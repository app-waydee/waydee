import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Core 2.0 kartı: saf beyaz, 24px yuvarlak, çerçevesiz, çok yumuşak gölge. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card bg-surface shadow-card', className)} {...props} />
}

interface CardTitleProps {
  children: ReactNode
  actions?: ReactNode
  className?: string
}

/** Kart başlığı: sade, kalın, sıkı harf aralıklı — referansta süs öğesi yok. */
export function CardTitle({ children, actions, className }: CardTitleProps) {
  return (
    <div className={cn('mb-5 flex items-center justify-between gap-3', className)}>
      <h2 className="text-xl font-semibold tracking-tight text-ink">{children}</h2>
      {actions}
    </div>
  )
}
