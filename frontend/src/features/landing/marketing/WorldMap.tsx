import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { applyFog } from '@/features/map/mapCanvas'
import { useMapboxRuntimeToken } from '@/features/map/useMapboxRuntimeToken'
import { useT } from '@/i18n'

/**
 * 🗺️ <b>Dönen dünya</b> — tanıtım sayfasının "Dijital pazar alanları"
 * karesinde, <b>gerçek Mapbox küresiyle</b>.
 *
 * <h2>🔴 İki tur boyunca yanlış yoldan gidildi</h2>
 * <p>102. tur, kullanıcı: *"dünya kısmını kaldır, bok gibi iş yaptın. Mapbox'ın
 * şekilli haritasını kullan, yapacak bir şey yok."*
 * <ul>
 *   <li>100. tur: <b>cobe</b> — küreyi nokta bulutu olarak çizdi, reddedildi.</li>
 *   <li>101. tur: <b>elde çizilen küre</b> (2B tuval, 1 KB kara maskesi) —
 *       kıtalar geldi ama yine reddedildi.</li>
 * </ul>
 *
 * <p>🔴 <b>Ders:</b> ürün zaten bir <b>harita uygulamasıdır</b>. Mapbox
 * projede kurulu, anahtarı çözülmüş, {@code projection: 'globe'} ve
 * {@link applyFog} ile küre görünümü <b>vitrin sayfasında</b> (`PublicMapPage`)
 * çoktan çalışıyordu. Var olan ve ürünün kendi diliyle konuşan bir yüzeyi
 * taklit etmeye çalışmak, iki tur ve iki reddedilmiş çıktı demekti.
 * <b>Elde çizmeden önce, ürünün o işi zaten yapıp yapmadığına bak.</b>
 *
 * <h2>⚠️ Bu bir DEKOR, harita değil</h2>
 * <p>Etkileşim <b>kapalı</b>: sürükleme, yakınlaştırma, döndürme, klavye ve
 * çift tık — hepsi kapalı. Tanıtım sayfasında bir karenin içindeki harita
 * kaydırmayı yakalarsa ziyaretçi sayfada <b>hapsolur</b>; üstelik gidilecek
 * yer zaten aşağıdaki "Harita" düğmesi.
 *
 * <p>⚠️ Bu yüzden {@code NavigationControl} da <b>eklenmez</b> ve öznitelik
 * (attribution) Mapbox'un kendi varsayılanında bırakılır — lisans şartı
 * (vault, 97. tur: künyeyi örtmek şartı çiğner).
 *
 * <p>⚠️ Küre <b>yalnız ekrandayken</b> döner. Mapbox bir WebGL bağlamı tutar
 * ve tanıtım sayfası uzundur; ziyaretçi en alttaki fiyat tablosundayken
 * yukarıdaki bir dekorun pil yakması için sebep yok.
 *
 * <p>⚠️ Tema <b>sorulmaz</b>: karo her temada koyu (`bg-black/40` çerçevenin
 * içinde) ve harita da koyu stille kurulur. Açık temada açık bir harita
 * koymak, koyu karonun içinde bembeyaz bir daire bırakırdı.
 */

/** Karo her temada koyu; harita da öyle olmalı (gerekçe yukarıda). */
const STYLE_URL = 'mapbox://styles/mapbox/dark-v11'

/** Tam tur ≈ 90 sn — göz yormayan, sürekli bir dönüş. */
const DEGREES_PER_MS = 360 / 90000

/**
 * Küre üzerindeki <b>mağaza noktaları</b> — `[boylam, enlem]`.
 *
 * <p>⚠️ <b>Dekordur</b>, gerçek mağaza verisi değil: tanıtım sayfası hiçbir uca
 * istek atmaz (ziyaretçi oturumu yok) ve atsaydı bile boş bir veritabanında
 * küre çıplak kalırdı. Gerçek veriyle çalışan harita `/map`'tedir.
 *
 * <p>Şehirler bilinçle <b>her kıtaya</b> dağıtıldı: küre dönerken hangi yüz
 * gelirse gelsin ekranda birkaç nokta olur.
 */
const STORE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [28.9784, 41.0082], // İstanbul
  [32.8597, 39.9334], // Ankara
  [-0.1278, 51.5074], // Londra
  [2.3522, 48.8566], // Paris
  [13.405, 52.52], // Berlin
  [-74.006, 40.7128], // New York
  [-118.2437, 34.0522], // Los Angeles
  [-46.6333, -23.5505], // São Paulo
  [55.2708, 25.2048], // Dubai
  [139.6503, 35.6762], // Tokyo
  [103.8198, 1.3521], // Singapur
  [151.2093, -33.8688], // Sydney
  [28.0473, -26.2041], // Johannesburg
  [72.8777, 19.076], // Mumbai
]

/**
 * Kürenin üstünde yüzen <b>mağaza kartları</b>.
 *
 * <p>🔴 Kullanıcı *"mağazalar oluyorsa 3d ya da güzel pngler olsun"* demişti
 * (100. tur). Haritanın kendi noktaları <b>ışıklı beneklerdir</b> — "burada
 * bir şey var" der ama <b>ne olduğunu</b> söylemez. Kartlar o cümleyi
 * tamamlar: gerçek bir vitrin fotoğrafı + mağaza rozeti.
 */
