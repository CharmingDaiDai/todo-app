import { useState } from 'react'
import { BellRing, CheckCircle2, Clock3, LogOut, ShieldCheck, Siren, TriangleAlert, XCircle } from 'lucide-react'
import { AppShell } from '../../components/layout/app-shell'
import { Button } from '../../components/ui/button'
import type { PushDeliveryLog, PushDeliveryLogStatus } from '../../features/notifications/api'
import { usePushDeliveryLogsQuery, usePushNotifications } from '../../features/notifications/hooks'
import { appRelease, formatVersionLabel } from '../../config/app-release'
import { env } from '../../lib/env'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth-store'

const deliveryStatusMeta: Record<
  PushDeliveryLogStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  sent: {
    label: '已发送',
    className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  failed: {
    label: '发送失败',
    className: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
    icon: XCircle,
  },
  subscription_removed: {
    label: '已清理失效订阅',
    className: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    icon: Siren,
  },
  skipped: {
    label: '已跳过',
    className: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
    icon: Clock3,
  },
}

const reminderTypeLabelMap = {
  hour: '提前 1 小时',
  ten_minutes: '提前 10 分钟',
  custom_date: '自定义时间',
} as const

function formatLogTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function describeLog(log: PushDeliveryLog) {
  if (log.errorMessage) {
    return log.errorMessage
  }

  if (log.responseStatus) {
    return `Push service responded with ${log.responseStatus}.`
  }

  return log.endpoint ? '已记录目标设备端点。' : '未记录额外错误信息。'
}

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const [isBusy, setIsBusy] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const notifications = usePushNotifications(user?.id)
  const deliveryLogs = usePushDeliveryLogsQuery(user?.id)

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
      title="Account and runtime configuration"
      description="在这里统一管理账号信息、通知能力、运行时配置与软件版本。"
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
            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Version strategy</div>
              <div className="mt-2 text-sm">版本号以 package.json 为唯一来源，设置页自动读取并展示；后续只需要更新一次语义化版本号即可同步到应用内。</div>
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
            <p>如果启用了推送但没有收到提醒，请先确认 Service Worker 已更新到最新版本，再检查 VAPID 与 Edge Function 配置。</p>
          </div>
        </section>

        <section className="panel p-6 xl:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Delivery audit</div>
              <h3 className="mt-1 text-xl font-semibold">最近推送投递记录</h3>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {deliveryLogs.isLoading ? <div className="panel-strong p-4 text-sm muted">正在加载最近的推送结果...</div> : null}

            {deliveryLogs.isError ? (
              <div className="panel-strong p-4 text-sm text-[#d11f3e]">{deliveryLogs.error instanceof Error ? deliveryLogs.error.message : '推送日志加载失败。'}</div>
            ) : null}

            {!deliveryLogs.isLoading && !deliveryLogs.isError && deliveryLogs.data?.length === 0 ? (
              <div className="panel-strong p-4 text-sm muted">当前还没有提醒投递记录。等 Edge Function 跑过一次后，这里会显示成功、失败和跳过原因。</div>
            ) : null}

            {deliveryLogs.data?.map((log: PushDeliveryLog) => {
              const meta = deliveryStatusMeta[log.status]
              const StatusIcon = meta.icon

              return (
                <article key={log.id} className="panel-strong space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{log.todoTitle ?? '未关联任务'}</div>
                      <div className="mt-1 text-xs muted">
                        {log.reminderType ? reminderTypeLabelMap[log.reminderType] : '非提醒窗口事件'}
                        {' · '}
                        {formatLogTime(log.createdAt)}
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {meta.label}
                    </div>
                  </div>

                  <div className="text-sm muted">{describeLog(log)}</div>

                  {log.responseStatus ? <div className="text-xs muted">HTTP status: {log.responseStatus}</div> : null}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </AppShell>
  )
}