import { useState } from 'react'
import { BellRing, LogOut, ShieldCheck } from 'lucide-react'
import { AppShell } from '../../components/layout/app-shell'
import { Button } from '../../components/ui/button'
import { env } from '../../lib/env'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth-store'

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const [isBusy, setIsBusy] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

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
            <p>前端现在已经具备 PWA 与登录基线。下一阶段会补浏览器通知授权、Push Subscription 注册和 push_subs 表写入。</p>
            <p>服务端链路将由 Supabase Edge Functions 与 pg_cron 接管，触发即将到期任务的系统级通知。</p>
          </div>
        </section>
      </div>
    </AppShell>
  )
}