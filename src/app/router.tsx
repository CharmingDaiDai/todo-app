import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DashboardPage } from './routes/dashboard-page'
import { NotFoundPage } from './routes/not-found-page'
import { ProtectedRoute } from './routes/protected-route'
import { RootLayout } from './routes/root-layout'
import { SettingsPage } from './routes/settings-page'
import { SignInPage } from './routes/sign-in-page'

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
        element: <SignInPage />,
      },
      {
        path: 'app',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])