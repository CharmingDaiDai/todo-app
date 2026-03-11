import { useState } from 'react'
import { BellRing, Clock3, LogOut, ShieldCheck } from 'lucide-react'
import { AppShell } from '../../components/layout/app-shell'
import { Button } from '../../components/ui/button'
import { usePushNotifications } from '../../features/notifications/hooks'
import { TagManagerSection } from '../../features/todos/components/tag-manager-section'
import { appRelease, formatVersionLabel } from '../../config/app-release'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth-store'

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const [isBusy, setIsBusy] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
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

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true)
    setUpdateFeedback(null)

    try {
      if (!('serviceWorker' in navigator)) {
        setUpdateFeedback('当前浏览器不支持 Service Worker，无法执行更新检查。')
        return
      }

      const registration = await navigator.serviceWorker.getRegistration()

      if (!registration) {
        setUpdateFeedback('当前页面还没有可用的 Service Worker 注册。')
        return
      }

      await registration.update()

      if (registration.waiting) {
        setUpdateFeedback('发现新版本，刷新页面即可切换到最新版本。')
        return
      }

      setUpdateFeedback('已检查完成，当前已是最新版本。')
    } catch (error) {
      setUpdateFeedback(error instanceof Error ? error.message : '更新检查失败。')
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  return (
    <AppShell
      eyebrow="Preferences"
      title="Account and settings"
      description="在这里处理账号、推送提醒和版本更新，不再暴露底层接入细节。"
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
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Software release</div>
              <h3 className="mt-1 text-xl font-semibold">版本与更新</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Current release</div>
              <div className="mt-2 text-sm font-semibold">{formatVersionLabel(appRelease.version, appRelease.channel)}</div>
              <div className="mt-2 text-sm muted">{appRelease.codename} · {appRelease.summary}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button tone="secondary" onClick={() => void handleCheckUpdate()} disabled={isCheckingUpdate}>
              {isCheckingUpdate ? '检查中...' : '检查更新'}
            </Button>
            <Button tone="secondary" onClick={() => window.location.reload()}>
              刷新到最新版本
            </Button>
          </div>

          {updateFeedback ? <div className="mt-4 text-sm muted">{updateFeedback}</div> : null}
        </section>

        <section className="panel p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Notifications</div>
              <h3 className="mt-1 text-xl font-semibold">推送提醒</h3>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Current status</div>
              <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {!notifications.isSupported
                  ? '当前浏览器不支持推送提醒'
                  : !notifications.isConfigured
                    ? '当前环境尚未完成推送配置'
                    : notifications.isSubscribed
                      ? '推送提醒已启用'
                      : '推送提醒未启用'}
              </div>
              <div className="mt-2 text-sm muted">
                {notifications.isSubscribed ? '任务提醒会直接发送到当前设备。' : '启用后可在到期前收到任务提醒。'}
              </div>
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
          </div>
        </section>

        <TagManagerSection userId={user?.id} />
      </div>
    </AppShell>
  )
}