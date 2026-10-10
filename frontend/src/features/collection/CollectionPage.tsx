import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { Pagination } from '@/components/ui/pagination'
import { CreatePostFlow } from '@/features/post/CreatePostFlow'
import { PostCard } from '@/features/post/PostCard'
import { api } from '@/lib/api'
import { useT } from '@/i18n'

interface Detail {
  id: string
  title: string
  itemCount: number
  sharePath: string
}
interface PostTile {
  id: string
  title: string | null
  imageUrl: string | null
}
interface Page<T> {
  content: T[]
  totalPages: number
}

/**
 * <b>Koleksiyon detayı</b> — referans ekran görüntüsüyle birebir.
 *
 * ```
 *              ┌──────────────────┐
 *              │ my koleksiyon  ✕ │      ← ad alanı, ortalı, temizleme düğmeli
 *              └──────────────────┘
 *  ─────────────────────────────────────  ← ince ayraç
 *  [DELETE COLLECTION] [COPY URL] [SHARE] ← ilki dolgulu pembe, ikisi çerçeveli
 *
 *                 No posts
 *            [ + Create your first post ]
 *
 *                   ‹ ›                   ← sayfalama (boşken de var)
 * ```
 *
 * ⚠️ Ad <b>yerinde</b> düzenlenir: alandan çıkınca (blur) kaydedilir. Ayrı bir
 * "kaydet" düğmesi referansta yok.
 * ⚠️ Paylaşım adresi sunucudan <b>göreli</b> gelir (`sharePath`); mutlak adresi
 * burada `window.location.origin` ile kurarız — API'ye alan adı gömmek
 * localhost ile üretimde farklı bağlantı üretirdi.
 */
export function CollectionPage() {
  const t = useT()
  const { collectionId = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const page = Math.max(Number(params.get('page') || '1'), 1)

  const [title, setTitle] = useState('')
  const [postFlow, setPostFlow] = useState(false)
  const [copied, setCopied] = useState(false)

  const detail = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: async () => (await api.get<Detail>(`/collections/${collectionId}`)).data,
  })
  const posts = useQuery({
    queryKey: ['collection-posts', collectionId, page],
    queryFn: async () =>
      (await api.get<Page<PostTile>>(`/collections/${collectionId}/posts?page=${page - 1}`)).data,
  })

  // Sunucudan gelen ad alana yalnız BİR kez yazılır; her tazelemede yazsaydı
  // kullanıcının yazdığı harfleri ezerdi.
  useEffect(() => {
    if (detail.data && title === '') setTitle(detail.data.title)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data])

  const setPage = (next: number) => {
    const p = new URLSearchParams(params)
    p.set('page', String(next))
    setParams(p, { replace: true })
  }

  const saveTitle = async () => {
    const value = title.trim()
    if (!value || value === detail.data?.title) return
    await api.patch(`/collections/${collectionId}`, { title: value })
    await qc.invalidateQueries({ queryKey: ['collection', collectionId] })
    await qc.invalidateQueries({ queryKey: ['collections'] })
  }

  const shareUrl = detail.data ? `${window.location.origin}${detail.data.sharePath}` : ''

  const copyUrl = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const share = async () => {
    if (!shareUrl) return
    // Mobilde yerel paylaşım sayfası; masaüstünde karşılığı yok → kopyalamaya düşer.
    if (navigator.share) {
      try {
        await navigator.share({ title: detail.data?.title, url: shareUrl })
        return
      } catch {
        /* kullanıcı vazgeçti — sessiz */
      }
    }
    await copyUrl()
  }

  const remove = async () => {
    if (!window.confirm(t('collection.deleteConfirm'))) return
    await api.delete(`/collections/${collectionId}`)
    await qc.invalidateQueries({ queryKey: ['collections'] })
    navigate('/home?tab=collections', { replace: true })
  }

  if (detail.isLoading) return <PageSpinner label={t('feed.loading')} />

  const rows = posts.data?.content ?? []

  return (
    <div className="flex w-full flex-col items-center">
      <div className="waydee-title-field mt-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          maxLength={120}
          aria-label={t('collection.nameLabel')}
        />
        {title && (
          <button
            type="button"
            onClick={() => setTitle('')}
            aria-label={t('common.clear')}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4 w-full border-t border-line" />

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {/* 🔴 "Gönderi ekle" ARTIK HER ZAMAN VAR. Önceden yalnız koleksiyon
            BOŞKEN çıkıyordu (boş durum kartındaki düğme); bir gönderi
            eklendikten sonra ikincisini eklemenin ekranda hiçbir yolu
            kalmıyordu. */}
        <button type="button" onClick={() => setPostFlow(true)} className="waydee-act waydee-act-outline">
          {t('collection.addPost')}
        </button>
        <button type="button" onClick={remove} className="waydee-act waydee-act-danger">
          {t('collection.delete')}
        </button>
        <button type="button" onClick={copyUrl} className="waydee-act waydee-act-outline">
          {copied ? t('common.copied') : t('collection.copyUrl')}
        </button>
        <button type="button" onClick={share} className="waydee-act waydee-act-outline">
          {t('collection.share')}
        </button>
      </div>

      <div className="mt-6 w-full max-w-screen-xl">
        {posts.isLoading && <PageSpinner label={t('feed.loading')} />}

        {!posts.isLoading && rows.length === 0 && (
          <div className="waydee-empty">
            <h3 className="mb-2 text-lg font-semibold">{t('home.noPosts')}</h3>
            <button type="button" onClick={() => setPostFlow(true)} className="waydee-empty-cta">
              <Plus className="h-5 w-5" />
              {t('home.firstPost')}
            </button>
          </div>
        )}

        {!posts.isLoading && rows.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((p) => (
              <PostCard key={p.id} post={p} owner />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={Math.max(posts.data?.totalPages ?? 0, 1)}
          onChange={setPage}
          className="mt-6"
        />
      </div>

      {postFlow && (
        /* 🔴 `collectionId` GEÇİLİR: akış gönderiyi oluşturduktan sonra onu bu
           koleksiyona da ekler. Önceden geçilmiyordu ve kullanıcı, gönderisini
           oluşturduğu ekranda göremiyordu (16 Ağu 2026, kullanıcı bildirimi). */
        <CreatePostFlow
          open
          collectionId={collectionId}
          onClose={() => {
            setPostFlow(false)
            qc.invalidateQueries({ queryKey: ['collection-posts', collectionId] })
          }}
        />
      )}
    </div>
  )
}
