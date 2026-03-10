import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type ReminderType = 'hour' | 'ten_minutes'

type TodoRow = {
  id: string
  user_id: string
  title: string
  due_date: string
}

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  auth: string
  p256dh: string
}

type ReminderRow = {
  todo_id: string
  reminder_type: ReminderType
  due_date: string
}

type PushDeliveryLogRow = {
  todo_id: string | null
  user_id: string | null
  push_subscription_id: string | null
  reminder_type: ReminderType | null
  status: 'sent' | 'failed' | 'subscription_removed' | 'skipped'
  endpoint: string | null
  error_message: string | null
  response_status: number | null
}

const HOUR_WINDOW_MINUTES = 60
const TEN_MINUTES_WINDOW = 10

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const cronPushToken = Deno.env.get('CRON_PUSH_TOKEN')
const vapidSubject = Deno.env.get('WEB_PUSH_VAPID_SUBJECT')
const vapidPublicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')

if (!supabaseUrl || !serviceRoleKey || !cronPushToken || !vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
  throw new Error('Missing required Edge Function secrets for push delivery.')
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function createReminderKey(todoId: string, reminderType: ReminderType, dueDate: string) {
  return `${todoId}:${reminderType}:${dueDate}`
}

function buildReminderTypes(dueDate: string): ReminderType[] {
  const diffInMinutes = Math.floor((new Date(dueDate).getTime() - Date.now()) / 60_000)
  const reminderTypes: ReminderType[] = []

  if (diffInMinutes > TEN_MINUTES_WINDOW && diffInMinutes <= HOUR_WINDOW_MINUTES) {
    reminderTypes.push('hour')
  }

  if (diffInMinutes > 0 && diffInMinutes <= TEN_MINUTES_WINDOW) {
    reminderTypes.push('ten_minutes')
  }

  return reminderTypes
}

function createNotificationPayload(todo: TodoRow, reminderType: ReminderType) {
  const minutesLabel = reminderType === 'hour' ? '1 小时内' : '10 分钟内'

  return {
    title: 'Deep Todo 到期提醒',
    body: `任务“${todo.title}”将在 ${minutesLabel} 到期。`,
    url: '/app',
    tag: `${todo.id}:${reminderType}`,
    icon: '/vite.svg',
    badge: '/vite.svg',
  }
}

async function removeInvalidSubscription(id: string) {
  await supabase.from('push_subs').delete().eq('id', id)
}

async function insertDeliveryLogs(logs: PushDeliveryLogRow[]) {
  if (logs.length === 0) {
    return
  }

  await supabase.from('push_delivery_logs').insert(logs)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (request.headers.get('x-cron-token') !== cronPushToken) {
    return new Response('Unauthorized', { status: 401 })
  }

  const nowIso = new Date().toISOString()
  const oneHourLaterIso = new Date(Date.now() + HOUR_WINDOW_MINUTES * 60_000).toISOString()

  const { data: todos, error: todosError } = await supabase
    .from('todos')
    .select('id, user_id, title, due_date')
    .eq('status', 'pending')
    .not('due_date', 'is', null)
    .gt('due_date', nowIso)
    .lte('due_date', oneHourLaterIso)
    .order('due_date', { ascending: true })

  if (todosError) {
    return Response.json({ error: todosError.message }, { status: 500 })
  }

  const todoRows = (todos ?? []) as TodoRow[]

  if (todoRows.length === 0) {
    return Response.json({ sent: 0, skipped: 0, reason: 'no_due_todos' })
  }

  const todoIds = todoRows.map((todo) => todo.id)
  const userIds = [...new Set(todoRows.map((todo) => todo.user_id))]

  const [{ data: subscriptions, error: subscriptionsError }, { data: reminders, error: remindersError }] = await Promise.all([
    supabase.from('push_subs').select('id, user_id, endpoint, auth, p256dh').in('user_id', userIds),
    supabase.from('todo_reminders').select('todo_id, reminder_type, due_date').in('todo_id', todoIds),
  ])

  if (subscriptionsError) {
    return Response.json({ error: subscriptionsError.message }, { status: 500 })
  }

  if (remindersError) {
    return Response.json({ error: remindersError.message }, { status: 500 })
  }

  const existingReminders = new Set(
    ((reminders ?? []) as ReminderRow[]).map((reminder) => createReminderKey(reminder.todo_id, reminder.reminder_type, reminder.due_date)),
  )

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>()

  for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
    const bucket = subscriptionsByUser.get(subscription.user_id) ?? []
    bucket.push(subscription)
    subscriptionsByUser.set(subscription.user_id, bucket)
  }

  const reminderRowsToInsert: Array<{ todo_id: string; user_id: string; reminder_type: ReminderType; due_date: string }> = []
  const deliveryLogs: PushDeliveryLogRow[] = []
  let sentCount = 0
  let skippedCount = 0

  for (const todo of todoRows) {
    const dueReminderTypes = buildReminderTypes(todo.due_date)

    if (dueReminderTypes.length === 0) {
      skippedCount += 1
      deliveryLogs.push({
        todo_id: todo.id,
        user_id: todo.user_id,
        push_subscription_id: null,
        reminder_type: null,
        status: 'skipped',
        endpoint: null,
        error_message: 'Todo does not fall into an active reminder window.',
        response_status: null,
      })
      continue
    }

    const userSubscriptions = subscriptionsByUser.get(todo.user_id) ?? []

    if (userSubscriptions.length === 0) {
      skippedCount += dueReminderTypes.length

      for (const reminderType of dueReminderTypes) {
        deliveryLogs.push({
          todo_id: todo.id,
          user_id: todo.user_id,
          push_subscription_id: null,
          reminder_type: reminderType,
          status: 'skipped',
          endpoint: null,
          error_message: 'No active browser subscriptions found for user.',
          response_status: null,
        })
      }

      continue
    }

    for (const reminderType of dueReminderTypes) {
      const reminderKey = createReminderKey(todo.id, reminderType, todo.due_date)

      if (existingReminders.has(reminderKey)) {
        skippedCount += 1
        deliveryLogs.push({
          todo_id: todo.id,
          user_id: todo.user_id,
          push_subscription_id: null,
          reminder_type: reminderType,
          status: 'skipped',
          endpoint: null,
          error_message: 'Reminder already recorded for this due date and window.',
          response_status: null,
        })
        continue
      }

      const payload = createNotificationPayload(todo, reminderType)
      let delivered = false

      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            },
            JSON.stringify(payload),
          )

          delivered = true
          deliveryLogs.push({
            todo_id: todo.id,
            user_id: todo.user_id,
            push_subscription_id: subscription.id,
            reminder_type: reminderType,
            status: 'sent',
            endpoint: subscription.endpoint,
            error_message: null,
            response_status: 201,
          })
        } catch (pushError) {
          const statusCode =
            typeof pushError === 'object' && pushError !== null && 'statusCode' in pushError
              ? Number(Reflect.get(pushError, 'statusCode'))
              : null
          const errorMessage = pushError instanceof Error ? pushError.message : 'Unknown push delivery failure.'

          deliveryLogs.push({
            todo_id: todo.id,
            user_id: todo.user_id,
            push_subscription_id: subscription.id,
            reminder_type: reminderType,
            status: 'failed',
            endpoint: subscription.endpoint,
            error_message: errorMessage,
            response_status: statusCode,
          })

          if (typeof pushError === 'object' && pushError !== null && 'statusCode' in pushError) {
            if (statusCode === 404 || statusCode === 410) {
              await removeInvalidSubscription(subscription.id)
              deliveryLogs.push({
                todo_id: todo.id,
                user_id: todo.user_id,
                push_subscription_id: subscription.id,
                reminder_type: reminderType,
                status: 'subscription_removed',
                endpoint: subscription.endpoint,
                error_message: 'Subscription endpoint is invalid and has been removed.',
                response_status: statusCode,
              })
            }
          }
        }
      }

      if (delivered) {
        reminderRowsToInsert.push({
          todo_id: todo.id,
          user_id: todo.user_id,
          reminder_type: reminderType,
          due_date: todo.due_date,
        })
        existingReminders.add(reminderKey)
        sentCount += 1
      }
    }
  }

  if (reminderRowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from('todo_reminders').insert(reminderRowsToInsert)

    if (insertError) {
      return Response.json({ error: insertError.message, sent: sentCount, skipped: skippedCount }, { status: 500 })
    }
  }

  await insertDeliveryLogs(deliveryLogs)

  return Response.json({ sent: sentCount, skipped: skippedCount, scannedTodos: todoRows.length })
})