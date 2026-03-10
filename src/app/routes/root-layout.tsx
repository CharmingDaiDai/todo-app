import { Outlet } from 'react-router-dom'

export function RootLayout() {
  return (
    <div className="relative min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="dot-grid absolute inset-0 opacity-25" />
      </div>
      <div className="relative z-10">
        <Outlet />
      </div>
    </div>
  )
}