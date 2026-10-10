import QRCode from 'qrcode'
import { t } from '@/i18n'

/**
 * <b>MAĞAZA DUYURU KARTI</b> — 1080×1080 canvas.
 *
 * <p>🔴 <b>10 Ağustos 2026'da bu kart baştan yazıldı.</b> Öncesinde
 * *"Ben de Waydee'deyim!"* diyen bir <b>katılım</b> kartıydı ve <b>kayıt
 * olur olmaz</b> herkese gösteriliyordu. Kullanıcı bunu kapattı: kart artık
 * yalnız <b>Premium'a geçip haritada mağazasını açan</b> kişi için üretilir ve
 * duyurduğu şey katılmak değil, <b>mağazanın açılmasıdır</b>.
 *
 * <p>Neden doğrusu bu: paylaşılmaya değer olan an "kaydoldum" değil, "artık
 * haritada bir yerim var"dır. Kayıt anındaki kartın paylaşacak bir içeriği
 * yoktu — ne konum, ne alan, ne gidilecek bir adres.
 *
 * <h3>Tasarım dili — tanıtım sayfası</h3>
 * Kullanıcı: *"tasarımı da bizim landing tasarımına geçir, waydee logosu yeni
 * logo olsun, renkler landing'deki fontlar ve mavi mor tasarım olsun"*.
 * <ul>
 *   <li><b>Yazı tipi Manrope</b> — tanıtım sayfasının gövde yazı tipi
 *       (`.waydee-landing`). Eski kart Inter kullanıyordu.</li>
 *   <li><b>Mavi → mor</b> — aurora rozetinin ilk iki durağı
 *       (<code>#3a86ff → #8338ec</code>). Eski kartın yeşili tamamen gitti.</li>
 *   <li><b>Koyu zemin</b> — tanıtım sayfasının vurgu bölümleri siyahtır;
 *       renkli gradyan ancak koyu zeminde parlar.</li>
 *   <li><b>Logo `/logo.svg`</b> (yeni marka dosyası), koyu zeminde beyaza
 *       çevrilerek.</li>
 * </ul>
 *
 * <p>Neden canvas: kart bir <b>görsel</b> olarak paylaşılacak (Instagram, X,
 * WhatsApp). HTML'i ekran görüntüsüne çeviren kütüphaneler yazı tipi ve
 * gölgeleri farklı basıyor; burada her piksel bizim kontrolümüzde.
 */

export const CARD_SIZE = 1080

/**
 * Marka paleti — kart tek yerden renk alır.
 *
 * ⚠️ Değerler tanıtım sayfasından alınmıştır: `blue`/`purple` aurora
 * gradyanının (`index.css` → `.waydee-aurora`) ilk iki durağıdır. Yeni bir
 * renk uydurma; kart tanıtım sayfasıyla aynı dili konuşmalı.
 */
const C = {
  blue: '#3a86ff',
  purple: '#8338ec',
  /** Gradyanın ortasında kalan mor-mavi karışım — ayrı bir durak olarak lazım. */
  indigo: '#5b6bf5',
  night: '#07070d',
  nightSoft: '#12121d',
  white: '#ffffff',
  /** Koyu zeminde ikincil metin: saf beyazın %62'si. */
  dim: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.38)',
  hair: 'rgba(255,255,255,0.14)',
  glass: 'rgba(255,255,255,0.06)',
} as const

/**
 * ⚠️ Yazı tipi **Manrope**, tanıtım sayfasıyla aynı. Canvas'ta font adı
 * yazmak yetmez — dosyanın yüklenmiş olması gerekir; `renderShareCard`
 * çizimden önce `document.fonts.ready`'yi bekler ve Manrope `index.css`'te
 * `@font-face` ile yerelden servis edilir.
 */
const FONT = "Manrope, ui-sans-serif, system-ui, sans-serif"

