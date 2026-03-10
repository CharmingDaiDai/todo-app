import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './routes/protected-route'
import { RootLayout } from './routes/root-layout'

const DashboardPage = lazy(async () => {
  const module = await import('./routes/dashboard-page')
  return { default: module.DashboardPage }
})

const NotFoundPage = lazy(async () => {
  const module = await import('./routes/not-found-page')
  return { default: module.NotFoundPage }
})

const SettingsPage = lazy(async () => {
  const module = await import('./routes/settings-page')
  return { default: module.SettingsPage }
})

const SignInPage = lazy(async () => {
  const module = await import('./routes/sign-in-page')
  return { default: module.SignInPage }
})

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel w-full max-w-md p-8 text-center">
        <div className="text-xs uppercase tracking-[0.24em] muted">Deep Todo</div>
        <div className="mt-4 text-2xl font-semibold">正在加载页面…</div>
        <p className="mt-2 text-sm muted">路由已切换为按需加载，以降低首屏资源体积。</p>
      </div>
    </div>
  )
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/app" replace />,
      },
      {
        path: 'auth',
        element: withSuspense(<SignInPage />),
      },
      {
        path: 'app',
        element: withSuspense(
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'settings',
        element: withSuspense(
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: '*',
        element: withSuspense(<NotFoundPage />),
      },
    ],
  },
])