import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastItem = {
  id: string
  title: string
  message?: string
  tone: ToastTone
}

type ToastStore = {
  toasts: ToastItem[]
  pushToast: (toast: Omit<ToastItem, 'id'>) => string
  dismissToast: (id: string) => void
}

function createToastId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = createToastId()

    set((state) => ({
      toasts: [{ id, ...toast }, ...state.toasts].slice(0, 4),
    }))

    return id
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },
}))

export function pushToast(toast: Omit<ToastItem, 'id'>) {
  return useToastStore.getState().pushToast(toast)
}

export function pushSuccessToast(title: string, message?: string) {
  return pushToast({ tone: 'success', title, message })
}

export function pushErrorToast(title: string, message?: string) {
  return pushToast({ tone: 'error', title, message })
}

export function pushInfoToast(title: string, message?: string) {
  return pushToast({ tone: 'info', title, message })
}