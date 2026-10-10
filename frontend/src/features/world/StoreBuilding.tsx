import { useMemo, useRef, useState } from 'react'
import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { WorldShelfItem, WorldStore } from '@/lib/marketplace'
import { useSafeTexture } from './useSafeTexture'
import { StoreMusic } from './StoreMusic'
import { StoreTv } from './StoreTv'

/**
 * <b>Mağaza ölçüleri</b> (metre) — tek kaynak.
 *
 * <p>🔴 Çarpışma kutusu da, duvarlar da, raflar da BURADAN türer. Ölçüyü iki
 * yerde tutmak, oyuncunun görünmez bir duvara çarpmasının ya da duvarın
 * içinden geçmesinin en kısa yoludur.
 */
export const STORE = {
  /** Cephe genişliği (x ekseni, mağaza kendi yerel uzayında). */
  width: 9,
  /** Derinlik (z ekseni). */
  depth: 8,
  /** Duvar yüksekliği — saçak bunun üstüne biner. */
  height: 4.0,
  /** Kapı boşluğunun genişliği. Oyuncu yarıçapı 0,35 m; 3 m rahat geçer. */
  doorWidth: 3.0,
  /** Kapı boşluğunun yüksekliği. */
  doorHeight: 2.8,
  /** Duvar kalınlığı. */
  wall: 0.16,
  /** Podyumun (platform) yüksekliği — fotoğraftaki basamaklı kaide. */
  podium: 0.36,
} as const

/**
 * Fotoğraftaki palet.
 *
 * <p>⚠️ Gövde saf beyaz (#fff) DEĞİL: saf beyaz, ACES ton eşlemesinde
 * tamamen doygunlaşıp yüzey ayrıntısını (kenar, gölge, derinlik) yutuyor ve
 * bina "kağıttan kesilmiş" gibi duruyordu.
 */
const PALETTE = {
  body: '#eef0f2',
  bodyDark: '#dfe3e7',
  roof: '#23262a',
  roofEdge: '#15171a',
  podium: '#41464d',
  podiumStep: '#5a6068',
  lime: '#b6f13f',
  limeDeep: '#8fd420',
  glass: '#a8c4d4',
  frame: '#17191c',
  panel: '#111316',
  shelf: '#f3f5f6',
  interior: '#f7f8f9',
  floor: '#d7dbe0',
  /* ── PREMIUM CAM PALETİ (97. tur, 24 Ağu 2026) ─────────────────────────
     Kullanıcı: *"mağaza tasarımlarını premium apple cam glasse çevir"*.
     🔴 Cam bir RENK değil bir DAVRANIŞTIR: burada yalnız tonu duruyor, geri
     kalanı {@link GLASS} malzemesinde. Rengi doğrudan `#fff` yapmak camı
     sütbeyaz bir plastiğe çeviriyordu (ACES ton eşlemesi doyuruyor). */
  glassCool: '#dbe7f0',
  glassWarm: '#eef3f7',
  /** Cam panellerin kenarındaki alüminyum çıta — Apple ürünlerindeki kenar. */
  alu: '#c9ced4',
  aluDark: '#8f979f',
} as const

/**
 * <b>Premium cam malzemesi</b> — mağazanın gövdesi (97. tur).
 *
 * <h3>🔴 Neden `transmission` YOK</h3>
 * <p>Gerçek kırılmalı cam ({@code transmission}) her yüzey için ayrı bir
 * geçiş (render target) doğurur. Bu caddede 20+ mağaza var ve her mağazada
 * 8+ cam yüzey; ölçüm 15 Ağu'da yapıldı ve kare süresini <b>üçe</b>
 * katlıyordu. Aynı görsel etki burada üç ucuz kanalla kuruluyor:
 * <ul>
 *   <li><b>clearcoat</b> — üstteki ince parlak lake; Apple yüzeylerindeki o
 *       "tek parça cam" hissini veren şey budur;</li>
 *   <li><b>düşük roughness + yüksek ior</b> — keskin, dar yansıma;</li>
 *   <li><b>düşük opaklık</b> — arkasını göstermeden derinlik.</li>
 * </ul>
 *
 * <p>⚠️ Cam yüzeyler <b>gölge üretmez</b> ({@code castShadow} verilmez):
 * saydam bir yüzeyin gölge haritasında katı davranması, dükkânın içini
 * bulut gibi kararan lekelerle dolduruyordu.
 *
 * <p>⚠️ {@code transparent} açıkken derinlik sıralaması yaklaşıktır; bu
 * yüzden iç yüzeyler (raflar, tezgâh) <b>opak</b> bırakıldı — hepsi cam
 * olsaydı dükkânın içi okunmaz bir parlama olurdu.
 */
function GlassSurface({
  tint = PALETTE.glassCool,
  opacity = 0.34,
  roughness = 0.06,
}: {
  tint?: string
  opacity?: number
  roughness?: number
}) {
  return (
    <meshPhysicalMaterial
      color={tint}
      transparent
      opacity={opacity}
      roughness={roughness}
      metalness={0}
      /* Cam kenarına bakınca beyazlaşır — gerçek camın Fresnel'i. */
      ior={1.5}
      reflectivity={0.6}
      clearcoat={1}
      clearcoatRoughness={0.04}
      /* ⚠️ Arka yüzler de çizilir: tek yüzlü cam, içeriden bakınca
         KAYBOLUYORDU (dükkânın içindeyken duvar yokmuş gibi görünüyordu). */
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  )
}

/**
 * <b>Cephe kuşağı</b> — sol pano ve sağ vitrinin kapladığı dikey aralık.
 *
 * <p>🔴 11 Ağu 2026, bildirilen hata: *"siyah alan tam oturmuyor, üstte
 * E-ticaret yarım kalıyor"*. Sebep sabit sayılardı: pano `y=2.0`, yükseklik
 * `2.5` → tepesi <b>3,25</b>; tabela bandının altı ise <b>2,805</b>. Yani pano
 * bandın 44 cm ARDINA giriyor ve ilk satır kesiliyordu.
 *
 * <p>Artık ikisi de bandın altından <b>türetiliyor</b>: iki bağımsız sabit,
 * biri değişince mutlaka ayrışır — 74. turdaki `PAYMENT_RETURN_URL` dersinin
 * geometrideki karşılığı.
 */
/** Tabela bandının merkez yüksekliği ve kalınlığı. */
const SIGN_MID = STORE.height - 0.62
const SIGN_H = 1.15
/** Bandın alt kenarı — cephe kuşağı bunun altında kalmalı. */
const SIGN_BOTTOM = SIGN_MID - SIGN_H / 2
/** Kuşağın alt kenarı (zeminden). */
const FASCIA_BOTTOM = 0.75
/** Band ile kuşak arasındaki nefes payı. */
const FASCIA_GAP = 0.14
/** Kuşağın yüksekliği ve merkezi. */
const FASCIA_H = SIGN_BOTTOM - FASCIA_GAP - FASCIA_BOTTOM
const FASCIA_MID = FASCIA_BOTTOM + FASCIA_H / 2
/** Panodaki dört satırın aralığı — yükseklikten türer, sabit değil. */
const ROW_GAP = (FASCIA_H - 0.42) / 3

