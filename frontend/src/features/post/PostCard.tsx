import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, MoreHorizontal, X } from 'lucide-react'
import { api } from '@/lib/api'
import { lockScroll } from '@/lib/scrollLock'
import { toast } from '@/components/ui/toast'
import { useT } from '@/i18n'
import { PostDetailModal } from './PostDetailModal'

export interface PostTile {
  id: string
  title: string | null
  /* ⚠️ Opsiyonel: koleksiyon ızgarası karo DTO'sunda açıklama taşımaz —
     zorunlu bırakmak aynı kartı iki yerde kullanmayı imkânsız kılıyordu. */
  caption?: string | null
  imageUrl: string | null
  tagCount?: number
  likeCount?: number
}
interface CollectionRow {
  id: string
  title: string
  itemCount: number
}

/**
 * Gönderi karosu — <b>referansla birebir</b>: görselin sağ üstünde beliren
 * <b>⋯ menüsü</b> (Edit · Copy link · Share · Archive · Delete) ve tıklanınca
 * açılan <b>detay penceresi</b>.
 *
 * ⚠️ ⋯ yalnız <b>sahibinin</b> ekranında çizilir (`owner`): vitrin profilinde
 * yabancı birine düzenleme menüsü göstermek anlamsız ve yanıltıcı olurdu.
 */
export function PostCard({ post, owner = false }: { post: PostTile; owner?: boolean }) {
  const t = useT()
  const qc = useQueryClient()
  const [menu, setMenu] = useState(false)
  const [detail, setDetail] = useState(false)
  const [picker, setPicker] = useState(false)

  /*
   * Dışarı tıklayınca menü kapanır.
   *
   * 🔴 Dinleyici bir sonraki tick'te bağlanır (`setTimeout 0`). Aynı tick'te
   * bağlanırsa **menüyü açan tıklama** window'a ulaşıp onu hemen kapatıyor ve
   * menü hiç görünmüyordu (ölçüldü: tıklamadan 300 ms sonra da `.waydee-menu`
   * yok). Sentetik `stopPropagation` bu yarışı kapatmıyor.
   */
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    const timer = window.setTimeout(() => window.addEventListener('click', close), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('click', close)
    }
  }, [menu])

  /* 🔴 9 Ağu 2026 — adres DÜZELTİLDİ: burada `/p/{postId}` yazıyordu, oysa
     `/p/:userId` **kullanıcı** sayfasının rotasıdır. Yani kopyalanan her
     gönderi bağlantısı yanlış sayfaya (ve UUID kullanıcı olmadığı için "profil
     bulunamadı"ya) gidiyordu. Gönderinin herkese açık adresi `/post/{id}`. */
  const shareUrl = `${window.location.origin}/post/${post.id}`

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    toast.success(t('common.copied'))
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title ?? '', url: shareUrl })
        return
      } catch {
        /* vazgeçildi */
      }
    }
    await copyLink()
  }
  const archive = async () => {
    await api.post(`/profile-posts/${post.id}/archive?value=true`)
    await qc.invalidateQueries({ queryKey: ['profile-posts'] })
    toast.success(t('post.archived'))
  }
  const remove = async () => {
    if (!window.confirm(t('post.deleteConfirm'))) return
    await api.delete(`/profile-posts/${post.id}`)
    await qc.invalidateQueries({ queryKey: ['profile-posts'] })
    toast.success(t('post.deleted'))
  }

  return (
    <>
      <div className="waydee-link-card relative">
        <button type="button" className="block w-full text-start" onClick={() => setDetail(true)}>
          <span className="waydee-link-media">
            {post.imageUrl ? (
              <img src={post.imageUrl} alt={post.title ?? ''} loading="lazy" />
            ) : (
              <span className="grid h-full w-full place-items-center text-muted">
                <ImageIcon className="h-6 w-6" />
              </span>
            )}
          </span>
          <span className="waydee-link-title block truncate">{post.title ?? ''}</span>
        </button>

        {owner && (
          <>
            <button
              type="button"
              className="waydee-dots"
              aria-label={t('post.menu')}
              onClick={(e) => {
                e.stopPropagation()
                setMenu((v) => !v)
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu && (
              <div className="waydee-menu" onClick={(e) => e.stopPropagation()}>
                {/* 🔴 Düzenleme TAM EKRAN sayfaya gider — referansta popup değil. */}
                <button type="button" onClick={() => { setMenu(false); window.location.assign(`/posts/${post.id}/edit`) }}>
                  {t('post.edit')}
                </button>
                <button type="button" onClick={() => { setMenu(false); copyLink() }}>
                  {t('post.copyLink')}
                </button>
                <button type="button" onClick={() => { setMenu(false); share() }}>
                  {t('collection.share')}
                </button>
                <button type="button" onClick={() => { setMenu(false); setPicker(true) }}>
                  {t('post.addToCollection')}
                </button>
                <button type="button" onClick={() => { setMenu(false); archive() }}>
                  {t('post.archive')}
                </button>
                <button
                  type="button"
                  className="waydee-menu-danger"
                  onClick={() => { setMenu(false); remove() }}
                >
                  {t('post.delete')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 🔴 Detay penceresi artık ORTAK bileşendir (`PostDetailModal.tsx`):
          vitrin profilinde ziyaretçinin gördüğü pencereyle birebir aynı. */}
      {detail && (
        <PostDetailModal
          postId={post.id}
          owner={owner}
          onClose={() => setDetail(false)}
        />
      )}
      {picker && <CollectionPicker postId={post.id} onClose={() => setPicker(false)} />}
    </>
  )
}

/**
 * <b>Koleksiyona ekle</b> — eksik olan halka buydu: gönderi ile koleksiyon
 * arasında arayüzde hiçbir bağ yoktu (uç hazırdı, ekran yoktu).
 */
function CollectionPicker({ postId, onClose }: { postId: string; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['collections', 1],
    queryFn: async () =>
      (await api.get<{ content: CollectionRow[] }>('/collections?page=0&size=48')).data,
  })

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [onClose])

  const add = async (collectionId: string) => {
    setBusy(collectionId)
    try {
      await api.post(`/collections/${collectionId}/posts`, { postId })
      await qc.invalidateQueries({ queryKey: ['collections'] })
      await qc.invalidateQueries({ queryKey: ['collection-posts', collectionId] })
      toast.success(t('post.addedToCollection'))
      onClose()
    } finally {
      setBusy(null)
    }
  }

  const rows = q.data?.content ?? []

  return createPortal(
    <div
      className="waydee-sheet-scrim"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="waydee-sheet">
        <div className="relative mb-5">
          <h2 className="waydee-sheet-title">{t('post.addToCollection')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute end-0 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">{t('home.noCollections')}</p>
        ) : (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {rows.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy === c.id}
                onClick={() => add(c.id)}
                className="waydee-create-card"
              >
                <span className="min-w-0 text-start">
                  <span className="block truncate text-[15px] font-bold leading-tight">{c.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{c.itemCount}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
