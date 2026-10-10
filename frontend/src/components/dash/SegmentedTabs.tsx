import { cn } from '@/lib/utils'

export interface SegmentOption {
  key: string
  label: string
}

interface SegmentedTabsProps {
  options: SegmentOption[]
  value: string
  onChange: (key: string) => void
  className?: string
}

/** Core 2.0 segmentli sekmesi: gri hazne, aktif seçenek beyaz pill. */
export function SegmentedTabs({ options, value, onChange, className }: SegmentedTabsProps) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-full bg-subtle p-1', className)}>
      {options.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            'rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
            value === option.key ? 'bg-surface text-ink shadow-tile' : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
