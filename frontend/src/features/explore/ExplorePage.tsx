import { useInfiniteQuery } from '@tanstack/react-query'
import { Compass } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageSpinner, Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { PostCard } from '@/features/territory/PostCard'
import type { PageResponse, PostResponse } from '@/types/api'
import { useT } from '@/i18n'

const EXPLORE_KEY = ['explore'] as const

/**
 * Keşfet: gizli olmayan hesapların gönderileri, en yeniden eskiye.
 * Şimdilik algoritma yok — düz herkese açık akış (madde 8).
 */
export function ExplorePage() {
  const t = useT()
  const query = useInfiniteQuery({
    queryKey: EXPLORE_KEY,
    queryFn: async ({ pageParam }) =>
      (await api.get<PageResponse<PostResponse>>('/explore', { params: { page: pageParam, size: 10 } })).data,
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  })

  const posts = query.data?.pages.flatMap((p) => p.content) ?? []

  return (
    <div className="min-h-full bg-canvas pb-8">
      <div className="mx-auto max-w-2xl px-4 md:px-6">
        <h1 className="mb-4 mt-2 text-2xl font-semibold tracking-tight">{t('feed.exploreTitle')}</h1>

        {query.isLoading && <PageSpinner label={t('feed.exploreLoading')} />}

        {!query.isLoading && posts.length === 0 && (
          <Card className="p-10 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-lilac-soft text-violet">
              <Compass className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold tracking-tight">{t('feed.exploreEmpty')}</p>
            <p className="mt-1.5 text-sm font-medium text-muted">
              Kullanıcılar paylaştıkça herkese açık gönderiler burada akar.
            </p>
          </Card>
        )}

        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} postsQueryKey={EXPLORE_KEY} />
          ))}
        </div>

        {query.hasNextPage && (
          <div className="mt-6 text-center">
            <Button
              variant="stroke"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? <Spinner /> : 'Daha fazla göster'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
