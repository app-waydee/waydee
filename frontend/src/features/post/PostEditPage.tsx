import { useEffect, useState } from 'react'
import { SocialLinks } from '@/components/social/SocialIcons'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, ChevronRight, Heart, Save, X } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'
import { AddTagDialog, TagStage, parsePrice, type DraftTag, type StagePoint } from '@/features/post/TagComposer'
import { usePlan } from '@/features/plan/PlanBadge'
import { AddToCollectionDialog } from '@/features/collection/AddToCollectionDialog'

/** Referansın "Select platform" listesi — sırası birebir. */
const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'SNAPCHAT', 'X', 'THREADS', 'MAIL', 'LINK', 'WEBSITE'] as const

/**
 * ⚠️ `price` / `currency` / `imageUrl` sunucudan HEP dönüyordu
 * (`PostTagController.TagResponse`); bu arayüz onları yalnız <b>bildirmiyordu</b>,
 * yani veri geliyor ve arayüzde çöpe gidiyordu. 11 Ağu 2026'da bilgi kartı
 * eklenirken tamamlandı.
 */
interface TagView {
  id: string
  x: number
  y: number
  productUrl: string
  productName: string | null
  price: number | null
  currency: string | null
  imageUrl: string | null
  /** ⚠️ `imageUrl` imzalıdır ve ondan kimliğe dönülemez — düzenleme formunun
      görseli koruyabilmesi için kimlik ayrıca gelir (17 Ağu 2026). */
  imageMediaId: string | null
}
interface Detail {
  id: string
  title: string | null
  caption: string | null
  imageUrl: string | null
  likeCount: number
  saveCount: number
  tags: TagView[]
}
interface SocialRow { id: string; platform: string; value: string; url: string }

/**
 * <b>Gönderi düzenleme — TAM EKRAN</b> (popup değil).
 *
 * ```
 *                ┌──────────────┐ ┌──┐
 *                │ Post-dRX   ✕ │ │💾│   ← kaydet YALNIZ ad değişince çıkar
 *                └──────────────┘ └──┘
 *  ────────────────────────────────────────
 *            ‹   [   görsel   ]   ›        ← tıklayınca o noktada +
 *            ♡ 0   🔖 0            ⌾ ⌾     ← sağda eklenen sosyal ikonlar
 *      [Add Social Links] [Add To Collection] [Update]   ← Update link eklenince
 *                    [ Delete ]
 * ```
 *
 * 🔴 Referansta bu bir <b>sayfa</b>dır, modal değil — kullanıcı bunu açıkça
 * söyledi. Modal olarak kalsaydı adres paylaşılamaz, geri tuşu çalışmaz ve
 * uzun içerikte kaydırma iki katmanda sıkışırdı.
 *
 * ⚠️ İki düğme <b>koşulludur</b> (referansın davranışı): ad değişmeden kaydet
 * <b>çizilmez</b>, sosyal bağlantı eklenmeden <b>Update</b> çizilmez. Her zaman
 * görünen bir düğme, "bir şey değişti mi?" bilgisini yok eder.
 */
