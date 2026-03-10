/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface DeepTodoRuntimeConfig {
	supabaseUrl?: string | null
	supabasePublishableKey?: string | null
	vapidPublicKey?: string | null
}

interface Window {
	__DEEP_TODO_RUNTIME_CONFIG__?: DeepTodoRuntimeConfig
}

interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL?: string
	readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
	readonly VITE_SUPABASE_ANON_KEY?: string
	readonly VITE_VAPID_PUBLIC_KEY?: string
}
