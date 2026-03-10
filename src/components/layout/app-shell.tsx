import { motion } from 'framer-motion'
import { House, Settings, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState, type PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { ThemeSwitcher } from '../theme/theme-switcher'

type AppShellProps = PropsWithChildren<{
  eyebrow: string
  title: string
  description: string
}>

export function AppShell({ eyebrow, title, description, children }: AppShellProps) {
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine)

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
    <div className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 md:py-6 xl:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="ambient-orb left-0 top-10 h-64 w-64 bg-[var(--accent)]" />
        <div className="ambient-orb bottom-0 right-0 h-72 w-72 bg-[var(--accent-strong)]" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="panel flex flex-col gap-6 p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.22em] muted">Deep Todo</div>
            <div>
              <h1 className="text-2xl font-semibold">Build the immersive task hub.</h1>
              <p className="mt-2 text-sm muted">工程骨架已接入 Supabase、主题引擎与 PWA 配置。</p>
            </div>
          </div>

          <nav className="space-y-2">
            <NavLink to="/app" className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}>
              <House className="h-4 w-4" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </NavLink>
          </nav>

          <div className="panel-strong flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Network</div>
              <div className="mt-1 text-sm font-semibold">{isOnline ? 'Online sync' : 'Offline cache'}</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </div>
          </div>

          <ThemeSwitcher />
        </aside>

        <motion.main
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="space-y-6"
        >
          <section className="panel relative overflow-hidden p-6 md:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-[var(--border)]" />
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] muted">{eyebrow}</div>
                <h2 className="mt-2 text-3xl font-semibold md:text-4xl">{title}</h2>
                <p className="mt-3 max-w-2xl text-sm muted">{description}</p>
              </div>
              <div className="panel-strong inline-flex items-center gap-3 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                <span className="text-sm font-semibold">Phase 1 baseline complete</span>
              </div>
            </div>
          </section>

          {children}
        </motion.main>
      </div>
    </div>
  )
}