export interface ShareCardData {
  /** Mağaza sahibinin görünen adı. */
  displayName: string
  username: string
  /** Profil fotoğrafı (imzalı URL ya da data URL). Yoksa baş harf çizilir. */
  avatarUrl?: string | null
  /** Mağazanın adı — kartın <b>başlığı</b> budur. */
  storeName: string
  /** Mağaza dairesinin merkezi. */
  lng: number
  lat: number
  /** Alan (m²) — mağaza dairesi sabit 100 m yarıçaplıdır (V38). */
  areaM2?: number | null
  /** "Kadıköy, İstanbul" gibi okunur konum. */
  locationLabel?: string | null
  /**
   * QR'ın işaret ettiği adres — <b>mağazanın haritadaki yeri</b>.
   *
   * ⚠️ `/map?t=<id>` kullanılır, `/t/:id` değil: ikincisi oturum ister ve
   * kodu okutan yabancı giriş ekranına düşerdi.
   */
  qrUrl: string
}

/** Kartı çizer ve PNG blob döner. */
export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_SIZE
  canvas.height = CARD_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas desteklenmiyor')

  // Yazı tipi yüklenmeden çizersek sistem yazı tipiyle basılır ve tasarım bozulur.
  await document.fonts.ready

  drawBackground(ctx)
  await drawHeader(ctx)
  drawHeadline(ctx, data)
  drawStoreDial(ctx)
  await drawOwnerPanel(ctx, data)
  drawFooter(ctx)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Görsel üretilemedi'))), 'image/png')
  })
}

// ---------------------------------------------------------------- arka plan

function drawBackground(ctx: CanvasRenderingContext2D) {
  // Koyu taban — tanıtım sayfasının siyah vurgu bölümleri.
  const base = ctx.createLinearGradient(0, 0, CARD_SIZE, CARD_SIZE)
  base.addColorStop(0, C.nightSoft)
  base.addColorStop(1, C.night)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  /*
   * İki renkli ışık kütlesi: sol üstte MAVİ, sağ altta MOR.
   * ⚠️ Düz bir mavi→mor doğrusal gradyan denendi ve kart "banner" gibi
   * düzleşiyordu. İki ayrı radyal kaynak, tanıtım sayfasındaki aurora
   * hissini verir — renk yüzeyde AKAR, üstüne boyanmış gibi durmaz.
   */
  const blue = ctx.createRadialGradient(150, 90, 40, 150, 90, 780)
  blue.addColorStop(0, 'rgba(58,134,255,0.55)')
  blue.addColorStop(0.55, 'rgba(58,134,255,0.12)')
  blue.addColorStop(1, 'rgba(58,134,255,0)')
  ctx.fillStyle = blue
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  const purple = ctx.createRadialGradient(1010, 1030, 60, 1010, 1030, 820)
  purple.addColorStop(0, 'rgba(131,56,236,0.62)')
  purple.addColorStop(0.55, 'rgba(131,56,236,0.14)')
  purple.addColorStop(1, 'rgba(131,56,236,0)')
  ctx.fillStyle = purple
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  // İnce ızgara — haritayı ima eder, okumayı bozmayacak kadar soluk.
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'
  ctx.lineWidth = 1
  for (let x = 54; x < CARD_SIZE; x += 54) line(ctx, x, 0, x, CARD_SIZE)
  for (let y = 54; y < CARD_SIZE; y += 54) line(ctx, 0, y, CARD_SIZE, y)

  // Kenarda 1px'lik iç parlaklık — "cam kenarı", tanıtım çubuğuyla aynı ayrıntı.
  roundRect(ctx, 1, 1, CARD_SIZE - 2, CARD_SIZE - 2, 0)
  ctx.strokeStyle = C.hair
  ctx.lineWidth = 2
  ctx.stroke()
}

// ---------------------------------------------------------------- üst blok

