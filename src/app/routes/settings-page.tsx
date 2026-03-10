import { useState } from 'react'
import { BellRing, LogOut, ShieldCheck } from 'lucide-react'
import { AppShell } from '../../components/layout/app-shell'
import { Button } from '../../components/ui/button'
import { usePushNotifications } from '../../features/notifications/hooks'
import { env } from '../../lib/env'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth-store'

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const [isBusy, setIsBusy] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const notifications = usePushNotifications(user?.id)

  const handleSignOut = async () => {
    setIsBusy(true)
    setSignOutError(null)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        setSignOutError(error.message)
      }
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <AppShell
      eyebrow="Preferences"
      title="Account and runtime configuration"
      description="这里先承载认证状态、主题控制和通知能力的基础说明，后续会扩展为完整账号设置页。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="panel p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Authenticated user</div>
              <h3 className="mt-1 text-xl font-semibold">{user?.email ?? 'Unknown user'}</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Supabase host</div>
              <div className="mt-2 break-all text-sm font-semibold">{new URL(env.supabaseUrl).host}</div>
            </div>
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Session strategy</div>
              <div className="mt-2 text-sm">使用 PKCE + 持久化 session，支持 Magic Link 回跳恢复。</div>
            </div>
          </div>

          <div className="mt-6">
            <Button tone="danger" onClick={() => void handleSignOut()} disabled={isBusy}>
              <LogOut className="h-4 w-4" />
              {isBusy ? 'Signing out...' : 'Sign out'}
            </Button>
            {signOutError ? <div className="mt-3 text-sm text-[#d11f3e]">{signOutError}</div> : null}
          </div>
        </section>

        <section className="panel p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Notifications</div>
              <h3 className="mt-1 text-xl font-semibold">Web Push scaffold</h3>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm muted">
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Browser support</div>
              <div className="mt-2 text-sm font-semibold">{notifications.isSupported ? 'Supported' : 'Not supported'}</div>
            </div>
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Permission</div>
              <div className="mt-2 text-sm font-semibold">{notifications.permission}</div>
            </div>
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Subscription</div>
              <div className="mt-2 text-sm font-semibold">{notifications.isSubscribed ? 'Active' : 'Inactive'}</div>
            </div>
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">VAPID config</div>
              <div className="mt-2 text-sm font-semibold">{notifications.isConfigured ? 'Configured' : 'Missing VAPID key'}</div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void notifications.subscribe()} disabled={notifications.isBusy || !notifications.isSupported || !notifications.isConfigured}>
                {notifications.isBusy ? '处理中...' : '启用推送提醒'}
              </Button>
              <Button tone="secondary" onClick={() => void notifications.unsubscribe()} disabled={notifications.isBusy || !notifications.isSupported || !notifications.isSubscribed}>
                取消推送订阅
              </Button>
            </div>

            {notifications.error ? <div className="text-sm text-[#d11f3e]">{notifications.error}</div> : null}

            <p>订阅成功后，浏览器 Push Subscription 会写入 `push_subs` 表，为后续 Supabase Edge Function 与 `pg_cron` 链路提供目标设备信息。</p>
            <p>当前仅完成前端链路和 service worker 推送处理。真正的定时提醒下发仍需要服务端配置 VAPID 密钥和 Edge Function。</p>
          </div>
        </section>
      </div>
    </AppShell>
  )
}