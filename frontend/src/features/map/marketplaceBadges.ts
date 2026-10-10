import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl'
import type { FeatureCollection } from '@/types/api'
import type { MarketplaceAreaProperties } from '@/lib/marketplace'

/**
 * 🏷️ <b>Pazar rozeti</b> — alanın tam ortasında ad + görsel + sayaç.
 *
 * <h2>Neden Mapbox katmanı değil, HTML işaretçisi</h2>
 * <p>105. tur, kullanıcı referans bir görsel verdi: üstte pazarın adı, altında
 * yüklenen PNG, onun da altında <b>beyaz bir hap</b> içinde renkli nokta +
 * stant sayısı. Bunu bir <code>symbol</code> katmanıyla çizmek üç ayrı katman
 * (metin, ikon, ikinci metin) ve her biri için ayrı hizalama demekti; hap'ın
 * yuvarlak zemini ve gölgesi ise <b>hiç</b> yapılamazdı.
 *
 * <p>{@link mapboxgl.Marker} bir DOM düğümünü koordinata çiviler: tasarım
 * bildiğimiz CSS, mobil uyum bildiğimiz medya sorgusu.
 *
 * <h2>🔴 Yakınlaştırma duyarlılığı</h2>
 * <p>Kullanıcı: *"yine yakınlaştırma uzaklaştırma hassasiyeti olacak şekilde
 * ayarla"*. Sabit piksel boyu, uzaklaşınca rozeti bütün ilçenin üstüne
 * taşacak kadar büyük gösteriyor. Rozet bu yüzden <b>zoom'la ölçekleniyor</b>
 * ({@link scaleFor}) — yere çivilenmiş gibi durur.
 *
 * <p>⚠️ Ölçek <b>sınırlıdır</b>. Serbest bıraksaydık dünya zoom'unda okunmaz
 * bir noktaya, sokak zoom'unda ekranı kaplayan bir afişe dönerdi.
 *
 * <p>⚠️ Ölçek <b>CSS değişkenine</b> yazılır, React state'ine değil: `zoom`
 * olayı sürükleme boyunca saniyede onlarca kez ateşler ve her birinde yeniden
 * render etmek haritayı kekeletirdi.
 *
 * <h2>⚠️ İmzalı adres = kimlik değil</h2>
 * <p>Medya adresleri <b>imzalı ve sürelidir</b>; aynı görsel her veri
 * tazelemesinde <b>yeni bir dize</b> olarak gelir. Rozetin yeniden kurulup
 * kurulmayacağına adrese bakarak karar vermek, her tazelemede bütün
 * işaretçileri söküp yeniden kurmak olurdu (98. turun dersi). Karar
 * <b>kimlik + ad + sayı</b> üçlüsüne bakılarak veriliyor.
 */

/**
 * 🔴 Zoom → ölçek eğrisi (106. tur).
 *
 * <p>Kullanıcı: *"yakınlaştırınca daha büyük olsun, uzaklarda güzel sadece
 * zemine yakınlaşınca biraz daha büyük olsun… örneğin İstanbul'da bir ilçe
 * kadar yakınlaşınca o artık **sabit kalmasın**, yakınlaşsın."*
 *
 * <p>İlk sürümde ölçek <b>zoom 15'te sabitleniyordu</b> (tavan 1,35). İlçe
 * ölçeği zaten 12–14 civarındadır; yani rozet tam da kullanıcının büyümesini
 * beklediği yerde <b>donuyordu</b>.
 *
 * <p>✅ Eğri artık <b>çok duraklı</b> ve zoom 20'ye kadar büyümeye devam
 * ediyor. Uzak uç <b>değişmedi</b> — kullanıcı orayı beğeniyordu.
 *
 * <table>
 *   <tr><th>zoom</th><th>ne görünür</th><th>ölçek</th></tr>
 *   <tr><td>≤7</td><td>ülke / bölge</td><td>0,62 (taban)</td></tr>
 *   <tr><td>12</td><td>şehir</td><td>1,05</td></tr>
 *   <tr><td>16</td><td>ilçe / mahalle</td><td>2,10</td></tr>
 *   <tr><td>≥20</td><td>sokak</td><td>3,60 (tavan)</td></tr>
 * </table>
 *
 * <p>⚠️ Tam <b>yer bağlı</b> (zoom başına iki kat) YAPILMADI: o, sokak
 * zoom'unda rozeti ekranın on katı büyüklüğe çıkarırdı. Aradaki fark tam da
 * kullanıcının istediği şey — "biraz daha büyük", "devasa" değil.
 *
 * <p>📱 <b>Mobilde ayrı tablo.</b> Telefonda taban görsel zaten daha küçük
 * (CSS: 76px yerine 104px) ama tavan da düşürülmeli: masaüstü tavanıyla
 * 76 × 3,6 = <b>274px</b> eder ve 375px'lik bir ekranda rozet haritayı yutar.
 */
type Stop = readonly [zoom: number, scale: number]

const STOPS_DESKTOP: readonly Stop[] = [
  [7, 0.62],
  [12, 1.05],
  [16, 2.1],
  [20, 3.6],
]

const STOPS_MOBILE: readonly Stop[] = [
  [7, 0.62],
  [12, 0.95],
  [16, 1.7],
  [20, 2.6],
]

/**
 * Duraklar arasında doğrusal geçiş; iki uçta <b>sabitlenir</b>.
 *
 * ⚠️ Üstel (zoom başına ×2) değil: üstel eğri 15'ten sonra rozeti ekrandan
 * taşırıyordu ve kullanıcı "büyüdükçe büyüyor" derdi.
 */
