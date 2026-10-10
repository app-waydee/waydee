import { useState } from 'react'
import { profilePath } from '@/lib/profilePath'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  Eye,
  Heart,
  Image as ImageIcon,
  MapPin,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DashShell } from '@/components/dash'
import { USER_NAV } from '@/app/userNav'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardTitle } from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/spinner'
import { BarChart } from '@/components/charts/BarChart'
import { getMyReport } from '@/lib/analytics'
import { fmtArea, fmtMoney, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ReportResponse } from '@/types/api'

const PERIODS = [
  { days: 7, label: '7 gün' },
  { days: 14, label: '14 gün' },
  { days: 30, label: '30 gün' },
  { days: 90, label: '90 gün' },
]

/**
 * Raporlar — görüntülenme trendi, bölge kırılımı, kitle ve içerik etkileşimi.
 *
 * 29 Tem 2026'da baştan yazıldı: eski sayfa yalnız iki sayaç + okunmayan bir
 * grafik gösteriyordu (veri seyrek olunca grafik bomboş görünüyordu). Artık
 * dönem seçilebiliyor, önceki dönemle karşılaştırma yapılıyor ve rapor tek
 * uçtan (`/me/report`) besleniyor.
 */
export function ReportsPage() {
  const [days, setDays] = useState(14)
  const { data, isLoading } = useQuery({
    queryKey: ['my-report', days],
    queryFn: () => getMyReport(days),
  })

  return (
    <DashShell navItems={USER_NAV}>
      <div className="space-y-3">
        {/* Dönem seçimi */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                days === p.days ? 'bg-ink text-on-ink' : 'bg-surface text-muted shadow-card hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isLoading && <PageSpinner label="Rapor hazırlanıyor…" />}
        {data && <ReportBody report={data} />}
      </div>
    </DashShell>
  )
}

function ReportBody({ report: r }: { report: ReportResponse }) {
  return (
    <>
      {/* Ana sayaçlar */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Eye}
          tone="sky"
          label={`Görüntülenme (${r.days} gün)`}
          value={r.viewsInPeriod.toLocaleString('tr-TR')}
          delta={r.changePercent}
          hint={`Önceki dönem: ${r.viewsPrevPeriod.toLocaleString('tr-TR')}`}
        />
        <Stat
          icon={Users}
          tone="mint"
          label="Tekil ziyaretçi"
          value={r.uniqueViewers.toLocaleString('tr-TR')}
          hint={`Toplam ${r.totalViews.toLocaleString('tr-TR')} görüntülenme`}
        />
        <Stat
          icon={UserPlus}
          tone="lilac"
          label="Takipçi"
          value={r.followers.toLocaleString('tr-TR')}
          hint={r.pendingRequests > 0 ? `${r.pendingRequests} bekleyen istek` : `${r.following} takip`}
        />
        <Stat
          icon={Wallet}
          tone="sand"
          label="Portföy değeri"
          value={fmtMoney(r.portfolioValue, r.currency)}
          hint={`${r.territoryCount} bölge · ${fmtArea(r.totalAreaKm2)}`}
        />
      </div>

      {/* Günlük grafik */}
      <Card className="p-4 md:p-5">
        <CardTitle
          actions={
            r.busiestHour != null ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                <Clock className="h-3.5 w-3.5" /> En yoğun saat {String(r.busiestHour).padStart(2, '0')}:00
              </span>
            ) : undefined
          }
        >
          Günlük görüntülenme
        </CardTitle>
        <BarChart
          data={r.viewsByDay.map((d) => ({ label: shortDate(d.date), value: d.count, title: longDate(d.date) }))}
          emptyLabel={`Son ${r.days} günde görüntülenme yok — bölgen görüntülendikçe grafik dolar.`}
        />
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Haftanın günü dağılımı */}
        <Card className="p-4 md:p-5">
          <CardTitle>Haftanın günlerine göre</CardTitle>
          <BarChart
            data={r.viewsByWeekday.map((d) => ({ label: d.label, value: d.count }))}
            height={132}
            emptyLabel="Bu dönemde dağılım oluşacak kadar veri yok."
          />
        </Card>

        {/* İçerik etkileşimi */}
        <Card className="p-4 md:p-5">
          <CardTitle>İçerik ve etkileşim</CardTitle>
          {/*
            🔴 15 Ağu 2026 — "Yorum" kutusu KALDIRILDI (kullanıcı isteği:
            "şimdilik kaldır, ilerleyen süreçte kullanabiliriz").

            ⚠️ Yalnız bu görünüm kaldırıldı; sunucu `commentsReceived` alanını
            döndürmeye devam ediyor ve tip de onu bildiriyor. Geri getirmek tek
            satır — alanı sunucudan da sökmek, dönüşü olmayan bir iş olurdu.

            ⚠️ Kalan üç kutu `grid-cols-2` içinde tek başına bir öksüz bırakır;
            sonuncusu bilerek **iki sütuna yayılıyor** ki hücrede boşluk kalmasın.
          */}
          <div className="grid grid-cols-2 gap-2">
            <MiniStat icon={ImageIcon} label="Gönderi" value={r.postCount} hint={`${r.postsInPeriod} bu dönem`} />
            <MiniStat icon={Heart} label="Beğeni" value={r.likesReceived} hint="toplam alınan" />
            <div className="col-span-2">
              <MiniStat icon={Clock} label="Aktif hikaye" value={r.activeStories} hint="24 saat içinde" />
            </div>
          </div>
        </Card>
      </div>

      {/* Bölge kırılımı */}
      <Card className="p-4 md:p-5">
        <CardTitle>Bölge bazında görüntülenme</CardTitle>
        {r.territories.length === 0 ? (
          <Empty>Henüz bölgen yok.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {r.territories.map((t) => {
              const max = Math.max(1, ...r.territories.map((x) => x.views))
              return (
                <Link
                  key={t.territoryId}
                  to={`/t/${t.territoryId}`}
                  className="flex items-center gap-3 py-2.5 transition-opacity hover:opacity-70"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-subtle text-muted">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{t.name}</span>
                    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${(t.views / max) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold tabular-nums">{t.views}</span>
                    <span className="block text-[11px] font-medium text-faint">{t.uniqueViewers} kişi</span>
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* En çok görüntüleyenler */}
        <Card className="p-4 md:p-5">
          <CardTitle>En çok görüntüleyenler</CardTitle>
          {r.topViewers.length === 0 ? (
            <Empty>Bu dönemde görüntüleyen olmadı.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {r.topViewers.map((v) => (
                <Link
                  key={v.viewer.id}
                  to={profilePath(v.viewer)}
                  className="flex items-center gap-2.5 py-2 transition-opacity hover:opacity-70"
                >
                  <Avatar src={v.viewer.avatarUrl} name={v.viewer.displayName} className="h-8 w-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{v.viewer.displayName}</span>
                    <span className="block truncate text-[11px] font-medium text-faint">@{v.viewer.username}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                    {v.views}×
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Son görüntüleyenler */}
        <Card className="p-4 md:p-5">
          <CardTitle>Son görüntüleyenler</CardTitle>
          {r.recentViewers.length === 0 ? (
            <Empty>Henüz kimse bölgelerini görüntülemedi.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {r.recentViewers.slice(0, 8).map((row) => (
                <Link
                  key={row.viewer.id}
                  to={profilePath(row.viewer)}
                  className="flex items-center gap-2.5 py-2 transition-opacity hover:opacity-70"
                >
                  <Avatar src={row.viewer.avatarUrl} name={row.viewer.displayName} className="h-8 w-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{row.viewer.displayName}</span>
                    <span className="block truncate text-[11px] font-medium text-faint">@{row.viewer.username}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-muted">{timeAgo(row.viewedAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

const TONES = {
  sky: 'bg-sky',
  mint: 'bg-mint',
  lilac: 'bg-lilac',
  sand: 'bg-sand',
  peach: 'bg-peach',
} as const

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  delta,
}: {
  icon: LucideIcon
  tone: keyof typeof TONES
  label: string
  value: string
  hint?: string
  delta?: number | null
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', TONES[tone])}>
          <Icon className="h-4 w-4 text-ink" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-muted">{label}</p>
          <p className="truncate text-lg font-semibold leading-tight tracking-tight">{value}</p>
        </div>
        {delta != null && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold',
              delta >= 0 ? 'bg-mint-soft text-[#4f9e33]' : 'bg-peach-soft text-[#e2402a]',
            )}
          >
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(Math.round(delta))}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 truncate text-[11px] font-medium text-faint">{hint}</p>}
    </Card>
  )
}

function MiniStat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl bg-subtle p-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <p className="mt-0.5 text-base font-semibold leading-tight tracking-tight">{value.toLocaleString('tr-TR')}</p>
      <p className="text-[10px] font-medium text-faint">{hint}</p>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs font-medium text-faint">{children}</p>
}

/** 2026-07-28 → 28/07 */
function shortDate(iso: string) {
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso
}

function longDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}
