import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, Sparkles, UploadCloud, X } from 'lucide-react'
import { AiPickerDialog } from '@/features/ai/AiPickerDialog'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { fileFromDataUrl, uploadImage } from '@/lib/media'
import { TagSuggestionBar, type TagSuggestion } from './TagSuggestions'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'
import { AddTagDialog, TagStage, parsePrice, type StagePoint } from '@/features/post/TagComposer'
import { usePlan } from '@/features/plan/PlanBadge'

/** Fotoğrafın üstündeki bir etiket — konum YÜZDE (0–1), piksel değil. */
interface DraftTag {
  x: number
  y: number
  productUrl: string
  productName: string
  price: string
  currency: string
  /** Etiketin ürün görseli — ⚠️ eskiden bu alan burada YOKTU ve `AddTagDialog`'un
      yüklediği görsel gönderilmeden atılıyordu. */
  imageMediaId?: string
  /** Yalnız arayüz için: gönderi kaydedilmeden önceki yerel önizleme. */
  imagePreviewUrl?: string
}

/**
 * 🔴 10 Ağu 2026 — ÜÇÜNCÜ ADIM EKLENDİ: `preview`.
 *
 * <b>Yaşanan hata:</b> etiket adımındaki düğmenin üstünde <b>"Ön izle"</b>
 * yazıyordu ama `onClick` doğrudan <b>`save`</b> idi — yani kullanıcı önizleme
 * beklerken gönderi <b>yayınlanıyordu</b>. Düğmenin adı ile yaptığı işin
 * ayrışması, geri alınamayan bir eylemde en kötü hata türüdür.
 */
type Step = 'compose' | 'tags' | 'preview'

/**
 * Gönderi oluşturma akışı — <b>referans ekran görüntüleriyle birebir</b>.
 *
 * ```
 * 1) CREATE A NEW POST : ad + kesikli çerçeveli yükleme alanı
 * 2) (görsel seçilince) : üçte bir ızgaralı kırpma + zoom kaydırıcısı
 * 3) Continue           : "Click on image to add tags"
 * 4) görsele tıkla      : Add Tag (URL · ad · fiyat + para birimi · Auto Fetch)
 * 5) Preview            : gönderi + etiketler TEK istekte kaydedilir
 * ```
 *
 * ⚠️ <b>Kırpma canvas ile yapılır ve `FileReader.readAsDataURL` kullanılır.</b>
 * `URL.createObjectURL` + cleanup React 19 StrictMode'da ölü URL üretiyor
 * (efekt iki kez koşuyor, ilk cleanup blob'u iptal ediyor) — bu tuzak bu
 * projede kırpma özelliğini bir kez sessizce bozmuştu.
 */
