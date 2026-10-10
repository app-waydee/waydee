import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { LogIn, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { isDarkMapStyle, themeMapStyle } from '@/lib/mapStyles'
import { getPublicRegions, getPublicTerritories } from '@/lib/publicApi'
import { useThemeStore } from '@/stores/theme'
import type { TerritoryProperties } from '@/types/api'
import {
  addSourcesAndLayers,
  applyFog,
  applyZoneTheme,
  findCenteredTerritory,
  findTerritoryById,
  flyToTerritory,
  jumpToDensest,
  attachStoreMarkerImages,
  setStoreMarkerData,
  startMarkerPulse,
  thinBaseLabels,
} from '@/features/map/mapCanvas'
import { createCameraMemory } from '@/features/map/mapCamera'
import { MapScrim } from '@/features/map/MapScrim'
import { useMapboxRuntimeToken } from '@/features/map/useMapboxRuntimeToken'
import { PublicTerritoryCard } from './PublicTerritoryCard'

/* Mapbox anahtarı sunucudan gelir (bkz. `lib/clientConfig.ts`) — vitrin de aynı
   çalışma zamanı anahtarını kullanır, admin değiştirince burası da yenilenir. */

/* 🔴 21 Ağu 2026 — `pitch: 0`. Eğik bakış ve 3B kaldırıldı; işaretçi artık
   ekran düzlemine çizilen halkalı bir fotoğraf ve eğik zeminde yüzüyormuş gibi
   durmamalı. Harita davranışı BEŞ yüzeydir, biri değişince hepsi taranır
   (vault kuralı) — bu yüzden vitrin de oturumlu haritayla aynı anda döndü. */
const DEFAULT_VIEW = { center: [32.5, 39.0] as [number, number], zoom: 4.6, pitch: 0 }

/** Vitrin haritasının kamerası — oturumlu haritanınkinden ayrı anahtar. */
const camera = createCameraMemory('waydee-public-map-view')

/**
 * Vitrin haritası (landing, `/`) — **yalnız görüntüleme**.
 *
 * Ziyaretçi haritada gezebilir, bölgelere dokunup açık hesapların profillerini
 * (web sitesi/HTML dahil) görebilir. Çizim, satın alma, beğeni gibi hiçbir
 * eylem yoktur; veriler `/api/v1/public/**` uçlarından gelir ve gizli hesaplar
 * sunucuda maskelenir.
 */
export function PublicMapPage() {
  const themeMode = useThemeStore((s) => s.mode)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const featuresRef = useRef<TerritoryProperties[]>([])
  /**
   * 🔴 Sis TEMAYI, bölge kaplaması TABANI izler — gerekçe `MapPage`.
   * Koyu modda arka plan (uzay + yıldızlar) karanlık, harita beyaz kalır.
   */
  const darkFogRef = useRef(false)
  const darkBaseRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  /**
   * Mapbox anahtarı değişince `mapKey` artar → harita yeni anahtarla yeniden kurulur.
   * ⚠️ `ready` false iken harita HİÇ yaratılmaz (boş anahtar = Mapbox fırlatır).
   */
  const { mapKey, ready: tokenReady } = useMapboxRuntimeToken()
  const [selected, setSelected] = useState<TerritoryProperties | null>(null)
  /*
   * ⚠️ `useSearchParams` bilerek BURADA çağrılıyor (eskiden derin bağlantı
   * etkisinin hemen üstündeydi): mağaza verisi gelince çalışan yoğunluk
   * odağı da `?t=` var mı diye bakıyor ve ondan önce yer alıyor.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  /** Yoğunluk odağı oturumda bir kez uygulanır — bkz. aşağıdaki gerekçe. */
  const densityFocusedRef = useRef(false)

  /** Viewport ortasına gelen dairenin kartı — oturumlu haritadaki davranışın aynısı. */
  const [autoTerritory, setAutoTerritory] = useState<TerritoryProperties | null>(null)
  const autoIdRef = useRef<string | null>(null)
  const autoSuppressedRef = useRef<string | null>(null)
  const evaluateRef = useRef<(() => void) | null>(null)
  const rafPendingRef = useRef(false)

  /* Çapalı kartın konumu DOM'a yazılır, state'e değil — oturumlu haritayla
     aynı gerekçe (bkz. MapPage / TerritoryCard `anchored` notu). */
  const autoCardRef = useRef<HTMLDivElement | null>(null)
  const autoPosRef = useRef({ x: 0, y: 0 })
  const placeAutoCard = (x: number, y: number) => {
    autoPosRef.current = { x, y }
    const el = autoCardRef.current
    if (el) {
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`
    }
  }
  useLayoutEffect(() => {
    if (!autoTerritory) return
    const { x, y } = autoPosRef.current
    const el = autoCardRef.current
    if (el) {
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`
    }
  }, [autoTerritory])

  /*
   * 🔴 10 Ağu 2026 — TABAN ARTIK TEMAYI İZLİYOR.
   * Önceki hâli `const styleKey = DEFAULT_MAP_STYLE` idi, yani **sabitti**;
   * aşağıdaki "tema değişti" etkisi `setStyle`i her seferinde AYNI stille
   * çağırıyor ve ziyaretçi tema düğmesine bastığında haritanın arka planı
   * hiç değişmiyordu (kullanıcı bildirdi). Sokak ayrıntısı korunur —
   * gerekçe `lib/mapStyles.ts` → `THEME_MAP_STYLES`.
   * ⚠️ Ziyaretçinin kayıtlı stil tercihi olmaz; yine de tek kaynaktan
   * (`themeMapStyle`) çözülür ki oturumlu haritayla ayrışmasın.
   */
  const styleUrl = themeMapStyle(null, themeMode)

  const { data: regions } = useQuery({
    queryKey: ['public', 'regions'],
    queryFn: getPublicRegions,
    staleTime: 5 * 60_000,
  })
  const { data: territories } = useQuery({
    queryKey: ['public', 'territories'],
    queryFn: getPublicTerritories,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!tokenReady || !containerRef.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      // Profil/giriş sayfasına gidip vitrine dönünce aynı noktadan devam edilir.
      ...camera.initialView(DEFAULT_VIEW),
      projection: 'globe',
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
    /* İşaretçi görselleri tembel üretilir; nabzı kare başına iki düz sayı sürer. */
    const detachMarkerImages = attachStoreMarkerImages(map)
    const stopPulse = startMarkerPulse(map)

    if (import.meta.env.DEV) {
      ;(window as unknown as { __waydeePublicMap?: mapboxgl.Map }).__waydeePublicMap = map
    }

    map.on('style.load', () => {
      applyFog(map, darkFogRef.current)
      /* Yol/POI yazıları söner, yer adları kalır — oturumlu haritayla aynı. */
      thinBaseLabels(map)
      addSourcesAndLayers(map)
      applyZoneTheme(map, darkBaseRef.current)
      setMapReady(true)
    })

    // Küme işaretçileri kendi olaylarını bağlar ve tek rAF'ta birleştirir.
    /*
     * 🔴 18 Ağu 2026 (4. tur) — HTML KÜME BALONLARI KALDIRILDI.
     * Kümeleme artık `territory-stores` kaynağının kendisinde ve kümeyi
     * ekranda 3B binanın kendisi temsil ediyor (üstünde "N mağaza" yazısıyla).
     * İki ayrı kümeleme sistemi tutmak, aynı yeri iki kez işaretlemek olurdu —
     * üstelik eskisi her karede DOM'a yazıyordu.
     */

    // Merkeze yaklaşan daire için kart aç/kapa (oturumlu haritayla aynı eşikler).
    const evaluateCenteredCard = () => {
      const best = findCenteredTerritory(map, featuresRef.current, autoIdRef.current)
      if (!best) {
        if (autoIdRef.current) {
          autoIdRef.current = null
          setAutoTerritory(null)
        }
        return
      }
      // Elle kapatılan kart, aday değişene dek yeniden açılmaz.
      if (autoSuppressedRef.current === String(best.territory.id)) return
      autoSuppressedRef.current = null
      placeAutoCard(best.x, best.y)
      if (autoIdRef.current !== String(best.territory.id)) {
        autoIdRef.current = String(best.territory.id)
        setAutoTerritory(best.territory)
      }
    }
    evaluateRef.current = evaluateCenteredCard

    const onMove = () => {
      if (rafPendingRef.current) return
      rafPendingRef.current = true
      requestAnimationFrame(() => {
        rafPendingRef.current = false
        evaluateCenteredCard()
      })
    }

    map.on('move', onMove)
    map.on('moveend', evaluateCenteredCard)

    map.on('click', 'territories-fill', (e) => {
      const feature = e.features?.[0]
      if (feature) setSelected(feature.properties as unknown as TerritoryProperties)
    })
    map.on('mouseenter', 'territories-fill', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'territories-fill', () => {
      map.getCanvas().style.cursor = ''
    })
    const detachCamera = camera.attach(map)

    return () => {
      detachCamera()
      stopPulse()
      detachMarkerImages()
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
    // `mapKey`: anahtar değişince harita yeniden kurulur (accessToken yalnız
    // yaratılışta okunur).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey, tokenReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !regions) return
    ;(map.getSource('regions') as mapboxgl.GeoJSONSource | undefined)?.setData(regions as never)
  }, [regions, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !territories) return
    ;(map.getSource('territories') as mapboxgl.GeoJSONSource | undefined)?.setData(territories as never)
    /* Vitrin haritası da aynı kaynağı besler — ziyaretçi ile oturumlu
       kullanıcı AYNI haritayı görmeli (vault: harita davranışı beş yüzeydir). */
    /* 🔴 Tek giriş noktası: görsel defteri → ad levhaları → `setData`.
       Sıra üç yüzeyde de aynı olmalı (bkz. `setStoreMarkerData`). */
    setStoreMarkerData(map, territories)
    featuresRef.current = territories.features.map((f) => f.properties)

    /*
     * 🔴 10 Ağu 2026 — İLK AÇILIŞ MAĞAZA YOĞUNLUĞUNA ODAKLANIR.
     * Ziyaretçinin gördüğü ilk ekran buydu ve sabit bir Türkiye görünümüydü;
     * mağazalar başka yerdeyken harita bomboş açılıyordu.
     * ⚠️ Üç koşul birden aranır ve **bir kez** çalışır:
     *  · kullanıcının kendi bıraktığı bir kamera YOK (`hasSavedView`),
     *  · `?t=` derin bağlantısı YOK — o daha güçlü bir niyettir,
     *  · daha önce odaklanılmadı (veri her tazelendiğinde tekrarlamasın;
     *    kullanıcı o sırada başka yere kaydırmış olabilir).
     */
    if (
      !densityFocusedRef.current &&
      !camera.hasSavedView() &&
      !searchParams.get('t') &&
      jumpToDensest(map, featuresRef.current)
    ) {
      densityFocusedRef.current = true
    }

    evaluateRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territories, mapReady])

  /*
   * `?t=<daireId>` derin bağlantısı — paylaşım kartındaki QR buraya gelir.
   * ⚠️ Vitrin bilinçli tercih: `/t/:id` oturum ister, QR'ı okutan yabancı
   * giriş ekranına düşerdi. Burada ziyaretçi daireyi haritada görür.
   * Bir kez uçulur ve parametre adresten silinir.
   */
  const deepLinkHandledRef = useRef(false)
  useEffect(() => {
    const id = searchParams.get('t')
    const map = mapRef.current
    if (!id || deepLinkHandledRef.current || !map || !mapReady) return
    const target = findTerritoryById(featuresRef.current, id)
    if (!target) return // veri henüz gelmedi — bir sonraki turda
    deepLinkHandledRef.current = true
    flyToTerritory(map, target)
    setSelected(target)
    const next = new URLSearchParams(searchParams)
    next.delete('t')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, mapReady, territories])

  /*
   * Taban stil değişirse stil tamamen yeniden yüklenir (katmanlar
   * `style.load`'da yeniden basılır — vault kuralı).
   *
   * 🔴 15 Ağu 2026 — taban artık **temayla dönmüyor**, hep beyaz sokak
   * haritası. Yani pratikte bu etki ziyaretçi için hiç tetiklenmez; kanca
   * `styleUrl`e bağlı kalıyor ki ileride elle stil seçimi eklenirse çalışsın.
   * ⚠️ `darkBaseRef` **tabandan** türer, temadan değil: `style.load` sisi ve
   * bölge tonunu ondan okuyor ve beyaz haritaya koyu sis basılmamalı.
   */
  useEffect(() => {
    darkBaseRef.current = isDarkMapStyle(styleUrl)
    darkFogRef.current = themeMode === 'dark'
    const map = mapRef.current
    if (map && mapReady) {
      /* Tema değişince sahneyi yeniden yüklemeden yalnız sisi güncelle. */
      applyFog(map, darkFogRef.current)
    }
  }, [styleUrl, themeMode, mapReady])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    setMapReady(false)
    map.setStyle(styleUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl])

  return (
    <div className="relative h-full overflow-hidden">
      {/* mapbox-gl.css position:relative ile utility'yi ezdiği için inline style şart */}
      {/* `waydee-map-surface`: sağ-üst zoom kontrolleri yüzen başlığın altından
          başlasın (index.css) — üst üste binmesinler. */}
      <div ref={containerRef} className="waydee-map-surface" style={{ position: 'absolute', inset: 0 }} />

      {/* Alt karartma — Mapbox künyesi göze batmasın (oturumlu haritayla aynı bileşen). */}
      <MapScrim />

      {/* Üst bar — vitrin kimliği + giriş çağrısı */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 md:p-4">
        {/* Marka işareti — "Görüntüleme modu" etiketi kaldırıldı, yerini logo aldı. */}
        <div className="pointer-events-auto flex items-center rounded-full bg-surface/95 px-4 py-2 shadow-float backdrop-blur">
          <Logo imgClassName="h-6 md:h-7" />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="stroke" size="sm" className="rounded-full bg-surface/95 backdrop-blur">
              <LogIn className="h-4 w-4" /> Giriş
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm" className="rounded-full shadow-float">
              <Sparkles className="h-4 w-4" /> Hemen başla
            </Button>
          </Link>
        </div>
      </header>

      {/* Alt çağrı — bölge almak için hesap gerekir */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4"
      >
        <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full bg-ink/95 py-2 pl-4 pr-2 text-on-ink shadow-float backdrop-blur">
          <span className="truncate text-[13px] font-semibold">
            Haritada gezinebilirsin — bölge almak için hesap gerekir
          </span>
          <Link to="/register" className="shrink-0">
            {/* `bg-ink` şeridin üstünde: stroke + text-on-ink okunmuyordu (bkz. button.tsx notu). */}
            <Button size="sm" variant="inverse">
              Kayıt ol
            </Button>
          </Link>
        </div>
      </motion.div>

      {selected && <PublicTerritoryCard territory={selected} onClose={() => setSelected(null)} />}

      {/*
        Merkezlenen dairenin kartı.

        🔴🔴 24 Ağu 2026 — ÇAPA ARTIK YALNIZ <b>MASKELİ</b> KARTA UYGULANIR.

        `PublicTerritoryCard` iki farklı şey çiziyor:
        ① kimliği açık mağazada → `TerritoryCard`, yani `position: fixed`
           yan panel;
        ② gizli hesap / rezerve alanda → küçük, akışa yerleşen bir bilgi kartı.

        Çapa sarmalayıcısı `transform` taşır ve <b>transform'lu bir ata,
        `position: fixed` çocuğun kapsayıcı bloğu olur</b>. ①'i sarmak paneli
        viewport'tan koparıp sıfır boyutlu bu kutuya çöktürüyordu — oturumlu
        haritada bu, mağazanın solunda <b>gelip giden siyah bir çizgi</b>
        olarak görüldü. ②'nin ise çapaya gerçekten ihtiyacı var: o kart
        dairenin yanında durmalı.

        ⚠️ Maskelilik ölçütü `PublicTerritoryCard` ile <b>aynı</b> olmalı
        (`!ownerId`). İkisi ayrışırsa panel yine sarmalanır ve hata sessizce
        geri gelir.
      */}
      {autoTerritory && !selected && (
        autoTerritory.ownerId ? (
          <PublicTerritoryCard
            territory={autoTerritory}
            onClose={() => {
              autoSuppressedRef.current = String(autoTerritory.id)
              autoIdRef.current = null
              setAutoTerritory(null)
            }}
          />
        ) : (
          <div ref={autoCardRef} className="waydee-map-anchor">
            <PublicTerritoryCard
              territory={autoTerritory}
              anchored
              onClose={() => {
                autoSuppressedRef.current = String(autoTerritory.id)
                autoIdRef.current = null
                setAutoTerritory(null)
              }}
            />
          </div>
        )
      )}
    </div>
  )
}