async function drawHeader(ctx: CanvasRenderingContext2D) {
  /*
   * 🔴 Marka dosyası `/logo.svg` — kullanıcı "yeni waydee logosu olsun" dedi;
   * `Logo.tsx`'in tek kaynağı da budur (eski `waydee-logo.png` 7 Ağu'da
   * emekliye ayrıldı). Elle SVG çizme (vault kuralı).
   *
   * ⚠️ SVG'nin yolları `fill="black"`; koyu zeminde görünmez olurdu.
   * Canvas'ta CSS filtresi yok, o yüzden `Logo.tsx`'teki
   * `brightness(0) invert(1)` numarasının canvas karşılığı kullanılır:
   * logo ayrı bir tuvale çizilir, `source-in` ile beyaza boyanır.
   */
  const logo = await loadImage('/logo.svg').catch(() => null)
  if (logo) {
    const h = 86
    const w = (logo.width / logo.height) * h
    ctx.drawImage(whiten(logo, w, h), 72, 74, w, h)
  }

  /*
   * Aurora rozeti: "MAĞAZA AÇILDI".
   * ⚠️ Gradyan METNİN içindedir (tanıtım sayfasındaki `background-clip: text`
   * karşılığı) — düz renk bir etiket, aurora rozetinin karakterini kaybederdi.
   */
  const label = t('share.storeBadge').toLocaleUpperCase('tr-TR')
  ctx.font = `700 26px ${FONT}`
  ctx.letterSpacing = '3px'
  const lw = ctx.measureText(label).width
  const bx = CARD_SIZE - 72 - (lw + 64)
  const by = 82
  const bh = 60

  roundRect(ctx, bx, by, lw + 64, bh, bh / 2)
  ctx.fillStyle = 'rgba(131,56,236,0.18)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(131,56,236,0.55)'
  ctx.lineWidth = 2
  ctx.stroke()

  const grad = ctx.createLinearGradient(bx, 0, bx + lw + 64, 0)
  grad.addColorStop(0, C.blue)
  grad.addColorStop(1, '#c084fc')
  ctx.fillStyle = grad
  ctx.textBaseline = 'middle'
  ctx.fillText(label, bx + 32, by + bh / 2 + 1)
  ctx.textBaseline = 'alphabetic'
  ctx.letterSpacing = '0px'
}

function drawHeadline(ctx: CanvasRenderingContext2D, data: ShareCardData) {
  ctx.textBaseline = 'alphabetic'

  ctx.font = `500 40px ${FONT}`
  ctx.fillStyle = C.dim
  ctx.fillText(t('share.storeEyebrow'), 72, 268)

  /*
   * Kartın BAŞLIĞI mağaza adıdır — duyurulan şey o.
   * ⚠️ İki satıra sarılır: "Kadıköy Kahve Atölyesi" gibi adlar tek satıra
   * sığmıyor ve kesilince duyuru anlamsızlaşıyordu.
   */
  ctx.font = `800 92px ${FONT}`
  ctx.fillStyle = C.white
  const lines = wrap(ctx, data.storeName, CARD_SIZE - 144, 2)
  let y = 372
  for (const l of lines) {
    ctx.fillText(l, 72, y)
    y += 100
  }

  // Mavi→mor vurgu çizgisi — tanıtım sayfasının gradyan imzası.
  const g = ctx.createLinearGradient(74, 0, 360, 0)
  g.addColorStop(0, C.blue)
  g.addColorStop(1, C.purple)
  ctx.strokeStyle = g
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  line(ctx, 74, y - 22, 300, y - 22)

  ctx.font = `600 34px ${FONT}`
  ctx.fillStyle = C.faint
  ctx.fillText('@' + data.username, 330, y - 12)
}

// ---------------------------------------------------------------- mağaza nişanı

/**
 * Sağ üstte "kapsama alanı" nişanı — mağazanın haritadaki 100 m'lik dairesi.
 *
 * ⚠️ Eski karttaki yeşil damla işareti kaldırıldı; nişan artık mavi→mor
 * halkalardan oluşuyor ve merkezinde dolu bir nokta var. Amaç aynı: kart bir
 * bakışta "bu bir yer" dedirtmeli.
 */
