import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent', className)}
      role="status"
      aria-label="Yükleniyor"
    />
  )
}

export function PageSpinner({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-56 flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="h-7 w-7" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}
