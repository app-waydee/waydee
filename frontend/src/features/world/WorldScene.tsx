import { useCallback, useState } from 'react'
import { Sky, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { WorldShelfItem, WorldStore, WorldView } from '@/lib/marketplace'
import { Crosshair, type AimTarget } from './Crosshair'
import { Player } from './Player'
import { STORE, StoreBuilding } from './StoreBuilding'
import { useVectorTexture } from './useSafeTexture'

/**
 * Caddenin giriş takındaki <b>Waydee kelime markası</b>.
 *
 * <p>🔴 11 Ağu 2026 — kaynak `waydee-logo.png` değil **`/logo.svg`**.
 * O png <b>eski logodur</b>: 7 Ağustos'ta vektör sürüm onun yerini aldı ve
 * tanıtım sayfası da (`components/Logo.tsx`) `logo.svg` kullanıyor. Marka
 * işareti <b>tek kaynaktan</b> gelir — vault altın kuralı; bu tur o kuralın
 * 3B tarafta ihlal edildiği yerdi.
 *
 * <p>⚠️ {@link useVectorTexture} ile <b>rasterleştirilir</b>: svg doğrudan
 * dokuya alınırsa içsel boyutunda (691×186) sabitlenir ve 4,4 metrelik
 * tabelada bulanık kalır. 2048 piksel genişlikte çizilince keskin.
 *
 * <p>⚠️ Doku gelmezse hiçbir şey çizilmez — altındaki beyaz levha zaten var.
 */
function SignLogo({ position, width }: { position: [number, number, number]; width: number }) {
  const texture = useVectorTexture('/logo.svg', 2048)
  if (!texture) return null
  /* logo.svg viewBox'ı 691×186 → oran 3,715. */
  return (
    <mesh position={position}>
      <planeGeometry args={[width, width / 3.715]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}

/**
 * Caddenin asfalt zemini + kaldırımlar.
 *
 * <p>⚠️ Zemin <b>sonsuz değil</b>: mağaza sayısına göre uzatılır. Sabit büyük
 * bir düzlem kullanmak, birkaç mağazalık bir pazarda oyuncuyu ıssız bir
 * boşluğun ortasında bırakıyordu.
 */
function Ground({ length, halfWidth }: { length: number; halfWidth: number }) {
  const pave = halfWidth + STORE.depth + 4

  return (
    <group>
      {/* Asfalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, length / 2 - 10]} receiveShadow>
        <planeGeometry args={[pave * 2, length + 40]} />
        <meshStandardMaterial color="#3c4046" roughness={0.95} />
      </mesh>
      {/* Yürüme yolu — caddenin ortasında açık şerit */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, length / 2 - 10]}>
        <planeGeometry args={[halfWidth * 2 - 2, length + 40]} />
        <meshStandardMaterial color="#4a4f56" roughness={0.9} />
      </mesh>
      {/* Orta çizgi — fıstık yeşili, yönü belli etsin. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, length / 2 - 10]}>
        <planeGeometry args={[0.18, length + 40]} />
        <meshStandardMaterial color="#c2f04b" emissive="#c2f04b" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

/**
 * <b>Gezilebilir pazar yeri evreni.</b>
 *
 * <p>Işıklandırma bilinçli olarak <b>ucuz</b>: tek yönlü ışık + ortam ışığı.
 * Mağaza başına gölge üreten ışık koymak, 20 mağazalık bir caddede kare
 * süresini üç katına çıkarıyordu; iç aydınlatma gölgesiz nokta ışıklarla
 * yapılıyor ({@link StoreBuilding}).
 */
export function WorldScene({
  world,
  onOpenPost,
  onStoreChange,
  likes,
  onToggleLike,
  moveRef,
  lookRef,
  targetRef,
  onAimChange,
  paused,
}: {
  world: WorldView
  onOpenPost: (item: WorldShelfItem, store: WorldStore) => void
  onStoreChange: (store: WorldStore | null) => void
  /**
   * Beğeni durumu — mağaza kimliğinden {beğendim mi, kaç} eşlemesi (97. tur).
   * ⚠️ Sahne bunu yalnız OKUR; iyimser güncelleme ve sunucu çağrısı sayfada.
   */
  likes: Record<string, { liked: boolean; count: number }>
  onToggleLike: (store: WorldStore) => void
  moveRef: React.RefObject<{ x: number; y: number }>
  lookRef: React.RefObject<{ dx: number; dy: number }>
  /** Nişangâhın hedeflediği ürün — tıklamada sayfa okur. */
  targetRef: React.RefObject<AimTarget | null>
  onAimChange: (aiming: boolean) => void
  /** Bir kart açık mı — açıkken sahne girdileri dinlemez. */
  paused: boolean
}) {
  const rows = Math.ceil(world.stores.length / 2)
  const length = Math.max(rows, 2) * world.rowSpacing

  /*
   * 🔴 15 Ağu 2026 — İÇİNDE BULUNULAN MAĞAZA SAHNEDE DE TUTULUR.
   *
   * Kullanıcı: *"müzik mağaza kapısından içeri girdikten sonra çalacak."*
   * Müziği mesafeye göre açmak caddede yürürken de duyuruyordu; artık
   * yalnız İÇERİDEYKEN çalıyor.
   *
   * ⚠️ Durum sayfada zaten vardı ama üst şerit için; sahne onu okuyamıyordu.
   * `Player` tek kaynak olarak kalır, buradaki kopya yalnız aşağı akıtır.
   * ⚠️ `Player` bunu YALNIZ DEĞİŞİNCE çağırır (her karede değil), yani bu
   * state sahneyi kare başına yeniden çizmez.
   */
  const [insideId, setInsideId] = useState<string | null>(null)
  const handleStoreChange = useCallback(
    (store: WorldStore | null) => {
      setInsideId(store?.id ?? null)
      onStoreChange(store)
    },
    [onStoreChange],
  )

  return (
    <>
      <Sky sunPosition={[70, 26, -60]} turbidity={4} rayleigh={0.9} mieCoefficient={0.006} />
      <fog attach="fog" args={['#b9c8d6', 55, 230]} />

      {/*
        ══ AYDINLATMA ══
        🔴 11 Ağu 2026'da yeniden kuruldu — kullanıcı: *"ışıklandırma ekle,
        gerçek ışık görünümü olsun"*. Önceki hâl tek bir `ambientLight 1.1` +
        yönlü ışıktı: ortam ışığı her yüzeyi EŞİT aydınlattığı için gölge ve
        hacim tamamen kayboluyor, binalar düz karton gibi duruyordu.

        Şimdi üç katman var:
         ① `hemisphereLight` — gökten mavi, zeminden asfalt grisi. Gerçek dış
            mekân dolgusu budur; düz ortam ışığından farkı, YÜZEYİN BAKTIĞI
            YÖNE göre renk vermesi. Çatı üstü serin, alt yüzler soğuk-gri olur.
         ② `directionalLight` — güneş, gölge üreten TEK ışık.
         ③ zayıf bir `ambientLight` — gölgelerin tamamen siyaha düşmemesi için.

        ⚠️ Gölge üreten ışık BİR TANE. Her mağazanın iç ışıkları gölgesizdir;
        20 mağaza × gölge haritası, kare süresini üçe katlıyordu.
      */}
      <hemisphereLight args={['#cfe3f5', '#4a4f56', 1.35]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[55, 48, -30]}
        intensity={2.6}
        color="#fff3e2"
        castShadow
        /* 🔴 97. tur, 2. bölüm — 2048'den 1024'e indirildi. Gölge haritası
           GPU'da 2048² × 4 bayt ≈ 16 MB yer tutuyor; bağlam kaybı
           şikâyetinde ışıklardan sonraki en büyük tek tahsis buydu ve
           caddede fark edilir bir kalite kaybı ölçülmedi (gölgeler zaten
           90 m'lik geniş bir kamerayla yumuşak). */
        shadow-mapSize={[1024, 1024]}
        /* ⚠️ Gölge kamerası caddeyi kapsayacak kadar geniş olmalı; varsayılan
           ±5 m'lik kutuda mağazaların gölgesi hiç çizilmiyordu. */
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-camera-far={320}
        /* ⚠️ `bias` olmadan düz yüzeylerde "gölge akne"si (titreşen çizgiler)
           çıkıyor; `normalBias` ise ince kutuların kendi gölgesiyle
           kararmasını engelliyor. */
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />

      <Ground length={length} halfWidth={world.streetHalfWidth} />

      {/*
        ══ CADDE GİRİŞ TAKI ══
        🔴 Pazarın adının üstünde <b>Waydee kelime markası</b> (`/logo.svg` —
        tanıtım sayfasındaki metin logosunun ta kendisi). ⚠️ Marka YALNIZ
        burada görünür; mağaza tabelalarında sahiplerinin kendi logoları var.
      */}
      <group position={[0, 0, -16]}>
        {/* Koyu ana kiriş */}
        <mesh position={[0, 4.3, 0]} castShadow>
          <boxGeometry args={[world.streetHalfWidth * 2 + 1.2, 2.4, 0.3]} />
          <meshStandardMaterial color="#17191c" roughness={0.7} />
        </mesh>
        {/* Beyaz logo levhası — logo koyu lacivert çizimli, siyah kirişte
            okunmazdı. */}
        <mesh position={[0, 4.95, 0.17]}>
          <planeGeometry args={[5.0, 1.44]} />
          <meshStandardMaterial color="#fbfcfc" roughness={0.35} />
        </mesh>
        <SignLogo position={[0, 4.95, 0.19]} width={4.4} />
        {/* Pazarın adı */}
        <Text
          position={[0, 3.85, 0.17]}
          fontSize={0.58}
          maxWidth={world.streetHalfWidth * 2 - 1.5}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {world.name}
        </Text>
        {/* Kirişin altındaki yeşil ışık hattı */}
        <mesh position={[0, 3.08, 0.16]}>
          <boxGeometry args={[world.streetHalfWidth * 2 + 1.2, 0.08, 0.03]} />
          <meshStandardMaterial color="#b6f13f" emissive="#b6f13f" emissiveIntensity={2.2} />
        </mesh>
        {/* Direkler */}
        {[-world.streetHalfWidth - 0.2, world.streetHalfWidth + 0.2].map((x) => (
          <mesh key={x} position={[x, 1.55, 0]} castShadow>
            <boxGeometry args={[0.34, 3.1, 0.34]} />
            <meshStandardMaterial color="#2a2d31" roughness={0.75} />
          </mesh>
        ))}
      </group>

      {world.stores.map((store) => (
        /*
         * 🔴 11 Ağu 2026 — <Suspense> KALDIRILDI. Raf fotoğrafları artık
         * `useSafeTexture` ile yükleniyor: askıya almıyor ve HATA FIRLATMIYOR.
         * Eski hâlde tek bir imzalı medya adresinin süresi dolduğunda
         * `useLoader` fırlatıyor, yakalayan sınır olmadığı için React bütün
         * ağacı söküyor ve geriye BOŞ GRİ TUVAL kalıyordu — bildirilen
         * "3B ekran yüklenmiyor" hatasının kök nedeni buydu.
         */
        <StoreBuilding
          key={store.id}
          store={store}
          inside={insideId === store.id}
          liked={likes[store.id]?.liked ?? store.likedByMe}
          likeCount={likes[store.id]?.count ?? store.likeCount}
          onToggleLike={() => onToggleLike(store)}
          onOpenPost={(item) => onOpenPost(item, store)}
        />
      ))}

      <Crosshair targetRef={targetRef} onAimChange={onAimChange} paused={paused} />
      <Player stores={world.stores} onStoreChange={handleStoreChange} moveRef={moveRef} lookRef={lookRef} paused={paused} />
    </>
  )
}

/** Sahnenin kurulum ayarları — `<Canvas>`'a birebir geçirilir. */
export const CANVAS_SETTINGS = {
  /* ⚠️ `PCFSoftShadowMap` KULLANILMIYOR: three artık onu kaldırdı ve her
     sahne kurulumunda konsola "deprecated" uyarısı basıyordu (kullanıcının
     gönderdiği konsol çıktısında iki kez görünüyor). PCF yeterince yumuşak. */
  shadows: { type: THREE.PCFShadowMap } as const,
  camera: { fov: 72, near: 0.1, far: 400 },
  /* ⚠️ Piksel oranı SINIRLANIR. Retina telefonlarda `devicePixelRatio` 3'e
     çıkıyor ve doldurulacak piksel sayısı 2,25 katına fırlıyor.
     🔴 97. tur, 2. bölüm — tavan 2'den 1,75'e indirildi: bağlam kaybı
     yaşayan makinelerde çizim tamponu (drawing buffer) tek başına yüzlerce
     megabayt tutuyordu. */
  dpr: [1, 1.75] as [number, number],
  gl: {
    antialias: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    /* Ayrık ekran kartı olan makinede onu seç — bağlam kaybı en çok
       tümleşik kartlarda görülüyor. */
    powerPreference: 'high-performance' as const,
    /* ⚠️ `true` olsaydı yazılım oluşturucuya düşen makinelerde bağlam HİÇ
       kurulmaz ve kullanıcı bembeyaz bir ekran görürdü — bildirilen
       belirtilerden biri tam olarak buydu. */
    failIfMajorPerformanceCaveat: false,
  },
}
