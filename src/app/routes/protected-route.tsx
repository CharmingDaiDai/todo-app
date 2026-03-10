import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth-store'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const status = useAuthStore((state) => state.status)

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel w-full max-w-md p-8 text-center">
          <div className="text-xs uppercase tracking-[0.24em] muted">Deep Todo</div>
          <div className="mt-4 text-2xl font-semibold">正在恢复会话…</div>
          <p className="mt-2 text-sm muted">Supabase 会话状态与本地主题偏好正在同步。</p>
        </div>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}