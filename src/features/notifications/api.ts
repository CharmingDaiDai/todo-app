import { supabase } from '../../lib/supabase'

export type PushSubscriptionRecord = {
  endpoint: string
  auth: string
  p256dh: string
}

export type PushDeliveryLogStatus = 'sent' | 'failed' | 'subscription_removed' | 'skipped'

export type PushDeliveryLog = {
  id: string
  todoId: string | null
  todoTitle: string | null
  reminderType: 'hour' | 'ten_minutes' | null
  status: PushDeliveryLogStatus
  endpoint: string | null
  errorMessage: string | null
  responseStatus: number | null
  createdAt: string
}

export async function upsertPushSubscription(userId: string, subscription: PushSubscriptionRecord) {
  const { error } = await supabase.from('push_subs').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      auth: subscription.auth,
      p256dh: subscription.p256dh,
    },
    {
      onConflict: 'user_id,endpoint',
    },
  )

  if (error) {
    throw error
  }
}

export async function deletePushSubscription(endpoint: string) {
  const { error } = await supabase.from('push_subs').delete().eq('endpoint', endpoint)

  if (error) {
    throw error
  }
}

export async function listPushDeliveryLogs(userId: string, limit = 12) {
  const { data, error } = await supabase
    .from('push_delivery_logs')
    .select(
      `
        id,
        todo_id,
        reminder_type,
        status,
        endpoint,
        error_message,
        response_status,
        created_at,
        todos:todos(title)
      `,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => {
    const todoRelation = Array.isArray(row.todos) ? row.todos[0] : row.todos

    return {
      id: row.id,
      todoId: row.todo_id,
      todoTitle: todoRelation?.title ?? null,
      reminderType: row.reminder_type,
      status: row.status,
      endpoint: row.endpoint,
      errorMessage: row.error_message,
      responseStatus: row.response_status,
      createdAt: row.created_at,
    } satisfies PushDeliveryLog
  })
}