function scaleFor(zoom: number, stops: readonly Stop[]): number {
  if (zoom <= stops[0][0]) return stops[0][1]
  const last = stops[stops.length - 1]
  if (zoom >= last[0]) return last[1]
  for (let i = 1; i < stops.length; i++) {
    const [z1, s1] = stops[i]
    const [z0, s0] = stops[i - 1]
    if (zoom <= z1) {
      const t = (zoom - z0) / (z1 - z0)
      return s0 + (s1 - s0) * t
    }
  }
  return last[1]
}

/** Rozetin yeniden kurulmasını gerektiren değerler (imzalı adres HARİÇ). */
function identityOf(p: MarketplaceAreaProperties): string {
  return [p.id, p.name, p.listingCount, p.accepting ? 1 : 0, p.coverUrl ? 1 : 0].join('|')
}

function buildElement(p: MarketplaceAreaProperties, countLabel: string): HTMLElement {
  const root = document.createElement('div')
  root.className = 'waydee-mp-badge'

  const name = document.createElement('span')
  name.className = 'waydee-mp-badge-name'
  name.textContent = p.name
  root.appendChild(name)

  if (p.coverUrl) {
    const art = document.createElement('img')
    art.className = 'waydee-mp-badge-art'
    art.src = p.coverUrl
    art.alt = ''
    art.setAttribute('aria-hidden', 'true')
    art.draggable = false
    /* ⚠️ Görsel gelmezse rozet BOŞ BİR KUTU bırakmaz, kendini siler: yüklenmemiş
       bir PNG'nin yer tutucusu, adla sayaç arasında sebepsiz bir boşluk olur. */
    art.onerror = () => art.remove()
    root.appendChild(art)
  }

  const pill = document.createElement('span')
  pill.className = 'waydee-mp-badge-pill'

  const dot = document.createElement('i')
  dot.className = 'waydee-mp-badge-dot'
  dot.style.background = p.accentColor
  pill.appendChild(dot)

  const value = document.createElement('b')
  value.textContent = String(p.listingCount)
  pill.appendChild(value)

  const label = document.createElement('em')
  label.textContent = countLabel
  pill.appendChild(label)

  root.appendChild(pill)
  return root
}

export type BadgeController = {
  /** Veriyi tazele — değişmeyen rozetler yerinde kalır. */
  setData: (areas?: FeatureCollection<MarketplaceAreaProperties>) => void
  /** Katman anahtarıyla birlikte gizlenir. */
  setVisible: (visible: boolean) => void
  destroy: () => void
}

/**
 * Rozetleri haritaya bağlar.
 *
 * @param countLabel "Aktif vitrin" — çağıran çeviriden geçirir; bu modül
 *                   sözlüğe dokunmaz.
 */
export function attachMarketplaceBadges(
  map: MapboxMap,
  countLabel: string,
  onOpen: (area: MarketplaceAreaProperties) => void,
): BadgeController {
  const markers = new Map<string, { marker: Marker; identity: string }>()
  let visible = true

  /* ⚠️ Kırılım bir kez sorulup DİNLENİYOR: her zoom olayında `matchMedia`
     çağırmak, saniyede onlarca kez düzen hesabı tetiklemek olurdu. */
  const narrow = window.matchMedia('(max-width: 640px)')
  let stops: readonly Stop[] = narrow.matches ? STOPS_MOBILE : STOPS_DESKTOP
  const onBreakpoint = () => {
    stops = narrow.matches ? STOPS_MOBILE : STOPS_DESKTOP
    applyScale()
  }
  narrow.addEventListener('change', onBreakpoint)

  const applyScale = () => {
    const s = String(scaleFor(map.getZoom(), stops))
    markers.forEach(({ marker }) => {
      marker.getElement().style.setProperty('--waydee-mp-scale', s)
    })
  }
  map.on('zoom', applyScale)

  const setData = (areas?: FeatureCollection<MarketplaceAreaProperties>) => {
    if (!areas) return
    const seen = new Set<string>()

    for (const feature of areas.features) {
      const p = feature.properties
      if (!p) continue
      seen.add(p.id)
      const identity = identityOf(p)
      const existing = markers.get(p.id)

      if (existing) {
        if (existing.identity === identity) {
          /* Yalnız konum tazelenir: alan yeniden çizilmiş olabilir. */
          existing.marker.setLngLat([p.centerLng, p.centerLat])
          continue
        }
        existing.marker.remove()
        markers.delete(p.id)
      }

      const el = buildElement(p, countLabel)
      el.style.setProperty('--waydee-mp-scale', String(scaleFor(map.getZoom(), stops)))
      el.style.display = visible ? '' : 'none'
      /* Rozete tıklamak da pazarı açar — poligonun ortasındaki en görünür
         hedef odur ve kullanıcıların ilk tıkladığı yer olacak. */
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onOpen(p)
      })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.centerLng, p.centerLat])
        .addTo(map)
      markers.set(p.id, { marker, identity })
    }

    /* Artık gelmeyen pazarların rozetleri sökülür — yoksa arşivlenen bir pazar
       haritada sonsuza kadar asılı kalırdı. */
    markers.forEach((entry, id) => {
      if (!seen.has(id)) {
        entry.marker.remove()
        markers.delete(id)
      }
    })
  }

  const setVisible = (next: boolean) => {
    visible = next
    markers.forEach(({ marker }) => {
      marker.getElement().style.display = next ? '' : 'none'
    })
  }

  const destroy = () => {
    map.off('zoom', applyScale)
    narrow.removeEventListener('change', onBreakpoint)
    markers.forEach(({ marker }) => marker.remove())
    markers.clear()
  }

  return { setData, setVisible, destroy }
}
