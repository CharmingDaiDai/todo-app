import { keepPreviousData, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type PropsWithChildren } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth-store'
import { useThemeStore } from '../store/theme-store'

function useThemeBootstrap() {
  const language = useThemeStore((state) => state.language)
  const mode = useThemeStore((state) => state.mode)

  useEffect(() => {
    document.documentElement.dataset.language = language
    document.documentElement.dataset.mode = mode
  }, [language, mode])
}

function useAuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession)

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [setSession])
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            placeholderData: keepPreviousData,
          },
        },
      }),
  )

  useThemeBootstrap()
  useAuthBootstrap()

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}