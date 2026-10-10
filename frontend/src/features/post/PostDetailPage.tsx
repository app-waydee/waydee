import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, Heart, Share2 } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { PostResponse } from '@/types/api'
import { usePostLike, usePostSave } from './postActions'

/**
 * <b>Gönderi detayı</b> (`/posts/:postId`) — referansla birebir.
 *
 * <p>🔴 Ölçüm `taginbio.com/taag.app/llxaxssc` sayfasından, 9 Ağu 2026'da
 * <b>tarayıcıdan</b> alındı (paket okuyarak değil — minify edilmiş paket token
 * verir, kompozisyon vermez; bu ders vault'ta kayıtlı):
 * <ul>
 *   <li>görsel <b>576×720</b> (4:5), köşe <b>11.2px</b>, ortalanmış</li>
 *   <li>altında <b>sola yaslı</b> aksiyon sırası: iki düğme <b>48×48</b>,
 *       köşe <b>16px</b>, zemin <b>saydam</b>, kenarlık yok, aralarında
 *       <b>8px</b> (her düğme <code>mx-1</code>'li sarmalayıcıda)</li>
 *   <li>düğme içi: <b>24px</b> ikon + yanında <b>16px/400</b> sayı, ikisi tek
 *       satırda, aralarında boşluk yok</li>
 *   <li>en altta <b>Paylaş</b>: dolu <b>siyah</b> zemin, beyaz metin,
 *       köşe <b>11.2px</b>, görselle aynı sütun genişliğinde ortalanmış</li>
 * </ul>
 *
 * <p>⚠️ Sayı <b>ikonun sağında, aynı düğmenin içinde</b> durur — ayrı bir metin
 * olarak yazmak dokunma alanını ikiye bölerdi ve referansta da tek düğme.
 *
 * <p>⚠️ Beğeni/kaydetme <b>iyimser</b> güncellenir (bkz. `postActions`): dolan
 * kalp sunucu yanıtını beklemez.
 */
export function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const t = useT()
  const like = usePostLike()
  const save = usePostSave()

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => (await api.get<PostResponse>(`/posts/${postId}`)).data,
    enabled: !!postId,
  })

  if (isLoading) return <PageSpinner label={t('feed.loading')} />
  if (!post) return null

  const image = post.mediaUrls[0] ?? null

  const share = async () => {
    const url = `${window.location.origin}/posts/${post.id}`
    if (navigator.share) {
      try {
        await navigator.share({ url, text: post.caption ?? undefined })
        return
      } catch {
        /* vazgeçildi */
      }
    }
    await navigator.clipboard.writeText(url)
    toast.success(t('common.copied'))
  }

  return (
    <div className="mx-auto w-full max-w-[576px] px-4 py-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('common.back')}
      </button>

      {/* --- görsel: referansta 4:5, köşe 11.2px --- */}
      {image ? (
        <img
          src={image}
          alt={post.caption ?? ''}
          className="w-full rounded-[11.2px] object-cover"
          style={{ aspectRatio: '576 / 720' }}
        />
      ) : (
        <div
          className="w-full rounded-[11.2px] bg-subtle"
          style={{ aspectRatio: '576 / 720' }}
        />
      )}

      {post.caption && (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{post.caption}</p>
      )}

      {/* --- aksiyon sırası: SOLA yaslı, 48×48, r16, saydam --- */}
      {/* ⚠️ `-mx-1`: her düğme kendi `mx-1` sarmalayıcısında olduğu için sıra
          görselin sol kenarından 4px içeride başlıyordu; referansta hizalı. */}
      <div className="mt-3 flex flex-row items-center -mx-1">
        <div className="mx-1">
          <button
            type="button"
            onClick={() => like.mutate({ id: post.id, liked: post.likedByMe })}
            aria-pressed={post.likedByMe}
            aria-label={t('post.like')}
            className="waydee-post-action"
          >
            <Heart
              className={cn('h-6 w-6', post.likedByMe && 'fill-current text-danger')}
            />
            <span className="text-[16px] tabular-nums">{post.likeCount}</span>
          </button>
        </div>
        <div className="mx-1">
          <button
            type="button"
            onClick={() => save.mutate({ id: post.id, saved: post.savedByMe })}
            aria-pressed={post.savedByMe}
            aria-label={t('post.save')}
            className="waydee-post-action"
          >
            <Bookmark className={cn('h-6 w-6', post.savedByMe && 'fill-current')} />
            <span className="text-[16px] tabular-nums">{post.saveCount}</span>
          </button>
        </div>
      </div>

      {/* --- paylaş: dolu siyah, tam genişlik --- */}
      <button type="button" onClick={share} className="waydee-post-share mt-2">
        <Share2 className="h-4 w-4" />
        {t('collection.share')}
      </button>
    </div>
  )
}
