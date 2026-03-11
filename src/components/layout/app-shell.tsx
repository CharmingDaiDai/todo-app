import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { House, LoaderCircle, Settings, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'

type AppShellProps = PropsWithChildren<{
  eyebrow: string
  title: string
  description: string
  mobileToolbar?: ReactNode
  hidePageHeader?: boolean
}>

const navItems = [
  { to: '/app', label: 'Dashboard', icon: House },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function AppShell({ eyebrow, title, description, mobileToolbar, hidePageHeader = false, children }: AppShellProps) {
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine)
  const activeMutationCount = useIsMutating()
  const activeQueryCount = useIsFetching()
  const isSyncing = activeMutationCount > 0
  const isRefreshing = activeQueryCount > 0
  const networkLabel = isOnline ? '在线' : '离线'
  const statusLabel = isSyncing ? `同步中 ${activeMutationCount}` : isRefreshing ? `刷新中 ${activeQueryCount}` : networkLabel

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="relative min-h-screen px-4 py-5 pb-28 md:px-6 md:py-6 md:pb-6 xl:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden panel flex-col gap-6 p-5 lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)]">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.22em] muted">Deep Todo</div>
            <div>
              <h1 className="text-2xl font-semibold">Keep work moving.</h1>
              <p className="mt-2 text-sm muted">任务优先的工作台。</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}>
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="inline-flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', isSyncing ? 'bg-[var(--accent)]/14 text-[var(--accent)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]')}>
              {isSyncing || isRefreshing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </div>
            <span>{statusLabel}</span>
          </div>
        </aside>

        <motion.main
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="space-y-6"
        >
          {hidePageHeader ? (
            mobileToolbar ? (
              <section className="panel mobile-shell-header overflow-hidden p-4 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">{mobileToolbar}</div>
                  <div
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--accent)]"
                    aria-label={statusLabel}
                    title={statusLabel}
                  >
                    {isSyncing || isRefreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  </div>
                </div>
                {isSyncing || isRefreshing ? <div className="mt-3 sync-pill"><span className="sync-pill-dot" /> {isSyncing ? '正在与 Supabase 同步更改' : '正在后台刷新最新数据'}</div> : null}
              </section>
            ) : null
          ) : (
            <>
              <section className="panel mobile-shell-header overflow-hidden p-5 lg:hidden">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-[0.22em] muted">{eyebrow}</div>
                    <div className="mt-2 text-2xl font-semibold">{title}</div>
                  </div>
                  <div
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--accent)]"
                    aria-label={statusLabel}
                    title={statusLabel}
                  >
                    {isSyncing || isRefreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  </div>
                </div>
                {isSyncing || isRefreshing ? <div className="mt-4 sync-pill"><span className="sync-pill-dot" /> {isSyncing ? '正在与 Supabase 同步更改' : '正在后台刷新最新数据'}</div> : null}

                {mobileToolbar ? <div className="mt-4">{mobileToolbar}</div> : null}
              </section>

              <section className="panel relative overflow-hidden p-6 md:p-8">
                <div className="absolute inset-x-0 top-0 h-px bg-[var(--border)]" />
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] muted">{eyebrow}</div>
                    <h2 className="mt-2 text-3xl font-semibold md:text-4xl">{title}</h2>
                    <p className="mt-3 max-w-2xl text-sm muted">{description}</p>
                  </div>
                  <div
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--accent)]"
                    aria-label={statusLabel}
                    title={statusLabel}
                  >
                    {isSyncing || isRefreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-[#d11f3e]" />}
                  </div>
                </div>
                {isSyncing || isRefreshing ? <div className="mt-4 sync-pill"><span className="sync-pill-dot" /> {isSyncing ? '正在与 Supabase 同步更改' : '正在后台刷新最新数据'}</div> : null}
              </section>
            </>
          )}

          {children}
        </motion.main>
      </div>

      <nav className="mobile-tabbar lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => cn('mobile-tab', isActive && 'mobile-tab-active')}>
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}