/**
 * Kapının kendiliğinden açıldığı uzaklık (metre).
 * <p>Fazla büyük olursa cadde boyunca yürürken bütün kapılar açılıp kapanıyor
 * ve sahne kıpır kıpır oluyor; fazla küçük olursa kapı yüzüne çarpıyormuş
 * gibi geç açılıyor.
 */
const DOOR_OPEN_RANGE = 5.0

/**
 * <b>Mağazanın rozeti</b> — başvuruda yüklenen logo, yoksa adının baş harfi.
 *
 * <p>🔴 Buraya Waydee işareti KONMAZ: cadde başkalarının dükkânlarından
 * oluşuyor ve hepsinin tabelasına aynı markayı asmak, mağazaları birbirinden
 * ayırt edilemez yapardı. Marka yalnız caddenin <b>giriş takında</b> durur.
 *
 * <p>⚠️ Logo yoksa <b>baş harf</b> yazılır. Boş bırakmak yeşil bir daire
 * bırakırdı; yer tutucu bir Waydee işareti koymak ise sahibinin markasıymış
 * gibi görünürdü — ikisi de yanlış.
 *
 * <p>⚠️ `transparent` şart: yüklenen logolar çoğunlukla saydam zeminli png'dir
 * ve saydamlık kapalıyken etraflarında siyah bir kare çıkar.
 *
 * <p>⚠️ `meshBasicMaterial` + `toneMapped={false}`: logo bir yüzey değil bir
 * <b>işaret</b>tir, sahne ışığıyla kararması onu okunmaz yapardı.
 *
 * <h3>🔴 97. tur — YUVARLAK, TAM OTURAN LOGO (Instagram mantığı)</h3>
 * <p>Kullanıcı: *"logo yuvarlağın içine tam sığsın, Instagram'daki profil
 * fotoğrafı mantığının birebir aynısı olsun"*.
 *
 * <p>Eski hâl <b>kare bir düzlemdi</b>: yuvarlak yeşil rozetin üstünde duran
 * kare bir logo, köşeleri daireden taşıyor ya da (saydam png'lerde) ortada
 * küçücük kalıyordu. Instagram'ın yaptığı şey iki adımdır ve ikisi de burada:
 * <ol>
 *   <li><b>Daireye kırpma</b> — geometri {@code circleGeometry}, yani logo
 *       dairenin dışına taşamaz;</li>
 *   <li><b>Kısa kenardan doldurma</b> (CSS'teki {@code object-fit: cover}) —
 *       görselin oranı korunur, taşan uzun kenar kırpılır. Bu, dokunun
 *       {@code repeat}/{@code offset} alanlarıyla yapılır.</li>
 * </ol>
 *
 * <p>🔴 <b>Neden `repeat` ile, neden geometri UV'siyle değil:</b> aynı doku
 * mağazanın iki yerinde (tabela + iç duvar) kullanılıyor ve doku bir
 * <b>paylaşılan</b> nesnedir. Ama {@code clone()} edilmiş bir doku aynı GPU
 * görselini işaret eder, ek bellek maliyeti yoktur — geometriyi her boyut için
 * yeniden üretmek ise iki ayrı tampon demekti.
 *
 * <p>⚠️ {@code ClampToEdgeWrapping} şart: varsayılan sarma kipinde
 * {@code offset} negatif olduğunda kırpılan kenar <b>diğer taraftan geri
 * girer</b> ve logonun kenarında hayalet bir şerit belirir.
 */
function StoreBadge({
  store,
  position,
  size = 0.58,
}: {
  store: WorldStore
  position: [number, number, number]
  size?: number
}) {
  const raw = useSafeTexture(store.logoUrl)

  /**
   * Dokunun <b>kapak (cover)</b> kırpması — Instagram'ın profil fotoğrafı.
   *
   * <p>Görsel dairenin kısa kenarını doldurur, uzun kenarı ortadan kırpılır.
   * Oran bilinmediği için hesap dokunun kendi piksel boyutundan yapılır.
   */
  const texture = useMemo(() => {
    if (!raw) return null
    const img = raw.image as { width?: number; height?: number } | undefined
    const w = img?.width ?? 1
    const h = img?.height ?? 1
    const tex = raw.clone()
    tex.needsUpdate = true
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.center.set(0.5, 0.5)
    if (w >= h) {
      /* Yatay logo: yataydan kırp. */
      tex.repeat.set(h / w, 1)
    } else {
      /* Dikey logo: dikeyden kırp. */
      tex.repeat.set(1, w / h)
    }
    tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2)
    return tex
  }, [raw])

  if (!texture) {
    return (
      <Text
        position={position}
        fontSize={size * 0.72}
        color="#14181c"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {(store.title.trim()[0] ?? '?').toLocaleUpperCase('tr')}
      </Text>
    )
  }

  return (
    <mesh position={position}>
      {/* 🔴 DAİRE — kare düzlem değil. Logo dairenin dışına taşayamaz. */}
      <circleGeometry args={[size / 2, 48]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}

/**
 * <b>Mağaza beğenisi</b> — dükkânın içindeki kalp düğmesi (97. tur).
 *
 * <p>Kullanıcı: *"mağaza içerisinde like butonu veya kalp butonu koy ... o
 * butona bakıp sol tık veya mobilde oraya tıklandığında +1 olsun"*.
 *
 * <h3>🔴 İki giriş yolu, tek eylem</h3>
 * <ul>
 *   <li><b>Masaüstü</b> — fare kilidi devrededir, imleç ekranda hareket etmez
 *       ve R3F'in kendi işaretçi olayları HİÇ tetiklenmez (11 Ağu'da
 *       raflarda yaşanan hatanın aynısı). Bu yüzden kalp {@code userData}
 *       ile işaretlenir, nişangâh onu hedefler ve tıklamayı sayfa karşılar.</li>
 *   <li><b>Dokunmatik</b> — fare kilidi yoktur, parmakla doğrudan dokunmak en
 *       doğal yoldur: {@code onClick} DURUR.</li>
 * </ul>
 *
 * <p>⚠️ Kalp <b>ekstrüde bir şekildir</b>, yazı tipi karakteri değil: drei'nin
 * {@code Text}'i bir font dosyası indirir ve o dosyada ♥ glifinin bulunacağının
 * garantisi yok — glif yoksa ekranda boş bir kutu çıkardı.
 *
 * <p>⚠️ Sayı {@code liked}/{@code count} <b>dışarıdan</b> gelir. İyimser
 * güncelleme sayfada yapılır: burada kendi state'ini tutsaydı sunucu hatasında
 * ekran gerçeğe dönemezdi.
 */
function StoreLikeButton({
  store,
  liked,
  count,
  position,
  onToggle,
}: {
  store: WorldStore
  liked: boolean
  count: number
  position: [number, number, number]
  onToggle: () => void
}) {
  /** Kalbin dış hattı — bir kez üretilir, her mağazada aynı geometri. */
  const heart = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, -0.32)
    shape.bezierCurveTo(0.42, 0.02, 0.34, 0.42, 0.1, 0.42)
    shape.bezierCurveTo(0.02, 0.42, 0, 0.36, 0, 0.3)
    shape.bezierCurveTo(0, 0.36, -0.02, 0.42, -0.1, 0.42)
    shape.bezierCurveTo(-0.34, 0.42, -0.42, 0.02, 0, -0.32)
    return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 12 })
  }, [])

  /* Beğenildiğinde kalp hafifçe büyür ve parlar — geri bildirim ANINDA
     olmalı, sunucunun cevabını beklemeden (iyimser güncelleme sayfada). */
  const scale = liked ? 1.12 : 1

  return (
    <group position={position}>
      {/* Cam plaka — mağazanın yeni cam diliyle aynı malzeme. */}
      <mesh
        /* 🔴 Nişangâhın hedefi: `Crosshair` bu alanı okur. */
        userData={{ likeStore: store }}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        <boxGeometry args={[1.1, 1.1, 0.08]} />
        <GlassSurface tint={PALETTE.glassWarm} opacity={0.5} />
      </mesh>
      {/* Plakanın alüminyum kenarı */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[1.18, 1.18, 0.03]} />
        <meshStandardMaterial color={PALETTE.alu} roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Kalp */}
      <mesh position={[0, 0.14, 0.06]} scale={[scale, scale, 1]} geometry={heart}>
        <meshStandardMaterial
          color={liked ? '#ff3b5c' : '#ffffff'}
          emissive={liked ? '#ff3b5c' : '#c8ced6'}
          emissiveIntensity={liked ? 0.9 : 0.25}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
      <Text
        position={[0, -0.34, 0.06]}
        fontSize={0.19}
        color="#14181c"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {String(count)}
      </Text>
    </group>
  )
}

