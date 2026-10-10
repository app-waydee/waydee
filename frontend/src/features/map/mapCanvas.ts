import type * as mapboxgl from 'mapbox-gl'
import { circleFeature } from '@/lib/geo'
import type { FeatureCollection, TerritoryProperties } from '@/types/api'

/**
 * Harita tuvali — kaynaklar, katmanlar, avatar/küme işaretçileri ve efekt halkaları.
 *
 * Hem oturumlu harita (`MapPage`) hem vitrin haritası (`PublicMapPage`) aynı
 * görünümü kullanır; mantık burada TEK yerde durur (iki app arasındaki UI
 * kopyası bilinçliydi, bu ise aynı app içinde tekrar olurdu).
 */

export const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const

/** Bir dairenin ekrandaki piksel yarıçapı. */
export function pixelRadius(map: mapboxgl.Map, lng: number, lat: number, radiusM: number) {
  const latRad = (lat * Math.PI) / 180
  const dLng = radiusM / (111_320 * Math.max(Math.cos(latRad), 0.01))
  const c = map.project([lng, lat])
  const edge = map.project([lng + dLng, lat])
  return Math.hypot(edge.x - c.x, edge.y - c.y)
}

export function setPreview(map: mapboxgl.Map, lng: number, lat: number, radiusM: number) {
  const source = map.getSource('preview') as mapboxgl.GeoJSONSource | undefined
  source?.setData({ type: 'FeatureCollection', features: [circleFeature(lng, lat, radiusM)] } as never)
}

export function clearPreview(map: mapboxgl.Map) {
  const source = map.getSource('preview') as mapboxgl.GeoJSONSource | undefined
  source?.setData(EMPTY_FC as never)
}

export function addLayerOnce(map: mapboxgl.Map, layer: mapboxgl.LayerSpecification) {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer)
  }
}

/*
 * ================================================================
 *  HARİTA İŞARETÇİSİ — HALKALI PROFİL FOTOĞRAFI
 *  (21 Ağu 2026, kullanıcı talimatı + ekran görüntüsü)
 * ================================================================
 *
 * 🔴 <b>3B BİNA VE EĞİK BAKIŞ KALDIRILDI.</b> Talimat: *"haritada eski hale
 * geri dönüyoruz, eğik açıdan bakma ve 3D'yi kaldırıyoruz, üstten görüntüye ve
 * fotoğraftaki gibi konum daireleri getiriyoruz; W logosu yerine kişinin profil
 * fotoğrafı, LIVE yazan yere kişinin ismi gelecek"*.
 *
 * Silinenler: `territory-store-models` (Mapbox `model` katmanı + `store.glb`),
 * `waydee-3d-buildings` (şehrin `fill-extrusion` binaları), `territory-store-pins`
 * (uzak zoom iğnesi — artık işaretçinin kendisi her zoom'da görünüyor, uzakta
 * kümeler devralıyor).
 *
 * <h3>🔴 DOM İŞARETÇİSİ YOK — bu bir performans kararıdır</h3>
 * <p>Bu tasarımın "kolay" yolu her mağazaya bir HTML `Marker` vermektir. Bu
 * projede o yol <b>bir kez denendi ve kasmanın kaynağı oldu</b>: eski
 * `makeAvatarEl`/`makeClusterEl` işaretçileri <b>her karede DOM'a</b>
 * yazıyordu ve 4. turda silindiler. Buraya geri getirilmedi.
 *
 * <p>Bunun yerine her şey Mapbox katmanlarında:
 * <ul>
 *   <li>fotoğraf + halka → <b>tek bir görsele</b> çizilir ({@link drawMarker})
 *       ve bir sembol katmanı onu basar; kare başına maliyet <b>sıfır</b>;</li>
 *   <li>parıltı → bir <b>daire katmanı</b>, nabzı kare başına <b>iki düz sayı</b>
 *       ile sürülür ({@link startMarkerPulse}) — ifade yeniden ayrıştırılmaz,
 *       yerleşim yeniden hesaplanmaz;</li>
 *   <li>ad → nine-patch levha, <b>aynı</b> sembol katmanında metinle birlikte.</li>
 * </ul>
 */

/** Görsel adının öneki. Kimlik mağazanın kendi kimliğidir — bkz. {@link markerIconId}. */
const MARKER_PREFIX = 'waydee-marker-'

/** Fotoğrafı olmayan hesapların işaretçisinde çizilen marka görseli. */
const DEFAULT_AVATAR = '/default-avatar.png'

/** İşaretçinin ekrandaki çapı (mantıksal px). */
const MARKER_D = 54
/**
 * Renkli dış halkanın kalınlığı.
 *
 * ⚠️ Referansta halka <b>kalın</b>: çapın ~%7'si. İnce bir halka işaretçiyi
 * "beyaz bir düğme" gibi gösteriyordu.
 */
const MARKER_RING = 4
/** Halka ile içerik arasındaki beyaz boşluk — referanstaki "iç kılıf". */
const MARKER_GAP = 2.5

/**
 * <b>Gradient halkanın ikinci rengi.</b>
 *
 * <p>🔴 Referanstaki halka <b>tek renk değil</b>: pembeden turuncuya dönen bir
 * geçiş (hikâye halkası dili). Tek düz renkle çizmek, işaretçiyi referanstan
 * ayıran en görünür farktı.
 *
 * <p>Kullanıcı tek bir renk seçiyor; ikinci renk ondan <b>türetilir</b>: ton
 * ({@code hue}) <b>+32°</b> döndürülür ve parlaklık bir tık artırılır. Böylece
 * her palet rengi kendi doğal partnerini alır (pembe→turuncu, mavi→mor) ve
 * kullanıcıya ikinci bir seçim yükü binmez.
 *
 * <p>⚠️ Doygunluğu çok düşük renklerde (siyah/gri) ton döndürmek görünür bir
 * şey yapmaz ve <b>yapmamalıdır</b> da: siyah halka siyah kalmalı.
 */
/**
 * Halkanın ikinci rengi: tondan <b>+32°</b>, parlaklık +0,08.
 *
 * <p>🔴 <b>DIŞA AKTARILDI</b> (24 Ağu 2026). Mağaza paneli de aynı degradeyi
 * çiziyor ve vault'taki uyarı açıktı: *"önizlemedeki `partner()` haritadaki
 * formülle birebir aynı kalmalı"*. Formülü ikinci kez yazmak yerine aynı
 * fonksiyon paylaşılıyor — kopyalanan bir formül er ya da geç ayrışır ve
 * mağaza haritada bir renk, panelde başka bir renk gösterirdi.
 */
export function gradientPartner(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d < 0.08) return hex // gri/siyah: döndürmenin anlamı yok
  const sat = d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360 + 32) % 360
  const nl = Math.min(l + 0.08, 0.72)
  const c = (1 - Math.abs(2 * nl - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = nl - c / 2
  const [rr, gg, bb] =
    h < 60 ? [c, x, 0]
      : h < 120 ? [x, c, 0]
        : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c]
            : h < 300 ? [x, 0, c]
              : [c, 0, x]
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, '0')
  return `#${to(rr)}${to(gg)}${to(bb)}`
}

/**
 * <b>Görsel kimliği mağazanın kimliğidir.</b>
 *
 * <p>⚠️ Renkten türetilmiyor (iğnelerdeki eski desen). Sebep: işaretçinin
 * içeriği artık <b>kişiye özel</b> — profil fotoğrafı. Renk başına tek görsel
 * üretmek, herkesin aynı fotoğrafı görmesi demekti.
 */
export function markerIconId(territoryId: string) {
  return MARKER_PREFIX + territoryId
}

/** {@link drawMarker} için gereken girdiler; görsel kimliğine göre saklanır. */
interface MarkerSpec {
  /**
   * Denenecek fotoğraf adresleri, <b>sırayla</b>.
   *
   * <p>🔴 Tek adres YETMİYOR — üretimde ölçüldü. Tercih edilen adres
   * {@code avatarStreamUrl} (aynı orijin, tuvali kirletmez), ama o alanı
   * <b>yeni</b> bir sunucu sürümü gönderiyor. Sürümler arasında (ya da eski
   * bir önbellek yanıtında) alan yoksa işaretçi sessizce <b>baş harfe</b>
   * düşüyordu ve kullanıcı *"profil fotoğrafım niye gelmedi"* diyordu.
   *
   * <p>Bu yüzden {@code ownerAvatarUrl} de bir yedek olarak deneniyor.
   * ⚠️ O adres başka orijine (S3) yönlendirebilir ve tuvali kirletebilir;
   * {@code getImageData} o durumda fırlatır ve <b>yakalanır</b> — sonuç yine
   * baş harftir, yani yedeği denemenin bir bedeli yok.
   */
  avatarUrls: string[]
  color: string
  /** Fotoğraf yoksa/yüklenmezse basılacak baş harf. */
  initial: string
}

