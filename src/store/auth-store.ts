import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthState = {
  session: Session | null
  user: User | null
  status: AuthStatus
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  status: 'loading',
  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'anonymous',
    })
  },
}))