export function CreatePostFlow({
  open,
  onClose,
  collectionId,
}: {
  open: boolean
  onClose: () => void
  /**
   * <b>Koleksiyon içinden açıldıysa o koleksiyonun kimliği</b> (16 Ağu 2026).
   *
   * <p>🔴 Kullanıcı: <i>"koleksiyonda post paylaşılırsa direkt o koleksiyona
   * eklensin ve gönderilerde de görünsün."</i> Önceden `CollectionPage` bu
   * akışı <b>koleksiyonu hiç söylemeden</b> açıyordu: gönderi oluşuyor, ama
   * koleksiyona eklenmediği için oluşturulduğu ekranda <b>görünmüyordu</b>.
   *
   * <p>⚠️ Gönderi yine normal bir gönderidir — "Gönderiler" sekmesinde de
   * çıkar. Koleksiyon bir <b>etikettir</b>, ayrı bir depo değil.
   */
  collectionId?: string
}) {
  const t = useT()
  const qc = useQueryClient()
  /* Etiket kotası sunucudan okunur — sayı istemcide SABİTLENMEZ, ileride
     plan değişirse tek kaynak yine sunucu olsun. */
  const { data: plan } = usePlan()
  const [step, setStep] = useState<Step>('compose')
  const [title, setTitle] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  /* Görselin doğal ölçüsü ve kırpma kutusunun kenarı — ikisi de kırpma
     matematiğinin girdisi (bkz. `coverScale` / `minZoom`). */
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [boxSize, setBoxSize] = useState(0)
  const [cropped, setCropped] = useState<string | null>(null)
  const [tags, setTags] = useState<DraftTag[]>([])
  /* Yapay zekâ önerileri ve tarama durumu — TagStage bunları görselin üstünde
     çizer. */
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [scanning, setScanning] = useState(false)
  /* ⚠️ `label`: yapay zekâ önerisine dokunulduysa ürünün adı burada taşınır
     ve etiket formu onunla açılır (10 Ağu 2026). */
  const [pending, setPending] = useState<{ x: number; y: number; label?: string | null } | null>(null)
  /**
   * 🔴 17 Ağu 2026 — düzenlenen etiketin indeksi (yoksa `null`).
   * ⚠️ Etiketin KENDİSİ değil indeksi tutulur: form kaydedince listede o
   * konumu değiştirmek gerekiyor ve nesne kimliğiyle aramak, iki etiket
   * aynı ürüne konduğunda yanlış satırı bulurdu.
   */
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  /** Yapay zekâ galerisi açık mı (V45). */
  const [aiPicker, setAiPicker] = useState(false)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const reset = useCallback(() => {
    setStep('compose'); setTitle(''); setDataUrl(null); setZoom(1)
    setOffset({ x: 0, y: 0 }); setCropped(null); setTags([]); setPending(null); setBusy(false)
    setEditIndex(null)
    setNat(null)
  }, [])

  const close = () => { reset(); onClose() }

  /*
   * Kırpma kutusunun kenarı state'te tutulur. Ölçü `useEffect` yerine
   * **callback ref** ile alınır: kutu yalnız görsel seçilince var olur, oysa
   * hook'lar erken `return null`'dan ÖNCE çağrılmak zorundadır — efektle
   * yazılsaydı ya hook sırası bozulurdu ya da kutu daha doğmadan ölçülürdü.
   */
  const roRef = useRef<ResizeObserver | null>(null)
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    if (!el) return
    const measure = () => setBoxSize(el.clientWidth)
    measure()
    roRef.current = new ResizeObserver(measure)
    roRef.current.observe(el)
  }, [])

  // Kilit: `overflow:hidden` DEĞİL, sayaçlı lockScroll (vault tuzağı).
  const lockRef = useRef<null | (() => void)>(null)
  if (open && !lockRef.current) lockRef.current = lockScroll()
  if (!open && lockRef.current) { lockRef.current(); lockRef.current = null }

  if (!open) return null

  const pickFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setNat(null)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setDataUrl(String(reader.result))
    }
    reader.readAsDataURL(file)
  }

  /*
   * 🔴 9 Ağu 2026 — KIRPMA ARTIK UZAKLAŞABİLİYOR (kullanıcı: "sağda solda
   * üstte altta büyük bir kısım alanın içerisine girilmiyor").
   *
   * <b>Kök neden:</b> kaydırıcının tabanı <b>1 = kapsama (cover)</b> idi ve
   * daha aşağı inemiyordu. Kare kutuda cover demek, dikey bir fotoğrafın
   * üstünü ve altını, yatay bir fotoğrafın da iki yanını <b>zorunlu olarak</b>
   * kesmek demektir — 3:4 çekilmiş bir üründe görüntünün dörtte biri kayboluyordu.
   *
   * <b>Çözüm:</b> tabanı <b>sığdırma (contain)</b>ya indir. `minZoom` iki ölçek
   * arasındaki orandır (`contain / cover`, her zaman ≤ 1); 1'de davranış
   * eskisiyle birebir aynı kalır — yani varsayılan bozulmadı, yalnızca aşağısı
   * açıldı. Sığdırmada kalan boşluk siyahla dolar (tuval zaten siyah basıyor).
   */
  const coverScale = nat && boxSize > 0 ? Math.max(boxSize / nat.w, boxSize / nat.h) : 1
  const containScale = nat && boxSize > 0 ? Math.min(boxSize / nat.w, boxSize / nat.h) : 1
  const minZoom = nat && boxSize > 0 ? +(containScale / coverScale).toFixed(3) : 1

  /**
   * Sürüklemeyi kutuda tutar: görselin kenarı hiçbir zaman kutunun içine
   * kaçamaz. Uzaklaşmada (görsel kutudan küçük) tek geçerli konum ortadır.
   */
  const clampOffset = (x: number, y: number, z: number) => {
    if (!nat || boxSize <= 0) return { x, y }
    const s = coverScale * z
    const maxX = Math.max(0, (nat.w * s - boxSize) / 2)
    const maxY = Math.max(0, (nat.h * s - boxSize) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  const setZoomClamped = (z: number) => {
    const next = Math.min(3, Math.max(minZoom, +z.toFixed(3)))
    setZoom(next)
    setOffset((o) => clampOffset(o.x, o.y, next))
  }

  /**
   * Kırpma sonucunu 1:1 kareye çizer (referansın kare ızgarası).
   *
   * <p>⚠️ Ölçüler artık `getBoundingClientRect` yerine <b>matematikten</b>
   * gelir: uzaklaşınca görsel kutudan küçük kalıyor ve rect okuması ile
   * `transform` arasındaki yuvarlama farkı kenarda bir piksellik kayma
   * bırakıyordu. Aynı formül ekranda da kullanıldığı için önizleme ile
   * kaydedilen kare <b>birebir</b> aynı.
   */
  const crop = (): string | null => {
    const img = imgRef.current
    if (!img || !nat || boxSize <= 0) return null
    const SIZE = 1080
    const canvas = document.createElement('canvas')
    canvas.width = SIZE; canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // Sığdırmada kalan boşluk siyah kalır (referansın kare karosu).
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, SIZE, SIZE)
    const k = SIZE / boxSize // kutu pikselinden tuval pikseline
    const s = coverScale * zoom
    const w = nat.w * s * k
    const h = nat.h * s * k
    ctx.drawImage(img, (SIZE - w) / 2 + offset.x * k, (SIZE - h) / 2 + offset.y * k, w, h)
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  const toTagStep = () => {
    const out = crop()
    if (!out) return
    setCropped(out)
    setStep('tags')
  }


  /*
   * ═══════════════════════════════════════════════════════════════════
   * 🔴 17 Ağu 2026 — ETİKET KOTASI ARTIK BU EKRANDA UYGULANIYOR
   *
   * <b>Bildirilen hata:</b> "ücretsiz planda 3'ten fazla etikete izin
   * veriyor, sonraki adımda uyarı veriyor".
   *
   * <b>Kök neden:</b> sınır YALNIZ sunucudaydı ve sunucuya ilk gidiş
   * `save()` anındaydı — yani kullanıcı dördüncü etiketi ekliyor, form
   * kapanıyor, nokta görselde beliriyor ve her şey kaydolmuş gibi
   * görünüyordu. Hata ancak <b>Paylaş</b>'a basınca çıkıyor ve o noktada
   * kullanıcı hangi etiketi silmesi gerektiğini de bilmiyordu.
   *
   * ⚠️ Sunucu kontrolü KALDIRILMADI — buradaki kontrol bir kolaylıktır,
   * güvenlik sınırı değil. İstemcinin düğmeyi gizlemesi güvenlik sayılmaz
   * (vault kuralı); `PlanService.assertTagCount` yerinde duruyor.
   * ═══════════════════════════════════════════════════════════════════
   */
  /*
   * 🔴🔴 17 Ağu 2026 — HAFTALIK GÖNDERİ KOTASI ARTIK EN BAŞTA SORULUYOR.
   *
   * <b>Bildirilen:</b> "fotoğraf paylaşılmıyor, gönderi oluşturulamadı hatası".
   *
   * <b>Ölçülen:</b> sunucuda hata YOK; istek temiz bir 403
   * `PLAN_LIMIT_REACHED` alıyordu (ücretsiz plan: haftada 1 gönderi).
   * Ama kapı akışın EN SONUNDAYDI: kullanıcı fotoğrafı seçiyor, kırpıyor,
   * etiketliyor, önizliyor, "Paylaş"a basıyor — görsel S3'e YÜKLENİYOR — ve
   * ancak ondan sonra reddediliyordu.
   *
   * <b>İkinci zarar:</b> her başarısız denemede yüklenen görsel depoda
   * ÖKSÜZ kalıyor. Diskten sayıldı: 12 medya nesnesi, 1 gönderi.
   *
   * ⚠️ Sunucu kontrolü yerinde duruyor; bu bir kolaylık, güvenlik sınırı
   * değil (etiket kotasındaki desenin aynısı).
   */
  const postsLeft = plan?.postsLeftThisWeek ?? -1
  const weeklyBlocked = plan != null && postsLeft === 0

  const tagLimit = plan?.tagsPerPost ?? -1
  const unlimitedTags = tagLimit < 0
  const tagLimitReached = !unlimitedTags && tags.length >= tagLimit

  /** Yeni etiket için tuvale tıklama — kota doluysa forma HİÇ geçilmez. */
  const pickSpot = (p: { x: number; y: number; label?: string | null }) => {
    if (tagLimitReached) {
      toast.error(t('post.tagLimitReached', { max: tagLimit }))
      return
    }
    setEditIndex(null)
    setPending(p)
  }

  const save = async () => {
    if (!cropped) return
    setBusy(true)
    /*
     * Referansın (`taag.app`) akışı paketten okundu:
     *   toast.loading("Creating your post", { id })   ← süresiz
     *   …iş biter…
     *   toast.remove(id) + "Your new post is live" + "View Post" + 🥳
     * ⚠️ Yükleme bildirimi SÜRESİZ açılır ve `finally`'de kapatılır — süreli
     * olsaydı uzun bir yüklemenin ortasında kaybolur, kullanıcı takıldı sanardı.
     */
    const loadingId = toast.loading(t('post.creating'))
    try {
      /* 🔴 17 Ağu 2026 — `fetch(cropped)` KALDIRILDI. `fetch`, `data:`
         adreslerinde de `connect-src`'ye tabidir; CSP zorlayıcı moda
         alınınca bu satır engellendi ve gönderi paylaşımı TAMAMEN durdu
         (sunucuya istek bile gitmiyordu). Gerekçe: `fileFromDataUrl`. */
      const media = await uploadImage(fileFromDataUrl(cropped))
      const created = await api.post<{ id: string }>('/profile-posts', {
        title: title.trim() || null,
        mediaId: media.id,
        tags: tags.map((tg) => ({
          x: tg.x, y: tg.y,
          productUrl: tg.productUrl,
          productName: tg.productName || null,
          /* ⚠️ Virgüllü ondalık ("199,90") düz `Number()` ile NaN olur ve
             JSON'da null'a düşerdi — fiyat sessizce kaybolurdu. */
          price: parsePrice(tg.price),
          currency: parsePrice(tg.price) != null ? tg.currency || null : null,
          // ⚠️ Ürün görseli TAŞINIR: yüklenip sonra sessizce atılıyordu.
          imageMediaId: tg.imageMediaId ?? null,
        })),
      })
      /*
       * 🔴 Koleksiyon içinden açıldıysa gönderi O KOLEKSİYONA da eklenir.
       * ⚠️ Ayrı bir `try` içinde: koleksiyona ekleme başarısız olsa bile
       * gönderi ZATEN oluştu ve kullanıcıya "olmadı" demek yanlış olurdu —
       * bu yüzden hata ayrı bildirilir, akış kesilmez.
       */
      if (collectionId) {
        try {
          await api.post(`/collections/${collectionId}/posts`, { postId: created.data.id })
          await qc.invalidateQueries({ queryKey: ['collection-posts', collectionId] })
          await qc.invalidateQueries({ queryKey: ['collection', collectionId] })
        } catch (err) {
          toast.error(apiErrorMessage(err, t('collection.addFailed')))
        }
      }
      await qc.invalidateQueries({ queryKey: ['profile-posts'] })
      await qc.invalidateQueries({ queryKey: ['collections'] })
      await qc.invalidateQueries({ queryKey: ['my-report'] })
      close()
      // Referansın başarı bildirimi: 🥳 + UPPERCASE metin + "View Post".
      toast.live(t('post.live'), t('post.view'), () => {
        window.location.assign(`/home?tab=posts&post=${created.data.id}`)
      })
    } catch (err) {
      toast.error(apiErrorMessage(err, t('post.createFailed')))
    } finally {
      // ⚠️ `finally`: hata yolunda da kapanmalı, yoksa yükleme bildirimi
      // ekranda sonsuza kadar asılı kalırdı.
      toast.dismiss(loadingId)
      setBusy(false)
    }
  }

  return createPortal(
    <div className="waydee-create-scrim" role="dialog" aria-modal="true">
      {step === 'compose' ? (
        <div className="waydee-post-modal">
          <div className="relative mb-4">
            <h2 className="text-center text-base font-bold uppercase tracking-wide">
              {t('post.createTitle')}
            </h2>
            <button type="button" onClick={close} aria-label={t('common.close')}
              className="absolute end-0 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>

          <input className="waydee-post-title-input" value={title} placeholder={t('post.namePlaceholder')}
            onChange={(e) => setTitle(e.target.value)} maxLength={140} />

          <div className="mt-4">
            {weeklyBlocked ? (
              /* 🔴 Kota dolu: kullanıcıya İŞ YAPTIRMADAN söyle. Eskiden
                 fotoğrafı yükleyip kırptıktan SONRA reddediliyordu. */
              <div className="waydee-quota-block">
                <p className="text-[14px] font-bold text-ink">{t('post.weeklyLimitTitle')}</p>
                <p className="mt-1 text-[13px] leading-snug text-muted">
                  {t('post.weeklyLimitBody', { max: plan?.weeklyPosts ?? 1 })}
                </p>
                <button
                  type="button"
                  onClick={() => window.location.assign('/plan')}
                  className="waydee-page-btn mt-4"
                >
                  {t('post.tagLimitUpgrade')}
                </button>
              </div>
            ) : !dataUrl ? (
              <>
              <label
                className="waydee-dropzone cursor-pointer"
                data-over={over}
                onDragOver={(e) => { e.preventDefault(); setOver(true) }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f) }}
              >
                <UploadCloud className="h-7 w-7" />
                <span className="text-sm">{t('post.dropzone')}</span>
                <span className="text-xs">PNG, JPG</span>
                <input type="file" accept="image/png,image/jpeg" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
              </label>
              {/*
                🔴 16 Ağu 2026 (V45) — YAPAY ZEKÂ GÖRSELİNDEN GÖNDERİ.
                Kullanıcı: "oluşturulan görseller post/hikâye kısmında
                depolamadan görünecek, isterse ekleyip paylaşabilecek."
                ⚠️ Seçilen görsel `pickFile` ile AYNI yola girer: kırpma,
                etiketleme ve kaydetme adımları tek satır bile değişmedi.
                İkinci bir "hazır medyayı doğrudan yayınla" yolu açmak,
                etiket ve kırpma mantığını çatallandırırdı.
              */}
              <button
                type="button"
                onClick={() => setAiPicker(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-subtle"
              >
                <Sparkles className="h-4 w-4 text-violet" />
                {t('ai.pickTitle')}
              </button>
              </>
            ) : (
              <>
                <div
                  ref={boxRef}
                  className="waydee-cropper"
                  style={{ touchAction: 'none', cursor: dragRef.current ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) => { dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }; e.currentTarget.setPointerCapture(e.pointerId) }}
                  onPointerMove={(e) => { if (dragRef.current) setOffset(clampOffset(e.clientX - dragRef.current.x, e.clientY - dragRef.current.y, zoom)) }}
                  onPointerUp={() => { dragRef.current = null }}
                >
                  {/*
                    🔴 Ölçü artık `minWidth/minHeight: 100%` ile DEĞİL, görselin
                    doğal pikseliyle verilir ve ölçek `transform`'dan gelir.
                    Eski kurulumda tarayıcı kutuyu kapatmayı garanti ediyordu
                    (cover) ve `scale(1)`'in altına inmek fiilen imkânsızdı —
                    kullanıcı fotoğrafın tamamını çerçeveye alamıyordu.
                    🔴 `pointer-events: none` ŞART: aksi halde işaretçi olayları
                    görselde kalıyor, sürükleme kabına hiç ulaşmıyordu — fotoğraf
                    "sağa sola oynamıyordu" (yaşandı).
                  */}
                  <img ref={imgRef} src={dataUrl} alt=""
                    onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                    style={
                      nat
                        ? {
                            width: `${nat.w}px`,
                            height: `${nat.h}px`,
                            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${coverScale * zoom})`,
                            transformOrigin: 'center',
                          }
                        : { opacity: 0 }
                    } />
                  <div className="waydee-cropper-grid" />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button type="button" className="waydee-zoom-btn" onClick={() => setZoomClamped(zoom - 0.1)} aria-label="-">
                    <Minus className="h-4 w-4" />
                  </button>
                  {/* ⚠️ Taban `minZoom` — sabit 1 DEĞİL: 1'de fotoğraf kutuyu
                      kaplar ve kenarları zorunlu olarak kesilir. */}
                  <input type="range" min={minZoom} max={3} step={0.01} value={zoom} className="flex-1"
                    onChange={(e) => setZoomClamped(Number(e.target.value))} aria-label={t('post.zoom')} />
                  <button type="button" className="waydee-zoom-btn" onClick={() => setZoomClamped(zoom + 0.1)} aria-label="+">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {/* Tek dokunuşla iki uç: tamamını sığdır ↔ kutuyu kapla. */}
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button type="button" className="waydee-crop-fit" onClick={() => setZoomClamped(minZoom)}>
                    {t('post.fitWhole')}
                  </button>
                  <button type="button" className="waydee-crop-fit" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }}>
                    {t('post.fillFrame')}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-4">
            <button type="button" onClick={close} className="waydee-danger-text">{t('common.cancel')}</button>
            <button type="button" onClick={toTagStep} disabled={!dataUrl || weeklyBlocked}
              className="waydee-page-btn disabled:cursor-not-allowed disabled:opacity-40">
              {t('common.continue')}
            </button>
          </div>

          {/* ⚠️ Pencere `compose` adımının İÇİNDE: kırpma adımına geçilince
              galeriden seçim anlamını yitirir ve iki üst üste modal kalırdı. */}
          {aiPicker && (
            <AiPickerDialog onClose={() => setAiPicker(false)} onPicked={(f) => pickFile(f)} />
          )}
        </div>
      ) : step === 'tags' ? (
        <div className="flex w-full flex-col items-center">
          <p className="mb-3 text-center text-base">{t('post.clickToTag')}</p>
          {/* 🔴 Büyüteç ve etiket noktaları DÜZENLEME ekranıyla AYNI bileşenden
              gelir (`TagComposer`). İki ayrı kopya tutmak, birinin sessizce
              geride kalmasına yol açıyordu — kullanıcı "iki yerde de birebir
              aynı olacak" dedi, tek kaynak bunun garantisi. */}
          <TagStage
            className="w-full"
            src={cropped!}
            points={tags.map((tg, i) => ({
              key: String(i),
              x: tg.x,
              y: tg.y,
              title: tg.productName || tg.productUrl,
              /* 🔴 Bilgi kartı için tam içerik (11 Ağu 2026): nokta artık
                 tıklanınca ne kaydedildiğini gösteriyor. */
              productName: tg.productName,
              productUrl: tg.productUrl,
              price: parsePrice(tg.price),
              currency: tg.currency,
              imageUrl: tg.imagePreviewUrl ?? null,
            }))}
            onPick={pickSpot}
            suggestions={suggestions}
            scanning={scanning}
            /* 🔴 Etiket düzenleme: nokta anahtarı listedeki İNDEKSTİR
               (yukarıda `key: String(i)` ile üretiliyor). */
            onEditPoint={(point: StagePoint) => {
              setEditIndex(Number(point.key))
              setPending({ x: point.x, y: point.y })
            }}
            onDeletePoint={(point: StagePoint) => {
              const i = Number(point.key)
              setTags((prev) => prev.filter((_, idx) => idx !== i))
              toast.success(t('post.tagDeleted'))
            }}
          />

          {/* 🔴 Kota şeridi — sayaç HER ZAMAN görünür, sınır dolunca kırmızıya
              döner. Yalnız hata anında göstermek, kullanıcıya kaç etiket
              hakkı kaldığını hiç söylememek demekti. */}
          <div className="waydee-tag-quota" data-full={tagLimitReached}>
            <span className="waydee-tag-quota-count">
              {unlimitedTags
                ? t('post.tagsUnlimited', { used: tags.length })
                : t('post.tagsUsed', { used: tags.length, max: tagLimit })}
            </span>
            {tagLimitReached && (
              <>
                <span>{t('post.tagLimitReached', { max: tagLimit })}</span>
                <button
                  type="button"
                  className="waydee-tag-quota-upgrade"
                  onClick={() => window.location.assign('/plan')}
                >
                  {t('post.tagLimitUpgrade')}
                </button>
              </>
            )}
          </div>
          {/* 🔴 Yapay zekâ önerisi — Premium'a özel. Premium olmayan burada
              yükseltme daveti görür; kapı sunucudadır, düğmeyi gizlemek
              güvenlik değildir. */}
          <TagSuggestionBar
            imageSrc={cropped}
            suggestionCount={suggestions.length}
            onScanning={setScanning}
            onSuggestions={setSuggestions}
          />
          <div className="mt-6 flex items-center gap-4">
            <button type="button" onClick={close} className="waydee-ghost-btn">{t('common.cancel')}</button>
            {/* ⚠️ Bu düğme ARTIK KAYDETMEZ; önizleme adımına geçer. */}
            <button type="button" onClick={() => setStep('preview')} className="waydee-page-btn">
              {t('post.preview')}
            </button>
          </div>

          {pending && (
            <AddTagDialog
              initialName={pending.label ?? ''}
              /* Düzenlemede form kayıtlı değerlerle açılır. */
              initialTag={editIndex != null ? tags[editIndex] : null}
              onCancel={() => { setPending(null); setEditIndex(null) }}
              onDelete={
                editIndex != null
                  ? () => {
                      setTags((prev) => prev.filter((_, i) => i !== editIndex))
                      setPending(null)
                      setEditIndex(null)
                      toast.success(t('post.tagDeleted'))
                    }
                  : undefined
              }
              onSave={(tag) => {
                setTags((prev) =>
                  editIndex != null
                    ? /* ⚠️ Konum KORUNUR: düzenleme formu noktayı taşımaz,
                         yalnız içeriği değiştirir. */
                      prev.map((old, i) =>
                        i === editIndex ? { ...tag, x: old.x, y: old.y } : old,
                      )
                    : [...prev, { ...tag, x: pending.x, y: pending.y }],
                )
                if (editIndex != null) toast.success(t('post.tagUpdated'))
                setPending(null)
                setEditIndex(null)
              }}
            />
          )}
        </div>
      ) : (
        /*
         * ---- ÖNİZLEME ----
         * Gönderi yayınlanmadan önce TAM OLARAK yayınlanacağı hâliyle görünür:
         * ad, kare görsel ve ürün etiketleri. Yayınlama yalnız buradaki
         * <b>Paylaş</b> düğmesiyle olur; "Geri" etiket adımına döner ve hiçbir
         * şey kaybolmaz (etiketler bileşen durumunda duruyor).
         */
        <div className="flex w-full flex-col items-center">
          <p className="mb-3 text-center text-base font-semibold">{t('post.previewTitle')}</p>
          <div className="waydee-post-modal">
            <h2 className="mb-3 truncate text-[13px] font-bold uppercase tracking-wide text-ink">
              {title.trim() || t('post.untitled')}
            </h2>
            <div className="waydee-post-figure">
              <img src={cropped!} alt="" />
              {tags.map((tg, i) => (
                <span
                  key={i}
                  className="waydee-post-tag"
                  style={{ insetInlineStart: `${tg.x * 100}%`, top: `${tg.y * 100}%` }}
                  title={tg.productName || tg.productUrl}
                >
                  <span className="waydee-post-tag-dot" />
                </span>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-muted">
              {t('post.previewTags')}: {tags.length}
            </p>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <button type="button" onClick={() => setStep('tags')} disabled={busy} className="waydee-ghost-btn">
              {t('common.back')}
            </button>
            <button type="button" onClick={save} disabled={busy} className="waydee-page-btn">
              {busy ? <Spinner /> : t('post.publish')}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

/** "Add Tag" — referanstaki alan sırası: URL · ad · (ikon) fiyat + para birimi · Auto Fetch. */
