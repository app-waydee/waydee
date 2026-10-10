import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

export type PastelTone = 'mint' | 'lilac' | 'sky' | 'peach' | 'sand'

const TILE_CLASSES: Record<PastelTone, string> = {
  mint: 'bg-mint',
  lilac: 'bg-lilac',
  sky: 'bg-sky',
  peach: 'bg-peach',
  sand: 'bg-sand',
}

interface DashStatProps {
  icon: LucideIcon
  tone: PastelTone
  label: string
  value: string
  hint?: string
  className?: string
}

/**
 * Core 2.0 istatistik kartı: pastel ikon karosu, yanında etiket ve sayı.
 *
 * 28 Tem 2026: kart **yatay ve daha sıkı** düzene alındı (eskiden ikon üstte,
 * sayı 32px'ti ve kartlar ekranı domine ediyordu). Aynı bilgiyi ~%40 daha az
 * dikey alanda gösterir; panelde birden çok kart yan yana rahat durur.
 */
export function DashStat({ icon: Icon, tone, label, value, hint, className }: DashStatProps) {
  return (
    <Card className={cn('flex items-center gap-3 p-3.5 md:p-4', className)}>
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', TILE_CLASSES[tone])}>
        <Icon className="h-4.5 w-4.5 text-ink" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="truncate text-xl font-semibold leading-tight tracking-tight" title={value}>
          {value}
        </p>
        {hint && <p className="mt-0.5 text-[11px] font-medium text-faint">{hint}</p>}
      </div>
    </Card>
  )
}
