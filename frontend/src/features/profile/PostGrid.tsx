import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { BarChart3, CalendarDays, Camera, Heart, Images, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageSpinner, Spinner } from '@/components/ui/spinner'
import { Dialog } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PostCard } from '@/features/territory/PostCard'
import type { PageResponse, PostResponse } from '@/types/api'

/**
 * Instagram tarzı gönderi ızgarası: 3 sütun kare kapaklar, üzerine gelince
 * beğeni/yorum sayıları; tıklayınca gönderi tam kart olarak açılır.
 */
export function PostGrid({ userId }: { userId: string }) {
  const [openPost, setOpenPost] = useState<PostResponse | null>(null)
  const queryKey = ['user-posts', userId] as const

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<PageResponse<PostResponse>>(`/users/${userId}/posts`, {
          params: { page: pageParam, size: 12 },
        })
      ).data,
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled: !!userId,
  })

  const posts = query.data?.pages.flatMap((p) => p.content) ?? []

  if (query.isLoading) return <PageSpinner label="Gönderiler yükleniyor…" />

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 grid h-16 w-16 place-items-center rounded-full border-2 border-line text-faint">
          <Camera className="h-7 w-7" />
        </span>
        <p className="text-lg font-semibold tracking-tight">Henüz gönderi yok</p>
        <p className="mt-1 text-sm font-medium text-muted">Bölgenden paylaştıkların burada görünür.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5 md:gap-1">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => setOpenPost(post)}
            className="group relative aspect-square overflow-hidden bg-subtle"
            aria-label="Gönderiyi aç"
          >
            {post.mediaUrls.length > 0 ? (
              <img src={post.mediaUrls[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] font-medium leading-snug text-muted md:text-[13px]">
                <span className="line-clamp-4">{post.caption ?? '—'}</span>
              </span>
            )}

            {/* Tür göstergesi */}
            {(post.kind !== 'STANDARD' || post.mediaUrls.length > 1) && (
              <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-scrim text-white">
                {post.kind === 'POLL' ? (
                  <BarChart3 className="h-3.5 w-3.5" />
                ) : post.kind === 'EVENT' ? (
                  <CalendarDays className="h-3.5 w-3.5" />
                ) : (
                  <Images className="h-3.5 w-3.5" />
                )}
              </span>
            )}

            {/* Hover katmanı (masaüstü) */}
            <span
              className={cn(
                'absolute inset-0 hidden items-center justify-center gap-4 bg-scrim text-sm font-semibold text-white',
                'md:flex md:opacity-0 md:transition-opacity md:group-hover:opacity-100',
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Heart className="h-4 w-4 fill-white" /> {post.likeCount}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 fill-white" /> {post.commentCount}
              </span>
            </span>
          </button>
        ))}
      </div>

      {query.hasNextPage && (
        <div className="py-5 text-center">
          <Button variant="stroke" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? <Spinner /> : 'Daha fazla'}
          </Button>
        </div>
      )}

      {openPost && (
        <Dialog open onClose={() => setOpenPost(null)} className="max-w-xl">
          <PostCard post={openPost} postsQueryKey={queryKey} />
        </Dialog>
      )}
    </>
  )
}