function drawStoreDial(ctx: CanvasRenderingContext2D) {
  const cx = 872
  const cy = 262

  for (const [r, a] of [[210, 0.10], [150, 0.16], [92, 0.26]] as const) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,255,255,${a})`
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Dolu çekirdek: mavi→mor gradyan + mor parıltı.
  const core = ctx.createLinearGradient(cx - 52, cy - 52, cx + 52, cy + 52)
  core.addColorStop(0, C.blue)
  core.addColorStop(1, C.purple)
  ctx.save()
  ctx.shadowColor = 'rgba(131,56,236,0.65)'
  ctx.shadowBlur = 46
  ctx.beginPath()
  ctx.arc(cx, cy, 52, 0, Math.PI * 2)
  ctx.fillStyle = core
  ctx.fill()
  ctx.restore()

  // Ortada beyaz "mağaza" işareti: tente + gövde (lucide `Store` ruhu).
  ctx.fillStyle = C.white
  roundRect(ctx, cx - 24, cy - 20, 48, 14, 4)
  ctx.fill()
  roundRect(ctx, cx - 19, cy - 2, 38, 24, 4)
  ctx.fill()
  ctx.fillStyle = C.purple
  roundRect(ctx, cx - 6, cy + 8, 12, 14, 2)
  ctx.fill()
}

// ---------------------------------------------------------------- sahip paneli

async function drawOwnerPanel(ctx: CanvasRenderingContext2D, data: ShareCardData) {
  const x = 72
  const y = 606
  const w = CARD_SIZE - 144
  const h = 336

  /*
   * Cam panel: koyu zeminin üstünde yarı saydam beyaz + hairline kenar.
   * ⚠️ Beyaz dolu bir kart denendi ve gradyanı "delip" kartı ikiye bölüyordu;
   * cam yüzey arkadaki rengi geçirir ve kompozisyon tek parça kalır.
   */
  roundRect(ctx, x, y, w, h, 40)
  ctx.fillStyle = C.glass
  ctx.fill()
  roundRect(ctx, x, y, w, h, 40)
  ctx.strokeStyle = C.hair
  ctx.lineWidth = 2
  ctx.stroke()

  // --- avatar (mavi→mor halka)
  const ax = x + 128
  const ay = y + 118
  const ar = 74

  const ring = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar)
  ring.addColorStop(0, C.blue)
  ring.addColorStop(1, C.purple)
  ctx.beginPath()
  ctx.arc(ax, ay, ar + 9, 0, Math.PI * 2)
  ctx.strokeStyle = ring
  ctx.lineWidth = 6
  ctx.stroke()

  const avatar = data.avatarUrl ? await loadImage(data.avatarUrl).catch(() => null) : null
  ctx.save()
  ctx.beginPath()
  ctx.arc(ax, ay, ar, 0, Math.PI * 2)
  ctx.clip()
  if (avatar) {
    // Kısa kenardan kare kırp — oran bozulmasın.
    const side = Math.min(avatar.width, avatar.height)
    ctx.drawImage(avatar, (avatar.width - side) / 2, (avatar.height - side) / 2, side, side,
      ax - ar, ay - ar, ar * 2, ar * 2)
  } else {
    ctx.fillStyle = C.indigo
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2)
    ctx.fillStyle = C.white
    ctx.font = `800 66px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((data.displayName[0] ?? 'W').toUpperCase(), ax, ay + 4)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()

  // --- ad + rol
  const tx = ax + ar + 56
  ctx.fillStyle = C.white
  ctx.font = `800 50px ${FONT}`
  ctx.fillText(ellipsis(ctx, data.displayName, 400), tx, y + 92)

  ctx.fillStyle = C.dim
  ctx.font = `500 30px ${FONT}`
  ctx.fillText(t('share.storeOwner'), tx, y + 136)

  // --- üç bilgi hücresi: konum · alan · koordinat
  const cells: { label: string; value: string }[] = [
    { label: t('share.cellLocation'), value: data.locationLabel ?? '—' },
    { label: t('share.cellArea'), value: data.areaM2 != null ? formatArea(data.areaM2) : '—' },
    { label: t('share.cellCoords'), value: `${data.lat.toFixed(3)}, ${data.lng.toFixed(3)}` },
  ]
  const sy = y + 196
  ctx.strokeStyle = C.hair
  ctx.lineWidth = 2
  line(ctx, x + 40, sy, x + w - 40, sy)

  let cellX = x + 44
  for (let i = 0; i < cells.length; i++) {
    ctx.fillStyle = C.faint
    ctx.font = `600 24px ${FONT}`
    ctx.fillText(cells[i].label, cellX, sy + 50)
    ctx.fillStyle = cells[i].value === '—' ? C.faint : C.white
    ctx.font = `700 30px ${FONT}`
    ctx.fillText(ellipsis(ctx, cells[i].value, 196), cellX, sy + 96)
    cellX += 226
    if (i < cells.length - 1) {
      ctx.strokeStyle = C.hair
      ctx.lineWidth = 2
      line(ctx, cellX - 26, sy + 26, cellX - 26, sy + 104)
    }
  }

  // --- QR (mağazanın haritadaki yeri)
  const qr = await qrImage(data.qrUrl)
  if (qr) {
    const qs = 104
    const qx = x + w - qs - 46
    const qy = sy + 12
    /* ⚠️ QR beyaz bir altlığa oturur: koyu zeminde beyaz modüllü bir kod
       çoğu okuyucuda okunmaz (kontrast tersine döner). */
    roundRect(ctx, qx - 14, qy - 14, qs + 28, qs + 28, 18)
    ctx.fillStyle = C.white
    ctx.fill()
    ctx.drawImage(qr, qx, qy, qs, qs)
  }
}

