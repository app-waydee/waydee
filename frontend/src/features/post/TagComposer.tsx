import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { uploadImage } from '@/lib/media'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'
import { ScanOverlay, SuggestionMarkers, type TagSuggestion } from './TagSuggestions'

/** Büyütecin büyütme oranı. 2,5× etiketi isabetli bırakmaya yetiyor. */
export const ZOOM = 2.5

/**
 * Fiyat alanındaki metni sayıya çevirir — <b>virgüllü ondalık dahil</b>.
 *
 * <p>🔴 10 Ağustos 2026'da eklendi. Öncesinde iki akış da düz `Number(price)`
 * çağırıyordu; Türkçe klavyede yazılan <code>199,90</code> için bu <b>NaN</b>
 * verir ve `JSON.stringify(NaN)` <b>`null`</b>'dır — yani fiyat, hiçbir hata
 * göstermeden <b>sessizce kayboluyordu</b>. Kullanıcı "kaydolmuyor" derken
 * gördüğü şeylerden biri buydu.
 *
 * <p>⚠️ Binlik ayıracı desteklenmez ve desteklenmemeli: <code>1.299,90</code>
 * ile <code>1.29</code> arasındaki farkı tahmin etmek, yanlış fiyat yazmaktan
 * daha kötüdür. Alan zaten yalnız rakam, nokta ve virgül kabul ediyor; tek
 * ayıraç ondalık sayılır.
 *
 * @returns geçerli bir sayı ya da `null` (boş/anlamsız girdi)
 */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null
  const normalized = raw.trim().replace(',', '.')
  if (normalized === '') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export interface DraftTag {
  productUrl: string
  productName: string
  price: string
  currency: string
  /** Etiketin küçük ürün görseli (yüklenmişse medya kimliği). */
  imageMediaId?: string
  /**
   * Yüklenen görselin <b>yerel</b> önizleme adresi (`URL.createObjectURL`).
   *
   * <p>⚠️ Sunucuya GÖNDERİLMEZ — yalnız gönderi henüz kaydedilmemişken bilgi
   * kartında bir şey gösterebilmek için var. Kaydedildikten sonra imzalı
   * `imageUrl` sunucudan gelir.
   */
  imagePreviewUrl?: string
}

/**
 * Görselin üstüne çizilen <b>kaydedilmiş</b> bir etiket.
 *
 * <p>🔴 11 Ağu 2026'da `{x,y,key,title}`'dan genişletildi: nokta artık yalnız
 * bir işaret değil, <b>tıklanınca ne kaydedildiğini gösteren</b> bir yüzey.
 * Öncesinde kullanıcı doldurduğu bilgiyi bir daha göremiyor, "kaydoldu mu?"
 * sorusunun tek cevabı `title` özniteliğindeki tarayıcı ipucuydu (mobilde
 * hiç görünmez).
 */
export interface StagePoint {
  key: string
  x: number
  y: number
  /** Erişilebilir ad / tarayıcı ipucu. */
  title?: string
  productUrl?: string | null
  productName?: string | null
  price?: number | string | null
  currency?: string | null
  /** Etiketin ürün görseli (imzalı adres). */
  imageUrl?: string | null
}

/**
 * Bir yapay zekâ önerisinin <b>artık doldurulmuş</b> sayılması için nokta ile
 * kaydedilmiş etiket arasındaki azami uzaklık (0–1 normalize koordinat).
 *
 * <p>⚠️ Kimlikle eşleştirme YAPILAMAZ: öneri sunucudan gelir ve kaydedilen
 * etiketin onunla hiçbir bağı yoktur — kullanıcı forma girerken noktayı bir
 * miktar kaydırabilir. 0,04 ≈ 1000px genişliğinde 40px; aynı ürüne ikinci bir
 * etiket koyacak kadar yakın değil, elin titremesini affedecek kadar geniş.
 */
const CONSUMED_RADIUS = 0.04

/** İki normalize nokta arası öklid uzaklığı. */
function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Öneriyi tüketen kaydedilmiş etiketi bulur — yoksa `null`.
 * <p>En yakın olan seçilir: iki etiket de yarıçapa girerse rastgele birini
 * göstermek yanlış ürünün kartını açardı.
 */
