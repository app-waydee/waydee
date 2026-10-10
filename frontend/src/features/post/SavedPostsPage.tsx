import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bookmark, ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { PageResponse, PostResponse } from '@/types/api'

type Tab = 'saved' | 'liked'

/**
 * <b>Kaydettiklerim / Beğendiklerim</b> (`/saved`).
 *
 * <p>🔴 Düzen kullanıcının verdiği ekran görüntüsündeki gibi: üstte
 * <b>hap sekmeler</b> (seçili olan dolu koyu, diğeri sessiz), altında
 * <b>ızgara</b>, en altta <b>sayfa numaraları</b>.
 *
 * <p>⚠️ Sekme URL'de tutulur (`/saved?t=liked`): kullanıcı bir gönderiye girip
 * geri geldiğinde aynı sekmede kalmalı. State'te tutulsaydı geri tuşu her
 * seferinde "kaydettiklerim"e düşürürdü.
 *
 * <p>⚠️ İki liste <b>ayrı sorgu anahtarları</b> kullanır ve sayfa numarası
 * sekme değişince <b>sıfırlanır</b>: 3. sayfada kaydettiklerimden beğendiklerime
 * geçen kullanıcı, beğenisi 3 sayfa tutmuyorsa boş ekranla karşılaşırdı.
 *
 * <p>⚠️ `keepPreviousData`: sayfa değişirken ızgara boşalıp yeniden dolmaz,
 * yükseklik zıplaması olmaz.
 */
export function SavedPostsPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('t') === 'liked' ? 'liked' : 'saved'
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: [tab === 'saved' ? 'saved-posts' : 'liked-posts', page],
    queryFn: async () =>
      (
        await api.get<PageResponse<PostResponse>>(
          `/users/me/${tab === 'saved' ? 'saved' : 'liked'}-posts`,
          { params: { page, size: 12 } },
        )
      ).data,
    placeholderData: keepPreviousData,
  })

  const select = (next: Tab) => {
    setPage(0)
    setParams(next === 'saved' ? {} : { t: next })
  }

  const items = data?.content ?? []
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* --- hap sekmeler --- */}
      <div className="flex items-center justify-center gap-2">
        <TabPill active={tab === 'saved'} onClick={() => select('saved')} icon={Bookmark}>
          {t('saved.savedTab')}
        </TabPill>
        <TabPill active={tab === 'liked'} onClick={() => select('liked')} icon={Heart}>
          {t('saved.likedTab')}
        </TabPill>
      </div>

      {isLoading && !data ? (
        <PageSpinner label={t('feed.loading')} />
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-subtle text-muted">
            {tab === 'saved' ? <Bookmark className="h-5 w-5" /> : <Heart className="h-5 w-5" />}
          </span>
          <p className="text-[15px] font-semibold">
            {tab === 'saved' ? t('saved.emptySaved') : t('saved.emptyLiked')}
          </p>
          <p className="mt-1 text-[13px] text-muted">{t('saved.emptyHint')}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((post) => (
              <Link
                key={post.id}
                to={`/posts/${post.id}`}
                className="group relative overflow-hidden rounded-[11.2px] bg-subtle"
                style={{ aspectRatio: '4 / 5' }}
              >
                {post.mediaUrls[0] && (
                  <img
                    src={post.mediaUrls[0]}
                    alt={post.caption ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                )}
                {/* Sayılar görselin üstünde: ızgarada satır yüksekliğini
                    değiştirmeden bilgi verir. */}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2 text-[12px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {post.likeCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bookmark className="h-3.5 w-3.5" /> {post.saveCount}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {/* --- sayfa numaraları (referans ekrandaki gibi) --- */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-1.5">
              <PageBtn disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  aria-current={i === page ? 'page' : undefined}
                  className={cn(
                    'h-9 min-w-9 rounded-[11.2px] px-2 text-[13px] font-semibold transition-colors',
                    i === page ? 'bg-ink text-on-ink' : 'bg-subtle text-muted hover:text-ink',
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <PageBtn
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </PageBtn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TabPill({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Heart
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wide transition-colors',
        active ? 'bg-surface text-ink shadow-float' : 'text-muted hover:text-ink',
      )}
    >
      <Icon className={cn('h-4 w-4', active && 'fill-current')} />
      {children}
    </button>
  )
}

function PageBtn({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-[11.2px] bg-subtle text-muted transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  )
}
