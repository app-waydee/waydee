import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleDotDashed, LocateFixed, Palette, Store, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { maxRadiusBefore, maxRadiusInsideZones, type NeighbourCircle } from '@/lib/geo'
import { fmtMoney } from '@/lib/format'
import { isDarkMapStyle, themeMapStyle } from '@/lib/mapStyles'
import { subscribeRegions, subscribeTerritories } from '@/lib/ws'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { useStoreAccess } from '@/features/plan/PlanBadge'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type {
  FeatureCollection,
  RegionProperties,
  TerritoryProperties,
  TerritoryResponse,
} from '@/types/api'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
/* 🔴 25 Ağu 2026 (98. tur) — TREND ŞERİDİ HARİTADAN KALDIRILDI, yerine
   ödemeli sıralama tahtası geldi (kullanıcı isteği). `TrendingBar` bileşeni
   DURUYOR: bir yüzeyden kaldırmak onu silmek değildir ve keşif tarafında
   yeniden kullanılabilir. */
import { BidBoard } from '@/features/promotion/BidBoard'
import {
  addSourcesAndLayers,
  applyFog,
  applyZoneTheme,
  clearPreview,
  findCenteredTerritory,
  findTerritoryById,
  flyToTerritory,
  jumpToDensest,
  pixelRadius,
  setPreview,
  attachStoreMarkerImages,
  setStoreMarkerData,
  startMarkerPulse,
  thinBaseLabels,
} from './mapCanvas'
import { createCameraMemory } from './mapCamera'
import { MapScrim } from './MapScrim'
import { MarketplaceMapCard } from './MarketplaceMapCard'
import { MarketplaceListSheet } from './MarketplaceListSheet'
import { attachMarketplaceBadges, type BadgeController } from './marketplaceBadges'
import {
  addMarketplaceLayers,
  attachMarketplaceInteractions,
  setMarketplaceData,
  setMarketplaceVisible,
} from './marketplaceLayer'
import {
  marketplaceAreas,
  marketplaceStalls,
  type MarketplaceAreaProperties,
  type StallProperties,
} from '@/lib/marketplace'
import { useMapboxRuntimeToken } from './useMapboxRuntimeToken'
import { useUserLocation } from './useUserLocation'
import { createUserLocationLayer, type UserLocationLayer } from './userLocationLayer'
import { StorePanel, type Selection } from './StorePanel'
import { CategoryFilterBar } from '@/features/category/CategoryFilterBar'
import { useStoreCategories } from '@/lib/storeCategories'
import { attachMapInspector } from './mapInspector'
import { StoreEditPanel } from './StoreEditPanel'
import type { TerritoryStyleDraft } from './TerritoryStylePicker'
import { TerritoryCard } from './TerritoryCard'

/*
 * Mapbox anahtarı artık derleme zamanında gömülmez — sunucudan gelir ve admin
 * panelden değiştirilebilir (bkz. `lib/clientConfig.ts`). Anahtar değişince
 * `mapKey` artar ve harita efekti baştan kurulur → yeni anahtarla devam eder.
 */

const MAX_RADIUS_M = 20000
/**
 * <b>Mağaza dairesinin sabit yarıçapı</b> (V38) — sunucudaki
 * `TerritoryService.STORE_RADIUS_M` ile aynı değer.
 *
 * ⚠️ İstemci bu değeri yalnız ÖNİZLEME çizmek için bilir; kararı sunucu verir.
 * İkisi ayrışırsa kullanıcı bir boyut görüp başka bir boyut alır — bu yüzden
 * değer tek satırda ve yorumla bağlanmış durumda.
 */
const STORE_RADIUS_M = 100

interface RegionHover {
  name: string
  level: string
  pricePerKm2: number
  currency: string
}

const LEVEL_LABELS: Record<string, string> = {
  ZONE: 'Özel bölge',
  COUNTRY: 'Ülke',
  PROVINCE: 'İl',
  DISTRICT: 'İlçe',
}