/**
 * Görsel kimliği → çizim girdileri.
 *
 * <p>🔴 <b>Neden bir kayıt defteri var:</b> görseller <b>tembel</b> üretiliyor.
 * Mapbox, olmayan bir görsel istendiğinde {@code styleimagemissing} olayını
 * fırlatır ve biz de tam o an çiziyoruz — yani yalnız <b>ekranda gerçekten
 * görünen</b> mağazaların fotoğrafı işleniyor. Yüzlerce mağazanın tamamını
 * peşinen çizmek, açılışta uzun bir donma ve şişmiş bir doku atlası demekti.
 *
 * <p>⚠️ Olay bize yalnız <b>kimliği</b> verir; fotoğraf adresi ve renk oradan
 * türetilemez. Defter bu boşluğu doldurur ve veri her yazıldığında tazelenir.
 */
const markerRegistry = new Map<string, MarkerSpec>()

/**
 * <b>Bir fotoğrafın DEĞİŞMEYEN kimliği.</b>
 *
 * <h3>🔴 25 Ağu 2026 — "bazı zoom'larda fotoğraf gidiyor, harf geliyor"</h3>
 * <p>Kök neden: medya adresleri <b>imzalı ve sürelidir</b>
 * ({@code ?id=…&e=…&sig=…}). Harita verisi her tazelendiğinde (zoom, kaydırma,
 * yeniden çekim) sunucu <b>aynı fotoğraf için yeni bir dize</b> döndürür.
 * {@link setStoreMarkerData} adresleri <b>dize olarak</b> karşılaştırdığı için
 * bunu "kullanıcı fotoğrafını değiştirdi" sanıyor, görseli siliyor
 * ({@code removeImage}) ve Mapbox onu yeniden isteyince önce <b>baş harfli</b>
 * yer tutucu çiziliyordu. Fotoğraf yeniden inip üzerine yazılana kadar —
 * ya da hiç inmezse kalıcı olarak — kullanıcı <b>harfi</b> görüyordu.
 *
 * <p>Çözüm: karşılaştırma ve önbellek <b>imzasız yol</b> üzerinden yapılır.
 * Yol medya kimliğini taşır; fotoğraf gerçekten değişirse yol da değişir.
 *
 * <p>⚠️ İndirme yine <b>tam adresle</b> yapılır — imza olmadan sunucu 403 döner.
 * Değişen yalnız "bu iki adres aynı fotoğrafı mı gösteriyor?" sorusunun cevabı.
 */
function avatarKey(url: string): string {
  const cut = url.indexOf('?')
  return cut === -1 ? url : url.slice(0, cut)
}

/**
 * Aynı fotoğrafın ikinci kez indirilmemesi için — birden çok mağaza aynı
 * avatarı taşıyabilir.
 *
 * <p>🔴 Anahtar <b>{@link avatarKey}</b>'dir, tam adres değil: imzalı adres her
 * tazelemede değiştiği için tam adresle anahtarlamak önbelleği <b>işe
 * yaramaz</b> hâle getiriyordu (her zoom'da yeniden indirme).
 */
const avatarCache = new Map<string, HTMLImageElement | null>()

function initialOf(properties: TerritoryProperties): string {
  const source = String(properties.name ?? properties.ownerDisplayName ?? '?')
  return (source.trim()[0] ?? '?').toUpperCase()
}

/**
 * İşaretçiyi çizer: renkli halka + beyaz kılıf + <b>daire içine kırpılmış</b>
 * profil fotoğrafı.
 *
 * <p>⚠️ Fotoğraf <b>"cover"</b> yerleştirilir (kısa kenara göre ölçeklenip
 * ortalanır). "Contain" olsaydı dikey bir fotoğrafın yanlarında boşluk kalır ve
 * daire bozuk görünürdü.
 *
 * @param glyph fotoğraf; {@code null} ise renkli zemin üstüne baş harf basılır —
 *              hiç işaretçi çıkmamasındansa harfli çıkması iyidir.
 */
