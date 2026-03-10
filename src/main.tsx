import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'

async function bootstrap() {
  try {
    const response = await fetch('/api/runtime-config', { cache: 'no-store' })

    if (response.ok) {
      window.__DEEP_TODO_RUNTIME_CONFIG__ = await response.json()
    }
  } catch {
    window.__DEEP_TODO_RUNTIME_CONFIG__ = window.__DEEP_TODO_RUNTIME_CONFIG__ ?? undefined
  }

  const { default: App } = await import('./App.tsx')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