function consumedBy(s: TagSuggestion, points: StagePoint[]): StagePoint | null {
  let best: StagePoint | null = null
  let bestD = CONSUMED_RADIUS
  for (const p of points) {
    const d = distance(s, p)
    if (d <= bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

/**
 * <b>Etiket bırakma yüzeyi</b> — görselin üstünde gezen <b>büyüteç</b> ve
 * kaydedilmiş etiket noktaları.
 *
 * <p>🔴 Bu bileşen <b>tek kaynaktır</b>: hem gönderi <i>oluşturma</i> akışı hem
 * <i>düzenleme</i> sayfası bunu kullanır. Kopyalanmış iki sürüm tutmak, projede
 * daha önce yaşandığı gibi (ui bileşenlerinin iki app'te kopya olması) birinin
 * sessizce geride kalmasına yol açardı.
 *
 * <p>⚠️ Konum <b>React state'ine yazılmaz</b>: `mousemove` saniyede ~60 kez
 * tetiklenir; her seferinde render etmek haritada yaşanan kasmanın aynısını
 * doğurur. Konum tek bir rAF içinde <b>doğrudan DOM'a</b> yazılır.
 *
 * <p>⚠️ Büyüteç gerçek bir mercektir: görsel, kabın {@link ZOOM} katı boyutunda
 * merceğin arka planına basılır ve `background-position` YÜZDE verilir — yüzde
 * konumlandırma imlecin altındaki noktayı merceğin ortasına hizalar. Yalnız
 * yarı saydam bir daire çizmek "büyüteç" değildir.
 */
export function TagStage({
  src,
  points,
  onPick,
  className = '',
  suggestions = [],
  scanning = false,
  onEditPoint,
  onDeletePoint,
}: {
  /** Görselin kaynağı (data URL ya da imzalı medya adresi). */
  src: string
  /** Kaydedilmiş etiketlerin konumları (0–1) ve içerikleri. */
  points: StagePoint[]
  /**
   * Tek tıklamada çağrılır — tıklanan nokta (0–1).
   *
   * ⚠️ `label` YALNIZ bir yapay zekâ önerisine dokunulduğunda dolar; boş
   * tuvale tıklandığında yoktur. Form bunu ad alanına önceden yazar.
   */
  onPick: (p: { x: number; y: number; label?: string | null }) => void
  className?: string
  /** Yapay zekânın önerdiği noktalar (0–1). Dokununca etiket formu açılır. */
  suggestions?: TagSuggestion[]
  /** Analiz sürüyor mu — görselin üstüne tarama katmanı biner. */
  scanning?: boolean
  /**
   * 🔴 17 Ağu 2026 — <b>etiketi düzenle</b>.
   *
   * <p>Kullanıcı: <i>"etiketlerin üstüne gelince etiketleri
   * düzenleyebilelim"</i>. Öncesinde kaydedilen bir etiket <b>hiçbir şekilde
   * değiştirilemiyordu</b> — yanlış yazılan bir fiyat ya da adres kalıcıydı,
   * silme yolu bile yoktu.
   *
   * <p>⚠️ Verilmezse kart salt-okunur kalır (vitrin/önizleme yüzeyleri).
   */
  onEditPoint?: (point: StagePoint) => void
  /** Etiketi sil. Verilmezse silme düğmesi çizilmez. */
  onDeletePoint?: (point: StagePoint) => void
}) {
  const t = useT()
  const [hover, setHover] = useState(false)
  /**
   * Fareyle üstünde durulan etiket.
   *
   * <p>⚠️ `openKey`'den AYRI: hover geçicidir (fare çıkınca kapanır), tıklama
   * ise kartı <b>sabitler</b>. Tek state ile yapılsaydı, karta doğru fareyi
   * götürürken kart kapanır ve düğmelerine hiç ulaşılamazdı.
   * ⚠️ Dokunmatikte hover yoktur — orada kartı tıklama açar, bu yüzden
   * düğmeler her iki girdi türünde de erişilebilir.
   */
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  /**
   * Bilgi kartı açık olan etiketin anahtarı.
   * <p>⚠️ Aynı anda TEK kart açılır — iki kart üst üste binince hangisinin
   * hangi noktaya ait olduğu okunamıyordu.
   */
  const [openKey, setOpenKey] = useState<string | null>(null)
  const pos = useRef({ x: 0.5, y: 0.5 })
  const box = useRef({ w: 0, h: 0 })
  const frame = useRef(0)
  const lensRef = useRef<HTMLSpanElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Bileşen sökülürken bekleyen kare iptal edilir (sızıntı olmasın).
  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current)
  }, [])

  /* Kart açıkken Escape kapatır — mobilde dışarı dokunmak, masaüstünde ESC. */
  useEffect(() => {
    if (!openKey) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenKey(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openKey])

  /*
   * 🔴 Nokta silinirse kart da kapanmalı. Aksi halde `openKey` var olmayan bir
   * anahtarı gösterir ve kart sessizce kaybolur — ama bir sonraki etikete
   * tıklandığında "zaten açık" sanılıp kapanma davranışı ters çalışırdı.
   */
  useEffect(() => {
    if (openKey && !points.some((p) => p.key === openKey)) setOpenKey(null)
  }, [points, openKey])

  return (
    <div className={`waydee-post-figure ${className}`}>
      <img ref={imgRef} src={src} alt="" />

      {points.map((p) => (
        <span
          key={p.key}
          className="waydee-post-tag"
          style={{ insetInlineStart: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          /* ⚠️ Olaylar KAPTA, noktanın kendisinde değil: kap hem noktayı hem
             kartı içerir, böylece fare noktadan karta geçerken kart kapanmaz. */
          onMouseEnter={() => setHoverKey(p.key)}
          onMouseLeave={() => setHoverKey((k) => (k === p.key ? null : k))}
        >
          {/*
            🔴 Nokta artık DÜĞME. `title` özniteliği mobilde hiç görünmediği
            için kaydedilen bilgi orada pratikte erişilemezdi.
            ⚠️ `stopPropagation` şart: altındaki tıklama katmanı `onPick`
            çağırıp aynı noktaya İKİNCİ bir etiket formu açıyordu.
          */}
          <button
            type="button"
            className={`waydee-post-tag-dot ${openKey === p.key ? 'waydee-post-tag-dot-open' : ''}`}
            title={p.title}
            aria-label={p.title || t('post.tagInfo')}
            aria-expanded={openKey === p.key}
            onClick={(e) => {
              e.stopPropagation()
              /*
               * 🔴 17 Ağu 2026 — TIKLAMA DOĞRUDAN DÜZENLEMEYİ AÇAR.
               *
               * Kullanıcı: "o etikete veya hafif çevresine tıklayınca o
               * etiketin güncelleme ekranı açılacak". Önceden tıklama yalnız
               * bilgi kartını açıyor, düzenlemek için kartın içindeki ikinci
               * bir düğmeye basmak gerekiyordu — düzenlemek asıl istenen şeyken
               * iki adım uzaktaydı.
               *
               * ⚠️ Düzenlenebilir DEĞİLSE (vitrin, önizleme) eski davranış
               * aynen sürer: kart açılır/kapanır.
               */
              if (onEditPoint) {
                setHoverKey(null)
                setOpenKey(null)
                onEditPoint(p)
                return
              }
              setOpenKey((k) => (k === p.key ? null : p.key))
            }}
          />
          {(openKey === p.key || hoverKey === p.key) && (
            <TagInfoCard
              point={p}
              onClose={() => {
                setOpenKey(null)
                setHoverKey(null)
              }}
              /* ⚠️ Düzenle düğmesi kartta ARTIK YOK: noktanın kendisi zaten
                 düzenlemeyi açıyor, ikinci bir yol kafa karıştırırdı.
                 Silme kartta kalır — dokunmatikte kart tıklamayla açılmadığı
                 için silme ayrıca formun içinde de var. */
              onDelete={onDeletePoint}
            />
          )}
        </span>
      ))}

      {/* ⚠️ Öneriler tıklama katmanının ÜSTÜNDE: altında kalsalardı dokunuş
          büyütece gidip önerinin kendisi tıklanamaz olurdu. */}
      <SuggestionMarkers
        points={suggestions}
        onPick={onPick}
        /* 🔴 Doldurulmuş öneri RENK DEĞİŞTİRİR ve forma değil, kaydedilen
           bilginin kartına götürür. Öneriyi tamamen kaldırmak da düşünüldü:
           kullanıcı "hangisini doldurmuştum?" bilgisini kaybederdi. */
        resolveFilled={(s) => consumedBy(s, points)}
        onOpenFilled={(p) => setOpenKey((k) => (k === p.key ? null : p.key))}
        openKey={openKey}
      />
      <ScanOverlay active={scanning} />

      <div
        className="absolute inset-0 cursor-none"
        aria-label={t('post.clickToTag')}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false)
          /*
           * 🔴 `frame.current` SIFIRLANMALI. Yalnız iptal etmek yetmiyor: kilit
           * dolu kalınca `onMouseMove` her seferinde erken dönüyor ve kullanıcı
           * görselden bir kez çıkıp geri girince büyüteç bir daha HİÇ hareket
           * etmiyordu (ölçüldü).
           */
          if (frame.current) {
            cancelAnimationFrame(frame.current)
            frame.current = 0
          }
        }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          box.current = { w: r.width, h: r.height }
          pos.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
          if (frame.current) return
          frame.current = requestAnimationFrame(() => {
            frame.current = 0
            const el = lensRef.current
            const img = imgRef.current
            if (!el || !img) return
            const { x, y } = pos.current
            el.style.insetInlineStart = `${x * 100}%`
            el.style.top = `${y * 100}%`
            /*
             * 🔴 Ölçek GÖRSELİN çizilen boyutundan alınır — kaptan değil.
             * Kabı kullanınca en/boy oranı bozuluyor ve mercek "balık gözü"
             * gibi eziliyordu (yaşandı).
             * Kap artık görsele yapışık (`width: fit-content`), yani kap = görsel;
             * bu yüzden letterbox ofseti hesaplamaya gerek YOK ve imlecin yüzdesi
             * doğrudan arka plan konumudur.
             */
            const r = img.getBoundingClientRect()
            el.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`
            el.style.backgroundPosition = `${x * 100}% ${y * 100}%`
          })
        }}
        // Tek tıklama: noktayı seç VE formu aç — iki adımlı değil.
        // ⚠️ Açık bilgi kartı önce kapanır: tuvale dokunmak "buradan çıktım"
        // demektir, kartın form penceresinin altında asılı kalması karışıklıktı.
        onClick={() => {
          setOpenKey(null)
          onPick({ ...pos.current })
        }}
      />

      <span
        ref={lensRef}
        className={`waydee-lens ${hover ? '' : 'waydee-lens-off'}`}
        style={{ backgroundImage: `url(${src})` }}
        aria-hidden
      >
        <Plus className="h-4 w-4" />
      </span>
    </div>
  )
}

/** Para birimi kodu → sembol. Bilinmeyen kod olduğu gibi yazılır. */
const CURRENCY_SIGN: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺', GBP: '£' }

/**
 * Kaydedilmiş etiketin <b>bilgi kartı</b> — noktaya bir kez tıklanınca açılır.
 *
 * <p>🔴 11 Ağu 2026. Kullanıcı: <i>"doldurulmuş etikete bir kere tıklayınca
 * doldurulan bilgiler çıksın"</i>. Öncesinde girilen ad/fiyat/adres yalnız
 * kaydediliyor, bir daha <b>hiçbir yerde</b> gösterilmiyordu.
 *
 * <p>⚠️ Kart noktanın <b>üstünde</b> durur ve yatayda ortalanır; `clamp` ile
 * kabın dışına taşmaz. Dar ekranda noktanın sağına açılsaydı, sağ kenardaki
 * bir etiketin kartı görselin dışında kalırdı.
 *
 * <p>⚠️ Adres <code>rel="noopener noreferrer"</code> ile açılır — hedef sayfa
 * kullanıcı içeriğidir ve `window.opener` üzerinden geri erişememelidir.
 */
function TagInfoCard({
  point,
  onClose,
  onDelete,
}: {
  point: StagePoint
  onClose: () => void
  /**
   * Verilirse "Sil" düğmesi çizilir (17 Ağu 2026).
   * ⚠️ "Düzenle" YOK: noktanın kendisine tıklamak zaten düzenlemeyi açıyor.
   */
  onDelete?: (point: StagePoint) => void
}) {
  const t = useT()
  const name = point.productName?.trim() || point.title?.trim() || ''
  const priceValue = point.price == null || point.price === '' ? null : Number(point.price)
  const sign = CURRENCY_SIGN[(point.currency || '').toUpperCase()] ?? point.currency ?? ''
  const url = point.productUrl?.trim() || ''
  /* Adres kartta kısaltılır: tam adres izleme parametreleriyle 300+ karakter
     olabiliyor ve kartı ekranın dışına taşırıyordu. Bağlantı yine tam adrese
     gider — gösterilen metin değil, `href` önemlidir. */
  let host = url
  try {
    host = new URL(url).host.replace(/^www\./, '')
  } catch {
    /* elle yazılmış, ayrıştırılamayan adres — olduğu gibi göster */
  }

  return (
    <div
      className="waydee-tag-info"
      role="dialog"
      aria-label={name || t('post.tagInfo')}
      /* ⚠️ Kartın içindeki tıklama, altındaki tuvale (yeni etiket) düşmemeli. */
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="waydee-tag-info-close"
        aria-label={t('common.close')}
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-center gap-2.5">
        {point.imageUrl ? (
          <img src={point.imageUrl} alt="" className="waydee-tag-info-thumb" />
        ) : (
          <span className="waydee-tag-info-thumb waydee-tag-info-thumb-empty">
            <TagIcon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {name ? (
            <p className="waydee-tag-info-name line-clamp-2">{name}</p>
          ) : (
            <p className="waydee-tag-info-name waydee-tag-info-muted">{t('post.tagNoName')}</p>
          )}
          {priceValue != null && Number.isFinite(priceValue) && (
            <p className="waydee-tag-info-price">
              {sign}
              {priceValue.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="waydee-tag-info-link"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{host}</span>
        </a>
      )}

      {/* 🔴 17 Ağu 2026 — düzenle/sil. Yalnız düzenlenebilir yüzeylerde çizilir
          (vitrin ve önizleme bu geri çağrıları vermez). */}
      {onDelete && (
        <div className="waydee-tag-info-actions">
          {onDelete && (
            <button
              type="button"
              className="waydee-tag-info-action waydee-tag-info-action-danger"
              onClick={() => onDelete(point)}
            >
              <Trash2 className="h-3 w-3" />
              {t('common.delete')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * <b>Add Tag</b> penceresi — referansla birebir, <b>tek kaynak</b>.
 *
 * ```
 *                Add Tag                (✕)
 *   ┌──────────────────────────────────────┐
 *   │ https://                             │
 *   ├──────────────────────────────────────┤
 *   │ Product Name                         │
 *   ├────────┬─────────────────────────────┤
 *   │  🏷    │  $ 0                 USD ⌄  │
 *   └────────┴─────────────────────────────┘
 *   ☑ Auto Fetch Data
 *                          Cancel   [ Save ]
 * ```
 */
export function AddTagDialog({
  onCancel,
  onSave,
  busy = false,
  initialName = '',
  initialTag,
  onDelete,
}: {
  onCancel: () => void
  onSave: (tag: DraftTag) => void
  busy?: boolean
  /**
   * Yapay zekânın bulduğu ürün adı — form bununla açılır (10 Ağu 2026).
   * ⚠️ Yalnız BAŞLANGIÇ değeridir; kullanıcı serbestçe değiştirir. Modelin
   * adını kilitlemek, yanlış bir tahmini düzeltilemez hâle getirirdi.
   */
  initialName?: string
  /**
   * 🔴 17 Ağu 2026 — <b>DÜZENLEME MODU</b>. Doluysa form kayıtlı değerlerle
   * açılır, başlık "Etiketi düzenle" olur.
   *
   * <p>⚠️ Ayrı bir bileşen YAZILMADI: alanlar, doğrulama ve Auto Fetch birebir
   * aynı: iki kopya tutmak, projede daha önce yaşandığı gibi (etiket yüzeyi
   * bir kez kopyalanmış ve biri geride kalmıştı) birinin sessizce eskimesine
   * yol açardı.
   */
  initialTag?: DraftTag | null
  /** Düzenleme modunda "Sil" düğmesi — verilmezse çizilmez. */
  onDelete?: () => void
}) {
  const t = useT()
  const editing = !!initialTag
  const [url, setUrl] = useState(initialTag?.productUrl || 'https://')
  const [name, setName] = useState(initialTag?.productName || initialName)
  const [price, setPrice] = useState(initialTag?.price ?? '')
  const [currency, setCurrency] = useState(initialTag?.currency || 'USD')
  /* ⚠️ Düzenlemede Auto Fetch KAPALI başlar: adres zaten dolu olduğu için
     alandan çıkarken tetiklenir ve kullanıcının elle düzelttiği adı/fiyatı
     sunucudan gelenle ezme riski taşırdı. */
  const [autoFetch, setAutoFetch] = useState(!editing)
  const [fetching, setFetching] = useState(false)
  const [thumb, setThumb] = useState<{ id: string; url: string } | null>(
    initialTag?.imageMediaId
      ? { id: initialTag.imageMediaId, url: initialTag.imagePreviewUrl || '' }
      : null,
  )
  const thumbInput = useRef<HTMLInputElement>(null)

  /*
   * <b>Auto Fetch Data</b> — adres yazılıp alandan çıkılınca sunucudan ad,
   * görsel ve fiyat çekilir.
   *
   * ⚠️ İstek SUNUCUYA gider, hedef siteye tarayıcıdan değil: üçüncü taraf
   * sayfalar CORS izni vermez ve verse bile kullanıcının IP'siyle istek atmak
   * gereksiz bir iz bırakırdı. Sunucu tarafında SSRF kapıları var.
   * ⚠️ Başarısızlık sessizdir: alanlar boş kalır, kullanıcı elle doldurur —
   * etiket eklemeyi bir dış sitenin erişilebilirliğine bağlamak akışı kırardı.
   */
  const runAutoFetch = async () => {
    const clean = url.trim()
    if (!autoFetch || fetching || clean === '' || clean === 'https://') return
    setFetching(true)
    try {
      const res = await api.get<{ title: string | null; imageUrl: string | null; price: number | null; currency: string | null }>(
        `/profile-posts/link-preview?url=${encodeURIComponent(clean)}`,
      )
      const d = res.data
      if (d.title && !name.trim()) setName(d.title)
      if (d.price != null && !price) setPrice(String(d.price))
      if (d.currency) setCurrency(d.currency.toUpperCase())
    } catch {
      /* sessiz — elle doldurulur */
    } finally {
      setFetching(false)
    }
  }

  const pickThumb = async (file: File | null) => {
    if (!file) return
    const media = await uploadImage(file)
    setThumb({ id: media.id, url: URL.createObjectURL(file) })
  }

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [onCancel])

  const canSave = url.trim() !== '' && url.trim() !== 'https://' && !busy

  return (
    <div
      className="waydee-sheet-scrim"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="waydee-sheet">
        <div className="relative mb-5">
          <h2 className="text-center text-[15px] font-bold text-ink">
            {editing ? t('post.editTag') : t('post.addTag')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('common.close')}
            className="absolute end-0 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            className="waydee-sheet-input"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={runAutoFetch}
            autoFocus
            inputMode="url"
          />
          <input
            className="waydee-sheet-input"
            placeholder={t('post.productName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={140}
          />

          <div className="flex items-stretch gap-3">
            {/* Ürün görseli yuvası — referansta solda kare, içinde etiket ikonu. */}
            {/* Ürün görseli yuvası — tıklanınca dosya seçilir; referansta da
                bu kare bir yükleme alanıdır. */}
            <button
              type="button"
              className="waydee-tag-thumb"
              onClick={() => thumbInput.current?.click()}
              aria-label={t('post.productImage')}
            >
              {thumb && thumb.url ? (
                <img src={thumb.url} alt="" className="h-full w-full rounded-[0.625rem] object-cover" />
              ) : fetching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <TagIcon className="h-6 w-6" />
              )}
            </button>
            <input
              ref={thumbInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => pickThumb(e.target.files?.[0] ?? null)}
            />
            <span className="waydee-price-field">
              <span className="text-muted">$</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                inputMode="decimal"
                aria-label={t('post.price')}
              />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
                <option value="GBP">GBP</option>
              </select>
            </span>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              className="waydee-check"
              checked={autoFetch}
              onChange={(e) => setAutoFetch(e.target.checked)}
            />
            {t('post.autoFetch')}
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-4">
          {/* 🔴 Silme formda DA var: dokunmatik cihazda hover yoktur, yani
              noktanın bilgi kartı hiç açılmaz ve karttaki silme düğmesine
              ulaşılamazdı. Nokta tıklanınca form açıldığı için tek erişilebilir
              yol burasıdır. */}
          {editing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="waydee-danger-text me-auto"
            >
              {t('common.delete')}
            </button>
          )}
          <button type="button" onClick={onCancel} className="waydee-sheet-cancel">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                productUrl: url.trim(),
                productName: name.trim(),
                price,
                currency,
                imageMediaId: thumb?.id,
                imagePreviewUrl: thumb?.url,
              })
            }
            disabled={!canSave}
            className="waydee-sheet-submit"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
