import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '../../lib/cn'
import { useToastStore, type ToastItem } from '../../store/toast-store'

const toneIconMap: Record<ToastItem['tone'], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
}

const toneClassMap: Record<ToastItem['tone'], string> = {
  success: 'border-[#2f8f58]/24 bg-[#2f8f58]/10 text-[#2f8f58]',
  error: 'border-[#d11f3e]/24 bg-[#d11f3e]/10 text-[#d11f3e]',
  info: 'border-[var(--accent)]/24 bg-[var(--accent)]/10 text-[var(--accent)]',
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id)
      }, toast.tone === 'error' ? 5200 : 3200),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [dismissToast, toasts])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-4 sm:justify-end sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = toneIconMap[toast.tone]

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="pointer-events-auto panel overflow-hidden p-0"
              >
                <div className="flex items-start gap-3 p-4">
                  <div className={cn('mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', toneClassMap[toast.tone])}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</div>
                    {toast.message ? <div className="mt-1 text-sm muted">{toast.message}</div> : null}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
                    onClick={() => dismissToast(toast.id)}
                    aria-label="关闭提示"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}