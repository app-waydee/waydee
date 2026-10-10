import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Core 2.0 butonu: pill form, kalın 15px metin, yumuşak renk geçişi.
 * primary → siyah CTA · accent → mavi · stroke → beyaz + hairline çerçeve
 *
 * ⚠️ `bg-ink` bir yüzeyin ÜSTÜNDEKİ butonlar için `inverse` / `inverse-stroke`
 * kullan. `variant="stroke"` + elle `text-on-ink` yazmak okunmaz sonuç verir:
 * stroke zaten `bg-surface` getirir, `text-on-ink` de o zeminle aynı tonda kalır
 * (ölçüldü: koyu temada bg #1a1d1f üstüne metin #111315). Bu iki varyant
 * zemini ve metni birlikte çevirdiği için iki temada da güvenlidir.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold',
    'transition-colors duration-150 select-none cursor-pointer whitespace-nowrap',
    'disabled:opacity-40 disabled:pointer-events-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-ink text-on-ink hover:bg-ink/85',
        accent: 'bg-accent text-white hover:bg-accent-strong',
        stroke: 'bg-surface text-ink border-2 border-line hover:border-faint/50',
        // `bg-ink` zeminde okunur ikili: zemin de metin de tema ile birlikte döner.
        inverse: 'bg-on-ink text-ink hover:bg-on-ink/85',
        'inverse-stroke':
          'bg-transparent text-on-ink border-2 border-on-ink/35 hover:bg-on-ink/12 hover:border-on-ink/55',
        success: 'bg-success text-white hover:brightness-95',
        danger: 'bg-danger text-white hover:brightness-95',
        subtle: 'bg-subtle text-ink hover:bg-line',
        ghost: 'text-muted hover:bg-subtle hover:text-ink',
      },
      size: {
        sm: 'h-9 px-4 text-[13px]',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-7 text-[15px]',
        icon: 'h-10 w-10 px-0',
        'icon-sm': 'h-8 w-8 px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