export function PostEditPage() {
  const t = useT()
  const { postId = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  /* Etiket kotası sunucudan — sayı istemcide sabitlenmez. */
  const { data: plan } = usePlan()

  const [title, setTitle] = useState('')
  const [spot, setSpot] = useState<{ x: number; y: number; label?: string | null } | null>(null)
  const [picker, setPicker] = useState(false)
  const [tagForm, setTagForm] = useState(false)
  /**
   * 🔴 17 Ağu 2026 — düzenlenen etiketin KİMLİĞİ (yeni etiket eklerken `null`).
   * ⚠️ Burada indeks değil kimlik tutulur: liste sunucudan geliyor ve
   * araya bir tazeleme girerse indeks kayabilir.
   */
  const [editTagId, setEditTagId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dirtyLinks, setDirtyLinks] = useState(false)
  /** "Koleksiyona ekle" penceresi açık mı. */
  const [collectionPicker, setCollectionPicker] = useState(false)

  const detail = useQuery({
    queryKey: ['post-detail', postId],
    queryFn: async () => (await api.get<Detail>(`/profile-posts/${postId}`)).data,
  })
  const social = useQuery({
    queryKey: ['post-social', postId],
    queryFn: async () => (await api.get<SocialRow[]>(`/profile-posts/${postId}/social-links`)).data,
  })

  // Ad alana yalnız BİR kez yazılır; her tazelemede yazsaydı kullanıcının
  // yazdığı harfleri ezerdi (koleksiyon ekranındaki aynı desen).
  useEffect(() => {
    if (detail.data && title === '') setTitle(detail.data.title ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data])

  if (detail.isLoading) return <PageSpinner label={t('feed.loading')} />
  const d = detail.data
  if (!d) return null

  const links = social.data ?? []
  const titleChanged = title.trim() !== (d.title ?? '').trim()

  const saveTitle = async () => {
    setBusy(true)
    try {
      await api.patch(`/profile-posts/${postId}`, { title: title.trim(), caption: d.caption ?? '' })
      await qc.invalidateQueries({ queryKey: ['post-detail', postId] })
      await qc.invalidateQueries({ queryKey: ['profile-posts'] })
      toast.success(t('post.saved'))
    } finally {
      setBusy(false)
    }
  }

  const update = async () => {
    // Bağlantılar eklenirken zaten yazıldı; Update yalnız listeyi tazeler ve
    // kullanıcıya "bitti" der — referansta da onay düğmesi gibi durur.
    await qc.invalidateQueries({ queryKey: ['post-social', postId] })
    setDirtyLinks(false)
    toast.success(t('post.saved'))
  }

  /*
   * 🔴 17 Ağu 2026 — ETİKET KOTASI BU EKRANDA DA UYGULANIYOR.
   * Gerekçe `CreatePostFlow`'daki ile birebir aynı: sınır yalnız sunucudaydı
   * ve kullanıcı hatayı ancak istek dönünce görüyordu.
   * ⚠️ Sunucu kontrolü yerinde duruyor — bu bir kolaylık, güvenlik sınırı değil.
   */
  const tagLimit = plan?.tagsPerPost ?? -1
  const unlimitedTags = tagLimit < 0
  const tagLimitReached = !unlimitedTags && d.tags.length >= tagLimit

  /** Düzenlenen etiketi forma verilecek biçime çevirir. */
  const draftOf = (tag: TagView): DraftTag => ({
    productUrl: tag.productUrl,
    productName: tag.productName ?? '',
    // ⚠️ Sunucu sayı döner, form metin bekler; boşsa boş dize (0 DEĞİL).
    price: tag.price == null ? '' : String(tag.price),
    currency: tag.currency ?? 'USD',
    imageMediaId: tag.imageMediaId ?? undefined,
    imagePreviewUrl: tag.imageUrl ?? undefined,
  })

  const editing = editTagId ? d.tags.find((tg) => tg.id === editTagId) ?? null : null

  const deleteTag = async (tagId: string) => {
    if (!window.confirm(t('post.tagDeleteConfirm'))) return
    try {
      await api.delete(`/profile-posts/${postId}/tags/${tagId}`)
      await qc.invalidateQueries({ queryKey: ['post-detail', postId] })
      toast.success(t('post.tagDeleted'))
    } catch (err) {
      // ⚠️ Yakalanmamış `await` = "hiçbir şey olmuyor" (vault kuralı).
      toast.error(apiErrorMessage(err, t('common.failed')))
    }
  }

  const remove = async () => {
    if (!window.confirm(t('post.deleteConfirm'))) return
    await api.delete(`/profile-posts/${postId}`)
    await qc.invalidateQueries({ queryKey: ['profile-posts'] })
    navigate('/home?tab=posts', { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-4">
      {/* --- ad + kaydet --- */}
      <div className="flex w-full items-center justify-center gap-2">
        <span className="waydee-edit-field">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('post.namePlaceholder')}
            maxLength={140}
            aria-label={t('post.namePlaceholder')}
          />
          {title && (
            <button type="button" onClick={() => setTitle('')} aria-label={t('common.clear')}>
              <X className="h-4 w-4" />
            </button>
          )}
        </span>
        {/* ⚠️ Yalnız ad DEĞİŞİNCE çıkar (referansın davranışı). */}
        {titleChanged && (
          <button
            type="button"
            className="waydee-edit-save waydee-pop-in"
            onClick={saveTitle}
            disabled={busy}
            aria-label={t('common.save')}
            title={t('common.save')}
          >
            <Save className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4 w-full border-t border-line" />

      {/* --- görsel: büyüteç + etiket noktaları (ortak bileşen) --- */}
      {d.imageUrl && (
        <TagStage
          className="mt-4 w-full"
          src={d.imageUrl}
          points={d.tags.map((tg) => ({
            key: tg.id,
            x: Number(tg.x),
            y: Number(tg.y),
            title: tg.productName ?? tg.productUrl,
            productName: tg.productName,
            productUrl: tg.productUrl,
            price: tg.price,
            currency: tg.currency,
            imageUrl: tg.imageUrl,
          }))}
          onPick={(p) => {
            // 🔴 Kota doluysa form HİÇ açılmaz; hata burada, sonraki adımda değil.
            if (tagLimitReached) {
              toast.error(t('post.tagLimitReached', { max: tagLimit }))
              return
            }
            setEditTagId(null)
            setSpot(p)
            setTagForm(true)
          }}
          onEditPoint={(point: StagePoint) => {
            setEditTagId(point.key)
            setSpot({ x: point.x, y: point.y })
            setTagForm(true)
          }}
          onDeletePoint={(point: StagePoint) => deleteTag(point.key)}
        />
      )}

      {d.imageUrl && (
        <div className="waydee-tag-quota" data-full={tagLimitReached}>
          <span className="waydee-tag-quota-count">
            {unlimitedTags
              ? t('post.tagsUnlimited', { used: d.tags.length })
              : t('post.tagsUsed', { used: d.tags.length, max: tagLimit })}
          </span>
          {tagLimitReached && (
            <>
              <span>{t('post.tagLimitReached', { max: tagLimit })}</span>
              <button
                type="button"
                className="waydee-tag-quota-upgrade"
                onClick={() => navigate('/plan')}
              >
                {t('post.tagLimitUpgrade')}
              </button>
            </>
          )}
        </div>
      )}

      {/* --- sayaçlar + eklenen sosyal ikonlar --- */}
      <div className="mt-3 flex w-full items-center justify-between">
        <div className="flex items-center gap-4 text-[13px] text-ink">
          <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" /> {d.likeCount}</span>
          <span className="flex items-center gap-1.5"><Bookmark className="h-4 w-4" /> {d.saveCount}</span>
        </div>
        {/* 🔴 9 Ağu 2026 — BOZUK GÖRÜNÜM DÜZELTİLDİ. Burada her bağlantı
            `platform.charAt(0)` ile, yani <b>tek bir harf</b> olarak
            çiziliyordu (görselin sağ altında anlamsız bir rozet). Artık
            profil başlığıyla aynı bileşen ve aynı marka ikonları kullanılıyor;
            "aynı verinin iki ayrı görünümü" hatası kapandı. */}
        <SocialLinks links={links} size="sm" className="w-auto justify-end" />
      </div>

      {/* --- eylemler --- */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="waydee-pill waydee-pill-violet" onClick={() => setPicker(true)}>
          {t('post.addSocialLinks')}
        </button>
        {/*
          🔴 16 Ağu 2026 — DÜĞME ARTIK ÇALIŞIYOR (kullanıcı: "add collection
          çalışmıyor, home dönüyor, buga giriyor").

          Eski hâli `navigate('/home?tab=posts&add=' + postId)` idi ve
          `HomePage` yalnız `?create=1` parametresini tanıyor — `add` HİÇBİR
          YERDE işlenmiyordu. Yani düğme kullanıcıyı ana sayfaya atıyor,
          orada da hiçbir şey olmuyordu.
          ⚠️ `HomePage`'e bir `add` işleyicisi eklemek de mümkündü ama yanlış
          olurdu: koleksiyon seçmek bir KARARDIR, bir sayfa değil — kullanıcı
          düzenlediği gönderiden koparılmamalı.
        */}
        <button
          type="button"
          className="waydee-pill waydee-pill-outline"
          onClick={() => setCollectionPicker(true)}
        >
          {t('post.addToCollection')}
        </button>
        {/* ⚠️ Yalnız bağlantı eklendikten sonra çıkar. */}
        {dirtyLinks && (
          <button type="button" className="waydee-pill waydee-pill-ink waydee-pop-in" onClick={update}>
            {t('post.update')}
          </button>
        )}
      </div>
      <button type="button" className="waydee-pill waydee-pill-danger mt-3" onClick={remove}>
        {t('post.delete')}
      </button>

      {tagForm && spot && (
        <AddTagDialog
          busy={busy}
          initialName={spot.label ?? ''}
          initialTag={editing ? draftOf(editing) : null}
          onCancel={() => { setTagForm(false); setEditTagId(null) }}
          onDelete={
            editTagId
              ? async () => {
                  const id = editTagId
                  setTagForm(false)
                  setEditTagId(null)
                  await deleteTag(id)
                }
              : undefined
          }
          onSave={async (tag) => {
            /*
             * 🔴 10 Ağu 2026 — HATA ARTIK YUTULMUYOR.
             *
             * <b>Bildirilen hata buydu:</b> "etiket ekleyince kaydolmuyor".
             * Burada `await api.post(...)` <b>try/catch'siz</b> duruyordu:
             * istek 400/403 dönerse söz reddediliyor, pencere açık kalıyor ve
             * ekranda <b>hiçbir şey olmuyordu</b>. Kullanıcı için bu, sessizce
             * çalışmayan bir düğme demekti.
             *
             * (Asıl 400'ün kaynağı ayrıca düzeltildi: ürün adresi sınırı
             * 200 → 500, bkz. `HtmlSanitizer.normalizeWebsite`. Ama sınır
             * düzelse de hatanın görünür olması ayrı bir gerekliliktir —
             * plan sınırı, geçersiz şema gibi başka 4xx'ler duruyor.)
             */
            try {
              /* 🔴 Düzenlemede PATCH: satır kimliği korunur, dolayısıyla o
                 etiketin gösterim/tıklama istatistiği YAŞAR. Silip yeniden
                 eklemek ölçümü sıfırlardı. */
              const path = editTagId
                ? `/profile-posts/${postId}/tags/${editTagId}`
                : `/profile-posts/${postId}/tags`
              await api[editTagId ? 'patch' : 'post'](path, {
                x: spot.x,
                y: spot.y,
                productUrl: tag.productUrl,
                productName: tag.productName || null,
                // ⚠️ Virgüllü ondalık ("199,90") `Number()` ile NaN olur ve
                // JSON'da null'a düşerdi — fiyat sessizce kaybolurdu.
                price: parsePrice(tag.price),
                currency: parsePrice(tag.price) != null ? tag.currency : null,
                // ⚠️ Etiketin ürün görseli TAŞINIR: yüklenip sonra atılıyordu.
                imageMediaId: tag.imageMediaId ?? null,
              })
              setTagForm(false)
              setSpot(null)
              if (editTagId) toast.success(t('post.tagUpdated'))
              setEditTagId(null)
              qc.invalidateQueries({ queryKey: ['post-detail', postId] })
            } catch (err) {
              toast.error(apiErrorMessage(err, t('post.tagFailed')))
            }
          }}
        />
      )}

      {collectionPicker && (
        <AddToCollectionDialog postId={postId} onClose={() => setCollectionPicker(false)} />
      )}

      {picker && (
        <SocialPicker
          postId={postId}
          onClose={() => setPicker(false)}
          onAdded={() => {
            setDirtyLinks(true)
            qc.invalidateQueries({ queryKey: ['post-social', postId] })
          }}
        />
      )}
    </div>
  )
}

/**
 * <b>Select platform</b> — referansın açılır listesi + <b>Add</b> düğmesi.
 * Liste sırası referanstakiyle aynı: INSTAGRAM → … → WEBSITE.
 */
function SocialPicker({
  postId,
  onClose,
  onAdded,
}: {
  postId: string
  onClose: () => void
  onAdded: () => void
}) {
  const t = useT()
  const [platform, setPlatform] = useState<string>('')
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [onClose])

  const add = async () => {
    if (!platform || !value.trim() || busy) return
    setBusy(true)
    try {
      await api.post(`/profile-posts/${postId}/social-links`, { platform, value: value.trim() })
      onAdded()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="waydee-sheet-scrim"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="waydee-sheet">
        <div className="relative mb-4">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="waydee-close-ring absolute end-0 top-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button type="button" className="waydee-select" onClick={() => setOpen((v) => !v)}>
          <span className={platform ? 'text-ink' : 'text-faint'}>
            {platform || t('post.selectPlatform')}
          </span>
          <ChevronRight className={`h-4 w-4 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
        </button>

        {open && (
          <div className="waydee-select-list">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                className={`waydee-select-item ${platform === p ? 'waydee-select-on' : ''}`}
                onClick={() => {
                  setPlatform(p)
                  setOpen(false)
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {platform && (
          <input
            className="waydee-sheet-input mt-3"
            placeholder={t('post.socialValuePlaceholder')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            autoFocus
          />
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="waydee-pill waydee-pill-violet-solid"
            disabled={!platform || !value.trim() || busy}
            onClick={add}
          >
            {t('common.add')}
          </button>
        </div>
      </div>
    </div>
  )
}


