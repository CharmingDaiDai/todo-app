import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone
  block?: boolean
}

const toneClassMap: Record<ButtonTone, string> = {
  primary: 'bg-[var(--accent)] text-white hover:opacity-90',
  secondary: 'bg-[var(--surface-strong)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--accent-soft)]',
  ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--accent-soft)]',
  danger: 'bg-[#d11f3e] text-white hover:opacity-90',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, tone = 'primary', block = false, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold transition duration-200',
        toneClassMap[tone],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
})