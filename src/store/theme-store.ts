import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DesignLanguage = 'zen' | 'glass' | 'brutal'
export type ColorMode = 'light' | 'dark'

type ThemeState = {
  language: DesignLanguage
  mode: ColorMode
  setLanguage: (language: DesignLanguage) => void
  setMode: (mode: ColorMode) => void
  toggleMode: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      language: 'zen',
      mode: 'light',
      setLanguage: (language) => set({ language }),
      setMode: (mode) => set({ mode }),
      toggleMode: () => set((state) => ({ mode: state.mode === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'deep-todo-theme',
    },
  ),
)