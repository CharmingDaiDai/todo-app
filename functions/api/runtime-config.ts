type RuntimeConfig = {
  supabaseUrl: string | null
  supabasePublishableKey: string | null
  vapidPublicKey: string | null
}

type PagesEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_ANON_KEY?: string
  VAPID_PUBLIC_KEY?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_ANON_KEY?: string
  VITE_VAPID_PUBLIC_KEY?: string
}

export function onRequest(context: { env: PagesEnv }) {
  const config: RuntimeConfig = {
    supabaseUrl: context.env.SUPABASE_URL ?? context.env.VITE_SUPABASE_URL ?? null,
    supabasePublishableKey:
      context.env.SUPABASE_PUBLISHABLE_KEY ??
      context.env.SUPABASE_ANON_KEY ??
      context.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      context.env.VITE_SUPABASE_ANON_KEY ??
      null,
    vapidPublicKey: context.env.VAPID_PUBLIC_KEY ?? context.env.VITE_VAPID_PUBLIC_KEY ?? null,
  }

  return new Response(JSON.stringify(config), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, must-revalidate',
    },
  })
}