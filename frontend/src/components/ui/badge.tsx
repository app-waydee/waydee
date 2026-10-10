import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Core 2.0 rozeti: yumuşak pastel zemin + doygun metin, 8px yuvarlak. */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      tone: {
        success: 'bg-mint-soft text-[#4f9e33]',
        danger: 'bg-peach-soft text-[#e2402a]',
        info: 'bg-sky-soft text-[#0f78bd]',
        warning: 'bg-sand-soft text-[#b57200]',
        violet: 'bg-lilac-soft text-[#6c3ee8]',
        neutral: 'bg-subtle text-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