function drawMarker(color: string, initial: string, glyph: HTMLImageElement | null): ImageData | null {
  const dpr = 2 // Retina'da bulanık kalmasın diye iki katı çizilir.
  const canvas = document.createElement('canvas')
  canvas.width = MARKER_D * dpr
  canvas.height = MARKER_D * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)

  const c = MARKER_D / 2
  const outerR = c - MARKER_RING / 2
  const photoR = c - MARKER_RING - MARKER_GAP

  /*
   * 1) BEYAZ disk.
   *
   * 🔴 Referansta işaretçinin içi <b>her zaman beyazdır</b> ve içerik (logo /
   * fotoğraf / harf) onun üstünde durur. Önceki sürüm fotoğrafı olmayan
   * kullanıcıda diski <b>seçilen renkle</b> dolduruyordu ve işaretçi beyaz
   * çerçeveli bir daire değil, <b>renkli bir leke</b> gibi görünüyordu —
   * referanstan en çok ayrılan yer burasıydı.
   */
  ctx.beginPath()
  ctx.arc(c, c, photoR + MARKER_GAP, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // 2) İçerik: fotoğraf (daireye kırpılmış) ya da KOYU baş harf.
  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, photoR, 0, Math.PI * 2)
  ctx.clip()
  if (glyph) {
    const iw = glyph.naturalWidth || glyph.width
    const ih = glyph.naturalHeight || glyph.height
    if (iw > 0 && ih > 0) {
      const scale = Math.max((photoR * 2) / iw, (photoR * 2) / ih)
      const w = iw * scale
      const h = ih * scale
      ctx.drawImage(glyph, c - w / 2, c - h / 2, w, h)
    }
  } else {
    /* ⚠️ Harf KOYU, zemin beyaz — referanstaki siyah logonun yerini tutar.
       Beyaz harf + renkli zemin tam tersi bir görüntü veriyordu. */
    ctx.fillStyle = '#111315'
    ctx.font = `700 ${Math.round(photoR * 1.15)}px "Inter", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initial, c, c + 1)
  }
  ctx.restore()

  /*
   * 3) GRADIENT halka.
   *
   * ⚠️ Geçiş <b>çaprazdır</b> (sol-alttan sağ-üste): referanstaki halkada
   * turuncu sol-altta, pembe sağ-üstte. Dikey ya da yatay bir geçiş aynı
   * hissi vermiyor.
   */
  const ring = ctx.createLinearGradient(0, MARKER_D, MARKER_D, 0)
  ring.addColorStop(0, gradientPartner(color))
  ring.addColorStop(1, color)
  ctx.beginPath()
  ctx.arc(c, c, outerR, 0, Math.PI * 2)
  ctx.lineWidth = MARKER_RING
  ctx.strokeStyle = ring
  ctx.stroke()

  /*
   * ⚠️ Tuval başka orijinden gelen bir fotoğrafla <b>kirlenmiş</b> olabilir;
   * o durumda {@code getImageData} SecurityError fırlatır. Yakalanır ve
   * {@code null} dönülür — çağıran taraf baş harfli görselde kalır. Fırlatmaya
   * bırakmak, tek bir kötü avatar yüzünden <b>bütün işaretçi üretimini</b>
   * durdururdu.
   */
  try {
    return ctx.getImageData(0, 0, MARKER_D * dpr, MARKER_D * dpr)
  } catch {
    return null
  }
}

/**
 * Eksik işaretçi görsellerini <b>istendiği anda</b> üretir.
 *
 * <p>🔴 {@code styleimagemissing}, Mapbox'ın "bu görseli istiyorum ama bende
 * yok" haberidir; tembel üretimin doğal kancası budur. Ekranda görünmeyen
 * mağazanın fotoğrafı hiç indirilmez.
 *
 * <p>⚠️ Görsel <b>iki kez</b> yazılır: önce fotoğrafsız (baş harfli) — harita
 * o karede bir şey gösterebilsin —, fotoğraf gelince {@code updateImage} ile
 * üzerine. Yüklemeyi beklemek, yavaş bağlantıda haritayı <b>işaretsiz</b>
 * bırakırdı.
 *
 * <p>⚠️ Dinleyici harita ömrü boyunca <b>bir kez</b> bağlanır ({@code setStyle}
 * onu silmez, çünkü harita olayıdır — kaynak/katman değil). Görselleri ise
 * {@code setStyle} siler; sorun değil: silinen görsel yeniden <b>istenir</b> ve
 * bu dinleyici onu yeniden üretir.
 *
 * @returns dinleyiciyi kaldıran fonksiyon.
 */
export function attachStoreMarkerImages(map: mapboxgl.Map): () => void {
  const onMissing = (event: { id: string }) => {
    const id = event.id
    if (!id || !id.startsWith(MARKER_PREFIX)) return
    if (map.hasImage(id)) return
    const spec = markerRegistry.get(id)
    if (!spec) return

    const placeholder = drawMarker(spec.color, spec.initial, null)
    if (placeholder) map.addImage(id, placeholder, { pixelRatio: 2 })
    if (spec.avatarUrls.length === 0) return

    const paint = (img: HTMLImageElement) => {
      if (!map.getStyle() || !map.hasImage(id)) return
      const drawn = drawMarker(spec.color, spec.initial, img)
      /* `null` = tuval kirlendi (bkz. `drawMarker`); baş harfli görselde kal. */
      if (drawn) map.updateImage(id, drawn)
    }

    /**
     * Adresleri <b>sırayla</b> dener; ilk başarılı olan çizilir.
     *
     * ⚠️ Başarısızlık iki türlü olur ve ikisi de bir sonrakine geçmeli:
     * yükleme hatası ({@code onerror}) ve kirlenmiş tuval ({@code drawMarker}
     * {@code null} döner). İkincisini es geçmek, S3'e yönlenen bir yedeği
     * "başarılı" sayıp fotoğrafı yine göstermemek olurdu.
     */
    const tryFrom = (index: number) => {
      if (index >= spec.avatarUrls.length) return
      const url = spec.avatarUrls[index]

      /* ⚠️ Önbellek anahtarı imzasız yol; indirme tam adresle. Gerekçe
         {@link avatarKey}. */
      const key = avatarKey(url)
      const cached = avatarCache.get(key)
      if (cached === null) {
        tryFrom(index + 1)
        return
      }
      if (cached) {
        paint(cached)
        return
      }

      const img = new Image()
      /* ⚠️ `crossOrigin` istenir: onaylı gelirse tuval temiz kalır ve
         `getImageData` çalışır. Sunucu onay vermezse yükleme başarısız olur ve
         bir sonraki adrese geçilir — sessizce kirli bir tuvale çizmekten iyidir. */
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        avatarCache.set(key, img)
        paint(img)
      }
      img.onerror = () => {
        avatarCache.set(key, null)
        tryFrom(index + 1)
      }
      img.src = url
    }
    tryFrom(0)
  }

  map.on('styleimagemissing', onMissing as never)
  return () => map.off('styleimagemissing', onMissing as never)
}

/**
 * <b>Nabız.</b> Parıltı halkası kare başına <b>iki düz sayı</b> ile sürülür.
 *
 * <p>🔴 <b>21 Ağu 2026 (2. bölüm) — TASARIM SEÇENEKLERİ KALDIRILDI.</b>
 * Kullanıcı: *"tek renk nabız parıltı sakin bunları kaldır düzgün
 * çalışmıyorlar"*. PULSE/GLOW/SOFT üç ayrı katmana süzülüyordu; haritada
 * birbirinden ayırt edilemiyor, seçim ekranını şişiriyor ve üç kod yolu
 * yaratıyordu. Artık <b>tek tasarım</b> var ve seçilen tek şey <b>renk</b>.
 *
 *
 * <p>🔴 Neden ifade değil düz sayı: {@code circle-radius}'a her karede bir
 * <i>ifade</i> yazmak, ifadenin her karede yeniden ayrıştırılması demektir.
 * İşaretçi <b>ekranda sabit boyda</b> olduğu için yarıçapın zoom'a bağlı olması
 * gerekmiyor — yani düz bir sayı yetiyor ve bu, uniform güncellemesi kadar ucuz.
 *
 * <p>🔴 Neden iki ayrı katman: tasarım mağaza başına değişiyor (PULSE / GLOW /
 * SOFT) ama düz bir sayı özellik başına farklı olamaz. Çözüm, <b>tasarıma göre
 * süzülmüş</b> katmanlar: her biri kendi genliğiyle sürülür. Alternatifi —
 * kare başına veriye bağlı ifade — tam da kaçındığımız maliyetti.
 *
 * <p>⚠️ Sekme arkadayken tarayıcı {@code requestAnimationFrame}'i zaten
 * durdurur; ayrıca bir görünürlük kontrolü gerekmiyor.
 *
 * @returns döngüyü durduran fonksiyon.
 */
export function startMarkerPulse(map: mapboxgl.Map): () => void {
  let frame = 0
  let stopped = false

  const tick = () => {
    if (stopped) return
    frame = requestAnimationFrame(tick)
    if (!map.getLayer('store-glow')) return

    /* 2,6 saniyelik yumuşak bir sinüs — "yanıp sönmek" değil, NEFES ALMAK.
       Sert bir yanıp sönme haritayı huzursuz yapardı. */
    const t = (performance.now() % 2600) / 2600
    const wave = (1 - Math.cos(t * Math.PI * 2)) / 2 // 0 → 1 → 0, yumuşak

    /*
     * 🔴 Parıltı <b>DAR</b> tutulur — headless Chrome'da gerçek haritada
     * ölçüldü: geniş bir halo (yarıçap +14, bulanıklık 0,85) işaretçinin
     * çevresinde <b>büyük soluk bir disk</b> yaratıyor ve beyaz daireyi
     * boğuyordu. Referanstaki parıltı halkanın hemen dışında biter.
     *
     * Halka dış kenarı r=27; parıltı 29→34 arasında nefes alır, yani en fazla
     * <b>7 px</b> dışarı taşar.
     */
    map.setPaintProperty('store-glow', 'circle-radius', MARKER_D / 2 + 2 + wave * 5)
    map.setPaintProperty('store-glow', 'circle-opacity', 0.55 - wave * 0.28)
  }

  frame = requestAnimationFrame(tick)
  return () => {
    stopped = true
    if (frame) cancelAnimationFrame(frame)
  }
}

/*
 * ================= AD LEVHASI =================
 * Fotoğraftaki "LIVE" rozetinin yerinde artık <b>kişinin adı</b> var.
 *
 * Levha, metne göre <b>esnetilen</b> bir görseldir ({@code icon-text-fit}) ve
 * <b>dokuz-parça</b> olarak kaydedilir: köşeler sabit kalır, yalnız ortası
 * uzar — aksi hâlde uzun bir adda yuvarlak köşeler <b>elips</b> olurdu.
 */
const PLATE_PREFIX = 'waydee-plate-'
const PLATE_FALLBACK = PLATE_PREFIX + 'default'
/*
 * 🔴 Ölçüler referans görselden alındı (kullanıcı: *"font vs her şey birebir
 * aynısı olsun"*): rozet <b>tam yuvarlak</b> (yükseklikin yarısı kadar
 * yarıçap), alçak ve dar; yazı küçük ve kalın.
 * ⚠️ `PLATE_R = PLATE_H / 2` bağı korunmalı — daha küçük bir yarıçap rozeti
 * "hap" değil "dikdörtgen" yapar ve referanstan ayrılır.
 */
const PLATE_W = 72
const PLATE_H = 22
const PLATE_R = 11

function drawPlate(color: string): ImageData | null {
  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = PLATE_W * dpr
  canvas.height = PLATE_H * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)

  const pad = 2
  /* ⚠️ `Path2D.roundRect` bilinçli KULLANILMADI: Safari'ye 16.4'te geldi ve
     levhanın eski bir iOS'ta hiç çizilmemesi, köşelerin bir tık keskin
     olmasından kötüdür. `arcTo` her yerde var. */
  const x0 = pad
  const y0 = pad
  const x1 = PLATE_W - pad
  const y1 = PLATE_H - pad
  const path = new Path2D()
  path.moveTo(x0 + PLATE_R, y0)
  path.arcTo(x1, y0, x1, y1, PLATE_R)
  path.arcTo(x1, y1, x0, y1, PLATE_R)
  path.arcTo(x0, y1, x0, y0, PLATE_R)
  path.arcTo(x0, y0, x1, y0, PLATE_R)
  path.closePath()

  ctx.save()
  ctx.shadowColor = 'rgba(15, 18, 22, 0.30)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1
  /* ⚠️ Referansta rozetin beyaz kılıfı BELİRGİN — daireye bindiği için onu
     fotoğraftan ayıran şey bu. İnce bir kılıf rozeti işaretçiye yapıştırıyordu. */
  ctx.lineWidth = 3.5
  ctx.strokeStyle = '#ffffff'
  ctx.lineJoin = 'round'
  ctx.stroke(path)
  ctx.restore()

  /* Rozet de halkanın gradient'ini taşır — ikisi aynı dili konuşmalı. */
  const fill = ctx.createLinearGradient(0, PLATE_H, PLATE_W, 0)
  fill.addColorStop(0, gradientPartner(color))
  fill.addColorStop(1, color)
  ctx.fillStyle = fill
  ctx.fill(path)
  return ctx.getImageData(0, 0, PLATE_W * dpr, PLATE_H * dpr)
}

/**
 * Levhanın dokuz-parça tanımı.
 *
 * <h3>🔴 KOORDİNATLAR HAM PİKSEL UZAYINDA — ölçüldü</h3>
 * <p>Sezgisel olan mantıksal piksel yazmaktır ({@code pixelRatio}'ya
 * bölünmüş), ama Mapbox bu değerleri <b>görselin kendi piksel dizisinde</b>
 * yorumluyor. Mantıksal yazıldığında esnetilebilir bölge görselin yalnız sol
 * yarısını kaplıyor: levha kısa adlarda gereksiz geniş kalıyor ve yazı sola
 * yapışıyor.
 *
 * <h3>🔴 ESNETME ARALIĞI TERS DÖNERSE LEVHA HİÇ ÇİZİLMEZ — yaşandı</h3>
 * <p>Rozet <b>tam yuvarlak</b> yapılınca ({@code PLATE_R = PLATE_H / 2})
 * dikeyde <b>düz bir bant kalmıyor</b>. Aralık elle
 * {@code [(R+2)·dpr, (H-R-2)·dpr]} yazılıydı ve bu, yükseklik daraltılınca
 * <b>[26, 18]</b> oldu — yani <b>başlangıç bitişten büyük</b>.
 *
 * <p>Mapbox bunu reddetmiyor, <b>sessizce yanlış hesaplıyor</b>:
 * {@code reduceRanges} aralıkları {@code bitiş - başlangıç} diye topluyor ve
 * sonuç <b>negatif</b> çıkıyor ({@code stretchHeight = -8}), ardından
 * {@code fixedHeight = imageHeight - stretchHeight} görselden <b>büyük</b>
 * oluyor ve dokuz-parça geometrisi çöküyor. Ekranda kalan tek şey <b>yazı</b>
 * oluyor; kullanıcı *"rozet nerede?"* diyor.
 *
 * <p>✅ Bu yüzden bantlar artık <b>geometriden türetiliyor</b> ve tanım gereği
 * geçerli: yatayda köşelerin arasındaki gerçek düz bant, dikeyde
 * <b>ortadaki 2 piksel</b>. Ortadaki bant her zaman geçerlidir — yükseklik ne
 * olursa olsun {@code orta-1 < orta+1}.
 *
 * <p>⚠️ {@code content} metnin oturduğu kutudur; {@code icon-text-fit} boyu
 * buna göre hesaplar. Yuvarlak uçların <b>içinde</b> kalmalı, yoksa yazı
 * kavise girer.
 */
const PLATE_DPR = 2

/** Dikey esnetme bandının merkezi — yuvarlak uçlarda tek geçerli nokta. */
const PLATE_MID = PLATE_H / 2

const PLATE_META = {
  pixelRatio: PLATE_DPR,
  stretchX: [
    [(PLATE_R + 1) * PLATE_DPR, (PLATE_W - PLATE_R - 1) * PLATE_DPR],
  ] as [number, number][],
  /* ⚠️ ±1 px: köşe yarıçapı yüksekliğin yarısı olduğu için dikeyde
     esnetilebilecek başka bir yer yok. Genişletmek yuvarlak ucu bozar. */
  stretchY: [
    [(PLATE_MID - 1) * PLATE_DPR, (PLATE_MID + 1) * PLATE_DPR],
  ] as [number, number][],
  content: [
    PLATE_R * PLATE_DPR,
    3 * PLATE_DPR,
    (PLATE_W - PLATE_R) * PLATE_DPR,
    (PLATE_H - 3) * PLATE_DPR,
  ] as [number, number, number, number],
}

/*
 * 🔴 Geliştirme sırasında bir kez daha ters dönmesin diye <b>kendini
 * denetler</b>. Sessiz bozulma bu hatanın en kötü yanıydı: Mapbox hata
 * vermiyor, yalnız levhayı çizmiyor.
 */
if (import.meta.env.DEV) {
  for (const [name, ranges] of [
    ['stretchX', PLATE_META.stretchX],
    ['stretchY', PLATE_META.stretchY],
  ] as const) {
    for (const [from, to] of ranges) {
      if (!(from < to)) {
        // eslint-disable-next-line no-console
        console.error(
          `[waydee] Rozet ${name} aralığı geçersiz: [${from}, ${to}]. ` +
            'Başlangıç bitişten küçük olmalı, yoksa levha HİÇ çizilmez.',
        )
      }
    }
  }
}

/**
 * Veride <b>gerçekten geçen</b> her renk için ad levhası üretir.
 *
 * <p>🔴 Sabit bir paletten üretmek <b>yetmez</b> — bu bir kez yapılıp ölçülen
 * bir hataydı: sunucunun renk seçmemiş kullanıcılara verdiği otomatik palet
 * ({@code OWNER_COLORS}) istemci paletiyle <b>üç renkte</b> ayrışıyor. Palete
 * güvenilseydi o kullanıcılar varsayılan renkte levha görürdü. Levha rengi
 * <b>veriden</b> gelir.
 *
 * <p>⚠️ Her {@code setData}'dan <b>ÖNCE</b> çağrılmalı; sonra çağrılırsa Mapbox
 * o kareyi eksik görselle çizer ve ad bir an boş görünür.
 */
function ensurePlateImages(map: mapboxgl.Map, features: { properties: TerritoryProperties }[]) {
  if (!map.hasImage(PLATE_FALLBACK)) {
    const fallback = drawPlate('#111315')
    if (fallback) map.addImage(PLATE_FALLBACK, fallback, PLATE_META as never)
  }
  for (const feature of features) {
    const color = feature.properties?.color
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) continue
    const id = PLATE_PREFIX + color.toLowerCase()
    if (map.hasImage(id)) continue
    const img = drawPlate(color.toLowerCase())
    if (img) map.addImage(id, img, PLATE_META as never)
  }
}

/**
 * İşaretçi verisini haritaya yazar: görsel defterini tazeler, levhaları üretir,
 * sonra kaynağa yazar.
 *
 * <p>🔴 Tek giriş noktası olması bilinçli: <b>beş harita yüzeyi</b> var ve
 * "önce defteri doldur, sonra levhaları üret, sonra {@code setData}" sırası
 * üçünde de aynı olmalı. Sıra bozulursa harita bir kare eksik çizer.
 */
export function setStoreMarkerData(
  map: mapboxgl.Map,
  collection: FeatureCollection<TerritoryProperties>,
) {
  const points = territoriesToPoints(collection)
  for (const feature of collection.features) {
    const id = markerIconId(String(feature.properties.id))
    const spec: MarkerSpec = {
      /*
       * 🔴 SIRA ÖNEMLİ. Önce `avatarStreamUrl`: aynı orijinden akar, tuvali
       * kirletmez (S3 CORS başlığı döndürmüyor — 3B mağazada üretimde yaşandı).
       * Sonra `ownerAvatarUrl`: yeni alanı henüz göndermeyen bir sunucu
       * sürümüne karşı yedek. Yedek kirli tuval üretirse `drawMarker` null
       * döner ve baş harfte kalınır — yani denemenin bedeli yok.
       */
      avatarUrls: [
        feature.properties.avatarStreamUrl,
        feature.properties.ownerAvatarUrl,
        /*
         * 🔴 25 Ağu 2026 — SON YEDEK: MARKA GÖRSELİ (kullanıcı isteği:
         * *"profil fotoğrafı olmayan profillerde de bu olsun"*).
         *
         * Fotoğrafı olmayan hesapta işaretçi baş harf basıyordu; harf her
         * hesapta başka bir renk/şekil demekti ve haritayı alfabe çorbasına
         * çeviriyordu.
         *
         * ⚠️ Aynı orijinden (`/public`) gelir, yani tuvali <b>kirletmez</b> —
         * `getImageData` çalışır. Uzak bir varsayılan görsel koysaydık S3
         * CORS sorunu buraya da taşınırdı.
         *
         * ⚠️ Baş harf mantığı SİLİNMEDİ: bu görsel de yüklenemezse
         * `drawMarker` yine harfi basar. İşaretçisiz bir mağaza en kötü sonuç.
         */
        DEFAULT_AVATAR,
      ].filter((url): url is string => typeof url === 'string' && url.length > 0),
      color: feature.properties.color ?? '#2a85ff',
      initial: initialOf(feature.properties),
    }
    const previous = markerRegistry.get(id)
    markerRegistry.set(id, spec)
    /* ⚠️ Görünüm DEĞİŞTİYSE var olan görsel bayattır: kullanıcı rengini
       değiştirdiğinde ya da fotoğrafını güncellediğinde haritada eskisi
       kalırdı. Görseli silmek yeterli — Mapbox onu yeniden ister ve
       `styleimagemissing` güncelini çizer. */
    /*
     * 🔴 25 Ağu 2026 — KARŞILAŞTIRMA İMZASIZ YOL ÜZERİNDEN.
     *
     * Adresler imzalı ve sürelidir; her tazelemede dize değişir. Dizeyi
     * karşılaştırmak "fotoğraf değişti" demek ve görseli silmekti — sonuç:
     * kullanıcı bazı zoom'larda fotoğrafın yerinde <b>baş harfi</b> görüyordu
     * (bildirilen hata). Yol, medya kimliğini taşır: fotoğraf gerçekten
     * değişirse yol da değişir.
     */
    const sameAvatar =
      previous?.avatarUrls.map(avatarKey).join('|') === spec.avatarUrls.map(avatarKey).join('|')
    if (
      previous
      && (previous.color !== spec.color || !sameAvatar || previous.initial !== spec.initial)
      && map.hasImage(id)
    ) {
      map.removeImage(id)
    }
  }
  ensurePlateImages(map, collection.features)
  const source = map.getSource('territory-stores') as mapboxgl.GeoJSONSource | undefined
  source?.setData(points as never)
}

/*
 * ================= TABAN STİLİN ETİKETLERİ =================
 * 🔴 21 Ağu 2026 — kullanıcı talimatı: *"haritada il ve ilçe görünsün, çok
 * fazla text görünüyor boğuluyor, il ilçe isimleri görünsün, çok text olmasın"*.
 */

/**
 * Taban stildeki sembol katmanlarının çoğunu <b>söndürür</b>; yalnız yer
 * adlarını bırakır.
 *
 * <h3>🔴 Neden stil değiştirilmiyor</h3>
 * <p>Daha az etiketli bir taban stile geçmek ({@code light-v11}) sokak
 * ayrıntısını <b>tamamen</b> götürürdü ve bu, 81. turda bilinçle alınmış
 * *"taban HER ZAMAN beyaz sokak haritası"* kararını geri almak olurdu. Burada
 * yollar duruyor, yalnız <b>yazıları</b> susuyor.
 *
 * <h3>Ne kalıyor</h3>
 * <p>{@code place_label} (ülke · il · ilçe · mahalle) ve {@code state_label}.
 * Susanlar: yol adları ve kalkan numaraları, POI'ler (dükkân, kafe, park
 * adı…), toplu taşıma durakları, havalimanları, doğal yer adları, su
 * etiketleri. Haritayı boğan yığın buydu.
 *
 * <p>⚠️ Katman <b>silinmiyor</b>, görünürlüğü kapatılıyor: stil Mapbox'ın
 * malıdır ve bir sonraki sürümünde katman adları değişebilir. Silmek geri
 * dönülemez, söndürmek tek satırda geri alınır.
 *
 * <p>⚠️ Ölçüt katman adı değil <b>{@code source-layer}</b>: adlar stil
 * sürümleri arasında değişir ({@code road-label-simple} → {@code road-label}),
 * kaynak katman adları ise vektör karo şemasının parçasıdır ve kalıcıdır.
 *
 * <p>⚠️ {@code source-layer}'ı OLMAYAN sembol katmanları <b>bizimkilerdir</b>
 * (GeoJSON kaynaklı: mağaza adı, bölge adı, pazar yeri); onlara dokunulmaz.
 */
export function thinBaseLabels(map: mapboxgl.Map) {
  const KEEP = new Set(['place_label', 'state_label'])
  const layers = map.getStyle()?.layers
  if (!layers) return
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue
    const sourceLayer = (layer as { 'source-layer'?: string })['source-layer']
    if (!sourceLayer || KEEP.has(sourceLayer)) continue
    try {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
    } catch {
      /* Katman bu stilde yoksa/kilitliyse sessizce geç — etiket temizliği bir
         süs, harita onsuz da çalışır. */
    }
  }
}

export function addSourcesAndLayers(map: mapboxgl.Map) {
  if (!map.getSource('regions')) {
    map.addSource('regions', { type: 'geojson', data: EMPTY_FC as never })
  }
  if (!map.getSource('territories')) {
    map.addSource('territories', { type: 'geojson', data: EMPTY_FC as never })
  }
  /*
   * 🔴 <b>MAĞAZA NOKTALARI KÜMELENİR</b> (18 Ağu 2026, 4. tur — kullanıcı
   * talimatı: *"çok mağaza varsa tek 1 tane görünsün, yakınlaştırdıkça
   * çoğalsın ve ayrılsınlar"*).
   *
   * Kümeleme burada bir <b>performans</b> aracı değil, <b>görsel</b> araçtır:
   * Türkiye ölçeğinde yüzlerce bina birbirine binmek yerine <b>tek bir bina</b>
   * olur ve yakınlaştıkça ayrışır. Yan faydası da gerçek: uzakta ekrana yüz
   * yerine birkaç model çizilir.
   *
   * ⚠️ `clusterMaxZoom: 14` — z14'ten sonra HİÇBİR ŞEY kümelenmez, yani
   * kullanıcı yakınlaştırdığında her mağaza kendi binasına kavuşur.
   * ⚠️ `clusterRadius: 70` bina genişliğine yakın: iki bina ancak ekranda
   * gerçekten çakışacakken birleşir.
   * ⚠️ `clusterProperties` ile kümenin RENGİ ilk üyeden taşınır — küme
   * iğnesi de renkli çıksın diye ({@code color} kümede kendiliğinden yok olur).
   */
  if (!map.getSource('territory-stores')) {
    map.addSource('territory-stores', {
      type: 'geojson',
      data: EMPTY_FC as never,
      cluster: true,
      clusterRadius: 70,
      clusterMaxZoom: 14,
      clusterProperties: {
        anyColor: ['coalesce', ['accumulated'], ['get', 'color']],
      },
    } as never)
  }
  if (!map.getSource('preview')) {
    map.addSource('preview', { type: 'geojson', data: EMPTY_FC as never })
  }

  // Fiyat bölgeleri
  addLayerOnce(map, {
    id: 'regions-zone-fill',
    type: 'fill',
    source: 'regions',
    filter: ['==', ['get', 'level'], 'ZONE'],
    paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.3 },
  })
  addLayerOnce(map, {
    id: 'regions-zone-line',
    type: 'line',
    source: 'regions',
    filter: ['==', ['get', 'level'], 'ZONE'],
    paint: { 'line-color': '#9a9fa5', 'line-width': 1, 'line-opacity': 0.55 },
  })
  addLayerOnce(map, {
    id: 'regions-zone-label',
    type: 'symbol',
    source: 'regions',
    filter: ['==', ['get', 'level'], 'ZONE'],
    layout: { 'text-field': ['get', 'name'], 'text-size': 11 },
    paint: { 'text-color': '#6f767e', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
  })

  addLayerOnce(map, {
    id: 'regions-country-fill',
    type: 'fill',
    source: 'regions',
    filter: ['==', ['get', 'level'], 'COUNTRY'],
    paint: { 'fill-color': '#ffd88d', 'fill-opacity': 0.07 },
  })
  addLayerOnce(map, {
    id: 'regions-province-fill',
    type: 'fill',
    source: 'regions',
    filter: ['==', ['get', 'level'], 'PROVINCE'],
    paint: { 'fill-color': '#2a85ff', 'fill-opacity': 0.06 },
  })
  addLayerOnce(map, {
    id: 'regions-province-line',
    type: 'line',
    source: 'regions',
    filter: ['==', ['get', 'level'], 'PROVINCE'],
    paint: { 'line-color': '#2a85ff', 'line-width': 0.8, 'line-opacity': 0.3 },
  })
  addLayerOnce(map, {
    id: 'regions-district-fill',
    type: 'fill',
    source: 'regions',
    filter: ['==', ['get', 'level'], 'DISTRICT'],
    paint: { 'fill-color': '#8e59ff', 'fill-opacity': 0.07 },
  })
  addLayerOnce(map, {
    id: 'regions-district-line',
    type: 'line',
    source: 'regions',
    filter: ['==', ['get', 'level'], 'DISTRICT'],
    paint: { 'line-color': '#8e59ff', 'line-width': 0.8, 'line-dasharray': [2, 2], 'line-opacity': 0.4 },
  })

  // Sahipli alanlar — renk/opaklık/kalınlık sahibin özelleştirmesinden gelir.
  addLayerOnce(map, {
    id: 'territories-fill',
    type: 'fill',
    source: 'territories',
    paint: {
      /* ⚠️ Son bir yedek şart: ikisi de yoksa `fill-color` varsayılanı
         SİYAH'tır (bkz. `territories-line` notu). */
      'fill-color': ['coalesce', ['get', 'fillColor'], ['get', 'color'], '#2a85ff'],
      'fill-opacity': ['coalesce', ['get', 'fillOpacity'], 0.38],
    },
  })
  /*
   * Kenar İKİ katmandır: altta açık renkli "kılıf", üstünde sahibin rengi.
   *
   * ⚠️ Tek katmanken kenar, aynı renkteki dolgunun üzerinde eriyip gidiyordu —
   * daire uydu/sokak tabanının üstünde nerede başlayıp bittiği belli olmuyordu.
   * Kılıf klasik kartografya tekniğidir: ince bir kontrast şeridi çizginin her
   * iki temada da okunmasını sağlar. Sıra ÖNEMLİ — kılıf önce eklenir ki altta kalsın.
   */
  addLayerOnce(map, {
    id: 'territories-line-casing',
    type: 'line',
    source: 'territories',
    paint: {
      'line-color': '#ffffff',
      'line-width': ['+', ['coalesce', ['get', 'strokeWidth'], 3], 3],
      'line-opacity': 0.5,
    },
  })
  addLayerOnce(map, {
    id: 'territories-line',
    type: 'line',
    source: 'territories',
    paint: {
      /*
       * ⚠️ `coalesce` ŞART — `['get','color']` tek başına tehlikeli.
       *
       * Özellik yoksa Mapbox ifadeyi `null` değerlendirir ve boya özelliği
       * <b>varsayılanına</b> düşer; `line-color`'ın varsayılanı **siyahtır**.
       * Yani eksik tek bir alan, haritada sebebi görünmeyen **siyah bir çizgi**
       * üretir. Komşu katmanlar (`store-glow`, `store-cluster`) zaten
       * `coalesce` kullanıyordu; burası ve dolgu atlanmıştı.
       */
      'line-color': ['coalesce', ['get', 'color'], '#2a85ff'],
      'line-width': ['coalesce', ['get', 'strokeWidth'], 3],
      'line-opacity': 0.95,
    },
  })
  /*
   * ================================================================
   *  MAĞAZA İŞARETÇİSİ — parıltı + halkalı fotoğraf + ad levhası
   * ================================================================
   *
   * Katman sırası (alttan üste) ÖNEMLİ:
   *   1. parıltı halkaları  → fotoğrafın altında kalmalı
   *   2. küme balonu + sayısı
   *   3. halkalı fotoğraf
   *   4. ad levhası         → fotoğrafın üstünde okunmalı
   *   5. görünmez tıklama hedefi
   */

  /*
   * -------- 1) PARILTI
   *
   * 🔴 <b>TEK katman.</b> Önce PULSE/GLOW/SOFT diye üçe bölünmüştü; kullanıcı
   * *"bunları kaldır düzgün çalışmıyorlar"* dedi ve haklıydı: haritada
   * birbirinden ayırt edilemiyorlardı. Tek tasarım, tek katman, tek kod yolu.
   *
   * Nabız {@link startMarkerPulse} tarafından kare başına <b>düz sayılarla</b>
   * sürülür — ifade yeniden ayrıştırılmaz, yerleşim yeniden hesaplanmaz.
   *
   * ⚠️ `circle-blur` parıltıyı YUMUŞATIR — keskin kenarlı ikinci bir daire
   * "iki halka" gibi okunuyordu, parıltı gibi değil.
   * ⚠️ Kümeler de dahil: küme de renkli bir halkadır ve tek başına sönük
   * kalmamalı. Rengi `clusterProperties.anyColor` ile üyelerden taşınır.
   */
  addLayerOnce(map, {
    id: 'store-glow',
    type: 'circle',
    source: 'territory-stores',
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], ['get', 'anyColor'], '#2a85ff'],
      'circle-radius': 29,
      'circle-opacity': 0.5,
      /* ⚠️ `circle-blur` yarıçapa GÖRELİDİR: 0,85 yumuşak kenarı yarıçapın
         %85'i kadar yayar ve daire bir "sis bulutu"na döner. 0,4 kenarı
         yumuşatır ama parıltıyı halkanın yanında tutar. */
      'circle-blur': 0.4,
    },
  })

  /*
   * -------- 2) KÜME
   * Uzakta yüzlerce fotoğraf yerine tek bir sayı. Kümeleme burada hem GÖRSEL
   * hem PERFORMANS aracı: ekranda çizilecek işaretçi sayısını tavanlar ve
   * üretilecek fotoğraf sayısını da öyle (görseller tembel üretiliyor).
   *
   * ⚠️ Kümede `color` YOKTUR (kümeleme özellik taşımaz) → renk
   * `clusterProperties.anyColor` ile üyelerden taşınır.
   */
  addLayerOnce(map, {
    id: 'store-cluster',
    type: 'circle',
    source: 'territory-stores',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': ['step', ['get', 'point_count'], 20, 10, 24, 50, 29, 200, 34],
      'circle-stroke-width': 3.5,
      'circle-stroke-color': ['coalesce', ['get', 'anyColor'], '#2a85ff'],
    },
  })
  addLayerOnce(map, {
    id: 'store-cluster-count',
    type: 'symbol',
    source: 'territory-stores',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 13,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#1a1d1f' },
  })

  /*
   * -------- 3) HALKALI FOTOĞRAF
   *
   * 🔴 `icon-image` mağazanın KİMLİĞİNDEN türer ve görsel o an yoksa Mapbox
   * `styleimagemissing` fırlatır; {@link attachStoreMarkerImages} tam o anda
   * çizer. Yani ekranda görünmeyen mağazanın fotoğrafı hiç indirilmez.
   *
   * ⚠️ `icon-allow-overlap: true` — işaretçi mağazanın haritadaki VARLIĞIDIR,
   * kalabalıkta elenirse mağaza "yok" olur. Elenmesi gereken şey ADIDIR ve o
   * ayrı bir katmanda (aşağıda) kendi çarpışmasını yapıyor.
   */
  addLayerOnce(map, {
    id: 'store-avatar',
    type: 'symbol',
    source: 'territory-stores',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'markerIcon'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      /* ⚠️ Görsel `pixelRatio: 2` ile kaydedildi; boyu zaten mantıksal
         piksel. `icon-size` 1 kalmalı, yoksa fotoğraf bulanıklaşır. */
      'icon-size': 1,
    },
  })

  /*
   * -------- 4) AD LEVHASI
   * Fotoğraftaki "LIVE" rozetinin yerinde kişinin adı.
   *
   * 🔴 Levha ve metin AYNI katmanda: iki ayrı sembol katmanı birbirine
   * KİLİTLENMEZ (ölçüldü, vault 18) — biri çarpışmada elenirken diğeri kalır
   * ve haritada boş levhalar ya da levhasız yazılar oluşur. `icon-text-fit`
   * ikisini tek bir yerleşim birimi yapar.
   *
   * ⚠️ Ad, fotoğrafın AKSİNE elenebilir (`allow-overlap: false`): kalabalıkta
   * adların üst üste binmesi haritayı okunmaz yapar, oysa işaretçilerin
   * kendisi durmalı.
   */
  addLayerOnce(map, {
    id: 'store-name',
    type: 'symbol',
    source: 'territory-stores',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['coalesce', ['get', 'name'], ''],
      /*
       * 🔴 Referanstaki "LIVE" rozeti: KÜÇÜK, KALIN, BÜYÜK HARF ve harf arası
       * açık. Küçük harf yazıldığında rozet bir "etiket" gibi okunuyordu,
       * referanstaki rozet gibi değil.
       */
      'text-size': 10,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.06,
      /*
       * 🔴 Rozet dairenin ALTINDA DEĞİL, <b>SAĞ ALT KÖŞESİNE BİNER</b> —
       * referansta "LIVE" tam olarak orada duruyor. Bunu veren şey
       * {@code text-anchor: 'top-left'}: kutunun SOL ÜST köşesi verilen
       * noktaya oturur, yani rozet oradan sağa doğru uzar ve uzun adlarda da
       * sola taşmaz.
       *
       * ⚠️ Birim <b>EM</b>'dir (yazı boyuna göre), piksel değil. 10 px yazıda
       * `[0.6, 1.35]` ≈ merkezden 6 px sağ, 13,5 px aşağı → 27 px'lik
       * yarıçapın alt-sağ yayının üstü.
       * ⚠️ `'top'` (ortalanmış) bırakılırsa rozet dairenin tam altına düşer ve
       * referanstaki asimetri kaybolur — önceki sürümün hatası buydu.
       */
      'text-offset': [0.6, 1.35],
      'text-anchor': 'top-left',
      /* Uzun adlar iki satıra bölünüp rozeti kutuya çevirmesin. */
      'text-max-width': 12,
      'icon-image': [
        'coalesce',
        ['image', ['concat', 'waydee-plate-', ['downcase', ['coalesce', ['get', 'color'], '']]]],
        ['image', 'waydee-plate-default'],
      ],
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [1, 4, 1, 4],
      'icon-anchor': 'top-left',
      'text-allow-overlap': false,
      'icon-allow-overlap': false,
      /* 🔴 İkisi de zorunlu: `text-optional` true olsaydı çarpışmada metin
         elenip haritada BOŞ renkli levhalar kalırdı. */
      'text-optional': false,
      'icon-optional': false,
    },
    paint: {
      'text-color': '#ffffff',
      /* Hâle levhanın KENDİ rengi: beyaz hâle levhayı içeriden yer ve yazıyı
         bulanık gösterirdi. */
      'text-halo-color': ['coalesce', ['get', 'color'], '#111315'],
      'text-halo-width': 0.5,
    },
  })

  /*
   * -------- 5) GÖRÜNMEZ TIKLAMA HEDEFİ
   *
   * ⚠️ Sembol katmanına tıklama YETMEZ: `icon-allow-overlap` ile üst üste
   * binen işaretçilerde hangisinin sorgulanacağı belirsizleşir ve levha da
   * ayrı bir katmandır. Saydam bir daire, hem kümeyi hem tekil mağazayı tek
   * bir hedefte toplar.
   *
   * ⚠️ Yarıçap işaretçinin ekrandaki boyuna yakın tutulur: daha küçük olsaydı
   * kullanıcı fotoğrafa basar ama hedefi ıskalardı.
   */
  addLayerOnce(map, {
    id: 'territory-store-hit',
    type: 'circle',
    source: 'territory-stores',
    paint: {
      'circle-radius': 28,
      'circle-opacity': 0,
    },
  })

  addLayerOnce(map, {
    id: 'preview-fill',
    type: 'fill',
    source: 'preview',
    paint: { 'fill-color': '#2a85ff', 'fill-opacity': 0.18 },
  })
  addLayerOnce(map, {
    id: 'preview-line',
    type: 'line',
    source: 'preview',
    paint: { 'line-color': '#2a85ff', 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
  })
}

/** Fiyat bölgeleri her iki temada da "hafifçe belli" olmalı. */
export function applyZoneTheme(map: mapboxgl.Map, dark: boolean) {
  if (!map.getLayer('regions-zone-fill')) return
  map.setPaintProperty('regions-zone-fill', 'fill-color', dark ? '#fcfcfc' : '#ffffff')
  map.setPaintProperty('regions-zone-fill', 'fill-opacity', dark ? 0.09 : 0.42)
  map.setPaintProperty('regions-zone-line', 'line-color', dark ? '#c9ced4' : '#8b9198')
  map.setPaintProperty('regions-zone-line', 'line-opacity', dark ? 0.4 : 0.5)
  map.setPaintProperty('regions-zone-label', 'text-color', dark ? '#c9ced4' : '#6f767e')
  map.setPaintProperty('regions-zone-label', 'text-halo-color', dark ? '#111315' : '#ffffff')

  // Daire kenarının kılıfı da temayla döner: açık temada beyaz, koyu temada
  // koyu bir şerit. Sabit beyaz bırakılsaydı koyu haritada kenar parlıyordu.
  if (map.getLayer('territories-line-casing')) {
    map.setPaintProperty('territories-line-casing', 'line-color', dark ? '#0b0d0f' : '#ffffff')
    map.setPaintProperty('territories-line-casing', 'line-opacity', dark ? 0.45 : 0.5)
  }
}

/**
 * Globe'un atmosferi ve uzay zemini — TEMAYA GÖRE.
 *
 * ⚠️ Eskiden iki haritada da sabit AÇIK değerler basılıyordu; koyu temada taban
 * harita koyu gelse bile küreyi çevreleyen uzay açık gri kalıyor ve "harita koyu
 * modda açık açılıyor" izlenimi veriyordu. Stil her `setStyle`'da sıfırlandığı
 * için bu her `style.load`'da yeniden çağrılmalıdır (tıpkı `applyZoneTheme`).
 */
export function applyFog(map: mapboxgl.Map, dark: boolean) {
  map.setFog(
    dark
      ? {
          color: 'rgb(28,32,38)',
          'high-color': 'rgb(36,44,58)',
          'horizon-blend': 0.14,
          'space-color': 'rgb(12,14,16)',
          'star-intensity': 0.32,
        }
      : {
          color: 'rgb(222,228,240)',
          'high-color': 'rgb(180,200,235)',
          'horizon-blend': 0.2,
          'space-color': 'rgb(230,236,245)',
          'star-intensity': 0,
        },
  )
}

/** Bölge poligonlarını merkez noktalarına indirger (kümeleme kaynağı için). */
export function territoriesToPoints(fc: FeatureCollection<TerritoryProperties>) {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({
      type: 'Feature',
      id: f.id,
      geometry: {
        type: 'Point',
        coordinates: [Number(f.properties.centerLng), Number(f.properties.centerLat)],
      },
      /*
       * 🔴 `markerIcon` BURADA eklenir, sunucudan gelmez: görselin kimliği
       * tamamen istemci tarafı bir kavram (`waydee-marker-<id>`) ve sunucuya
       * anlatmanın hiçbir faydası yok — sözleşmeye istemcinin çizim
       * ayrıntısını sokmak olurdu.
       * ⚠️ Harita ifadesi bu adı `['get','markerIcon']` ile okuyor; ad
       * değişirse {@link markerIconId} ile birlikte değişmeli.
       */
      properties: { ...f.properties, markerIcon: markerIconId(String(f.properties.id)) },
    })),
  }
}

/** Avatar işaretçisinin iç elemanını (foto ya da baş harf) güncel props'a göre boyar. */
export function flyToTerritory(map: mapboxgl.Map, t: TerritoryProperties) {
  const lng = Number(t.centerLng)
  const lat = Number(t.centerLat)
  const radiusM = Math.max(Number(t.radiusM) || 0, 1)
  const el = map.getContainer()
  const target = Math.max(Math.min(el.clientWidth, el.clientHeight) * 0.3, 60)
  const metersPerPixelAtZ0 = 78271.51696 * Math.cos((lat * Math.PI) / 180)
  const zoom = Math.min(Math.max(Math.log2((target * metersPerPixelAtZ0) / radiusM), 1.5), 18)
  map.flyTo({ center: [lng, lat], zoom, duration: 1400, essential: true })
}

// ------------------------------------------------- açılış kamerası: yoğunluk

/**
 * 🔴 **10 Ağustos 2026 — HARİTA BOŞ BİR YERE DEĞİL, KALABALIĞA AÇILIR.**
 *
 * Kullanıcı: *"loginli olan veya loginsiz olan normal kullanıcı map'e
 * geçtiğinde mağazaların yoğunluğunun olduğu kısıma yönelsin"*. Önceki
 * davranış her ikisinde de **sabit** bir kameraydı (Türkiye geneli, z≈4.6):
 * ürünün içi doluyken bile ilk ekran bomboş bir haritaydı ve ziyaretçi
 * "burada kimse yok" izlenimiyle ayrılıyordu.
 *
 * <h3>Yöntem: ızgara sayımı</h3>
 * Mağaza merkezleri {@code cell} derecelik bir ızgaraya atılır, en kalabalık
 * hücre seçilir, sonra o hücrenin <b>komşularıyla birlikte</b> ağırlık merkezi
 * hesaplanır. Komşuları katmak şart: iki mağaza hücre sınırının iki yanına
 * düşerse "yoğunluk" ikiye bölünür ve kamera ikisinin arasına değil, birinin
 * üstüne giderdi.
 *
 * ⚠️ Kümeleme kütüphanesi (supercluster/k-means) bilinçli olarak
 * <b>kullanılmadı</b>: bu tek seferlik, tek sonuçlu bir sorgu — harita zaten
 * Mapbox'ın kendi kümelemesiyle çiziliyor, ikinci bir kümeleme motoru pakete
 * girmeyi hak etmiyor.
 * ⚠️ Boylam sarması (±180) ele alınmaz. Yoğunluk merkezi tanım gereği
 * mağazaların **yoğun** olduğu yerdedir; tarih çizgisine oturan bir küme
 * gerçekleşirse kamera yine küme içinde bir noktaya bakar, yalnız merkez
 * ideal olmaz. Bunun için kod karmaşıklaştırılmadı.
 *
 * @param features mağaza (daire) özellikleri
 * @param cell     ızgara gözü, derece (varsayılan 1° ≈ 111 km)
 * @returns odaklanılacak merkez + kaç mağazadan oluştuğu; hiç mağaza yoksa null
 */
export function densestCluster(
  features: TerritoryProperties[],
  cell = 1,
): { center: [number, number]; count: number } | null {
  const cells = new Map<string, { lng: number; lat: number; n: number }>()
  for (const f of features) {
    const lng = Number(f.centerLng)
    const lat = Number(f.centerLat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    const gx = Math.floor(lng / cell)
    const gy = Math.floor(lat / cell)
    const key = `${gx}:${gy}`
    const acc = cells.get(key) ?? { lng: 0, lat: 0, n: 0 }
    acc.lng += lng
    acc.lat += lat
    acc.n += 1
    cells.set(key, acc)
  }
  if (cells.size === 0) return null

  let bestKey = ''
  let bestN = -1
  for (const [key, acc] of cells) {
    if (acc.n > bestN) {
      bestN = acc.n
      bestKey = key
    }
  }

  // En kalabalık göz + 8 komşusu: sınıra düşen kümeler ikiye bölünmesin.
  const [bx, by] = bestKey.split(':').map(Number)
  let sumLng = 0
  let sumLat = 0
  let total = 0
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const acc = cells.get(`${bx + dx}:${by + dy}`)
      if (!acc) continue
      sumLng += acc.lng
      sumLat += acc.lat
      total += acc.n
    }
  }
  if (total === 0) return null
  return { center: [sumLng / total, sumLat / total], count: total }
}

/**
 * Yoğunluk merkezine götürür — <b>animasyonsuz</b> ({@code jumpTo}).
 *
 * ⚠️ Uçuş DEĞİL: bu, kullanıcının bir eylemine verilen cevap değil,
 * haritanın açılış konumudur. `flyTo` ile açmak, sayfa daha okunmadan
 * ekranın kaymasına ve "harita kendi kendine hareket ediyor" hissine yol
 * açıyordu. Derin bağlantı (`?t=`) ise gerçek bir eylemdir, o `flyTo` kalır.
 *
 * @param zoom kalabalığın görüldüğü, ama mağazaların birbirinden ayrıldığı ara zoom
 */
export function jumpToDensest(map: mapboxgl.Map, features: TerritoryProperties[], zoom = 10) {
  const hot = densestCluster(features)
  if (!hot) return false
  map.jumpTo({ center: hot.center, zoom })
  return true
}

/** Derin bağlantıdaki kimliği yüklenmiş bölgeler arasında arar. */
export function findTerritoryById(
  features: TerritoryProperties[],
  id: string,
): TerritoryProperties | null {
  return features.find((t) => String(t.id) === String(id)) ?? null
}

// ---------------------------------------------------------------- merkezlenen kart

export interface CenteredCandidate {
  territory: TerritoryProperties
  /** Dairenin merkezinin ekran koordinatı — kart buraya oturur. */
  x: number
  y: number
}

/**
 * Viewport ortasına gelen ve yeterince büyüyen daireyi seçer (kart burada açılır).
 *
 * Histerezis: **açık olan** aday daha gevşek eşiklerle tutulur, böylece kart
 * sınır civarında titremez. Büyük daireler düşük zoom'da, küçük daireler yüksek
 * zoom'da açılır — ölçüt ekrandaki piksel yarıçapıdır, metre değil.
 *
 * Oturumlu harita ve vitrin haritası aynı davranışı paylaşsın diye burada durur.
 */
export function findCenteredTerritory(
  map: mapboxgl.Map,
  features: TerritoryProperties[],
  currentId: string | null,
): CenteredCandidate | null {
  const container = map.getContainer()
  const w = container.clientWidth
  const h = container.clientHeight
  if (!w || !h) return null

  const minDim = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  /*
   * Eşikler GEVŞETİLDİ (31 Tem 2026). Eski değerlerle (mesafe 0.15·minDim,
   * yarıçap 0.28·minDim) kart yalnız daire ekranın TAM ORTASINA gelince
   * açılıyordu; kullanıcı haritada gezerken dairenin üstünden geçse bile kart
   * çıkmıyordu. Yeni değerler:
   *   - mesafe eşiği 0.15 → **0.34** (daire ekranın orta üçte birinde olsa yeter)
   *   - yarıçap eşiği 0.28 → **0.17** (daha uzaktan/daha küçük dairelerde de açılır)
   * Histerezis korunuyor: açılma eşiği kapanmadan DAR, kapanma eşiği GENİŞ —
   * yoksa kart sınırda titrer.
   */
  const OPEN_R = 0.17 * minDim
  const KEEP_R = 0.12 * minDim
  const OPEN_D = 0.34 * minDim
  const KEEP_D = 0.46 * minDim

  let best: (CenteredCandidate & { dist: number }) | null = null
  for (const t of features) {
    const lng = Number(t.centerLng)
    const lat = Number(t.centerLat)
    const c = map.project([lng, lat])
    const dist = Math.hypot(c.x - cx, c.y - cy)
    const isCurrent = currentId === String(t.id)
    if (dist > (isCurrent ? KEEP_D : OPEN_D)) continue
    const px = pixelRadius(map, lng, lat, Number(t.radiusM))
    if (px < (isCurrent ? KEEP_R : OPEN_R)) continue
    if (!best || dist < best.dist) best = { territory: t, x: c.x, y: c.y, dist }
  }
  return best ? { territory: best.territory, x: best.x, y: best.y } : null
}
