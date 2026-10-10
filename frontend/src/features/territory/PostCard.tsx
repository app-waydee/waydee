import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Heart, MessageCircle, Send, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { useAuthStore, currentUserId, isAdmin } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { CommentResponse, PageResponse, PostResponse } from '@/types/api'

interface PostCardProps {
  post: PostResponse
  postsQueryKey: readonly unknown[]
}

export function PostCard({ post, postsQueryKey }: PostCardProps) {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [showComments, setShowComments] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [activeImage, setActiveImage] = useState(0)

  const patchPost = (patch: Partial<PostResponse>) => {
    // Hem tek sayfalı (PageResponse) hem sonsuz (InfiniteData — Keşfet) önbelleği destekler.
    queryClient.setQueryData<unknown>(postsQueryKey as readonly unknown[], (old: unknown) => {
      if (!old) return old
      const apply = (p: PostResponse) => (p.id === post.id ? { ...p, ...patch } : p)
      if (typeof old === 'object' && 'pages' in (old as Record<string, unknown>)) {
        const data = old as { pages: PageResponse<PostResponse>[]; pageParams: unknown[] }
        return { ...data, pages: data.pages.map((pg) => ({ ...pg, content: pg.content.map(apply) })) }
      }
      const page = old as PageResponse<PostResponse>
      return { ...page, content: page.content.map(apply) }
    })
  }

  /* Kaydetme: begeniyle AYNI iyimser desen. Ayri bir kanca yazmak yerine
     buradaki `patchPost` kullanilir - kartin kendi onbellek parcasini zaten o
     guncelliyor. */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (post.savedByMe) await api.delete(`/posts/${post.id}/save`)
      else await api.post(`/posts/${post.id}/save`)
    },
    onMutate: () =>
      patchPost({
        savedByMe: !post.savedByMe,
        saveCount: Math.max(0, post.saveCount + (post.savedByMe ? -1 : 1)),
      }),
    onError: () => patchPost({ savedByMe: post.savedByMe, saveCount: post.saveCount }),
    onSettled: () => {
      // "Kaydettiklerim" listesi sunucuda siralanir; iyimser eklenemez.
      void queryClient.invalidateQueries({ queryKey: ['saved-posts'] })
    },
  })

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (post.likedByMe) await api.delete(`/posts/${post.id}/like`)
      else await api.post(`/posts/${post.id}/like`)
    },
    onMutate: () => patchPost({ likedByMe: !post.likedByMe, likeCount: post.likeCount + (post.likedByMe ? -1 : 1) }),
    onError: (error) => {
      patchPost({ likedByMe: post.likedByMe, likeCount: post.likeCount })
      toast.error(apiErrorMessage(error))
    },
  })

  const commentsQuery = useQuery({
    queryKey: ['comments', post.id],
    queryFn: async () =>
      (await api.get<PageResponse<CommentResponse>>(`/posts/${post.id}/comments`, { params: { size: 50 } })).data,
    enabled: showComments,
  })

  const commentMutation = useMutation({
    mutationFn: async (body: string) => (await api.post<CommentResponse>(`/posts/${post.id}/comments`, { body })).data,
    onSuccess: (comment) => {
      setCommentBody('')
      queryClient.setQueryData<PageResponse<CommentResponse>>(['comments', post.id], (old) =>
        old ? { ...old, content: [...old.content, comment] } : old,
      )
      patchPost({ commentCount: post.commentCount + 1 })
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Yorum eklenemedi')),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      toast.success('Gönderi silindi')
      void queryClient.invalidateQueries({ queryKey: postsQueryKey as never })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  /**
   * Yorum silme.
   *
   * ⚠️ Yetki sunucudan gelen `canDelete` ile belirlenir (yorumu yazan ·
   * gönderi sahibi · admin); düğme yalnız o zaman çizilir. Silinen yorum
   * listeden çıkarılır ve sayaç düşürülür.
   */
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/comments/${commentId}`)
      return commentId
    },
    onSuccess: (commentId) => {
      queryClient.setQueryData<PageResponse<CommentResponse>>(['comments', post.id], (old) =>
        old ? { ...old, content: old.content.filter((c) => c.id !== commentId) } : old,
      )
      patchPost({ commentCount: Math.max(post.commentCount - 1, 0) })
      toast.success(t('comments.deleted'))
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('comments.deleteFailed'))),
  })

  const submitComment = (e: FormEvent) => {
    e.preventDefault()
    if (commentBody.trim()) commentMutation.mutate(commentBody.trim())
  }

  /* 🔴 Rol TOKEN'dan (19 Ağu 2026): `user.role` localStorage'dan geliyordu ve
     elle ADMIN yapılabiliyordu. Kimlik karşılaştırması da token'ın kimliğiyle.
     ⚠️ Bu yalnız DÜĞMEYİ gizler; silmeyi gerçekten engelleyen şey sunucudaki
     sahiplik kontrolüdür (`PostService`: "Bu gönderiyi silme yetkiniz yok"). */
  const myId = currentUserId()
  const canDelete = !!myId && (myId === post.author.id || isAdmin(user))

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 pb-3 md:p-5 md:pb-4">
        <div className="flex items-center gap-3">
          <Avatar src={post.author.avatarUrl} name={post.author.displayName} className="h-10 w-10" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{post.author.displayName}</p>
            <p className="text-xs font-medium text-faint">{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        {canDelete && (
          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate()} aria-label="Gönderiyi sil">
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        )}
      </div>

      {post.mediaUrls.length > 0 && (
        <div className="relative px-4 md:px-5">
          <img
            src={post.mediaUrls[activeImage]}
            alt={post.caption ?? 'Gönderi görseli'}
            className="aspect-[4/3] w-full rounded-2xl bg-subtle object-cover"
            loading="lazy"
          />
          {post.mediaUrls.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-scrim px-2.5 py-1.5 backdrop-blur">
              {post.mediaUrls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn('h-1.5 rounded-full transition-all', i === activeImage ? 'w-5 bg-white' : 'w-1.5 bg-white/50')}
                  aria-label={`Görsel ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 md:p-5">
        {/* 🔴 ANKET ve ETKİNLİK blokları KALDIRILDI (9 Ağu 2026, kullanıcı
            isteği). Daire artık bir "yer" değil kişinin mağazası; oy verilen
            anketler ve katılım toplayan etkinlikler o modelin kalıntısıydı.
            ⚠️ Sunucudaki `POLL`/`EVENT` türleri ve uçları DURUYOR: geçmiş
            gönderiler silinmemeli. Bu türdeki eski bir gönderi artık düz
            gönderi gibi çizilir — açıklaması görünür, oylama görünmez. */}
        {post.caption && <p className="mb-4 text-sm font-medium leading-relaxed">{post.caption}</p>}

        <div className="mt-4 flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 1.15 }}
            onClick={() => (user ? likeMutation.mutate() : toast.info('Beğenmek için giriş yap'))}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors',
              post.likedByMe ? 'bg-peach-soft text-danger' : 'bg-subtle text-muted hover:text-ink',
            )}
          >
            <Heart className={cn('h-4 w-4', post.likedByMe && 'fill-danger')} />
            {post.likeCount}
          </motion.button>
          <button
            onClick={() => setShowComments((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors',
              showComments ? 'bg-sky-soft text-accent' : 'bg-subtle text-muted hover:text-ink',
            )}
          >
            <MessageCircle className="h-4 w-4" />
            {post.commentCount}
          </button>
          {/* Kaydetme - begeni ve yorumla ayni sirada. Ayri bir yere koymak
              (ornegin ustteki ... menusune) kullanicinin onu bulmasini
              zorlastirirdi; referansta da ikisi yan yana. */}
          <motion.button
            whileTap={{ scale: 1.15 }}
            onClick={() => (user ? saveMutation.mutate() : toast.info(t('post.loginToSave')))}
            aria-pressed={post.savedByMe}
            aria-label={t('post.save')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors',
              post.savedByMe ? 'bg-subtle text-ink' : 'bg-subtle text-muted hover:text-ink',
            )}
          >
            <Bookmark className={cn('h-4 w-4', post.savedByMe && 'fill-current')} />
            {post.saveCount}
          </motion.button>
        </div>

        {showComments && (
          <div className="mt-5 space-y-3 border-t border-line pt-5">
            {commentsQuery.isLoading && <Spinner />}
            {commentsQuery.data?.content.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3">
                <Avatar src={comment.author.avatarUrl} name={comment.author.displayName} className="h-8 w-8" />
                <div className="min-w-0 flex-1 rounded-2xl bg-subtle px-4 py-2.5">
                  <p className="text-xs font-semibold">
                    {comment.author.displayName}
                    <span className="ml-1.5 font-medium text-faint">{timeAgo(comment.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 text-sm font-medium">{comment.body}</p>
                </div>
                {comment.canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('comments.deleteConfirm'))) {
                        deleteCommentMutation.mutate(comment.id)
                      }
                    }}
                    disabled={deleteCommentMutation.isPending}
                    aria-label={t('comments.delete')}
                    title={t('comments.delete')}
                    className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-peach-soft hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {commentsQuery.data?.content.length === 0 && (
              <p className="text-[13px] font-medium text-faint">{t('comments.empty')}</p>
            )}
            {user && (
              <form onSubmit={submitComment} className="flex items-center gap-2 pt-1">
                <Input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder={t('comments.placeholder')}
                  maxLength={500}
                  className="h-11"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  disabled={commentMutation.isPending || !commentBody.trim()}
                  aria-label={t('comments.title')}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

