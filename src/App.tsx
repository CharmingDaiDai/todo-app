import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { router } from './app/router'
import { ToastViewport } from './components/ui/toast-viewport'

function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <ToastViewport />
    </AppProviders>
  )
}

export default App