const STORE_CARDS: ReadonlyArray<{
  img: string
  city: string
  style: React.CSSProperties
  delay: string
}> = [
  { img: '/landing/category1.webp', city: 'İstanbul', style: { left: '1%', top: '14%' }, delay: '0s' },
  { img: '/landing/category4.webp', city: 'New York', style: { right: '2%', top: '33%' }, delay: '-2.4s' },
  { img: '/landing/category3.webp', city: 'Tokyo', style: { left: '7%', top: '60%' }, delay: '-4.8s' },
]

/** Noktaları tek bir katmanda çizen GeoJSON kaynağı. */
const POINTS_SOURCE = 'waydee-globe-stores'

export function WorldMap() {
  const t = useT()
  const hostRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const { mapKey, ready: tokenReady } = useMapboxRuntimeToken()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    const container = containerRef.current
    if (!tokenReady || !host || !container || mapRef.current) return

    const map = new mapboxgl.Map({
      container,
      style: STYLE_URL,
      center: [28.9784, 30],
      zoom: 1.6,
      projection: 'globe',
      /* 🔴 Dekor: her girdi kapalı (gerekçe dosya başında). `interactive:false`
         tek başına yeterli ama açıkça yazılan her biri, ileride biri
         "sadece zoom açalım" dediğinde neyin bilinçli kapatıldığını söyler. */
      interactive: false,
      attributionControl: true,
      /* Ekran görüntüsü/paylaşım için gerekmiyor ve bellek yiyor. */
      preserveDrawingBuffer: false,
    })
    mapRef.current = map

    /* Vitrin haritasıyla aynı kolaylık: geliştirmede örneği dışarı aç ki
       katmanlar ve kamera konsoldan ölçülebilsin. */
    if (import.meta.env.DEV) {
      ;(window as unknown as { __waydeeLandingGlobe?: mapboxgl.Map }).__waydeeLandingGlobe = map
    }

    map.on('style.load', () => {
      /* Küre atmosferi — vitrin haritasıyla aynı yardımcı, tek kaynak. */
      applyFog(map, true)

      map.addSource(POINTS_SOURCE, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: STORE_POINTS.map(([lng, lat]) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [lng, lat] },
            properties: {},
          })),
        },
      })
      /* İki katman: geniş ve soluk bir hâle + üstünde küçük parlak bir çekirdek.
         Tek dairede ikisi birden olmaz — `circle-blur` bütün daireyi yumuşatır. */
      map.addLayer({
        id: POINTS_SOURCE + '-glow',
        type: 'circle',
        source: POINTS_SOURCE,
        paint: {
          'circle-radius': 11,
          'circle-color': '#c2f04b',
          'circle-blur': 1.1,
          'circle-opacity': 0.5,
        },
      })
      map.addLayer({
        id: POINTS_SOURCE + '-core',
        type: 'circle',
        source: POINTS_SOURCE,
        paint: {
          'circle-radius': 3,
          'circle-color': '#f2ffd6',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#c2f04b',
        },
      })
      setShown(true)
    })

    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [mapKey, tokenReady])

  /*
   * Dönüş ve görünürlük kapısı.
   *
   * ⚠️ Dönüş `easeTo`/`flyTo` ile YAPILMAZ: her kare yeni bir animasyon
   * kuyruğa sokmak Mapbox'ın kendi geçişleriyle çakışıyor ve dönüş kekeliyor.
   * `setCenter` doğrudan yazar — küre zaten kare başına yeniden çiziliyor.
   */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let raf = 0
    let running = false
    let last = 0
    let seen = false

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const map = mapRef.current
      if (!map) return
      if (!last) last = now
      const step = (now - last) * DEGREES_PER_MS
      last = now
      const c = map.getCenter()
      map.setCenter([c.lng + step, c.lat])
    }

    const start = () => {
      if (running) return
      running = true
      last = 0
      raf = requestAnimationFrame(loop)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          seen = true
          if (e.isIntersecting) start()
          else stop()
        }),
      { rootMargin: '150px' },
    )
    io.observe(host)

    /* ⚠️ SİGORTA (vault kuralı: *"süs içeriği yutamaz"*). `IntersectionObserver`
       her ortamda ateşlemiyor — ölçüldü, 100. tur. IO hiç konuşmazsa küre yine
       de döner: donmuş bir dekor, ekran dışında birkaç kare fazla çizmekten
       daha kötüdür. */
    const fuse = window.setTimeout(() => {
      if (!seen) start()
    }, 1200)

    return () => {
      io.disconnect()
      window.clearTimeout(fuse)
      cancelAnimationFrame(raf)
    }
  }, [mapKey, tokenReady])

  return (
    <div ref={hostRef} className="waydee-globe" aria-label={t('landing.map.d')} role="img">
      {/* Kürenin arkasındaki yumuşak parıltı — Mapbox'ın atmosferini karonun
          zeminine bağlar, disk koyu zemine bıçak gibi kesilerek oturmaz. */}
      <span className="waydee-globe-halo" aria-hidden />
      <div ref={containerRef} className="waydee-globe-canvas" data-on={shown} />

      {STORE_CARDS.map((c) => (
        <figure
          key={c.city}
          className="waydee-globe-card"
          style={{ ...c.style, animationDelay: c.delay }}
        >
          <img src={c.img} alt="" aria-hidden loading="lazy" draggable={false} />
          <figcaption>
            {/* Rozet: uygulamanın gerçek mağaza ikonu — tek kaynak. */}
            <img src="/shopicon.png" alt="" aria-hidden loading="lazy" draggable={false} />
            <span>{c.city}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