export function MapPage() {
  const t = useT()
  const themeMode = useThemeStore((s) => s.mode)
  const savedMapStyle = useThemeStore((s) => s.mapStyle)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  /**
   * Mapbox anahtarı değişince `mapKey` artar → harita efekti baştan kurulur.
   * ⚠️ `ready` false iken harita HİÇ yaratılmaz (boş anahtar = Mapbox fırlatır).
   */
  const { mapKey, ready: tokenReady } = useMapboxRuntimeToken()

  /** Kullanıcının kayıtlı harita stili (Ayarlar'dan seçilir); yoksa beyaz sokak haritası. */
  /*
   * 🔴 15 Ağu 2026 — TABAN ARTIK TEMAYI İZLEMİYOR: hep `navigation-day-v1`
   * (beyaz zeminli sokak haritası), kabuk koyu olsa bile. Gerekçe
   * `lib/mapStyles.ts`. Elle seçilen stil her zaman ezer.
   * ⚠️ Değişkenler MAP_STYLES anahtarı değil, doğrudan **stil adresi** taşır.
   */
  const desiredStyleUrl = themeMapStyle(savedMapStyle, themeMode)
  const [styleUrl, setStyleUrl] = useState<string>(desiredStyleUrl)

  /**
   * `style.load` geri çağrısının okuduğu iki ayrı ölçüt.
   *
   * 🔴 15 Ağu 2026 — İKİSİ AYRI, ÇÜNKÜ İKİ FARKLI ŞEY:
   *
   * · **Sis / uzay** (`applyFog`) → **TEMAYI** izler. Kullanıcı isteği:
   *   *"koyu modda sadece arka planı karanlık olacak (arkada yıldızlar
   *   vardı), ama sokak haritası beyaz kalacak."* Yani küre dışındaki uzay
   *   koyu ve yıldızlı, harita karolarının kendisi beyaz.
   * · **Bölge kaplaması** (`applyZoneTheme`) → **TABAN STİLİ** izler. O,
   *   karoların ÜSTÜNE çizilir; beyaz haritaya koyu dolgu basmak onu
   *   okunmaz yapardı.
   *
   * ⚠️ İkisini tek bayrağa bağlamak bu turda bir kez daha hata üretti:
   * önce ikisi de temaya, sonra ikisi de tabana bağlanmıştı. Doğru cevap
   * "ikisi de aynı şeyi izlesin" değil, **her biri kendi zeminini izlesin**.
   */
  const darkFogRef = useRef(false)
  const darkBaseRef = useRef(false)

  /** Yoğunluk odağı oturumda bir kez uygulanır — gerekçe veri etkisinde. */
  const densityFocusedRef = useRef(false)

  const [drawMode, setDrawMode] = useState(false)
  const drawModeRef = useRef(false)
  /** Mevcut alanlar; çizim sırasında yarıçapı sınırlamak için event handler'lardan okunur. */
  const neighboursRef = useRef<NeighbourCircle[]>([])
  /** Fiyat bölgesi sınırları; daire bu çizgileri kesemez. */
  const zoneRingsRef = useRef<number[][][]>([])
  /** Seçimin komşulardan ötürü büyüyebileceği tavan — kaydırıcı da bunu aşamaz. */
  const maxRadiusRef = useRef(MAX_RADIUS_M)
  const [blockedHint, setBlockedHint] = useState(false)

  const [selection, setSelection] = useState<Selection | null>(null)
  const selectionRef = useRef<Selection | null>(null)
  /** Yarıçap kaydırıcısı sustuktan sonra kamerayı yeniden sığdıran zamanlayıcı. */
  const refitTimerRef = useRef<number | undefined>(undefined)
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryProperties | null>(null)
  /*
   * Seçili kategori (V52). `null` → tümü.
   *
   * ⚠️ Tercih KALICI DEĞİL (localStorage yok) ve bu bilinçli: kullanıcı
   * haritayı bir dahaki açışında ekranda mağazaların çoğunu göremediğinde
   * sebebini hatırlamaz ve haritayı bozuk sanar. Pazar katmanı anahtarı
   * kalıcıdır çünkü o bir KATMAN açar/kapatır, veriyi süzmez.
   */
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const { data: storeCategories } = useStoreCategories()
  const [hoverRegion, setHoverRegion] = useState<RegionHover | null>(null)

  /** Viewport merkezine gelen dairenin kartı: otomatik açılır/kapanır. */
  const [autoTerritory, setAutoTerritory] = useState<TerritoryProperties | null>(null)
  const autoSuppressedRef = useRef<string | null>(null)
  const autoIdRef = useRef<string | null>(null)
  const territoryFeaturesRef = useRef<TerritoryProperties[]>([])
  const rafPendingRef = useRef(false)
  const evaluateRef = useRef<(() => void) | null>(null)

  /*
   * 🔴 ÇAPALI KART KODU SİLİNDİ (24 Ağu 2026) — `autoCardRef`,
   * `autoPosRef`, `positionAutoCard` ve konumu ilk kareye yazan
   * `useLayoutEffect`.
   *
   * Panel artık `position: fixed` ve konumunu `.waydee-store-sheet`ten alıyor
   * (masaüstünde sağda tam yükseklik, mobilde alt sayfa). Bir kenara yapışık
   * panelin dairenin merkezine taşınacak bir konumu yok.
   *
   * ⚠️ Kodu "zararsız" diye bırakmak ZARARLIYDI: sarmalayıcının `transform`'u
   * `position: fixed` panelin kapsayıcı bloğunu değiştirip paneli sıfır
   * boyutlu bir kutuya çöktürüyordu (haritadaki siyah çizgi) ve harita
   * hareket ettikçe onu yeniden yazıyordu (çizginin gelip gitmesi).
   * Ölü kod, yeni koda müdahale ediyordu.
   */

  /** Avatar/küme işaretçileri + efekt halkaları (ortak yönetici — mapCanvas.ts). */

  /*
   * Kendi konumum.
   *
   * ⚠️ İzin AÇILIŞTA istenmez — kullanıcı düğmeye bastığında sorulur
   * (bkz. useUserLocation). Konum ekran dışına çıkarsa kenarda bir yön
   * göstergesi belirir; tıklayınca kamera konuma döner.
   */
  const me = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  /* Mağaza hakkı SUNUCUDAN gelir, plan adı karşılaştırmasıyla değil — ileride
     bir kampanya planı da bu hakkı verebilir.
     🔴 18 Ağu 2026 — kapı `canOwnStore`'dan `useStoreAccess()`e taşındı:
     ücretsiz hesabın harcanmamış 1 aylık denemesi de mağaza açtırır. Eski
     bayrağı okumaya devam etseydi ücretsiz kullanıcı haritada "Mağaza aç"
     düğmesine basıp doğrudan plan sayfasına atılırdı — hakkı olduğu hâlde. */
  const storeAccess = useStoreAccess()
  const canOwnStore = storeAccess.canOpen
  /*
   * 🔴🔴 24 Ağu 2026 — `enabled: canOwnStore` KALDIRILDI. ÜRETİMİ BOZAN HATA.
   *
   * <b>Belirti:</b> mağazası olan kullanıcı `/map`'i yenileyince altta
   * *"Mağaza aç"* görüyordu; ayarlardan gelince *"Mağazamı düzenle"* doğru
   * çıkıyordu.
   *
   * <b>Sebep:</b> `useStoreAccess().canOpen`, mağazasını <b>ücretsiz
   * denemeyle</b> açmış kullanıcı için `false` döner — hak harcanmıştır
   * (21 Ağu'da bilinçle böyle yazıldı). Sorgu ona bağlı olduğu için
   * <b>hiç çalışmıyordu</b> → `myStore = null` → `hasStore = false` →
   * *"Mağaza aç"* düğmesinin koşulu (`!canOwnStore && !hasStore`) sağlanıyordu.
   *
   * <b>Neden ayarlardan gelince doğruydu:</b> başka bir ekran
   * `['my-territories']` önbelleğini <b>zaten doldurmuştu</b>; devre dışı bir
   * sorgu da önbellekteki veriyi okur. Sert yenilemede önbellek boştur ve
   * hata ortaya çıkar. Bu yüzden "bazen çalışıyor" gibi görünüyordu.
   *
   * <b>Ders:</b> bir sorguyu <b>"bunu yapabilir mi"</b> kapısına bağlama.
   * Burada sorulan şey *"mağaza açabilir mi"* değil, *"mağazası VAR mı"* —
   * ikisi zıt yönlerdir: hakkını harcamış olan tam da mağazası olandır.
   */
  const myStoreQuery = useQuery({
    queryKey: ['my-territories'],
    queryFn: async () => (await api.get<TerritoryResponse[]>('/territories/my')).data,
    staleTime: 60_000,
  })
  /* Yalnız "var mı" değil MAĞAZANIN KENDİSİ: düzenleme paneli kimliğini,
     adını ve kayıtlı görünümünü buradan okuyor. */
  const myStore = (myStoreQuery.data ?? []).find((x) => x.status === 'ACTIVE') ?? null
  const hasStore = myStore !== null
  /*
   * ⚠️ Sorgu çözülene kadar <b>iki düğmeden hiçbiri</b> çizilmez. Yoksa
   * mağazası olan kullanıcı sayfayı yenilediğinde bir kare *"Mağaza aç"*
   * görüp sonra düğmenin *"Mağazamı düzenle"*ye dönüşmesini izlerdi — yukarıda
   * düzeltilen hatanın görsel kalıntısı. Bilmediğimiz bir şeyi
   * <b>söylemeyiz</b>; boş bırakırız.
   */
  const storeKnown = myStoreQuery.isSuccess
  const [editingStore, setEditingStore] = useState(false)
  /** Kaydedilmemiş görünüm taslağı — haritaya YEREL olarak uygulanır. */
  const [storeDraft, setStoreDraft] = useState<TerritoryStyleDraft | null>(null)
  const [inviteDismissed, setInviteDismissed] = useState(
    () => sessionStorage.getItem('waydee-store-invite') === 'off',
  )
  const dismissInvite = () => {
    sessionStorage.setItem('waydee-store-invite', 'off')
    setInviteDismissed(true)
  }
  const showStoreInvite =
    canOwnStore && storeKnown && !hasStore && !inviteDismissed && !drawMode && !selection && !selectedTerritory
  const location = useUserLocation()
  const locationLayerRef = useRef<UserLocationLayer | null>(null)
  /** Harita kurulumundaki yerleştirme mantığı (bkz. `placeStore`). */
  const placeStoreRef = useRef<((center: [number, number]) => boolean) | null>(null)
  /** Konum gelir gelmez mağazayı oraya kur — düğmeye basıldığında işaretlenir. */
  const placeAtMyLocationRef = useRef(false)

  /** Pazar yeri katmanı: seçim durumu + görünürlük tercihi. */
  const [selectedArea, setSelectedArea] = useState<MarketplaceAreaProperties | null>(null)
  const [selectedStall, setSelectedStall] = useState<StallProperties | null>(null)
  /**
   * 🧾 Aktif pazar listesi paneli (105. tur).
   *
   * 🔴 "Pazar yerleri" düğmesi artık katmanı AÇIP KAPATMIYOR, listeyi açıyor
   * (kullanıcı: *"pazar yerlerine tıklayınca soft şekilde aktif pazar yerleri
   * açılsın"*). Katman görünürlüğü panelin içindeki anahtara taşındı —
   * kaybolmadı, çünkü haritayı sadeleştirmek için onu kapatan kullanıcılar var
   * ve tercih `localStorage`da saklı.
   */
  const [mpListOpen, setMpListOpen] = useState(false)
  const badgesRef = useRef<BadgeController | null>(null)

  const [showMarketplaces, setShowMarketplaces] = useState(
    () => localStorage.getItem('waydee-show-marketplaces') !== 'false',
  )

  const queryClient = useQueryClient()

  const { data: regions } = useQuery({
    queryKey: ['map', 'regions'],
    queryFn: async () => (await api.get<FeatureCollection<RegionProperties>>('/map/regions')).data,
    staleTime: 5 * 60_000,
  })

  const { data: territories } = useQuery({
    queryKey: ['map', 'territories'],
    queryFn: async () => (await api.get<FeatureCollection<TerritoryProperties>>('/map/territories')).data,
    staleTime: 60_000,
  })

  /*
   * Kullanıcının işaretçisinin GERÇEK rengi.
   *
   * ⚠️ `myStore.style.strokeColor` yetmez: hiç renk seçmemişse orası `null`dır
   * ve gerçek renk sunucuda sahibin kimliğinden türetilen otomatik palet
   * rengidir. O renk yalnız harita verisinde durur — panel maviyi gösterip
   * harita moru çizmesin diye buradan okunuyor.
   */
  const myStoreColor =
    territories?.features.find((f) => String(f.properties.id) === myStore?.id)?.properties.color
    ?? '#2a85ff'

  // Pazar yeri katmanı: alanlar (poligon) + onaylı stantlar (kümelenen noktalar).
  const { data: mpAreas } = useQuery({
    queryKey: ['marketplace', 'map', 'areas'],
    queryFn: marketplaceAreas,
    staleTime: 60_000,
  })
  const { data: mpStalls } = useQuery({
    queryKey: ['marketplace', 'map', 'stalls'],
    queryFn: marketplaceStalls,
    staleTime: 60_000,
  })

  // ---------------------------------------------------------------- harita kurulumu

  useEffect(() => {
    if (!tokenReady || !containerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      // Doğru başlangıç stili: koyu tema/kayıtlı tercihte açık harita "flash"i olmaz.
      style: styleUrl,
      // Sekme/navbar ile ayrılıp dönünce harita aynı noktada açılsın.
      ...camera.initialView(DEFAULT_VIEW),
      projection: 'globe',
      /*
       * 🔴 21 Ağu 2026 — EĞİM KİLİTLİ (kullanıcı talimatı: *"eğik açıdan bakma
       * ve 3D'yi kaldırıyoruz, üstten görüntüye"*).
       *
       * `pitch: 0` tek başına YETMEZ: kullanıcı iki parmakla ya da sağ tuşla
       * haritayı yine eğebilirdi ve işaretçiler — ekran düzlemine çizilen
       * daireler — eğik zeminde yüzüyormuş gibi görünürdü. `maxPitch: 0`
       * kararı kalıcı kılar.
       * ⚠️ Döndürme (bearing) KAPATILMADI: o kuzeyi değiştirir, bakış açısını
       * değil, ve işaretçilerin görünüşünü bozmuyor.
       */
      maxPitch: 0,
    })
    mapRef.current = map
    /* ⚠️ `visualizePitch` kalktı: eğim kilitliyken pusuladaki eğim göstergesi
       hiçbir zaman değişmeyen ölü bir denetim olurdu. */
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
    /* İşaretçi görselleri TEMBEL üretilir; dinleyici haritanın ömrü boyunca
       bir kez bağlanır (`setStyle` harita olaylarını silmez). */
    const detachMarkerImages = attachStoreMarkerImages(map)
    /* Parıltının nabzı — kare başına iki düz sayı, ifade yok. */
    const stopPulse = startMarkerPulse(map)
    /* 🔍 Katman denetçisi — YALNIZ geliştirmede. ALT + fare ile bir pikselin
       hangi katmandan geldiğini söyler. Gerekçe: `mapInspector.ts`. */
    const detachInspector = import.meta.env.DEV ? attachMapInspector(map) : null

    /*
     * 🔴 18 Ağu 2026 — HARİTAYA ALT ÇUBUK PAYI (`setPadding`).
     *
     * Mobilde harita tuvali alt gezinme çubuğunun ALTINA kadar uzanıyor
     * (bilinçli: kesintisiz görünüm). Ama Mapbox'ın "merkez" kavramı tuvalin
     * geometrik ortasıdır — yani `easeTo`, `jumpTo`, `fitBounds` ve merkezlenen
     * kart mantığının hepsi, kullanıcının GÖREMEDİĞİ bir noktayı merkez sayıyordu.
     * Kullanıcının şikâyeti buydu: mağaza adları ve kontroller çubuğun altında
     * kalıyordu.
     *
     * `setPadding` kameranın merkezini görünür bandın ortasına kaydırır; tuval
     * yine tam ekrandır, yalnız ODAK doğru yere gelir.
     *
     * ⚠️ Değerler CSS'teki TEK KAYNAKTAN okunur (`--waydee-tabbar-h` +
     * safe-area). İkinci bir sayı yazmak, 17. turdaki hatanın aynısı olurdu:
     * çubuğun yüksekliği bir yerde, ondan kaçınma payı BAŞKA yerde.
     * ⚠️ Masaüstünde alt çubuk yok (`md:hidden`) → pay da yok.
     */
    const applyMapPadding = () => {
      const mobile = window.matchMedia('(max-width: 767px)').matches
      if (!mobile) {
        /*
         * 🔴 25 Ağu 2026 (3. tur) — MASAÜSTÜ PAYI ARTIK VAR.
         *
         * Tuval kolonun ve üst çubuğun altına taşıyor (`waydee-map-bleed`),
         * yani tuvalin geometrik merkezi ile kullanıcının GÖRDÜĞÜ merkez
         * artık aynı değil. Pay verilmezse `flyTo`/`fitBounds` seçilen
         * mağazayı kolonun ya da başlığın altına oturturdu.
         *
         * ⚠️ Değerler CSS'teki tek kaynaktan okunur — ikinci bir sayı yazmak
         * 17. turdaki hatanın aynısı olurdu.
         */
        const rootStyle = getComputedStyle(document.documentElement)
        const px = parseFloat(rootStyle.fontSize) || 16
        const railRem = parseFloat(rootStyle.getPropertyValue('--waydee-rail-w')) || 5
        const barRem = parseFloat(rootStyle.getPropertyValue('--waydee-topbar-h')) || 4
        map.setPadding({
          top: Math.round(barRem * px),
          right: 0,
          bottom: 0,
          left: Math.round(railRem * px),
        })
        return
      }
      const css = getComputedStyle(document.documentElement)
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const barRem = parseFloat(css.getPropertyValue('--waydee-tabbar-h')) || 5
      const gapRem = parseFloat(css.getPropertyValue('--waydee-above-nav-gap')) || 0.75
      map.setPadding({ top: 0, right: 0, bottom: Math.round((barRem + gapRem) * rem), left: 0 })
    }
    applyMapPadding()
    window.addEventListener('resize', applyMapPadding)
    map.once('remove', () => window.removeEventListener('resize', applyMapPadding))

    if (import.meta.env.DEV) {
      ;(window as unknown as { __waydeeMap?: mapboxgl.Map }).__waydeeMap = map
    }

    map.on('style.load', () => {
      applyFog(map, darkFogRef.current)
      /* 🔴 Taban stilin yol/POI yazıları söndürülür, yer adları kalır
         (kullanıcı: *"çok fazla text görünüyor boğuluyor, il ilçe isimleri
         görünsün"*). `addSourcesAndLayers`tan ÖNCE: bizim katmanlarımız
         henüz eklenmemişken taranan liste yalnız Mapbox'ın katmanlarıdır. */
      thinBaseLabels(map)
      addSourcesAndLayers(map)
      // Pazar katmanları da HER style.load'da yeniden basılır (setStyle hepsini siler).
      addMarketplaceLayers(map)
      applyZoneTheme(map, darkBaseRef.current)
      setMapReady(true)
    })

    // -------- çizim etkileşimi
    map.getCanvasContainer().addEventListener('contextmenu', (e) => e.preventDefault())

    /** Merkezin izin verdiği en büyük yarıçap (komşu daireler + fiyat bölgesi kenarları). */
    const headroomAt = (center: [number, number]) =>
      Math.min(
        maxRadiusBefore(center, neighboursRef.current),
        maxRadiusInsideZones(center, zoneRingsRef.current),
      )

    /* 🔴 TEK DOKUNUŞ, SABİT YARIÇAP (V38).
       Daire artık km² ile fiyatlanmıyor; Premium üyeliğin 100 m'lik mağazası.
       Bu yüzden "bas-sürükle ile boyutlandır" etkileşimi TAMAMEN kaldırıldı:
       boyutu değiştirmeyen bir sürükleme, kullanıcıya var olmayan bir denetim
       vaat ederdi. Yer seçimi tek tıklamadır.
       ⚠️ Komşuluk kontrolü (`headroom`) DURUYOR: 100 m'lik daire bile başka bir
       mağazanın ya da fiyat bölgesi kenarının üstüne düşebilir; sunucu da aynı
       kontrolü yapar, buradaki yalnız erken uyarıdır. */
    /*
     * 🔴 Yerleştirme mantığı bir REF'e açılır (`placeStoreRef`).
     * Sebep: `headroomAt` ve `focusSelection` bu efektin kapanışında yaşıyor;
     * "şu anki konumuma kur" düğmesi ise render ağacında. Mantığı ikinci kez
     * yazmak yerine tek kaynak paylaşılır — aksi halde komşuluk kontrolü iki
     * yerde ayrışır ve biri sessizce geride kalırdı (bu projede üç kez oldu).
     */
    const placeStore = (center: [number, number]): boolean => {
      if (headroomAt(center) < STORE_RADIUS_M) {
        setBlockedHint(true)
        window.setTimeout(() => setBlockedHint(false), 2200)
        return false
      }
      const next = { lng: center[0], lat: center[1], radiusM: STORE_RADIUS_M }
      selectionRef.current = next
      setSelection(next)
      setDrawModeBoth(false)
      setPreview(map, next.lng, next.lat, next.radiusM)
      // Panel açılırken daire panelin kapatmadığı boşluğa taşınır ve
      // görünecek kadar yakınlaştırılır (100 m'lik daire z5'te birkaç piksel —
      // kullanıcı nereye kurduğunu göremiyordu).
      focusSelection(map, next)
      return true
    }
    placeStoreRef.current = placeStore

    map.on('click', (e) => {
      if (!drawModeRef.current) return
      placeStore([e.lngLat.lng, e.lngLat.lat])
    })

    map.on('mousemove', (e) => {
      if (drawModeRef.current) return
      const features = map.queryRenderedFeatures(e.point, {
        layers: [
          'regions-zone-fill',
          'regions-district-fill',
          'regions-province-fill',
          'regions-country-fill',
        ].filter((l) => map.getLayer(l)),
      })
      if (features.length > 0) {
        setHoverRegion(features[0].properties as unknown as RegionHover)
      } else {
        setHoverRegion(null)
      }
    })

    /*
     * -------- MAĞAZA / KÜME TIKLAMASI
     *
     * 🔴 `model` katmanı `queryRenderedFeatures` ile SORGULANAMAZ, yani binaya
     * tıklamayı yakalayan şey binanın kendisi değil, altındaki saydam
     * `territory-store-hit` dairesidir.
     *
     * İki durum tek yerde: küme ise <b>açılım zoom'una</b> gidilir (mağazalar
     * orada ayrışır — kullanıcının istediği davranış), tekil ise kartı açılır.
     */
    map.on('click', 'territory-store-hit', (e) => {
      if (drawModeRef.current || selectionRef.current) return
      const feature = e.features?.[0]
      if (!feature) return
      const props = feature.properties as Record<string, unknown>
      const coords = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates

      if (props.cluster) {
        const source = map.getSource('territory-stores') as mapboxgl.GeoJSONSource | undefined
        source?.getClusterExpansionZoom(Number(props.cluster_id), (err, zoom) => {
          if (err) return
          /* ⚠️ `+0.25`: tam açılım zoom'unda küme genellikle HÂLÂ küme kalır
             (eşik değerinde). Küçük bir fazlalık, tıklayan kişinin gerçekten
             ayrışmayı görmesini garanti eder. */
          map.easeTo({ center: coords, zoom: (zoom ?? map.getZoom()) + 0.25, duration: 650 })
        })
        return
      }
      setSelectedTerritory(props as unknown as TerritoryProperties)
    })
    map.on('mouseenter', 'territory-store-hit', () => {
      if (!drawModeRef.current) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'territory-store-hit', () => {
      if (!drawModeRef.current) map.getCanvas().style.cursor = ''
    })

    // -------- sahipli alan tıklaması
    map.on('click', 'territories-fill', (e) => {
      if (drawModeRef.current || selectionRef.current) return
      const feature = e.features?.[0]
      if (feature) {
        setSelectedTerritory(feature.properties as unknown as TerritoryProperties)
      }
    })
    map.on('mouseenter', 'territories-fill', () => {
      if (!drawModeRef.current) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'territories-fill', () => {
      if (!drawModeRef.current) map.getCanvas().style.cursor = ''
    })

    /*
     * 🔴 18 Ağu 2026 (4. tur) — HTML KÜME BALONLARI KALDIRILDI.
     * Kümeleme artık `territory-stores` kaynağının kendisinde ve kümeyi
     * ekranda 3B binanın kendisi temsil ediyor (üstünde "N mağaza" yazısıyla).
     * İki ayrı kümeleme sistemi tutmak aynı yeri iki kez işaretlemek olurdu —
     * üstelik eskisi her karede DOM'a yazıyordu, yani bedeli de vardı.
     */
    locationLayerRef.current = createUserLocationLayer(map)

    // -------- merkezlenen dairenin profil kartı
    const evaluateCenteredCard = () => {
      if (drawModeRef.current || selectionRef.current) {
        if (autoIdRef.current) {
          autoIdRef.current = null
          setAutoTerritory(null)
        }
        return
      }
      // Eşik + histerezis mantığı mapCanvas'ta; vitrin haritası da aynısını kullanır.
      const best = findCenteredTerritory(map, territoryFeaturesRef.current, autoIdRef.current)
      if (!best) {
        if (autoIdRef.current) {
          autoIdRef.current = null
          setAutoTerritory(null)
        }
        return
      }
      if (autoSuppressedRef.current === String(best.territory.id)) return
      autoSuppressedRef.current = null
      /*
       * ⚠️ Konum yazımı KALDIRILDI (24 Ağu 2026): panel sabit bir kenarda
       * duruyor, dairenin merkezine taşınmıyor. `best.x/best.y` yalnız hangi
       * dairenin merkezde olduğunu seçmek için hesaplanıyor.
       *
       * ⚠️ Kimlik kontrolü DURUYOR ve şart: `setAutoTerritory` yalnız daire
       * DEĞİŞTİĞİNDE çağrılmalı. Her karede çağrılsaydı harita gezdirilirken
       * saniyede ~60 render olurdu — kasmanın eski kaynağı buydu.
       */
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
    const detachCamera = camera.attach(map)

    return () => {
      detachCamera()
      stopPulse()
      detachInspector?.()
      detachMarkerImages()
      locationLayerRef.current?.destroy()
      locationLayerRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
    // `mapKey`: Mapbox anahtarı değişince harita YENİDEN kurulur (accessToken
    // yalnız yaratılışta okunur; var olan örneğe uygulanamaz).
    // `tokenReady`: anahtar sunucudan geç gelirse harita o zaman kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey, tokenReady])

  const setDrawModeBoth = useCallback((value: boolean) => {
    drawModeRef.current = value
    setDrawMode(value)
    const map = mapRef.current
    if (map) {
      map.getCanvas().style.cursor = value ? 'crosshair' : ''
      if (!value) {
        map.dragPan.enable()
      }
    }
    containerRef.current?.classList.toggle('waydee-drawing', value)
  }, [])

  // ---------------------------------------------------------------- veri → kaynaklar

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !regions) return
    const source = map.getSource('regions') as mapboxgl.GeoJSONSource | undefined
    source?.setData(regions as never)
  }, [regions, mapReady, styleUrl])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !territories) return
    /*
     * 🔴 KAYDEDİLMEMİŞ TASLAK BURADA UYGULANIR.
     * Düzenleme paneli açıkken seçilen renk/tasarım, sunucudan gelen
     * koleksiyonun bir KOPYASINA yazılır ve harita onu çizer — önizleme bir
     * kutucuk değil, işaretçinin kendisi.
     *
     * ⚠️ Sunucudan gelen `territories` DEĞİŞTİRİLMEZ: o React Query'nin
     * önbelleği; yerinde değiştirilseydi "vazgeç" hiçbir şeyi geri almazdı.
     * ⚠️ Taslak yoksa koleksiyon olduğu gibi geçer — normal akışta fazladan
     * hiçbir iş yapılmaz.
     */
    const data =
      storeDraft && myStore
        ? {
            ...territories,
            features: territories.features.map((f) =>
              String(f.properties.id) === myStore.id
                ? {
                    ...f,
                    properties: {
                      ...f.properties,
                      color: storeDraft.strokeColor,
                      fillColor: storeDraft.fillColor,
                    },
                  }
                : f,
            ),
          }
        : territories
    /*
     * 🔴 KATEGORİ SÜZGECİ **VERİ SEVİYESİNDE** (V52, 24 Ağu 2026).
     *
     * <b>Katman `filter`'ı kullanılamaz</b> ve bunun sebebi kümelemedir:
     * kümeler kaynağın İÇİNDE üretilir, katman süzgeci ise kümeler
     * oluştuktan SONRA çalışır. Süzgeç katmana yazılsaydı "23" yazan bir
     * kümenin içindeki mağazaların çoğu elenmiş olurdu ve harita seçili
     * kategoride olmayan mağazaları SAYMAYA devam ederdi — sayı yalan
     * söylerdi. Kaynağa süzülmüş veri vermek kümeleri yeniden hesaplatır.
     *
     * ⚠️ Kategorisi OLMAYAN mağaza, bir kategori seçiliyken elenir. Doğru
     * okunuş bu: kullanıcı "Moda" dedi, kategorisiz mağaza moda değildir.
     * "Tümü" (null) hepsini gösterir.
     *
     * ⚠️ `territories` yine DEĞİŞTİRİLMEZ — React Query önbelleği.
     */
    const visible =
      categoryFilter === null
        ? data
        : {
            ...data,
            features: data.features.filter((f) => f.properties.categoryId === categoryFilter),
          }
    const source = map.getSource('territories') as mapboxgl.GeoJSONSource | undefined
    source?.setData(visible as never)
    /* Tek nokta kaynağı: parıltı, fotoğraf, ad ve tıklama hedefi hepsi bunu
       okur. Kümeleme kaynağın KENDİSİNDE (bkz. `addSourcesAndLayers`).
       🔴 Tek giriş noktası: görsel defterini tazeler, ad levhalarını üretir,
       sonra kaynağa yazar. Sıra önemli — bkz. `setStoreMarkerData`. */
    setStoreMarkerData(map, visible)
  }, [territories, mapReady, styleUrl, myStore, storeDraft, categoryFilter])

  /*
   * Pazar katmanı verisi. `styleUrl` bağımlılıkta ŞART: tema değişince
   * `setStyle` kaynakları siler, katmanlar `style.load`'da boş yaratılır ve
   * veri yeniden basılmazsa pazar haritadan kaybolur.
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    setMarketplaceData(map, mpAreas, mpStalls)
  }, [mpAreas, mpStalls, mapReady, styleUrl])

  /** Pazar katmanını aç/kapa (kullanıcı tercihi kalıcı). */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    setMarketplaceVisible(map, showMarketplaces)
  }, [showMarketplaces, mapReady, styleUrl])

  /**
   * 🏷️ Alanın ortasındaki rozetler (ad + görsel + sayaç).
   *
   * ⚠️ `styleUrl` bağımlılıkta: tema değişince harita yeniden kuruluyor ve
   * işaretçiler onunla birlikte gidiyor — yeniden bağlanmazsa rozetler bir
   * daha görünmezdi (pazar KATMANIYLA aynı tuzak, bir üstteki efektte de var).
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const ctrl = attachMarketplaceBadges(map, t('map.mpList.activeShowcases'), (area) => {
      setSelectedArea(area)
      setSelectedStall(null)
    })
    badgesRef.current = ctrl
    return () => {
      ctrl.destroy()
      badgesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, styleUrl])

  /* Veri ve görünürlük rozetlere de akıtılır — kaynakları katmanla aynı. */
  useEffect(() => {
    badgesRef.current?.setData(mpAreas)
  }, [mpAreas, mapReady, styleUrl])

  useEffect(() => {
    badgesRef.current?.setVisible(showMarketplaces)
  }, [showMarketplaces, mapReady, styleUrl])

  /** Alan/stant tıklamaları — katmanlar hazır olduktan sonra bağlanır. */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    return attachMarketplaceInteractions(
      map,
      (stall) => {
        setSelectedStall(stall)
        setSelectedArea(null)
      },
      (area) => {
        setSelectedArea(area)
        setSelectedStall(null)
      },
    )
  }, [mapReady, styleUrl])

  useEffect(() => {
    neighboursRef.current = (territories?.features ?? []).map((feature) => ({
      center: [Number(feature.properties.centerLng), Number(feature.properties.centerLat)] as [number, number],
      radiusM: Number(feature.properties.radiusM),
    }))
    territoryFeaturesRef.current = (territories?.features ?? []).map((f) => f.properties)

    /*
     * 🔴 10 Ağu 2026 — İLK AÇILIŞ MAĞAZA YOĞUNLUĞUNA ODAKLANIR.
     * Kullanıcı: "map'e geçtiğinde mağazaların yoğunluğunun olduğu kısıma
     * yönelsin". Vitrin haritasındaki davranışın aynısı — ikisinin ayrışmaması
     * için hesap tek yerde (`mapCanvas.densestCluster`).
     * ⚠️ Üç koşul: kayıtlı kamera YOK · `?t=` derin bağlantısı YOK · daha önce
     * odaklanılmadı. Kullanıcının baktığı yeri her veri tazelemesinde elinden
     * almamak için `densityFocusedRef` şart.
     * ⚠️ Konum izni açıksa aşağıdaki "konumuma uç" etkisi bunu ezer — doğrusu
     * da budur: kullanıcının kendi konumu kalabalıktan güçlü bir niyettir.
     */
    const map = mapRef.current
    if (
      map &&
      mapReady &&
      !densityFocusedRef.current &&
      !camera.hasSavedView() &&
      !new URLSearchParams(window.location.search).get('t') &&
      jumpToDensest(map, territoryFeaturesRef.current)
    ) {
      densityFocusedRef.current = true
    }

    evaluateRef.current?.()
  }, [territories, mapReady])

  /*
   * `?t=<daireId>` derin bağlantısı — paylaşım kartındaki QR buraya gelir.
   * Bölge verisi yüklenmeden çalışmaz; bir kez uçar (`handledRef`) ve
   * parametreyi adresten siler, yoksa her veri tazelenişinde kamerayı
   * kullanıcının elinden alırdı.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkHandledRef = useRef(false)
  useEffect(() => {
    const id = searchParams.get('t')
    const map = mapRef.current
    if (!id || deepLinkHandledRef.current || !map || !mapReady) return
    const target = findTerritoryById(territoryFeaturesRef.current, id)
    if (!target) return // veri henüz gelmedi — bir sonraki turda
    deepLinkHandledRef.current = true
    flyToTerritory(map, target)
    setSelectedTerritory(target)
    const next = new URLSearchParams(searchParams)
    next.delete('t')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, mapReady, territories])

  /** Konum değiştikçe işaretçiyi taşı; kapatılınca katmanı temizle. */
  useEffect(() => {
    if (!mapReady) return
    locationLayerRef.current?.update(
      location.position,
      me?.avatarUrl ?? null,
      me?.displayName ?? '?',
    )
  }, [location.position, me?.avatarUrl, me?.displayName, mapReady, styleUrl])

  /** Konum ilk kez gelince oraya uç — kullanıcı kendini aramasın. */
  const locationCenteredRef = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !location.position || locationCenteredRef.current) return
    locationCenteredRef.current = true
    map.easeTo({
      center: [location.position.lng, location.position.lat],
      zoom: Math.max(map.getZoom(), 13),
      duration: 900,
      essential: true,
    })
  }, [location.position])

  /*
   * "Şu anki konumuma kur" — konum İZNİ düğmeye basınca istenir ve okuma
   * geldiği anda mağaza oraya yerleştirilir.
   *
   * ⚠️ İki aşamalı olmak zorunda: `watchPosition` anında değer vermez
   * (izin diyaloğu + GPS ilk okuma). Düğme yalnız bir bayrak bırakır, işi
   * konum gelince bu efekt yapar. Tek seferliktir — bayrak hemen düşürülür,
   * yoksa kullanıcı her hareket ettiğinde daire yeniden konumlanırdı.
   */
  useEffect(() => {
    if (!placeAtMyLocationRef.current || !location.position) return
    placeAtMyLocationRef.current = false
    const ok = placeStoreRef.current?.([location.position.lng, location.position.lat])
    if (!ok) {
      // Komşuluk engeli: `blockedHint` zaten çıktı; kullanıcı elle bir yer seçsin.
      setDrawModeBoth(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.position])

  /** Davet ya da çizim modundaki "konumuma kur" düğmesinin eylemi. */
  const placeAtMyLocation = () => {
    if (location.status === 'denied' || location.status === 'unavailable') {
      toast.error(t('map.locationUnavailable'))
      return
    }
    placeAtMyLocationRef.current = true
    if (location.position) {
      // Konum zaten elde: beklemeye gerek yok.
      placeAtMyLocationRef.current = false
      const ok = placeStoreRef.current?.([location.position.lng, location.position.lat])
      if (!ok) setDrawModeBoth(true)
      return
    }
    if (!location.enabled) location.toggle()
  }

  useEffect(() => {
    zoneRingsRef.current = (regions?.features ?? [])
      .filter((feature) => feature.properties.level === 'ZONE')
      .map((feature) => feature.geometry.coordinates[0])
  }, [regions])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (selection) {
      setPreview(map, selection.lng, selection.lat, selection.radiusM)
    } else {
      clearPreview(map)
    }
  }, [selection, mapReady, styleUrl])

  // ---------------------------------------------------------------- websocket

  useEffect(() => {
    const unsubscribe = subscribeTerritories((message) => {
      queryClient.setQueryData<FeatureCollection<TerritoryProperties>>(['map', 'territories'], (old) => {
        if (!old) return old
        // Admin bölgeyi gizlediyse/pasife aldıysa haritadan düşer.
        if (message.type === 'TERRITORY_REMOVED' || !message.feature) {
          return { ...old, features: old.features.filter((f) => f.id !== message.territoryId) }
        }
        const feature = message.feature
        const exists = old.features.some((f) => f.id === feature.id)
        // Görünüm güncellemesi ise feature yerinde değiştirilir, satın alma ise eklenir.
        if (exists) {
          return { ...old, features: old.features.map((f) => (f.id === feature.id ? feature : f)) }
        }
        return { ...old, features: [...old.features, feature] }
      })
      if (message.type === 'TERRITORY_PURCHASED' && message.feature) {
        toast.info(`@${message.buyerUsername} yeni bir bölge aldı: ${message.feature.properties.name}`)
      }
    })
    return unsubscribe
  }, [queryClient])

  useEffect(() => {
    const unsubscribe = subscribeRegions(() => {
      void queryClient.invalidateQueries({ queryKey: ['map', 'regions'] })
    })
    return unsubscribe
  }, [queryClient])

  // ---------------------------------------------------------------- stil / tema

  /*
   * Kaplama tonu **taban stili** izler, uygulama temasını değil (gerekçe
   * `darkBaseRef`). Beyaz haritada açık kaplama, kullanıcı Ayarlar'dan koyu ya
   * da uydu seçerse koyu kaplama.
   */
  useEffect(() => {
    const darkBase = isDarkMapStyle(styleUrl)
    const darkFog = themeMode === 'dark'
    darkBaseRef.current = darkBase
    darkFogRef.current = darkFog
    const map = mapRef.current
    if (map && map.getLayer('regions-zone-fill')) {
      /* Kaplama TABANI izler (beyaz haritaya koyu dolgu basılmasın). */
      applyZoneTheme(map, darkBase)
      /* Sis/uzay TEMAYI izler: koyu modda arka plan karanlık + yıldızlı. */
      applyFog(map, darkFog)
    }
  }, [styleUrl, themeMode])

  /**
   * Stil uygulaması YALNIZ harita hazır olduğunda yapılır.
   * (Yükleme ortasında setStyle çağırmak haritayı boş bırakabiliyordu — "bazen yüklenmiyor" hatası.)
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || desiredStyleUrl === styleUrl) return
    setStyleUrl(desiredStyleUrl)
    setMapReady(false)
    map.setStyle(desiredStyleUrl)
  }, [desiredStyleUrl, mapReady, styleUrl])

  // ---------------------------------------------------------------- eylemler

  const startDraw = () => {
    setSelection(null)
    selectionRef.current = null
    setSelectedTerritory(null)
    setAutoTerritory(null)
    maxRadiusRef.current = MAX_RADIUS_M
    setDrawModeBoth(true)
  }

  const cancelDraw = () => {
    setDrawModeBoth(false)
    const map = mapRef.current
    if (map) clearPreview(map)
  }

  const closeSelection = () => {
    window.clearTimeout(refitTimerRef.current)
    setSelection(null)
    selectionRef.current = null
  }

  /**
   * <b>Mağaza kuruldu → haritada kal ve yumuşakça otur.</b>
   *
   * <p>⚠️ Kamera {@code jumpTo} DEĞİL {@code easeTo}: kullanıcı biraz önce
   * haritanın neresine baktığını biliyor; ani bir sıçrama "başka bir yere
   * gittim" hissi verir. Yumuşak geçiş, az önce koyduğu binaya <b>aynı
   * haritada</b> yaklaştığını gösterir.
   *
   * <p>⚠️ Eğim burada <b>zorlanır</b> ({@code pitch: 60}): kullanıcı haritayı
   * düz bırakmış olabilir ve o açıdan yeni mağazasının 3B hâli görünmez.
   * Kurulum anı, binanın görülmesi gereken tek andır.
   *
   * <p>⚠️ Zoom {@code Math.max} ile korunur — zaten daha yakındaysa
   * uzaklaştırmayız.
   */
  const handleStoreCreated = useCallback(
    (territoryId: string) => {
      /* ⚠️ Konum ÖNCE okunur: `closeSelection()` seçimi siler ve sonrasında
         kameranın nereye gideceğini bilemezdik. */
      const at = selectionRef.current
      const map = mapRef.current
      closeSelection()
      void queryClient.invalidateQueries({ queryKey: ['territories'] })
      void queryClient.invalidateQueries({ queryKey: ['my-territories'] })
      void queryClient.invalidateQueries({ queryKey: ['my-plan'] })
      if (!map || !at) return
      map.easeTo({
        center: [at.lng, at.lat],
        zoom: Math.max(map.getZoom(), 16.2),
        pitch: 60,
        duration: 1400,
        essential: true,
      })
      /* Kart, veri geldikten SONRA açılsın: daire henüz kaynakta yokken
         aramak `null` döner ve kullanıcı hiçbir şey görmez. Gecikme kamera
         hareketinden kısa — kart, hareket biterken belirir. */
      window.setTimeout(() => {
        const target = findTerritoryById(territoryFeaturesRef.current, territoryId)
        if (target) setSelectedTerritory(target)
      }, 1200)
    },
    [closeSelection, queryClient],
  )


  /** Bekleyen kamera düzeltmesi bileşen kaldırılınca çalışmasın. */
  useEffect(() => () => window.clearTimeout(refitTimerRef.current), [])

  /* 🔴 `onRadiusChange` KALDIRILDI (V38): yarıçap sabit 100 m, değiştirilemez.
     Kaydırıcı sustuktan sonra kamerayı yeniden sığdıran gecikmeli düzeltme de
     onunla birlikte gitti — tek dokunuşta konan dairede yeniden sığdıracak bir
     değişim yok, `focusSelection` yerleştirme anında bir kez çağrılıyor. */

  // ---------------------------------------------------------------- render

  return (
    /* ⚠️ Masaüstünde `overflow-visible`: tuval bilerek kolonun ve üst çubuğun
       ALTINA taşıyor (`waydee-map-bleed`) ve buradaki `overflow-hidden` onu
       daha ilk kapta kırpardı. Taşmayı kabuğun kendi `overflow-hidden`'ı
       kırpıyor, yani sayfa büyümüyor. */
    <div className="relative h-full overflow-hidden md:overflow-visible">
      {/* mapbox-gl.css .mapboxgl-map position:relative ile utility'yi ezdiği için inline style şart.
          `waydee-map-surface`: Mapbox'ın sağ-üst kontrol kabını yüzen başlığın
          ALTINA indirir (index.css) — yoksa +/− düğmeleri arama/zil/hamburger
          düğmelerinin üstüne biniyordu. */}
      <div
        ref={containerRef}
        className="waydee-map-surface waydee-map-bleed"
        /* 🔴 `inset` BURADA VERİLMEZ — ölçüldü (25 Ağu 2026): satır içi stil
           her zaman sınıfı ezer, yani `inset: 0` yazıldığı sürece
           `.waydee-map-bleed`in negatif değerleri HİÇ uygulanmaz ve tuval
           çubukların altına taşımaz (cam yine boş zemini bulanıklaştırır).
           `inset` artık tamamen CSS'te: mobilde 0, masaüstünde negatif.
           ⚠️ `position` inline KALIR: mapbox-gl.css `.mapboxgl-map`e
           `position: relative` yazıyor ve utility sınıfını eziyor. */
        style={{ position: 'absolute' }}
      />

      {/* Alt karartma — ortak bileşen, beş harita yüzeyinin hepsinde aynı. */}
      <MapScrim />


      {/* Çizim ipucu / yarıçap okuması */}
      {drawMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute left-1/2 top-20 z-20 w-[min(92vw,26rem)] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-center text-[13px] font-semibold text-on-ink shadow-float md:top-24"
        >
          {/* ⚠️ Canlı yarıçap okuması KALDIRILDI: sürükleyerek boyutlandırma
              yok, gösterilecek değişen bir sayı da yok. */}
          {t('map.drawHint')}
        </motion.div>
      )}

      {/* --- Premium daveti: mağazanı işaretle ---
          🔴 Premium üye haritaya girdiğinde ne yapacağını SÖYLEYEN bir şey
          yoktu; "Alan al" düğmesi hâlâ eski satın alma dilini konuşuyordu.
          Davet yalnız hakkı OLAN ve mağazası OLMAYAN kullanıcıya çıkar.
          ⚠️ Kapatılabilir ve kapatma `sessionStorage`'da tutulur: her harita
          açılışında yeniden çıkması rahatsız edici olurdu, ama kalıcı olarak
          susturmak da vazgeçen kullanıcıyı bir daha davet etmemek olurdu. */}
      {showStoreInvite && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="waydee-above-nav pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
        >
          <div className="waydee-store-invite pointer-events-auto">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet/15 text-violet">
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold leading-tight">{t('map.inviteTitle')}</p>
              <p className="mt-0.5 text-[12px] font-medium leading-snug text-muted">
                {t('map.inviteBody')}
              </p>
            </div>
            {/* 🔴 10 Ağu 2026 — İKİ YOL (kullanıcı isteği: "konum seçeceği
                zaman şu anki konumuna git tarzı bir kısım ekle").
                Premium üyenin mağazası çoğunlukla <b>bulunduğu yerdedir</b>;
                haritada elle o noktayı bulmak (100 m'lik daire için doğru
                yakınlaştırmaya inip sokağı tanımak) gereksiz bir emekti. */}
            {/* ⚠️ İki düğme MOBİLDE ikinci satıra iner (ızgara) — sarmalayıcı
                bunun için var; 768px üstünde `display: contents` ile ortadan
                kalkar ve eski tek satırlık yerleşim aynen döner.
                Gerekçe ve ölçüm: `index.css` → `.waydee-store-invite`. */}
            <div className="waydee-store-invite-actions">
              <Button
                size="sm"
                variant="stroke"
                className="shrink-0"
                onClick={placeAtMyLocation}
                disabled={location.status === 'locating'}
              >
                {location.status === 'locating' ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
                {t('map.useMyLocation')}
              </Button>
              <Button size="sm" className="shrink-0" onClick={startDraw}>
                {t('map.inviteCta')}
              </Button>
            </div>
            <button
              type="button"
              onClick={dismissInvite}
              aria-label={t('common.close')}
              className="shrink-0 rounded-full p-1 text-faint transition-colors hover:text-ink"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {blockedHint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute left-1/2 top-20 z-30 w-[min(92vw,26rem)] -translate-x-1/2 rounded-full bg-danger px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-float md:top-24"
        >
          {t('map.blocked')}
        </motion.div>
      )}

      {/* Bölge hover bilgisi (masaüstü) */}
      {hoverRegion && !drawMode && !selection && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="waydee-above-nav pointer-events-none absolute left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold shadow-card md:block"
        >
          <span className="text-faint">{LEVEL_LABELS[hoverRegion.level] ?? hoverRegion.level}</span>{' '}
          {hoverRegion.name}
          <span className="text-faint"> · </span>
          {fmtMoney(Number(hoverRegion.pricePerKm2), hoverRegion.currency)}/km²
        </motion.div>
      )}

      {/* Sağ-alt yığın: son hareketler paneli + "Alan al" düğmesi.
          Tek bir flex sütunda durdukları için ASLA üst üste binmezler. */}
      {!selection && (
        <div className="waydee-above-nav pointer-events-none absolute right-3 z-20 flex flex-col items-end gap-2.5 md:right-4 md:gap-3">
          {!drawMode && <ActivityFeed />}
          {/* Konumum — izin kullanıcı basınca istenir. */}
          {!drawMode && (
            <button
              type="button"
              onClick={() => {
                locationCenteredRef.current = false
                location.toggle()
              }}
              aria-pressed={location.enabled}
              title={location.enabled ? t('location.disable') : t('location.enable')}
              className={cn(
                'pointer-events-auto grid h-11 w-11 place-items-center rounded-full shadow-float transition-colors',
                location.enabled ? 'bg-[#8ed11f] text-white' : 'bg-surface/92 text-muted hover:text-ink',
              )}
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          )}
          {/* 🔴 "Alan al" KALDIRILDI (9 Ağu 2026).
              Daire artık km² ile satılan bir alan değil, Premium üyenin
              mağazası. Bu yüzden tek bir "al" düğmesi yerine iki ayrı durum var:
              · Premium DEĞİLSE → "Mağaza aç" · tıklayınca Premium planına gider
                (haritada çizim yaptırmanın anlamı yok, hakkı yok).
              · Premium İSE → düğme HİÇ çizilmez; onun yerine ekranın altında
                mağazasını işaretlemeye çağıran bir davet çıkar (aşağıda).
              ⚠️ Mağazası zaten olan Premium kullanıcıya da çizim açılmaz —
              kullanıcı başına tek mağaza (V38 tekil indeksi). */}
          {/* 🔴 21 Ağu 2026 — MAĞAZAM DÜZENLE (kullanıcı talimatı: *"haritaya
              mağazası açık olanlara mağazanı düzenle geliştirmesi de yap"*). */}
          {!drawMode && storeKnown && myStore && (
            <Button
              onClick={() => setEditingStore(true)}
              size="lg"
              variant="stroke"
              className="pointer-events-auto rounded-full pl-4 pr-5 shadow-float"
            >
              <Palette className="h-5 w-5" /> {t('map.editStore')}
            </Button>
          )}
          {/* 🔴 HATA DÜZELTİLDİ (kullanıcı: *"mağazası varken hâlâ altta mağaza
              aç deniliyor"*).
              Koşul yalnız `!canOwnStore` idi. `useStoreAccess().canOpen`,
              mağazası OLAN kullanıcı için de false döner — hakkı harcanmıştır.
              Yani mağazasını kurmuş biri, haritada kendi mağazasını görürken
              altta *"Mağaza aç"* düğmesini görüyor ve basınca plan sayfasına
              atılıyordu. `!hasStore` eksik parçaydı: düğme yalnız mağazası
              OLMAYAN ve hakkı OLMAYAN kullanıcıya çıkar. */}
          {!drawMode && storeKnown && !canOwnStore && !hasStore && (
            <Button
              onClick={() => navigate('/plan')}
              size="lg"
              className="pointer-events-auto rounded-full pl-4 pr-5 shadow-float"
            >
              <Store className="h-5 w-5" /> {t('map.openStore')}
            </Button>
          )}
          {/* Çizim modunda da aynı kısayol: kullanıcı "bir yere tıkla"
              ekranındayken de kendi konumunu seçebilmeli. */}
          {drawMode && (
            <Button
              onClick={placeAtMyLocation}
              size="lg"
              variant="stroke"
              disabled={location.status === 'locating'}
              className="pointer-events-auto rounded-full pl-4 pr-5 shadow-float"
            >
              {location.status === 'locating' ? (
                <Spinner className="h-5 w-5" />
              ) : (
                <LocateFixed className="h-5 w-5" />
              )}
              {t('map.useMyLocation')}
            </Button>
          )}
          {!drawMode ? null : (
            <Button
              onClick={cancelDraw}
              size="lg"
              variant="danger"
              className="pointer-events-auto rounded-full pl-4 pr-5 shadow-float"
            >
              <XCircle className="h-5 w-5" /> {t('map.cancelDrawing')}
            </Button>
          )}
        </div>
      )}

      {drawMode && !selection && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <CircleDotDashed className="h-10 w-10 animate-pulse text-accent/70" />
        </div>
      )}

      {selection && (
        <StorePanel
          selection={selection}
          onClose={closeSelection}
          /*
           * 🔴 18 Ağu 2026 — MAĞAZA AÇILINCA <b>HARİTADA KALINIR</b>
           * (kullanıcı talimatı: *"mağaza açınca profile döndü … haritada
           * kalsın, kullanıcı başka yerlere yönlendirilmesin"*).
           *
           * Eskiden burası `/my-card?t=…` adresine gidiyordu: kullanıcı
           * mağazasını yerleştiriyor, ekran anında başka bir sayfaya
           * atlıyordu ve <b>az önce kurduğu şeyi hiç görmüyordu</b>. Duyuru
           * kartı hâlâ üretiliyor — ona `/me`'den ulaşılıyor — ama artık
           * kurulumun ödülü kartı değil, <b>haritadaki mağazanın kendisi</b>.
           *
           * Sıra önemli: önce panel kapanır, sonra veri tazelenir (yeni daire
           * kaynağa girsin), sonra kamera <b>yumuşakça</b> oturur.
           */
          onCreated={handleStoreCreated}
        />
      )}

      {/* 🔴 Mağaza düzenleme paneli.
          ⚠️ Panel kapanırken taslak da temizlenir: `StoreEditPanel` kendi
          temizlik fonksiyonunda `onPreview(null)` çağırıyor, yani harita
          sunucudaki gerçeğe döner — "vazgeç" gerçekten vazgeçmek olsun. */}
      {editingStore && myStore && (
        <StoreEditPanel
          store={myStore}
          currentColor={myStoreColor}
          onPreview={setStoreDraft}
          onClose={() => setEditingStore(false)}
        />
      )}

      {selectedTerritory && !selection && (
        <TerritoryCard territory={selectedTerritory} onClose={() => setSelectedTerritory(null)} />
      )}

      {/*
        Merkezlenen dairenin paneli.

        🔴🔴 24 Ağu 2026 — `.waydee-map-anchor` SARMALAYICISI KALDIRILDI.
        İKİ HATANIN TEK KÖKÜ BUYDU (kullanıcı buldu):

        Sarmalayıcı, kartı dairenin merkezine taşımak için `transform`
        kullanıyordu. Kart bir zamanlar `absolute` idi ve bu doğruydu. Panel
        `position: fixed` olunca kural değişti:

        🔴 <b>TRANSFORM'LU BİR ATA, `position: fixed` ÇOCUĞUN KAPSAYICI BLOĞU
        OLUR.</b> Yani panel artık VIEWPORT'a değil, sıfır boyutlu bu
        sarmalayıcıya çakılıyordu:
        ① `top:0; bottom:0; inset-inline:auto 0` sıfır yükseklikli bir kutuya
           çözülüp panel <b>ince bir şeride</b> çöküyordu — haritada mağazanın
           solunda görülen <b>siyah çizgi</b> tam olarak buydu;
        ② sarmalayıcının transform'u harita her hareket ettiğinde yeniden
           yazıldığı için şerit <b>gelip gidiyordu</b>.

        Panel kendi konumunu `.waydee-store-sheet` ile alıyor (masaüstünde
        sağda tam yükseklik, mobilde alt sayfa). Çapaya ihtiyacı yok ve
        çapa ona <b>zarar veriyordu</b>.
      */}
      {autoTerritory && !selectedTerritory && !selection && !drawMode && (
        <TerritoryCard
          territory={autoTerritory}
          onClose={() => {
            autoSuppressedRef.current = String(autoTerritory.id)
            autoIdRef.current = null
            setAutoTerritory(null)
          }}
        />
      )}

      {/*
        🧾 Aktif pazar listesi. Yalnız BAŞVURU ALAN pazarlar (kullanıcı:
        "aktif pazar yerleri"). Kapalı/arşiv olanlar haritada duruyor ama
        listeye girmiyor — liste bir eylem listesi, envanter değil.
      */}
      <MarketplaceListSheet
        open={mpListOpen}
        areas={(mpAreas?.features ?? [])
          .map((f) => f.properties)
          .filter((p): p is NonNullable<typeof p> => !!p && p.accepting)}
        onClose={() => setMpListOpen(false)}
        layerOn={showMarketplaces}
        onToggleLayer={(next) => {
          setShowMarketplaces(next)
          localStorage.setItem('waydee-show-marketplaces', String(next))
        }}
        onGoto={(area) => {
          setMpListOpen(false)
          /* ⚠️ Zoom 13: alanın tamamı ekrana sığsın diye. Daha yakını
             kullanıcıyı poligonun içinde, sınırları görünmeden bırakıyordu. */
          mapRef.current?.flyTo({
            center: [area.centerLng, area.centerLat],
            zoom: 13,
            duration: 1200,
            essential: true,
          })
        }}
      />

      {/* Pazar yeri kartı — bölge kartıyla aynı anda açılmaz. */}
      {(selectedArea || selectedStall) && !selection && !selectedTerritory && (
        <MarketplaceMapCard
          area={selectedArea}
          stall={selectedStall}
          onClose={() => {
            setSelectedArea(null)
            setSelectedStall(null)
          }}
        />
      )}

      {/*
        Sol üst yığın: trend duyurusu + pazar katmanı anahtarı.

        🔴 15 Ağu 2026 — PAZAR ÇİPİ BU SÜTUNUN İÇİNE ALINDI.

        Yorumda *"tek flex sütununda durdukları için asla üst üste binmezler"*
        yazıyordu ama çip sütunun **dışındaydı**: kendi `absolute top-[7.5rem]`
        değeriyle konumlanıyordu. Yani iki öğe birbirini hiç bilmiyordu ve
        TrendingBar iki satıra çıktığında (uzun bölge adı, dar ekran) çipin
        üstüne biniyordu — bildirilen "pazar yeri kısmı üstte kalıyor" şikâyeti.

        Elle ayarlanmış `top` değerleri bu tür bir hizalamanın en kırılgan
        yoludur: bir öğenin yüksekliği değişince diğerinin sabiti yanlış olur.
        Artık ikisi de akışta; aralarındaki boşluğu `gap-2` verir.

        ⚠️ `pointer-events-none` kapta, çipte `pointer-events-auto`: kap tüm
        sol üst köşeyi kaplıyor ve haritayı sürüklemeyi engellememeli.
        ⚠️ Sol boşluk `md:left-5`: kenar çubuğu 80px ve üstünde 40px'lik
        `backdrop-blur` var; 12px'lik eski boşlukta çip çubuğun bulanık
        kenarına yapışık duruyordu.
      */}
      {/*
        🔴 24 Ağu 2026 — KATEGORİ ŞERİDİ ve sol üst yığın AYNI SÜTUNDA.

        Şerit ayrı bir `absolute top-…` ile konumlansaydı, 15 Ağu'da pazar
        çipiyle birebir yaşanan hata tekrarlanırdı: iki öğe birbirini
        bilmiyordu ve TrendingBar iki satıra çıkınca üst üste biniyorlardı.
        Elle ayarlanmış `top` sabitleri, bir öğenin yüksekliği değişince
        yanlış olur. İkisi de bu akışta duruyor; aralarını `gap` veriyor.

        ⚠️ Kap `max-w` ile SINIRLI değil artık: şerit tam genişliği
        kullanabilmeli (ekran görüntüsündeki gibi), ama altındaki sol yığın
        eski dar genişliğinde kalmalı — bu yüzden `max-w` şeridin DEĞİL,
        altındaki sarmalayıcının üstünde.

        ⚠️ Sağ kenardan pay: sağ üstte arama/zil düğmeleri, sağ altta +/− var.
        Şerit `pe-16` ile son çipin o düğmelerin altına kaymasını engeller —
        TerritoryCard'ta sol rayla birebir aynı hata yaşanmıştı.
      */}
      {!drawMode && !selection && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col gap-2 md:top-4">
          <CategoryFilterBar
            categories={storeCategories ?? []}
            value={categoryFilter}
            onChange={setCategoryFilter}
            className="w-full overflow-hidden pe-14 ps-0 md:ps-2"
          />
          <div className="flex max-w-[calc(100vw-1.5rem)] flex-col items-start gap-2 ps-3 md:max-w-[22rem] md:ps-5">
          <BidBoard
            onFlyTo={(lng, lat) => mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 })}
          />
          {/* 🔴 105. tur — düğme LİSTEYİ açar (kullanıcı isteği). Katman
              görünürlüğü panelin içindeki anahtarda. */}
          <button
            type="button"
            onClick={() => setMpListOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={mpListOpen}
            data-on={mpListOpen ? 'true' : 'false'}
            /* 🧊 Apple cam hap — tarif `.waydee-glass` içinde, tek yerde. */
            className="waydee-glass waydee-glass-pill pointer-events-auto inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-colors data-[on=false]:hover:text-ink" 
          >
            <Store className="h-3.5 w-3.5" /> {t('map.marketplaces')}
          </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- seçime odaklan

/** `PurchasePanel`'in masaüstündeki genişliği (`md:w-[460px]`) + kenar boşluğu. */
const PANEL_W_DESKTOP = 460

/**
 * Seçilen daireyi **panelin kapatmadığı boşluğun ortasına** yumuşakça taşır.
 *
 * ⚠️ <b>Neden gerekli:</b> panel açılınca daire ya panelin altında kalıyor ya da
 * (tek dokunuşla yerleştirildiyse) 150 m'lik bir daire z5 haritada birkaç
 * piksel olduğu için hiç görünmüyordu. "Ne kadar alan aldığımı göremiyorum"
 * şikayetinin kökü buydu: panel kısaltmak tek başına yetmiyor, <b>kameranın</b>
 * da kalan boşluğa göre ayarlanması gerekiyor.
 *
 * İki iş yapar:
 *  1. <b>Kaydırma</b> — `offset` ile dairenin merkezi serbest alanın ortasına
 *     gelir (mobilde panelin üstü, masaüstünde panelin solu).
 *  2. <b>Ölçek</b> — yalnız GEREKİRSE. Daire boşluğa sığmıyorsa ya da göz
 *     kırpacak kadar küçükse zoom ayarlanır; zaten makul boydaysa kullanıcının
 *     zoom'una dokunulmaz (sürükleyerek çizen biri istediği ölçeği zaten seçmiştir).
 *
 * ⚠️ Transform animasyonu değil, Mapbox'ın kendi `easeTo`'su kullanılır —
 * projedeki framer-motion transform tuzağıyla ilgisi yoktur.
 */
function focusSelection(map: mapboxgl.Map, sel: Selection, duration = 620) {
  const el = map.getContainer()
  const W = el.clientWidth
  const H = el.clientHeight
  if (!W || !H) return

  const desktop = W >= 768
  // Panelin kapladığı yer düşülerek kalan "serbest" dikdörtgen (piksel).
  const free = desktop
    ? { x0: 24, x1: Math.max(W - PANEL_W_DESKTOP - 40, 240), y0: 84, y1: H - 24 }
    : { x0: 16, x1: W - 16, y0: 84, y1: Math.max(H * 0.56 - 92, 180) }

  const cx = (free.x0 + free.x1) / 2
  const cy = (free.y0 + free.y1) / 2
  // Dairenin yarıçapına ayrılabilecek en büyük piksel değeri.
  const room = Math.max(Math.min(free.x1 - free.x0, free.y1 - free.y0) / 2 - 16, 40)
  const px = pixelRadius(map, sel.lng, sel.lat, sel.radiusM)

  let zoom = map.getZoom()
  if (px > room || px < room * 0.22) {
    /*
     * ⚠️ Hedef zoom ORAN İLE değil, doğrudan hesaplanır.
     * `zoom + log2(hedef/mevcut)` sezgisel görünüyor ama yanlış: globe
     * projeksiyonunda düşük zoom'da piksel ölçeği 2^zoom ile doğrusal
     * değişmez, ayrıca çok küçük dairelerde ölçülen piksel yarıçapı 0'a
     * yaklaşıp bölmeyi patlatır. Ölçüldü: 150 m'lik daire z5.5'te 0.11px;
     * oran yöntemi z13.99 (40px) verirken doğrusu z16.1 (≈180px).
     *
     * ⚠️ Sabit **78271.5** — yaygın yazılan 156543.03 değeri 256px'lik karolar
     * içindir, Mapbox GL ise 512px karo kullanır. Yanlış sabitle zoom bir
     * kademe fazla çıkıyor ve daire serbest alana SIĞMIYORDU (ölçüldü: 360px
     * yarıçap, oysa alanın yarısı 290px).
     * Mercator bağıntısı: pikselYarıçapı = metre / (mpp0·cos(enlem) / 2^zoom).
     */
    const metersPerPixelAtZ0 = 78271.51696 * Math.cos((sel.lat * Math.PI) / 180)
    const target = room * 0.62
    zoom = Math.log2((target * metersPerPixelAtZ0) / Math.max(sel.radiusM, 1))
    zoom = Math.min(Math.max(zoom, 1.5), 19)
  }

  map.easeTo({
    center: [sel.lng, sel.lat],
    zoom,
    offset: [cx - W / 2, cy - H / 2],
    duration,
    essential: true,
  })
}

// ---------------------------------------------------------------- kamera kalıcılığı

/**
 * Haritanın açılış kamerası.
 *
 * <p>🔴 <b>`pitch: 60` — yatığa yakın bakış</b> (kullanıcı talimatı, 18 Ağu
 * 2026: *"bakış açısı da yataya yakındı, onu da öyle yap"*). Harita eskiden
 * tepeden (`pitch: 0`) açılıyordu ve o açıdan <b>3B hiçbir şey görünmez</b>:
 * ne mağaza binası ne şehrin kendisi. Eğim, 3B'nin ön koşuludur.
 *
 * <p>⚠️ Bu yalnız <b>varsayılandır</b>. Kullanıcının kayıtlı kamerası varsa
 * ({@code camera.initialView}) ona dokunulmaz — kişi haritayı düzleştirdiyse
 * her dönüşte yeniden eğmek, tercihini görmezden gelmek olurdu.
 */
const DEFAULT_VIEW = {
  center: [32.5, 39.0] as [number, number],
  zoom: 5.2,
  pitch: 0,
}

/** Oturumlu haritanın kamerası (bkz. `mapCamera.ts` — tüm haritalarda aynı desen). */
const camera = createCameraMemory('waydee-map-view')

// ---------------------------------------------------------------- yardımcılar

