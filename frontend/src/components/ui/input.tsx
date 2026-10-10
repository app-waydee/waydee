import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Core 2.0 alanı: hairline çerçeve, odakta koyulaşan kenar, dolgusuz beyaz zemin. */
export const fieldClasses = [
  'w-full rounded-xl border-2 border-line bg-surface font-semibold text-ink',
  'placeholder:font-medium placeholder:text-faint transition-colors',
  'focus:border-faint/60 focus:outline-none',
  'disabled:opacity-50 disabled:bg-subtle',
].join(' ')

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldClasses, 'h-12 px-4 text-sm', className)} {...props} />
  ),
)
Input.displayName = 'Input'
