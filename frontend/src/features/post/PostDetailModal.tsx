import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Bookmark, Heart, Share2, X } from 'lucide-react'
import { safeHref } from '@/lib/safeHref'
import { api } from '@/lib/api'
import { publicApi } from '@/lib/publicApi'
import { lockScroll } from '@/lib/scrollLock'
import { Avatar } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { SocialLinks } from '@/components/social/SocialIcons'
import { VerifiedTick } from '@/components/VerifiedTick'
import { toast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/auth'
import { reportTagClick, reportTagImpressions } from '@/lib/tagStats'
import { TagStatsPanel } from './TagStatsPanel'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

export interface PostDetailData {
  id: string
  title: string | null
  caption: string | null
  imageUrl: string | null
  likeCount: number
  saveCount: number
  likedByMe: boolean
  savedByMe: boolean
  author: { tag: string; displayName: string | null; avatarUrl: string | null; verified: boolean } | null
  tags: {
    id: string
    x: number | string
    y: number | string
    productUrl: string
    productName: string | null
    price: number | string | null
    currency: string | null
  }[]
  socialLinks: { id: string; platform: string; value: string; url: string }[]
}

/** Vitrin (kimliksiz) yanıtı — {@code /public/posts/{id}}. */
interface PublicPost {
  id: string
  title: string | null
  caption: string | null
  imageUrl: string | null
  likeCount: number
  saveCount: number
  likedByMe: boolean
  savedByMe: boolean
  author: { id: string; tag: string; displayName: string | null; avatarUrl: string | null; verified: boolean }
  tags: PostDetailData['tags']
  socialLinks: PostDetailData['socialLinks']
}

/** Sahip yanıtı — {@code /profile-posts/{id}} (alanlar bilinçli olarak hizalı). */
interface OwnerPost {
  id: string
  title: string | null
  caption: string | null
  imageUrl: string | null
  likeCount: number
  saveCount: number
  likedByMe: boolean
  savedByMe: boolean
  authorTag: string
  authorName: string | null
  authorAvatarUrl: string | null
  tags: PostDetailData['tags']
  socialLinks: PostDetailData['socialLinks']
}

/**
 * <b>Gönderiyi getir</b> — sahip ucundan, olmazsa vitrin ucundan.
 *
 * <p>🔴 Neden iki uç: {@code /profile-posts/{id}} sahiplik filtresi taşır ve
 * başkasının gönderisinde <b>404</b> döner (varlığı sızmasın diye, doğru
 * davranış). Ziyaretçi ucu ise sahibin göremediği hiçbir şeyi taşımaz ama
 * herkese açıktır. Sıra bilinçli: oturum sahibiyse arşiv/düzenleme bağlamı
 * olan zengin yanıt gelir.
 */
export function usePostDetail(postId: string, enabled = true) {
  const authed = useAuthStore((s) => !!s.user)
  return useQuery({
    queryKey: ['post-detail', postId],
    enabled: enabled && !!postId,
    queryFn: async (): Promise<PostDetailData> => {
      if (authed) {
        try {
          const { data } = await api.get<OwnerPost>(`/profile-posts/${postId}`)
          return {
            ...data,
            author: {
              tag: data.authorTag,
              displayName: data.authorName,
              avatarUrl: data.authorAvatarUrl,
              verified: false,
            },
          }
        } catch {
          /* Başkasının gönderisi — vitrin ucuna düşülür. */
        }
      }
      /* ⚠️ Oturum varsa vitrin ucu da `api` ile çağrılır: JWT gidince sunucu
         `likedByMe`/`savedByMe` doldurur ve ziyaretçi geçişi aramaz. Oturumsuz
         çağrı `publicApi` ile gider (geçiş başlığını o taşır). */
      const { data } = authed
        ? await api.get<PublicPost>(`/public/posts/${postId}`)
        : await publicApi.get<PublicPost>(`/posts/${postId}`)
      return { ...data, author: data.author }
    },
  })
}

/**
 * <b>Gönderi detayı</b> — tek bileşen, <b>iki izleyici</b>.
 *
 * <p>🔴 9 Ağu 2026 — kullanıcı: <i>"kendi paylaşımına tıklayınca sadece o
 * paylaşımı görüyor… başkaları da aynı şekilde görecek ve beğeni
 * bırakabilecek… sosyal medya linkini de görmeli"</i>.
 *
 * <p><b>Önceki durum (üç ayrı kopukluk):</b>
 * <ol>
 *   <li>Vitrin profilindeki gönderi ızgarası <b>tıklanamayan resimlerdi</b> —
 *       başka biri bir gönderiyi hiçbir şekilde açamıyordu.</li>
 *   <li>Sahibinin penceresinde kalp ve yer imi <b>ölü sayaçtı</b>: rakam
 *       yazıyordu ama basılamıyordu.</li>
 *   <li>Gönderiye eklenen <b>sosyal bağlantılar hiçbir yerde çizilmiyordu</b>
 *       (yalnız düzenleme ekranında, o da tek harf olarak).</li>
 * </ol>
 *
 * <p>Bu üçü tek bileşende çözülür ki iki taraf zamanla ayrışmasın — projede
 * "aynı şeyin iki kopyası" hatası daha önce üç kez yaşandı (etiket katmanı,
 * sekme şeridi, sosyal ikonlar).
 *
 * <p>⚠️ Beğeni/kaydetme <b>oturum ister</b>: ziyaretçi bastığında giriş
 * ekranına, dönüş adresiyle birlikte gönderilir. Düğmeyi gizlemek yerine
 * yönlendirmek, ziyaretçiye ürünün ne yaptığını gösterir.
 */
export function PostDetailModal({
  postId,
  owner = false,
  onClose,
}: {
  postId: string
  owner?: boolean
  onClose: () => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const q = usePostDetail(postId)

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [onClose])

  return createPortal(
    <div
      className="waydee-sheet-scrim"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="waydee-post-modal">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="truncate text-[13px] font-bold uppercase tracking-wide text-ink">
            {q.data?.title || t('post.untitled')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="text-muted hover:text-ink">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {q.isLoading ? (
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        ) : !q.data ? (
          <p className="py-8 text-center text-[13px] text-muted">{t('post.notFound')}</p>
        ) : (
          <PostDetailBody
            data={q.data}
            owner={owner}
            onEdit={() => {
              onClose()
              navigate(`/posts/${postId}/edit`)
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Pencerenin ve <b>herkese açık gönderi sayfasının</b> ortak gövdesi —
 * yazar başlığı · görsel + ürün etiketleri · beğeni/kaydetme · sosyal
 * bağlantılar · paylaş.
 */
export function PostDetailBody({
  data,
  owner = false,
  onEdit,
}: {
  data: PostDetailData
  owner?: boolean
  onEdit?: () => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const authed = useAuthStore((s) => !!s.user)
  /** Rapor alanının görünürlüğü için — sahiplik `username` ↔ `author.tag`. */
  const me = useAuthStore((s) => s.user)
  /** Rapor paneli açık mı (fotoğrafın sağında). */
  const [statsOpen, setStatsOpen] = useState(false)
  /* ⚠️ Hareket duyarlılığı: animasyon bir süs değil, rahatsızlık kaynağı olabilir. */
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /*
   * ⚠️ İyimser güncelleme YERİNDE yapılır (`setQueryData`), `postActions`
   * yardımcısı kullanılmaz: o yardımcı `likedByMe` alanı taşıyan **PostResponse**
   * biçimini tarıyor; buradaki detay ayrı bir DTO ve o tarama onu bulamazdı.
   */
  const toggle = useMutation({
    mutationFn: async ({ kind, on }: { kind: 'like' | 'save'; on: boolean }) => {
      if (on) await api.delete(`/posts/${data.id}/${kind}`)
      else await api.post(`/posts/${data.id}/${kind}`)
    },
    onMutate: ({ kind, on }) => {
      qc.setQueryData<PostDetailData>(['post-detail', data.id], (old) =>
        !old
          ? old
          : kind === 'like'
            ? { ...old, likedByMe: !on, likeCount: Math.max(0, old.likeCount + (on ? -1 : 1)) }
            : { ...old, savedByMe: !on, saveCount: Math.max(0, old.saveCount + (on ? -1 : 1)) },
      )
    },
    onError: (_e, { kind, on }) => {
      qc.setQueryData<PostDetailData>(['post-detail', data.id], (old) =>
        !old
          ? old
          : kind === 'like'
            ? { ...old, likedByMe: on, likeCount: Math.max(0, old.likeCount + (on ? 1 : -1)) }
            : { ...old, savedByMe: on, saveCount: Math.max(0, old.saveCount + (on ? 1 : -1)) },
      )
      toast.error(t('common.failed'))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['saved-posts'] })
    },
  })

  const shareUrl = `${window.location.origin}/post/${data.id}`
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: data.title ?? '', url: shareUrl })
        return
      } catch {
        /* vazgeçildi */
      }
    }
    await navigator.clipboard.writeText(shareUrl)
    toast.success(t('common.copied'))
  }

  /** Oturumsuz kullanıcı beğeniye basınca giriş ekranına, dönüş adresiyle. */
  const act = (kind: 'like' | 'save', on: boolean) => {
    if (!authed) {
      navigate(`/login?next=${encodeURIComponent(`/post/${data.id}`)}`)
      return
    }
    toggle.mutate({ kind, on })
  }

  /*
   * 🔴 GÖSTERİM BİLDİRİMİ — etiketler ekranda çizildi.
   *
   * ⚠️ Gönderi başına TEK istek (toplu). Etiket başına ayrı çağrı, beş
   * etiketli bir gönderide her açılışta beş HTTP isteği demekti.
   *
   * ⚠️ `useRef` bayrağı ŞART: React 19 StrictMode'da efektler iki kez koşar
   * ve gösterim sayacı her açılışta İKİYE katlanırdı. Vault'ta aynı tuzak
   * tek kullanımlık jetonda yaşanmıştı; boş bağımlılık dizisi tek başına
   * yetmiyor.
   */
  const reportedRef = useRef<string | null>(null)
  useEffect(() => {
    const ids = data.tags.map((t) => t.id)
    if (!ids.length || reportedRef.current === data.id) return
    reportedRef.current = data.id
    void reportTagImpressions(data.id, ids)
  }, [data.id, data.tags])

  const a = data.author
  /** Rapor yalnız gönderinin SAHİBİNE açılır (sunucu da 403 ile korur). */
  const canSeeStats = !!me && !!a && me.username === a.tag
  return (
    <>
      {/* --- yazar başlığı: ziyaretçi gönderiyi kimin paylaştığını görmeli --- */}
      {a && (
        <Link to={`/${a.tag}`} className="waydee-post-author">
          <Avatar src={a.avatarUrl} name={a.displayName || a.tag} className="h-9 w-9 rounded-full" />
          <span className="min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate text-[14px] font-bold leading-tight">{a.displayName || a.tag}</span>
              {a.verified && <VerifiedTick size={14} />}
            </span>
            <span className="block truncate text-[12px] text-muted">@{a.tag}</span>
          </span>
        </Link>
      )}

      {/*
        🔴 15 Ağu 2026 — RAPOR ARTIK FOTOĞRAFIN SAĞINDA AÇILIYOR.

        Kullanıcı: *"tag istatistikleri için bir buton koy, tıklayınca soft
        şekilde fotoğrafın sağında açılsın."* Eskiden panel koşulsuz olarak
        fotoğrafın ALTINDA duruyor ve gönderiyi aşağı itiyordu.

        ⚠️ Mobilde yan yana sığmaz → `flex-col`, `md`'den itibaren satır.
      */}
      <div className="flex flex-col gap-2.5 md:flex-row md:items-start">
      <div className="waydee-post-figure min-w-0 flex-1">
        {data.imageUrl ? <img src={data.imageUrl} alt={data.title ?? ''} /> : null}
        {/* Ürün etiketleri — konum YÜZDEdir (V29), her ekranda aynı noktaya düşer. */}
        {data.tags.map((tag) => (
          <a
            key={tag.id}
            href={safeHref(tag.productUrl)}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="waydee-post-tag"
            style={{ insetInlineStart: `${Number(tag.x) * 100}%`, top: `${Number(tag.y) * 100}%` }}
            title={tag.productName ?? tag.productUrl}
            /*
              🔴 Tıklama ölçülür ama gezinme ENGELLENMEZ: `preventDefault` yok,
              `await` yok. Kullanıcı ürüne gitmeye devam eder; ölçüm arka
              planda düşerse düşer (hata `reportTagClick` içinde yutulur).
              Ölçüm, ölçtüğü deneyimi geciktirmemeli.
            */
            onClick={() => void reportTagClick(data.id, tag.id)}
          >
            <span className="waydee-post-tag-dot" />
          </a>
        ))}
      </div>

      {/*
        Açılır rapor.

        🔴 Geçiş SATIR İÇİ STİLLE yazılıyor. Vault tuzağı: Tailwind'in
        rastgele-özellik geçişleri (`transition-[max-height,opacity]`) bu
        projede sessizce çalışmadı — sınıflar elemanda görünüyordu ama
        `getComputedStyle` `max-height: 0` diyordu. Görünürlüğü kritik bir
        geçişi üretilen CSS'e bağlamıyoruz.

        ⚠️ `overflow: hidden` + genişlik geçişi: kapalıyken panel yer KAPLAMAZ,
        yani fotoğraf tam genişlikte kalır.
        ⚠️ `prefers-reduced-motion` açıksa animasyon yok — hareket
        duyarlılığı olan kullanıcı için bu bir süs değil, rahatsızlık.
      */}
      {statsOpen && (
        /*
          🔴 16 Ağu 2026 — panel 340 → **400px**. Kullanıcı: *"gerekirse biraz
          yatay yap"*. Dikeyde tek ekrana sığmanın yolu yatayda yer vermekti:
          özet kutuları ve etiket satırları 340px'te sıkışıyor, satır başına
          fazladan yükseklik alıyordu.
          ⚠️ `overflow: hidden` KALDIRILDI — panelin kendi kaydırılabilir
          listesi var ve dıştaki `hidden` onu kesiyordu.
        */
        <div
          className="waydee-stats-panel min-w-0 md:w-[400px] md:shrink-0"
          style={{ animation: reduceMotion ? undefined : 'waydee-stats-in 260ms ease-out' }}
        >
          <TagStatsPanel
            postId={data.id}
            isOwner={canSeeStats}
            onBack={() => setStatsOpen(false)}
          />
        </div>
      )}
      </div>

      {data.caption && (
        <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed">{data.caption}</p>
      )}

      {/*
        🔴 ETİKET RAPOR ALANI — yalnız gönderinin SAHİBİNE (kullanıcı isteği:
        "paylaşılan fotoğraflara tıklayınca da orda rapor alanı olsun").

        ⚠️ Sahiplik `username` ↔ `author.tag` karşılaştırmasıyla belirleniyor:
        vitrin yanıtı (`PublicPost`) yazarın **kimliğini taşımıyor**, yalnız
        tutamacını. Panel yine de kendini savunuyor — sunucu sahibi olmayana
        403 döner, yani bu karşılaştırma bir GÖRÜNÜRLÜK kararıdır, güvenlik
        kapısı değil (vault kuralı: istemcinin gizlemesi güvenlik sayılmaz).
      */}


      {/* --- beğeni / kaydetme: ARTIK DÜĞME (eskiden ölü sayaçtı) --- */}
      <div className="mt-2 flex items-center gap-2">
        {/*
          🔴 ETİKET İSTATİSTİKLERİ DÜĞMESİ — yalnız sahibine görünür.
          Panel fotoğrafın sağında açılır (yukarıdaki kap).
          ⚠️ Etiketi olmayan gönderide gösterilmez: açılınca "etiket yok"
          diyen bir panel, hiç olmayan bir düğmeden daha kötüdür.
        */}
        {canSeeStats && data.tags.length > 0 && (
          <button
            type="button"
            onClick={() => setStatsOpen((v) => !v)}
            aria-expanded={statsOpen}
            aria-label={t('tagStats.title')}
            title={t('tagStats.title')}
            className={cn('waydee-post-action', statsOpen && 'waydee-post-action-on')}
          >
            <BarChart3 className="h-[18px] w-[18px]" />
          </button>
        )}
        <button
          type="button"
          onClick={() => act('like', data.likedByMe)}
          aria-pressed={data.likedByMe}
          aria-label={t('post.like')}
          className="waydee-post-action"
        >
          <Heart className={cn('h-5 w-5', data.likedByMe && 'fill-current text-danger')} />
          <span className="text-[14px] tabular-nums">{data.likeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => act('save', data.savedByMe)}
          aria-pressed={data.savedByMe}
          aria-label={t('post.save')}
          className="waydee-post-action"
        >
          <Bookmark className={cn('h-5 w-5', data.savedByMe && 'fill-current')} />
          <span className="text-[14px] tabular-nums">{data.saveCount}</span>
        </button>

        {/*
          🔴 16 Ağu 2026 — PAYLAŞ ARTIK BURADA, İKON OLARAK.
          Kullanıcı: *"altta share var, onu kaldırıp kaydetin en sağına paylaş
          ikonu koyabilirsin."* Alttaki geniş SHARE düğmesi hem bir satır
          yükseklik yiyordu hem de beğeni/kaydetme ile aynı ailedeki bir eylemi
          sayfanın öbür ucuna atıyordu. `ms-auto` ile satırın **sonuna**
          yaslanır (RTL'de doğru tarafa geçsin diye mantıksal özellik).
        */}
        <button
          type="button"
          onClick={() => void share()}
          aria-label={t('collection.share')}
          title={t('collection.share')}
          className="waydee-post-action ms-auto"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      {/* --- gönderinin sosyal bağlantıları: her iki izleyicide de görünür --- */}
      {data.socialLinks.length > 0 && (
        <div className="mt-1.5 border-t border-line pt-1.5">
          <SocialLinks links={data.socialLinks} size="sm" className="justify-start" />
        </div>
      )}

      {/*
        🔴 ALT ŞERİT SADELEŞTİ: SHARE buradan KALKTI (yukarıdaki eylem satırına
        ikon olarak taşındı). Geriye yalnız **sahibine** görünen DÜZENLE kaldı;
        sahibi olmayanda bu blok hiç çizilmez ve pencere bir satır kısalır.
        Eskiden ziyaretçide bile boş bir düğme sırası ve `mt-4` boşluğu vardı.
      */}
      {owner && onEdit && (
        <div className="mt-2.5 flex items-center justify-center">
          <button type="button" className="waydee-act waydee-act-edit" onClick={onEdit}>
            {t('post.edit')}
          </button>
        </div>
      )}
    </>
  )
}
