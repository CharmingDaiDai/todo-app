import { supabase } from '../../lib/supabase'

export type PushSubscriptionRecord = {
  endpoint: string
  auth: string
  p256dh: string
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