// ---------------------------------------------------------------- alt blok

function drawFooter(ctx: CanvasRenderingContext2D) {
  const y = 1002
  ctx.textBaseline = 'middle'

  // Mavi→mor çağrı düğmesi.
  ctx.font = `700 28px ${FONT}`
  const cta = t('share.cta')
  const pw = ctx.measureText(cta).width + 76
  const g = ctx.createLinearGradient(72, 0, 72 + pw, 0)
  g.addColorStop(0, C.blue)
  g.addColorStop(1, C.purple)
  roundRect(ctx, 72, y - 34, pw, 68, 34)
  ctx.fillStyle = g
  ctx.fill()
  ctx.fillStyle = C.white
  ctx.fillText(cta, 72 + 38, y + 1)

  /*
   * Alan adı.
   * 🔴 10 Ağu 2026 — `app.waydee.com` DEĞİL: ürün kök alana taşındı ve kart
   * basılıp paylaşılan, geri alınamayan bir görseldir; yanlış adres yazan bir
   * kart sonsuza kadar yanlış kalır.
   */
  ctx.fillStyle = C.white
  ctx.font = `800 32px ${FONT}`
  const domain = 'waydee.com'
  ctx.textAlign = 'right'
  ctx.fillText(domain, CARD_SIZE - 72, y + 1)
  ctx.textAlign = 'left'

  ctx.textBaseline = 'alphabetic'
}

// ---------------------------------------------------------------- yardımcılar

/**
 * Siyah çizilmiş bir görseli **beyaza** çevirir (koyu zemin için).
 *
 * ⚠️ Canvas'ta CSS `filter` yoktur; `Logo.tsx`'in `brightness(0) invert(1)`
 * numarasının karşılığı budur: görsel ara bir tuvale çizilir, sonra
 * `source-in` ile üstü tamamen beyaza boyanır — <b>şekli</b> (alfa kanalı)
 * korunur, rengi değişir. Kaynak rengi ne olursa olsun sonuç kesin beyazdır.
 */
function whiten(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  const cx = c.getContext('2d')
  if (!cx) return c
  cx.drawImage(img, 0, 0, c.width, c.height)
  cx.globalCompositeOperation = 'source-in'
  cx.fillStyle = '#ffffff'
  cx.fillRect(0, 0, c.width, c.height)
  return c
}

/** Metni verilen genişliğe sarar; `maxLines` aşılırsa son satır "…" ile kesilir. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = words[0]
  for (let i = 1; i < words.length; i++) {
    const candidate = current + ' ' + words[i]
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = words[i]
      if (lines.length === maxLines - 1) break
    }
  }
  // Kalan kelimeler son satıra toplanır; sığmayan kısım kesilir.
  const used = lines.join(' ').split(/\s+/).filter(Boolean).length
  const rest = words.slice(Math.max(used, 0)).join(' ')
  lines.push(ellipsis(ctx, rest || current, maxWidth))
  return lines.slice(0, maxLines)
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Uzun metni kutuya sığdırır; taşan kısım "…" ile kesilir. */
function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return cut + '…'
}

export function formatArea(m2: number): string {
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(1)} km²`
  return `${Math.round(m2).toLocaleString('tr-TR')} m²`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // İmzalı medya kendi origin'imizden gelir; yine de tuvali kirletmemek için.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Görsel yüklenemedi: ' + src))
    img.src = src
  })
}

async function qrImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      margin: 0,
      width: 320,
      /* ⚠️ Koyu modüller + saydam zemin: kod beyaz altlığın üstüne oturuyor
         (bkz. `drawOwnerPanel`). Zemini burada boyamak, yuvarlatılmış
         altlığın köşelerini kare bir beyazla dolduruyordu. */
      color: { dark: C.night, light: '#00000000' },
      errorCorrectionLevel: 'M',
    })
    return await loadImage(dataUrl)
  } catch {
    // QR olmasa da kart tamamdır — sessizce atlanır.
    return null
  }
}
