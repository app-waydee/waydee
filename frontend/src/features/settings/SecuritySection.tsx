import { useInfiniteQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, Globe2, Laptop, Monitor, Smartphone, Tablet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { fmtDateTime } from '@/lib/format'
import { useT } from '@/i18n'
import type { PageResponse } from '@/types/api'

/** Sunucudaki `MyLoginRow` ile birebir. */
interface MyLogin {
  id: string
  ip: string | null
  country: string | null
  device: string | null
  browser: string | null
  os: string | null
  surface: string
  success: boolean
  createdAt: string
}

const PAGE_SIZE = 20

function deviceIcon(device: string | null) {
  const key = (device ?? '').toLowerCase()
  if (key.includes('mobil') || key.includes('mobile') || key.includes('phone')) return Smartphone
  if (key.includes('tablet')) return Tablet
  if (key.includes('masa') || key.includes('desktop')) return Monitor
  return Laptop
}

/**
 * "Hesabıma nereden girildi?" — Ayarlar → Güvenlik.
 *
 * ⚠️ Başarısız denemeler de listelenir ve <b>ayrı işaretlenir</b>: birinin
 * hesabına girmeye çalıştığını görmek, başarılı girişleri görmek kadar
 * önemlidir. Kayıtlar sunucuda oturum sahibine göre süzülür (istekte kullanıcı
 * kimliği taşınmaz).
 */
export function SecuritySection() {
  const t = useT()

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['my-logins'],
      initialPageParam: 0,
      queryFn: async ({ pageParam }) =>
        (
          await api.get<PageResponse<MyLogin>>('/users/me/logins', {
            params: { page: pageParam, size: PAGE_SIZE },
          })
        ).data,
      getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
      staleTime: 30_000,
    })

  const rows = data?.pages.flatMap((p) => p.content) ?? []

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium leading-snug text-muted">{t('settings.securityDesc')}</p>

      {isLoading && (
        <div className="grid place-items-center py-8">
          <Spinner />
        </div>
      )}

      {isError && (
        <div className="rounded-2xl bg-peach-soft px-3.5 py-3">
          <p className="text-[13px] font-semibold text-danger">{t('common.retry')}</p>
          <Button variant="stroke" size="sm" className="mt-2" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <p className="rounded-2xl bg-subtle px-3.5 py-6 text-center text-[13px] font-medium text-muted">
          {t('settings.securityEmpty')}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {rows.map((row) => {
              const Icon = deviceIcon(row.device)
              return (
                <li key={row.id} className="flex items-start gap-3 px-3.5 py-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      row.success ? 'bg-subtle text-ink' : 'bg-peach-soft text-danger'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">
                      {row.browser || t('settings.deviceUnknown')}
                      {row.os && <span className="font-medium text-muted"> · {row.os}</span>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-medium text-faint">
                      {row.country && (
                        <span className="inline-flex items-center gap-1">
                          <Globe2 className="h-3 w-3" />
                          {row.country}
                        </span>
                      )}
                      {row.ip && (
                        <span>
                          {t('settings.ipLabel')} {row.ip}
                        </span>
                      )}
                      <span>{fmtDateTime(row.createdAt)}</span>
                    </p>
                  </div>
                  <span
                    className={`mt-1 inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold ${
                      row.success ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {row.success ? (
                      <>
                        <Check className="h-3 w-3" /> {t('settings.securitySuccess')}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" /> {t('settings.securityFailed')}
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>

          <p className="text-[11.5px] font-medium text-faint">{t('settings.securityCurrentHint')}</p>

          {hasNextPage && (
            <Button
              variant="stroke"
              size="sm"
              className="w-full justify-center"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? <Spinner /> : t('settings.loadMore')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