/**
 * Raftaki tek bir ürün — gönderi fotoğrafı, beyaz kutu üstünde.
 *
 * <p>⚠️ Doku {@link useSafeTexture} ile gelir: <b>askıya almaz, fırlatmaz</b>.
 * Fotoğraf gelmezse kutu yeşil bir kapakla çizilir ve mağaza yine ayakta kalır.
 */
function ShelfProduct({
  item,
  store,
  position,
  onOpen,
}: {
  item: WorldShelfItem
  /** Işın testinin kutuya iliştirdiği bağlam — {@link Crosshair} okur. */
  store: WorldStore
  position: [number, number, number]
  onOpen: (item: WorldShelfItem) => void
}) {
  const texture = useSafeTexture(item.imageUrl)

  return (
    <group position={position}>
      {/*
        Kutu gövdesi — fotoğraftaki raflarda duran küçük ürün kutuları.

        🔴 11 Ağu 2026 — `onPointerOver` ile vurgu KALDIRILDI. Fare kilidi
        devredeyken imleç ekranda hareket etmez, `pointermove` hiç gelmez ve
        R3F'in ışın testi hiç çalışmaz: kutular bu yüzden yeşil yanmıyordu.
        Vurgu artık `Crosshair`ın işi — ekranın ortasından ışın atıyor ve
        `emissive` alanını doğrudan boyuyor.

        ⚠️ `onClick` DURUYOR: dokunmatikte fare kilidi yoktur ve parmakla
        doğrudan rafa dokunmak hâlâ en doğal yol. Masaüstünde tıklama
        nişangâh üzerinden sayfada karşılanıyor.
      */}
      <mesh
        castShadow
        userData={{ shelfItem: item, store }}
        onClick={(e) => {
          e.stopPropagation()
          onOpen(item)
        }}
      >
        <boxGeometry args={[0.5, 0.5, 0.32]} />
        <meshStandardMaterial color="#ffffff" roughness={0.55} metalness={0.05} />
      </mesh>

      {/*
        Ön yüzdeki fotoğraf (ya da yer tutucu kapak).

        🔴 15 Ağu 2026 — FOTOĞRAF ARTIK HEDEFLENEBİLİR (bildirilen hata:
        *"raftaki ürünlere hover zor oluyor, fotoğraf kısmını da hovera ekle;
        işaret ürün fotoğrafının üstündeyken tıklayınca ürün detayı gelsin"*).

        <b>Kök neden:</b> bu düzlem kutunun ÖNÜNDE duruyor (z 0,162 > 0,16) ve
        `userData` TAŞIMIYORDU. `Crosshair` ışını ilk katı yüzeyde durur; ilk
        çarptığı şey bu düzlemdi, üstünde `shelfItem` bulamayınca hedefi
        <b>yok</b> sayıyordu. Yani ürünün tam ortasına bakmak çalışmıyor,
        yalnız fotoğrafın DIŞINDA kalan ince kutu kenarına nişan alınca
        tutuyordu — "hover zor" tarifi birebir buydu.

        🔴 Malzeme `meshBasicMaterial`den `meshStandardMaterial`e çevrildi.
        Sebep: vurgu `emissive` ile yapılıyor ve `MeshBasicMaterial`in
        `emissive` alanı **yoktur** — `Crosshair` ona dokunmaya çalışsa
        çalışma zamanında patlardı.
        ⚠️ Fotoğraf yine de sahne ışığından ETKİLENMEZ: `color` siyah,
        görsel `emissiveMap` olarak veriliyor, yani yüzey kendi kendine
        aydınlanıyor. Bunun güzel bir yan etkisi var — `Crosshair` `emissive`i
        yeşile çevirince fotoğraf da yeşile boyanıyor ve hedef **açıkça**
        görünüyor.
      */}
      <mesh
        position={[0, 0, 0.162]}
        userData={{ shelfItem: item, store }}
        onClick={(e) => {
          e.stopPropagation()
          onOpen(item)
        }}
      >
        <planeGeometry args={[0.44, 0.44]} />
        {texture ? (
          <meshStandardMaterial
            color="#000000"
            emissive="#ffffff"
            emissiveMap={texture}
            toneMapped={false}
          />
        ) : (
          <meshStandardMaterial color={PALETTE.limeDeep} roughness={0.6} />
        )}
      </mesh>

      {/* Kutu kapağındaki ince yeşil şerit — fotoğraftaki marka detayı. */}
      <mesh position={[0, 0.255, 0]}>
        <boxGeometry args={[0.5, 0.015, 0.32]} />
        <meshStandardMaterial color={PALETTE.lime} emissive={PALETTE.lime} emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

/**
 * Bir raf ünitesi — dört kat tahta + altlarında şerit aydınlatma.
 *
 * <p>Fotoğrafta raflar duvara gömülü nişler hâlinde ve <b>her katın altında
 * bir ışık şeridi</b> var; ürünler o ışıkla aydınlanıyor. Şerit burada
 * `emissive` bir çubuk + kata düşen zayıf bir nokta ışıkla taklit ediliyor.
 *
 * <p>⚠️ Kat başına gerçek ışık koymak pahalı olurdu (mağaza × kat × cadde).
 * Raf başına <b>tek</b> nokta ışık var, gölge üretmiyor.
 */
/**
 * <b>Oyuncu bu mağazanın yakınında mı?</b> (97. tur, 2. bölüm)
 *
 * <h3>🔴 Kök neden: ÇOK FAZLA IŞIK — "WebGL bağlamı kayboldu"</h3>
 * <p>Bildirilen hata: *"bazen 3B evreni yüklenmiyor, ya bembeyaz ya mavi
 * kalıyor"*; konsolda <b>`THREE.WebGLRenderer: Context Lost`</b>.
 *
 * <p>Sebep sahnedeki <b>ışık sayısıydı</b>. Her mağazada <b>dokuz</b> nokta
 * ışığı var (podyum · vitrin · tabela · kapı · tezgâh · televizyon · iki raf ·
 * tavan). 20 mağazalık bir caddede bu <b>180 ışık</b> eder ve three.js
 * <b>ışık sayısına göre shader derler</b>: tek bir malzeme için üretilen
 * program devleşir, GPU'nun tekdüze (uniform) sınırı aşılır ve sürücü bağlamı
 * <b>düşürür</b>. "Bazen oluyor bazen olmuyor" tam olarak bunun imzasıdır —
 * mağaza sayısına, sürücüye ve o anki GPU belleğine göre değişir.
 *
 * <p>Çözüm: ışıklar <b>yalnız yakındaki</b> mağazalarda kurulur. Uzaktaki
 * dükkânın iç aydınlatması zaten görünmüyordu; ödenen bedel tamamen boştu.
 *
 * <p>⚠️ Ölçüm <b>her karede</b> yapılır ama state yalnız <b>eşik
 * geçildiğinde</b> yazılır: her karede state yazmak sahneyi saniyede 60 kez
 * yeniden çizerdi.
 *
 * <p>⚠️ Eşikte <b>histerezis</b> var (girişte 30 m, çıkışta 34 m): tek bir
 * sınır olsaydı, oyuncu tam o mesafede dururken ışıklar açılıp kapanarak
 * <b>titrer</b> ve her seferinde shader yeniden derlenirdi.
 */
function useNearby(x: number, z: number) {
  const [near, setNear] = useState(false)
  const nearRef = useRef(false)

  useFrame(({ camera }) => {
    const d = Math.hypot(camera.position.x - x, camera.position.z - z)
    const next = nearRef.current ? d < 34 : d < 30
    if (next !== nearRef.current) {
      nearRef.current = next
      setNear(next)
    }
  })

  return near
}

function ShelfUnit({
  items,
  store,
  position,
  rotationY,
  lit,
  onOpen,
}: {
  items: WorldShelfItem[]
  store: WorldStore
  position: [number, number, number]
  rotationY: number
  /** Oyuncu yakında mı — ışık yalnız o zaman kurulur ({@link useNearby}). */
  lit: boolean
  onOpen: (item: WorldShelfItem) => void
}) {
  const rows = 4
  const perRow = 3
  const boardWidth = 2.6
  const boardGap = 0.72
  const baseY = 0.7

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Nişin arka paneli — raflar duvara gömülü görünsün. */}
      <mesh position={[0, baseY + (rows * boardGap) / 2 - 0.35, -0.24]} receiveShadow>
        <boxGeometry args={[boardWidth + 0.24, rows * boardGap + 0.5, 0.06]} />
        <meshStandardMaterial color={PALETTE.bodyDark} roughness={0.85} />
      </mesh>

      {Array.from({ length: rows }).map((_, r) => (
        <group key={r} position={[0, baseY + r * boardGap, 0]}>
          {/* Raf tahtası */}
          <mesh position={[0, -0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[boardWidth, 0.05, 0.42]} />
            <meshStandardMaterial color={PALETTE.shelf} roughness={0.7} />
          </mesh>
          {/* Tahtanın altındaki ışık şeridi */}
          <mesh position={[0, -0.34, 0.19]}>
            <boxGeometry args={[boardWidth - 0.1, 0.025, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive="#fff8e6" emissiveIntensity={2.2} />
          </mesh>

          {items.slice(r * perRow, r * perRow + perRow).map((item, i) => (
            <ShelfProduct
              /*
                🔴 15 Ağu 2026 — `key={item.postId}` İDİ ve BOZUKTU.
                Mağazaya özel (CUSTOM) üründe `postId` **null**; iki özel ürün
                aynı `null` anahtarı paylaşınca React onları aynı öğe sanıp
                birleştiriyor ve raftaki ürünlerin bir kısmı hiç çizilmiyordu.
                Konum + sıra her zaman benzersiz.
              */
              key={item.postId ?? `${r}-${i}`}
              item={item}
              store={store}
              position={[-boardWidth / 2 + 0.55 + i * 0.78, 0, 0.02]}
              onOpen={onOpen}
            />
          ))}
        </group>
      ))}

      {/* Rafın tamamını yıkayan tek yumuşak ışık.
          🔴 Yalnız oyuncu yakındayken kurulur — gerekçe {@link useNearby}. */}
      {lit && (
        <pointLight
          position={[0, baseY + (rows * boardGap) / 2, 0.9]}
          intensity={5}
          distance={4.5}
          color="#fff4dd"
        />
      )}
    </group>
  )
}

/**
 * <b>Tek bir mağaza</b> — referans fotoğrafın birebir karşılığı.
 *
 * <pre>
 *      ╔══════════════════════╗  ← füme düz çatı, altında beyaz ışık hattı
 *      ║  (W) Waydee          ║  ← beyaz tabela bandı + yuvarlak yeşil rozet
 *      ╟────┬──────────┬──────╢
 *      │ ▪ │ ▁▁▁▁▁▁▁▁ │ ▤▤▤ │  ← sol: siyah 4 satırlık pano
 *      │ ▪ │ [ camlı ] │ ▤▤▤ │    orta: siyah tente + camlı çift kapı
 *      │ ▪ │ [ kapı  ] │ ▤▤▤ │    sağ: raflı vitrin camı
 *      └───┴───🌿🌿────┴──────┘  ← basamaklar + saksılar
 * </pre>
 *
 * <h3>Cephe hangi yöne bakar?</h3>
 * <p>Model kendi yerel uzayında hep "+z'ye bakan" kurulur ve grup döndürülür.
 * Sağ yaka −x'e, sol yaka +x'e bakar — her yaka için ayrı model yazmak iki
 * kopya demekti.
 *
 * <p>⚠️ Ön duvar <b>üç parçadır</b> (sol · sağ · kapı üstü lento): tek parça
 * yapıp ortasına delik açmak CSG gerektirir; üç kutu hem ucuz hem çarpışma
 * hesabıyla birebir uyumlu.
 */
export function StoreBuilding({
  store,
  inside = false,
  liked = false,
  likeCount,
  onToggleLike,
  onOpenPost,
}: {
  store: WorldStore
  /** Oyuncu ŞU AN bu dükkânın içinde mi — müzik buna bağlı. */
  inside?: boolean
  /**
   * Bu mağaza beğenilmiş mi (97. tur).
   * ⚠️ Sunucudan gelen `store.likedByMe` DEĞİL, sayfanın iyimser durumu:
   * kalbe basınca dolmasını sunucunun cevabına bağlamak, düğmeyi "geç
   * tepki veren" bir düğme yapardı.
   */
  liked?: boolean
  /** Beğeni sayısı — sayfanın iyimser sayacı. */
  likeCount?: number
  onToggleLike?: () => void
  onOpenPost: (item: WorldShelfItem) => void
}) {
  const { width: W, depth: D, height: H, doorWidth: DW, doorHeight: DH, wall: T } = STORE

  /**
   * Işık şiddeti çarpanı — stüdyodaki yüzde değerinden türer (100 = 1×).
   *
   * ⚠️ Tavan 200'de sınırlı (sunucu da öyle doğruluyor): daha fazlası ACES ton
   * eşlemesinde her şeyi bembeyaza doyurur ve dükkânın içi <b>okunamaz</b> olur.
   */
  const lightScale = Math.max(0, Math.min(store.studio.lightIntensity, 200)) / 100

  /**
   * 🔴 Bu mağazanın ışıkları kurulsun mu (97. tur, 2. bölüm).
   * Gerekçe ve ölçülen hata {@link useNearby}'de — kısaca: 20 mağaza × 9 ışık
   * = 180 ışık, three.js bunları shader'a gömüyor ve GPU bağlamı düşüyor.
   */
  const lit = useNearby(store.x, store.z)

  const rotationY = store.side === 'RIGHT' ? -Math.PI / 2 : Math.PI / 2
  /** Ön duvarın kapı yanındaki parçalarının genişliği. */
  const sideWidth = (W - DW) / 2
  /** Sol/sağ parçaların merkez konumu. */
  const sideX = DW / 2 + sideWidth / 2

  /* Vurgu şeridi hafifçe nefes alır — cadde "donmuş" görünmesin.
     ⚠️ Yalnız `emissiveIntensity`; konum/ölçek animasyonu bu projede
     framer-motion'da defalarca takıldı ve burada da gereksiz. */
  const limeRef = useRef<THREE.MeshStandardMaterial>(null)

  /*
   * 🔴 KAYAN KAPI (11 Ağu 2026, kullanıcı isteği: *"kapıya yaklaşınca kapı
   * yana doğru açılsın"*). Kanatlar yerel x ekseninde dışa kayar ve ön
   * duvarın yan parçalarının ARDINA girer — gerçek otomatik kapı gibi.
   *
   * ⚠️ Açık/kapalı bir DURUM (state) DEĞİL: 60 Hz'de state yazmak sahneyi
   * düşürürdü. Hedef konum her karede uzaklıktan hesaplanıyor ve kanat oraya
   * yumuşakça yaklaşıyor.
   *
   * ⚠️ Çarpışma DEĞİŞMEZ — kapı boşluğu zaten hep açıktı (bkz. `Player`).
   * Kanatlar salt görseldir; kapalıyken içeri yürünebilmesi bilinçli, aksi
   * hâlde kapı geç açılırsa oyuncu duvara toslamış gibi olurdu.
   */
  const leftDoor = useRef<THREE.Group>(null)
  const rightDoor = useRef<THREE.Group>(null)
  /** Kanadın kayabileceği azami mesafe — kapı boşluğunu tam boşaltır. */
  const slide = DW / 2 - 0.06

  useFrame(({ clock, camera }, rawDelta) => {
    if (limeRef.current) {
      limeRef.current.emissiveIntensity =
        1.1 + Math.sin(clock.elapsedTime * 1.2 + store.slot) * 0.25
    }

    /* Kapının dünya konumu: cephenin ortası. */
    const facing = store.side === 'RIGHT' ? -1 : 1
    const doorX = store.x + facing * (STORE.depth / 2)
    const near =
      Math.hypot(camera.position.x - doorX, camera.position.z - store.z) < DOOR_OPEN_RANGE

    /* ⚠️ Delta sınırlanır: sekme arka plandayken tek karede kanat hedefi
       aşıp duvarın içine kayıyordu. */
    const k = 1 - Math.pow(0.0015, Math.min(rawDelta, 0.05))
    const target = near ? slide : 0
    if (leftDoor.current) {
      leftDoor.current.position.x = THREE.MathUtils.lerp(
        leftDoor.current.position.x,
        -DW / 4 - target,
        k,
      )
    }
    if (rightDoor.current) {
      rightDoor.current.position.x = THREE.MathUtils.lerp(
        rightDoor.current.position.x,
        DW / 4 + target,
        k,
      )
    }
  })

  const [leftItems, rightItems] = useMemo(
    () => [store.shelf.slice(0, 12), store.shelf.slice(12, 24)],
    [store.shelf],
  )

  return (
    <group position={[store.x, 0, store.z]} rotation={[0, rotationY, 0]}>
      {/* ══ KAİDE — fotoğraftaki basamaklı gri platform ══ */}
      <mesh position={[0, STORE.podium / 2, 0.8]} receiveShadow castShadow>
        <boxGeometry args={[W + 2.0, STORE.podium, D + 2.6]} />
        <meshStandardMaterial color={PALETTE.podium} roughness={0.8} />
      </mesh>
      {/* Kaidenin çevresini saran yeşil ışık hattı (fotoğrafta zemine vuruyor) */}
      <mesh position={[0, 0.05, 0.8 + (D + 2.6) / 2 + 0.01]}>
        <boxGeometry args={[W + 2.0, 0.07, 0.02]} />
        <meshStandardMaterial color={PALETTE.lime} emissive={PALETTE.lime} emissiveIntensity={2.4} />
      </mesh>
      {/* Zemine düşen yeşil yansıma */}
      {lit && (
        <pointLight position={[0, 0.25, 0.8 + (D + 2.6) / 2]} intensity={4} distance={5} color={PALETTE.lime} />
      )}

      {/* ══ BASAMAKLAR — kapının önünde iki kademe, kenarları yeşil ══ */}
      {[0, 1].map((i) => {
        const y = STORE.podium - (i + 1) * (STORE.podium / 2.5)
        const z = D / 2 + 1.05 + i * 0.42
        return (
          <group key={i}>
            <mesh position={[0, y + 0.09, z]} receiveShadow castShadow>
              <boxGeometry args={[DW + 1.6, 0.18, 0.42]} />
              <meshStandardMaterial color={PALETTE.podiumStep} roughness={0.85} />
            </mesh>
            <mesh position={[0, y + 0.185, z + 0.211]}>
              <boxGeometry args={[DW + 1.6, 0.035, 0.02]} />
              <meshStandardMaterial color={PALETTE.lime} emissive={PALETTE.lime} emissiveIntensity={1.6} />
            </mesh>
          </group>
        )
      })}

      <group position={[0, STORE.podium, 0]}>
        {/* ══ İÇ ZEMİN — açık ahşap/laminat ══ */}
        <mesh position={[0, 0.012, 0]} receiveShadow>
          <boxGeometry args={[W, 0.024, D]} />
          <meshStandardMaterial color={PALETTE.floor} roughness={0.45} metalness={0.05} />
        </mesh>

        {/* ══ DUVARLAR ══ */}
        <mesh position={[0, H / 2, -D / 2]} castShadow receiveShadow>
          <boxGeometry args={[W, H, T]} />
          <meshStandardMaterial color={PALETTE.interior} roughness={0.9} />
        </mesh>
        {/* 🔴 YAN DUVARLAR CAM (97. tur). Gölge üretmezler — gerekçe
            {@link GlassSurface}. Alt ve üstlerinde alüminyum çıta var:
            kenarsız cam, bittiği yer belli olmadığı için "duvar yok" gibi
            okunuyordu. */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[(s * W) / 2, H / 2, 0]} receiveShadow>
              <boxGeometry args={[T, H, D]} />
              <GlassSurface />
            </mesh>
            {[0.06, H - 0.06].map((y) => (
              <mesh key={y} position={[(s * W) / 2, y, 0]}>
                <boxGeometry args={[T * 1.4, 0.09, D]} />
                <meshStandardMaterial color={PALETTE.alu} roughness={0.28} metalness={0.85} />
              </mesh>
            ))}
          </group>
        ))}

        {/* ══ ÖN DUVAR: sol parça · sağ parça · kapı üstü lento ══ */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * sideX, H / 2, D / 2]} receiveShadow>
              <boxGeometry args={[sideWidth, H, T]} />
              <GlassSurface tint={PALETTE.glassWarm} opacity={0.3} />
            </mesh>
            {/* Cephe camının dikey alüminyum çıtası — panelin bittiği yer. */}
            <mesh position={[s * (sideX + sideWidth / 2), H / 2, D / 2]}>
              <boxGeometry args={[0.08, H, T * 1.4]} />
              <meshStandardMaterial color={PALETTE.aluDark} roughness={0.3} metalness={0.9} />
            </mesh>
          </group>
        ))}
        {/* Kapı üstü lento — cam, altında ince alüminyum kaş. */}
        <mesh position={[0, DH + (H - DH) / 2, D / 2]}>
          <boxGeometry args={[DW, H - DH, T]} />
          <GlassSurface tint={PALETTE.glassWarm} opacity={0.3} />
        </mesh>
        <mesh position={[0, DH + 0.03, D / 2]}>
          <boxGeometry args={[DW, 0.07, T * 1.5]} />
          <meshStandardMaterial color={PALETTE.alu} roughness={0.28} metalness={0.85} />
        </mesh>

        {/* ══ SAĞ CEPHE: raflı vitrin — siyah çerçeveli büyük cam ══ */}
        <group position={[sideX, FASCIA_MID, D / 2]}>
          {/* Siyah çerçeve */}
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[sideWidth - 0.35, FASCIA_H, 0.06]} />
            <meshStandardMaterial color={PALETTE.frame} roughness={0.5} metalness={0.35} />
          </mesh>
          {/* Cam yüzey — çerçevenin içi */}
          <mesh position={[0, 0, 0.07]}>
            <planeGeometry args={[sideWidth - 0.55, FASCIA_H - 0.2]} />
            {/* 🔴 97. tur — cam artık TEK yerden gelir ({@link GlassSurface}).
                Kopyalanan malzeme ayarları zamanla ayrışıyor ve aynı dükkânın
                iki camı farklı görünüyordu (95. turdaki `gradientPartner`
                dersinin birebir aynısı). */}
            <GlassSurface tint={PALETTE.glassCool} opacity={0.22} roughness={0.03} />
          </mesh>
          {/* Vitrinin içindeki raflar — dışarıdan görünür (fotoğraftaki gibi) */}
          {[-0.58, -0.03, 0.52].map((y) => (
            <group key={y} position={[0, y, -0.35]}>
              <mesh castShadow>
                <boxGeometry args={[sideWidth - 0.6, 0.05, 0.34]} />
                <meshStandardMaterial color={PALETTE.shelf} roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.04, 0.16]}>
                <boxGeometry args={[sideWidth - 0.7, 0.02, 0.015]} />
                <meshStandardMaterial color="#ffffff" emissive="#fff6e0" emissiveIntensity={2} />
              </mesh>
              {/* Vitrindeki ürün kutuları */}
              {[-0.55, 0, 0.55].map((x) => (
                <mesh key={x} position={[x, 0.19, -0.02]} castShadow>
                  <boxGeometry args={[0.34, 0.3, 0.22]} />
                  <meshStandardMaterial color={PALETTE.frame} roughness={0.6} />
                </mesh>
              ))}
            </group>
          ))}
          {lit && <pointLight position={[0, 0, 0.4]} intensity={5} distance={4} color="#fff3d8" />}
        </group>

        {/* ══ SOL CEPHE: siyah bilgi panosu (fotoğraftaki 4 satırlık liste) ══ */}
        <group position={[-sideX, FASCIA_MID, D / 2 + 0.05]}>
          {/* Yeşil ince çerçeve */}
          <RoundedBox args={[sideWidth - 0.42, FASCIA_H, 0.05]} radius={0.06} smoothness={3}>
            <meshStandardMaterial color={PALETTE.lime} emissive={PALETTE.lime} emissiveIntensity={0.6} />
          </RoundedBox>
          {/* Siyah pano */}
          <RoundedBox
            args={[sideWidth - 0.54, FASCIA_H - 0.12, 0.05]}
            radius={0.05}
            smoothness={3}
            position={[0, 0, 0.02]}
          >
            {/* 🔴 Cephe panosunun rengi stüdyodan gelir (varsayılan #111315). */}
            <meshStandardMaterial color={store.studio.facadeColor} roughness={0.55} />
          </RoundedBox>

          {/* Dört satır: kategori · sahibi · beğeni · ürün sayısı.
              ⚠️ `outlineWidth` yok — drei `Text` konturu ayrı bir geçiş
              kurar ve mağaza sayısıyla çarpılıyor. Kontrast zaten yüksek. */}
          {[
            /* ⚠️ Kategori artık null olabilir (başvuru dört alana indi).
               Boş bırakmak panoda ölü bir satır bırakırdı; yerine tanıtım
               cümlesi yazılıyor, o da yoksa mağaza adı. */
            store.categoryLabel ?? store.tagline ?? store.title,
            `@${store.ownerUsername}`,
            `${store.likeCount} beğeni`,
            `${store.shelf.length} ürün`,
          ].map((line, i) => (
            /* Dört satır panonun İÇİNE ortalanır: üstten aşağı, aralık
               yükseklikten türetilir. 🔴 11 Ağu 2026 — sabit 0,82/0,55
               değerleri pano kısaldığında ilk satırı bandın ARDINA
               itiyordu ("E-ticaret yarım kalıyor"). */
            <group key={line} position={[0, (ROW_GAP * 3) / 2 - i * ROW_GAP, 0.05]}>
              {/* Satır başındaki yeşil nokta (fotoğraftaki ikonların yerinde) */}
              <mesh position={[-(sideWidth - 0.54) / 2 + 0.24, 0, 0]}>
                <circleGeometry args={[0.068, 20]} />
                <meshStandardMaterial color={PALETTE.lime} emissive={PALETTE.lime} emissiveIntensity={0.8} />
              </mesh>
              <Text
                position={[0.12, 0, 0]}
                fontSize={0.17}
                maxWidth={sideWidth - 1.05}
                color={i === 1 ? PALETTE.lime : '#ffffff'}
                anchorX="center"
                anchorY="middle"
              >
                {line}
              </Text>
            </group>
          ))}
        </group>

        {/* ══ SİYAH TENTE — kapının üstünde öne çıkan saçak ══ */}
        <mesh position={[0, DH + 0.16, D / 2 + 0.42]} castShadow>
          <boxGeometry args={[DW + 0.5, 0.3, 0.95]} />
          <meshStandardMaterial color={PALETTE.roof} roughness={0.6} />
        </mesh>
        {/* Tentenin altındaki sıcak spot — girişi aydınlatır */}
        {lit && <pointLight position={[0, DH - 0.1, D / 2 + 0.35]} intensity={9} distance={5} color="#ffeccd" />}

        {/* ══ CAMLI ÇİFT KAPI ══ */}
        {[-1, 1].map((s) => (
          <group key={s} ref={s === -1 ? leftDoor : rightDoor} position={[(s * DW) / 4, DH / 2, D / 2]}>
            {/* Siyah kanat çerçevesi */}
            {/* 🔴 97. tur — kanat çerçevesi siyahtan FIRÇALI ALÜMİNYUMA
                çevrildi: cam gövdenin yanında siyah çerçeve, dükkânı yeniden
                "koyu kutu" gibi gösteriyordu. */}
            <mesh>
              <boxGeometry args={[DW / 2 - 0.04, DH, 0.06]} />
              <meshStandardMaterial color={PALETTE.aluDark} roughness={0.3} metalness={0.9} />
            </mesh>
            {/* Cam
                ⚠️ Kapı kanatları GÖRSELDİR — çarpışma yok. Oyuncu aradan
                yürüyerek girer; "kapıyı aç" adımı FPS gezintisinde gereksiz
                bir sürtünmeydi. */}
            <mesh position={[0, 0, 0.035]}>
              <planeGeometry args={[DW / 2 - 0.18, DH - 0.16]} />
              <GlassSurface tint={PALETTE.glassCool} opacity={0.18} roughness={0.02} />
            </mesh>
            {/* Dikey uzun kol (fotoğraftaki siyah barlar) */}
            <mesh position={[-s * 0.16, -0.15, 0.08]}>
              <boxGeometry args={[0.055, 1.25, 0.055]} />
              <meshStandardMaterial color="#0d0f11" metalness={0.75} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {/* ══ TABELA BANDI — beyaz kap, yuvarlak yeşil rozet, koyu ad ══ */}
        <group position={[0, H - 0.62, D / 2 + 0.09]}>
          <RoundedBox args={[W - 0.1, 1.15, 0.14]} radius={0.05} smoothness={3} castShadow>
            <meshStandardMaterial color="#fbfcfc" roughness={0.35} />
          </RoundedBox>
          {/* 🔴 11 Ağu 2026 — rozette MAĞAZANIN KENDİ LOGOSU var (başvuruda
              yüklenen `logoMediaId`). Önce Waydee işareti duruyordu: bu
              caddedeki her dükkânın tabelasına aynı markayı asmak demekti,
              oysa bunlar başkalarının mağazaları.
              ⚠️ Silindir varsayılan olarak Y ekseninde durur; yüze bakması
              için MESH döndürülür — geometrinin `rotation`'ı yoktur. */}
          <mesh position={[-(W / 2) + 1.0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.05, 40]} />
            <meshStandardMaterial color={PALETTE.lime} emissive={PALETTE.lime} emissiveIntensity={0.55} />
          </mesh>
          <StoreBadge store={store} position={[-(W / 2) + 1.0, 0, 0.115]} />
          <Text
            position={[0.5, 0, 0.09]}
            fontSize={0.46}
            maxWidth={W - 2.6}
            color="#14181c"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            {store.title}
          </Text>
        </group>

        {/* ══ ÇATI — füme kapak + altında beyaz ışık hattı ══ */}
        <mesh position={[0, H + 0.26, 0.32]} castShadow receiveShadow>
          <boxGeometry args={[W + 1.0, 0.5, D + 1.25]} />
          <meshStandardMaterial color={PALETTE.roof} roughness={0.75} />
        </mesh>
        {/* Çatının ön kenarındaki koyu bant (fotoğraftaki keskin çizgi) */}
        <mesh position={[0, H + 0.26, 0.32 + (D + 1.25) / 2 + 0.01]}>
          <boxGeometry args={[W + 1.0, 0.5, 0.02]} />
          <meshStandardMaterial color={PALETTE.roofEdge} roughness={0.6} />
        </mesh>
        {/* Saçağın altındaki beyaz ışık hattı — fotoğrafta tabelayı yıkıyor */}
        <mesh position={[0, H + 0.01, D / 2 + 0.5]}>
          <boxGeometry args={[W + 0.9, 0.035, 0.12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} />
        </mesh>
        {lit && <pointLight position={[0, H - 0.1, D / 2 + 0.5]} intensity={7} distance={4.5} color="#fff8ee" />}

        {/* ══ SAĞ KÖŞEDEKİ DİKEY YEŞİL OLUKLU SÜTUN ══ */}
        <group position={[W / 2 + 0.16, H / 2 - 0.1, D / 2 - 0.5]}>
          <mesh>
            <boxGeometry args={[0.2, H - 0.2, 1.0]} />
            {/* 🔴 Vurgu sütunu da sahibinin seçtiği renkte — dükkânların
                birbirinden ayırt edilmesini sağlayan en görünür işaret. */}
            <meshStandardMaterial
              ref={limeRef}
              color={store.studio.accentColor}
              emissive={store.studio.accentColor}
            />
          </mesh>
          {/* Oluklar — fotoğraftaki dikey çizgili doku */}
          {[-0.36, -0.12, 0.12, 0.36].map((z) => (
            <mesh key={z} position={[0.11, 0, z]}>
              <boxGeometry args={[0.03, H - 0.3, 0.05]} />
              <meshStandardMaterial color={PALETTE.limeDeep} />
            </mesh>
          ))}
        </group>
        {lit && (
          <pointLight
            position={[W / 2 + 0.8, H / 2, D / 2 - 0.5]}
            intensity={6}
            distance={6}
            color={store.studio.accentColor}
          />
        )}

        {/* ══ DUVAR APLİĞİ — sağ kolonda küçük ışık (fotoğrafta var) ══ */}
        <group position={[sideX + sideWidth / 2 - 0.35, 1.75, D / 2 + 0.1]}>
          <mesh>
            <boxGeometry args={[0.12, 0.26, 0.12]} />
            <meshStandardMaterial color={PALETTE.frame} />
          </mesh>
          {lit && <pointLight position={[0, 0, 0.25]} intensity={4} distance={3} color="#ffdca8" />}
        </group>

        {/* ══ SAKSILAR — kapının iki yanında ══ */}
        {[-(DW / 2 + 0.62), DW / 2 + 0.62].map((x, i) => (
          <group key={x} position={[x, 0, D / 2 + 0.72]}>
            {/* Biri kare beton, diğeri yuvarlak beyaz — fotoğraftaki gibi. */}
            {i === 0 ? (
              <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.62, 0.52, 0.44]} />
                <meshStandardMaterial color={PALETTE.frame} roughness={0.85} />
              </mesh>
            ) : (
              <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.26, 0.2, 0.48, 24]} />
                <meshStandardMaterial color="#f4f6f7" roughness={0.6} />
              </mesh>
            )}
            {/* Bitki — birkaç küre kümesi, tek küreden daha organik. */}
            {[
              [0, 0.68, 0, 0.26],
              [0.16, 0.6, 0.1, 0.18],
              [-0.15, 0.62, -0.08, 0.19],
            ].map(([px, py, pz, r]) => (
              <mesh key={`${px}-${py}`} position={[px, py, pz]} castShadow>
                <sphereGeometry args={[r, 14, 10]} />
                <meshStandardMaterial color="#3d6b34" roughness={0.95} />
              </mesh>
            ))}
          </group>
        ))}

        {/* ══ İÇ MEKÂN: tezgâh + duvardaki logo ══ */}
        <mesh position={[0, 0.45, -D / 2 + 1.1]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.9, 0.7]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.92, -D / 2 + 1.1]}>
          <boxGeometry args={[2.7, 0.05, 0.8]} />
          <meshStandardMaterial color={PALETTE.bodyDark} roughness={0.3} metalness={0.15} />
        </mesh>
        {/*
          🔴 15 Ağu 2026 — KASA ARKASINDAKİ TELEVİZYON (kullanıcı isteği:
          "mağazada kasanın arkasında bir televizyonda o video oynatılacak").

          Konum tezgâhtan TÜRETİLİYOR: tezgâh `-D/2 + 1.1`'de ve 0,9 m yüksek;
          televizyon onun arkasındaki duvara, göz hizasının hemen üstüne
          gelir. Sabit bir sayı yazmak, tezgâh oynayınca ekranın havada
          kalmasına yol açardı (76. turdaki cephe panosu dersi).

          ⚠️ Marka rozeti televizyon varken YUKARI kayar; ikisi aynı yerde
          çakışıyordu. Video yoksa rozet eski yerinde kalır.
        */}
        {/* 🔴 97. tur, 2. bölüm — televizyon YALNIZ YAKINDA kurulur.
            Her açık televizyon bir video çözücü (decoder) ve her karede
            yenilenen bir doku demektir; caddedeki 20 dükkânın hepsi aynı anda
            video oynatınca GPU belleği doluyor ve bağlam düşüyordu (aynı
            olayın ikinci kaynağı — ilki ışıklar, bkz. {@link useNearby}).
            ⚠️ Rozetin konumu DEĞİŞMEZ: televizyon uzakta çizilmese de o
            mağazanın televizyonu VARDIR; rozet yer değiştirseydi caddede
            yürürken duvardaki işaret zıplardı. */}
        {store.studio.tvOn && store.studio.videoUrl ? (
          <>
            {lit && <StoreTv
              url={store.studio.videoUrl}
              muted={store.studio.tvMuted}
              width={2.6}
              height={1.46}
              position={[0, 1.95, -D / 2 + T + 0.06]}
            />}
            {/* Ekranın döktüğü mavimsi ışık — karanlık dükkânda gerçekçilik. */}
            {lit && (
              <pointLight
                position={[0, 1.95, -D / 2 + 0.9]}
                intensity={3.5}
                distance={4.5}
                color="#9fd0ff"
              />
            )}
            <mesh position={[0, 3.25, -D / 2 + T]}>
              <circleGeometry args={[0.36, 40]} />
              <meshStandardMaterial
                color={store.studio.accentColor}
                emissive={store.studio.accentColor}
                emissiveIntensity={0.5}
              />
            </mesh>
            <StoreBadge store={store} position={[0, 3.25, -D / 2 + T + 0.02]} size={0.52} />
          </>
        ) : (
          <>
            {/* Arka duvardaki yuvarlak marka işareti (televizyon yokken) */}
            <mesh position={[0, 2.3, -D / 2 + T]}>
              <circleGeometry args={[0.5, 40]} />
              <meshStandardMaterial
                color={store.studio.accentColor}
                emissive={store.studio.accentColor}
                emissiveIntensity={0.5}
              />
            </mesh>
            <StoreBadge store={store} position={[0, 2.3, -D / 2 + T + 0.02]} size={0.74} />
          </>
        )}

        {/*
          Mağaza müziği — dükkâna yaklaşınca duyulur. Görsel bir karşılığı
          yoktur, bu yüzden `null` döndürür ve sahnede yer kaplamaz.
        */}
        {/*
          🔴 15 Ağu 2026 — MÜZİK YALNIZ İÇERİDE ÇALAR (kullanıcı isteği:
          "müzik mağaza kapısından içeri girdikten sonra çalacak").

          Eskiden mesafeye göre açılıyordu ve caddede yürürken de duyuluyordu;
          kırk dükkânlık bir caddede bu bir uğultuya dönüşüyordu.

          ⚠️ Bileşen `inside` false iken HİÇ kurulmaz: `preload` bile
          başlamaz, yani caddeye girer girmez kırk ses dosyası indirilmez.
        */}
        {inside && store.studio.musicOn && store.studio.musicUrl && (
          <StoreMusic
            url={store.studio.musicUrl}
            volume={store.studio.musicVolume}
            /* ⚠️ Dinleyici mesafesi DÜNYA uzayında ölçülür; mağazanın kendi
               yerel uzayı döndürülmüş olduğu için kaynak noktası mağazanın
               cadde üzerindeki gerçek konumudur. */
            position={[store.x, 1.5, store.z]}
          />
        )}

        {/*
          ══ TAVAN AYDINLATMASI — sahibinin stüdyodan seçtiği renk ve şiddet ══

          🔴 15 Ağu 2026: renk ve şiddet artık sabit değil, `studio`'dan gelir.
          Şiddet yüzde olarak saklanır (100 = varsayılan) ve burada çarpana
          çevrilir — kullanıcıya "16 birim ışık" demek anlamsız, "%140" anlamlı.

          ⚠️ `emissiveIntensity` de ölçekleniyor: yalnız `pointLight`
          değiştirilseydi, ışık kısılınca panellerin kendisi hâlâ bembeyaz
          parlar ve tavan "kapalı ama yanıyor" gibi görünürdü.
        */}
        {[-1.6, 1.6].map((x) => (
          <mesh key={x} position={[x, H - 0.14, -0.4]}>
            <boxGeometry args={[0.35, 0.04, D - 2.2]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={store.studio.lightColor}
              emissiveIntensity={2.6 * lightScale}
            />
          </mesh>
        ))}
        {lit && (
          <pointLight
            position={[0, H - 0.6, -0.6]}
            intensity={16 * lightScale}
            distance={11}
            color={store.studio.lightColor}
          />
        )}

        {/* ══ İÇ RAFLAR: iki yan duvara dayalı ══ */}
        <ShelfUnit
          items={leftItems}
          store={store}
          position={[-W / 2 + 0.5, 0, -0.6]}
          rotationY={Math.PI / 2}
          lit={lit}
          onOpen={onOpenPost}
        />
        {rightItems.length > 0 && (
          <ShelfUnit
            items={rightItems}
            store={store}
            position={[W / 2 - 0.5, 0, -0.6]}
            rotationY={-Math.PI / 2}
            lit={lit}
            onOpen={onOpenPost}
          />
        )}

        {/*
          ══ MAĞAZA BEĞENİSİ — kalp düğmesi (97. tur) ══

          🔴 Konum İÇERİDE ve kapıya BAKAR: dışarıdan basılabilseydi "beğeni"
          kapının önünden geçmekle aynı şey olurdu; içeri girmek, beğeniyi
          gerçekten dükkânı gezmiş birinin işareti yapıyor.

          ⚠️ Yükseklik göz hizası (1,6 m ≈ oyuncunun kamera yüksekliği):
          nişangâh yere ya da tavana bakmadan hedefleyebilmeli.
        */}
        {onToggleLike && (
          <StoreLikeButton
            store={store}
            liked={liked}
            count={likeCount ?? store.likeCount}
            position={[W / 2 - 1.5, 1.6, -D / 2 + T + 0.08]}
            onToggle={onToggleLike}
          />
        )}

        {/* ══ KAPI EŞİĞİ — yeşil çizgi, girişi işaretler ══ */}
        <mesh position={[0, 0.026, D / 2 - 0.12]}>
          <boxGeometry args={[DW, 0.02, 0.45]} />
          <meshStandardMaterial color={PALETTE.lime} emissive={PALETTE.lime} emissiveIntensity={1.2} />
        </mesh>
      </group>
    </group>
  )
}
