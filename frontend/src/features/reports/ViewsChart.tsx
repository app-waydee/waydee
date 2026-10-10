import type { DayCount } from '@/types/api'

/** Core 2.0 diline uygun, bağımlılıksız bar grafik (görüntülenme/gün). */
export function ViewsChart({ data }: { data: DayCount[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5">
        {data.map((d) => {
          const pct = (d.count / max) * 100
          return (
            <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] font-bold text-ink opacity-0 transition-opacity group-hover:opacity-100">
                {d.count}
              </span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-accent to-violet transition-all group-hover:brightness-110"
                style={{ height: `${Math.max(pct, d.count > 0 ? 6 : 2)}%`, opacity: d.count > 0 ? 1 : 0.22 }}
                title={`${label(d.date)} · ${d.count} görüntülenme`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d, i) => (
          <span key={d.date} className="flex-1 text-center text-[10px] font-medium text-faint">
            {i % 3 === 0 ? label(d.date) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function label(iso: string) {
  const parts = iso.split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso
}
