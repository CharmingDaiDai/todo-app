import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel w-full max-w-xl p-8 text-center">
        <div className="text-xs uppercase tracking-[0.22em] muted">404</div>
        <h1 className="mt-4 text-3xl font-semibold">This route is not mapped yet.</h1>
        <p className="mt-3 text-sm muted">当前项目已经切换到多路由应用壳，但这个路径还没有分配实际页面。</p>
        <Link to="/app" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}