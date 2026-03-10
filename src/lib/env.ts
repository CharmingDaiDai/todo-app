const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local.')
}

if (supabaseUrl === 'your-supabase-project-url' || supabasePublishableKey === 'your-supabase-publishable-key') {
  throw new Error('Supabase environment variables are still placeholders. Update .env.local before running the app.')
}

try {
  new URL(supabaseUrl)
} catch {
  throw new Error('VITE_SUPABASE_URL must be a valid absolute URL.')
}

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  vapidPublicKey:
    vapidPublicKey && vapidPublicKey !== 'your-web-push-vapid-public-key' ? vapidPublicKey : null,
} as const