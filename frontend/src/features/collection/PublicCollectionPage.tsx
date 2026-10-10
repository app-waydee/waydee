import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Images, Settings2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { PageSpinner } from '@/components/ui/spinner'
import { Pagination } from '@/components/ui/pagination'
import { publicApi } from '@/lib/publicApi'
import { profilePath } from '@/lib/profilePath'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/i18n'
import { useState } from 'react'
import { PostDetailModal } from '@/features/post/PostDetailModal'

interface PublicCollection {
  id: string
  title: string
  description: string | null
  coverUrl: string | null
  itemCount: number
  ownerUsername: string
  ownerDisplayName: string
  ownerAvatarUrl: string | null
  ownerVerified: boolean
}
interface Tile {
  id: string
  title: string | null
  imageUrl: string | null
  tagCount: number
  likeCount: number
}
interface Page<T> {
  content: T[]
  totalPages: number
}

/**
 * <b>Herkese açık koleksiyon</b> — {@code /collection/{id}}.
 *
 * <h3>🔴 17 Ağustos 2026 — neden var</h3>
 * Koleksiyonun "Paylaş" düğmesi vardı ama paylaşılan adres <b>iki kere
 * ölüydü</b>: sunucu {@code /{username}/c/{id}} üretiyordu (arayüzde öyle bir
 * rota yoktu → 404) ve adres düzeltilse bile veri ucu <b>yalnız sahibine</b>
 * açıktı. Yani "paylaş", paylaşılamayan bir şeyi paylaşıyordu.
 *
 * <h3>Adres standardı</h3>
 * <pre>
 *   /{username}            profil        (herkese açık)
 *   /post/{id}             gönderi       (herkese açık)
 *   /collection/{id}       koleksiyon    (herkese açık)   ← bu sayfa
 *   /collections/{id}      koleksiyon    (SAHİBİN YÖNETİMİ)
 * </pre>
 * <p>⚠️ Tekil/çoğul ayrımı bilinçli: paylaşılan adres düzenleme düğmeleri
 * göstermemeli, yönetim adresi de arama motoruna girmemeli. Aynı sayfayı
 * "sahibi mi" diye dallandırmak, tek bir koşul unutulduğunda ziyaretçiye
 * silme düğmesi göstermek demekti.
 */
export function PublicCollectionPage() {
  const t = useT()
  const { collectionId = '' } = useParams()
  const me = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)
  const [openPost, setOpenPost] = useState<string | null>(null)

  const detail = useQuery({
    queryKey: ['public-collection', collectionId],
    queryFn: async () =>
      (await publicApi.get<PublicCollection>(`/collections/${collectionId}`)).data,
  })
  const posts = useQuery({
    queryKey: ['public-collection-posts', collectionId, page],
    queryFn: async () =>
      (await publicApi.get<Page<Tile>>(`/collections/${collectionId}/posts?page=${page - 1}`)).data,
    enabled: !!detail.data,
  })

  if (detail.isLoading) return <PageSpinner />
  const c = detail.data
  if (!c) {
    /* ⚠️ "Bulunamadı" ile "göremezsin" AYNI ekran: gizli bir hesabın
       koleksiyonunun var olduğunu söylemek, gizliliğin kendisini delerdi. */
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h3 className="text-lg font-semibold text-ink">{t('collection.notFound')}</h3>
      </div>
    )
  }

  const isOwner = me?.username === c.ownerUsername

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      {/* --- başlık --- */}
      <div className="flex items-start gap-4">
        <span className="waydee-collection-cover">
          {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <Images className="h-6 w-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-bold text-ink">{c.title}</h1>
          {c.description && (
            <p className="mt-1 line-clamp-2 text-[13px] text-muted">{c.description}</p>
          )}
          <p className="mt-1 text-[12px] text-faint">
            {t('collection.itemCount', { count: c.itemCount })}
          </p>
        </div>
        {/* 🔴 Sahibi buradan YÖNETİM görünümüne geçer. Düzenleme düğmelerini
            bu sayfaya koymak yerine ayrı sayfaya götürmek, ziyaretçiye
            yanlışlıkla eylem göstermeyi yapısal olarak imkânsız kılar. */}
        {isOwner && (
          <Link to={`/collections/${c.id}`} className="waydee-pill waydee-pill-outline shrink-0">
            <Settings2 className="h-4 w-4" /> {t('collection.manage')}
          </Link>
        )}
      </div>

      {/* --- sahibi: koleksiyon çıkmaz sokak olmamalı --- */}
      <Link
        to={profilePath({ username: c.ownerUsername })}
        className="flex items-center gap-2.5 self-start rounded-full border border-line px-3 py-1.5 transition-colors hover:bg-subtle"
      >
        <Avatar src={c.ownerAvatarUrl} name={c.ownerDisplayName} className="h-7 w-7" />
        <span className="text-[13px] font-semibold text-ink">{c.ownerDisplayName}</span>
        <span className="text-[12px] text-faint">@{c.ownerUsername}</span>
      </Link>

      {/* --- gönderi ızgarası --- */}
      {posts.data && posts.data.content.length === 0 ? (
        <p className="waydee-empty">{t('collection.empty')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {posts.data?.content.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenPost(p.id)}
              className="waydee-link-card text-start"
            >
              <span className="waydee-link-media">
                {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : null}
              </span>
              <span className="waydee-link-title block truncate">
                {p.title || t('post.untitled')}
              </span>
            </button>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(posts.data?.totalPages ?? 1, 1)}
        onChange={setPage}
        className="mt-2"
      />

      {/* Gönderi detayı ORTAK bileşen — vitrin ızgarasıyla aynı pencere. */}
      {openPost && <PostDetailModal postId={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  )
}
