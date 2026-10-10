import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { WorldStore } from '@/lib/marketplace'
import { STORE } from './StoreBuilding'

/** Göz yüksekliği (metre) — kaidenin üstünde durunca da bu hizada kalır. */
const EYE_HEIGHT = 1.7

/**
 * Yürüme ve koşma hızı (m/sn).
 *
 * <p>🔴 11 Ağu 2026'da artırıldı (4,2 → **6,4**). Kullanıcı: *"yürüyüş hızını
 * arttır biraz"*. Cadde sıra başına 14 m; eski hızda iki mağaza arası
 * yürümek 3,3 sn sürüyordu ve gezinti ağır hissettiriyordu.
 */
const WALK_SPEED = 6.4
const RUN_SPEED = 11.0

/** Oyuncunun yatay yarıçapı — çarpışmada bir daire gibi davranır. */
const PLAYER_RADIUS = 0.35

/** Hızın sönümlenme katsayısı — bırakınca kısa bir kayışla durur. */
const DAMPING = 11

/**
 * Bakış hassasiyeti (radyan / piksel).
 *
 * <p>Fare kilidi ve dokunmatik sürükleme <b>aynı</b> katsayıyı kullanır:
 * ikisi de "piksel başına dönüş" ölçer, farklı sayılar iki cihazda iki ayrı
 * his üretirdi.
 */
const LOOK_SENSITIVITY = 0.0026

/** Yukarı/aşağı bakış sınırı — tam tepeye bakınca kamera takla atmasın. */
const MAX_PITCH = Math.PI / 2 - 0.08

/** Eksene hizalı bir engel kutusu (dünya uzayında, yatay düzlem). */
interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/**
 * Bir mağazanın çarpışma kutuları.
 *
 * <p>🔴 Kapı boşluğu <b>bilerek</b> kutu üretmez: oyuncu oradan içeri yürür.
 * Mağazayı tek bir kutuyla kapatmak, "kapının önüne gidince gir" isteğini
 * imkânsız kılardı.
 *
 * <p>Model kendi yerel uzayında +z'ye bakar ve sahnede 90° döndürülür; yani
 * dünyada <b>derinlik x eksenine</b>, <b>cephe genişliği z eksenine</b> düşer.
 * Bu takas burada bir kez yapılır ve {@link STORE} ölçüleriyle birebir uyumludur.
 */
function storeBoxes(store: WorldStore): Box[] {
  const { width: W, depth: D, doorWidth: DW, wall: T } = STORE
  const right = store.side === 'RIGHT'
  const facing = right ? -1 : 1

  const backX = store.x + facing * -(D / 2)
  const frontX = store.x + facing * (D / 2)
  const half = W / 2
  const t = T / 2 + PLAYER_RADIUS
  const minX = Math.min(backX, frontX)
  const maxX = Math.max(backX, frontX)

  const boxes: Box[] = [
    { minX: backX - t, maxX: backX + t, minZ: store.z - half, maxZ: store.z + half },
    { minX, maxX, minZ: store.z - half - t, maxZ: store.z - half + t },
    { minX, maxX, minZ: store.z + half - t, maxZ: store.z + half + t },
  ]

  /* Ön duvarın kapı YANINDAKİ iki parçası — orta boşluk açık kalır. */
  const sideLen = (W - DW) / 2
  boxes.push({ minX: frontX - t, maxX: frontX + t, minZ: store.z - half, maxZ: store.z - half + sideLen })
  boxes.push({ minX: frontX - t, maxX: frontX + t, minZ: store.z + half - sideLen, maxZ: store.z + half })

  return boxes
}

/**
 * Bir noktayı, girdiği kutunun <b>en yakın kenarından</b> dışarı iter.
 *
 * <p>🔴 Hareketi tümden iptal etmek yerine itmek bilinçli: iptal edilirse
 * oyuncu duvara eğik gelince <b>yapışıp kalıyor</b>, duvar boyunca kayamıyordu.
 */
function resolve(p: THREE.Vector3, boxes: Box[]) {
  for (const b of boxes) {
    if (p.x <= b.minX || p.x >= b.maxX || p.z <= b.minZ || p.z >= b.maxZ) continue
    const dLeft = p.x - b.minX
    const dRight = b.maxX - p.x
    const dBack = p.z - b.minZ
    const dFront = b.maxZ - p.z
    const min = Math.min(dLeft, dRight, dBack, dFront)
    if (min === dLeft) p.x = b.minX
    else if (min === dRight) p.x = b.maxX
    else if (min === dBack) p.z = b.minZ
    else p.z = b.maxZ
  }
}

/**
 * <b>FPS gezinme.</b>
 *
 * <h3>Bakış: tek bir açı çifti, iki girdi</h3>
 * <p>🔴 11 Ağu 2026 — `PointerLockControls` <b>kaldırıldı</b>. Sebep: dokunmatikte
 * fare kilidi <b>yoktur</b>, dolayısıyla telefonda sağa-sola dönmenin hiçbir yolu
 * kalmıyordu (kullanıcının bildirdiği hata). Artık kamera açıları burada tutuluyor
 * (`yaw` / `pitch`) ve <b>iki girdi de aynı açılara</b> yazıyor:
 * <ul>
 *   <li>masaüstü — tuvale tıklayınca fare kilidi, `movementX/Y`;</li>
 *   <li>dokunmatik — ekranın ortasını sürüklemek ({@link lookRef}).</li>
 * </ul>
 * Kamera her karede tek bir yerden kuruluyor; iki ayrı denetleyicinin aynı
 * kamerayı çekiştirmesi (ve birinin diğerini sıfırlaması) böylece imkânsız.
 *
 * <p>⚠️ Kamera doğrudan her karede taşınır, React state'ine yazılmaz: 60 Hz'de
 * `setState` bu projede haritada yaşanan kasmanın aynısını üretirdi.
 */
export function Player({
  stores,
  onStoreChange,
  moveRef,
  lookRef,
  paused,
}: {
  stores: WorldStore[]
  /** Oyuncunun içine girdiği mağaza değişince çağrılır (dışarıdaysa `null`). */
  onStoreChange: (store: WorldStore | null) => void
  /** Yön çubuğunun çıktısı (−1…1). Klavyeyle <b>toplanır</b>, yerine geçmez. */
  moveRef: React.RefObject<{ x: number; y: number }>
  /**
   * Dokunmatik bakış sürüklemesinin <b>biriken</b> piksel farkı.
   * <p>⚠️ Her karede okunup <b>sıfırlanır</b> — birikimi burada tüketmezsek
   * parmak durduğunda kamera dönmeye devam ederdi.
   */
  lookRef: React.RefObject<{ dx: number; dy: number }>
  /** Bir kart açık mı — açıkken tuşlar, bakış ve yürüme yok sayılır. */
  paused: boolean
}) {
  const { camera, gl } = useThree()
  const velocity = useRef(new THREE.Vector3())
  const keys = useRef<Record<string, boolean>>({})
  const insideId = useRef<string | null>(null)
  /** Kameranın açıları — TEK gerçek kaynak. */
  const angles = useRef({ yaw: 0, pitch: 0 })
  /* ⚠️ `paused` bir REF'e yansıtılır: olay işleyicileri bir kez kuruluyor ve
     kapanışlarında ilk değeri hapsediyor. Etkiyi `paused`a bağlamak, kart her
     açılıp kapandığında fare kilidi dinleyicilerini söküp yeniden kurardı. */
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const boxes = useMemo(() => stores.flatMap(storeBoxes), [stores])

  /* Başlangıç: caddenin girişinde, ilk sıraya bakar (−z'den +z'ye). */
  useEffect(() => {
    camera.position.set(0, EYE_HEIGHT, -11)
    angles.current = { yaw: 0, pitch: 0 }
  }, [camera])

  /* --- Masaüstü: fare kilidi --- */
  useEffect(() => {
    const canvas = gl.domElement

    const onMove = (e: MouseEvent) => {
      if (pausedRef.current) return
      if (document.pointerLockElement !== canvas) return
      angles.current.yaw -= e.movementX * LOOK_SENSITIVITY
      angles.current.pitch = THREE.MathUtils.clamp(
        angles.current.pitch - e.movementY * LOOK_SENSITIVITY,
        -MAX_PITCH,
        MAX_PITCH,
      )
    }
    /* ⚠️ Kilit yalnız FARE ile istenir. Dokunmatikte `requestPointerLock`
       ya sessizce başarısız olur ya da kaydırmayı bozar; orada bakış zaten
       sürüklemeyle yapılıyor. */
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      /* ⚠️ Kart açıkken kilit İSTENMEZ: kartın üstüne tıklamak sahneyi
         yeniden kilitliyor, imleç kayboluyor ve kart kullanılamaz hâle
         geliyordu — bildirilen "illa Esc'ye basmak gerekiyor" durumu. */
      if (pausedRef.current) return
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.()
    }

    canvas.addEventListener('pointerdown', onDown)
    document.addEventListener('mousemove', onMove)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      document.removeEventListener('mousemove', onMove)
      if (document.pointerLockElement === canvas) document.exitPointerLock?.()
    }
  }, [gl])

  /* --- Klavye --- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    /* 🔴 Odak kaybında TÜM tuşlar bırakılmış sayılır. Sekme değişirken basılı
       kalan bir tuşun `keyup`'ı hiç gelmiyor ve oyuncu geri dönüldüğünde
       kendi kendine yürüyordu. */
    const blur = () => {
      keys.current = {}
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      keys.current = {}
    }
  }, [])

  useFrame((_, rawDelta) => {
    /* ⚠️ Delta sınırlanır. Sekme arka plandayken `delta` saniyelere çıkıyor ve
       oyuncu tek karede duvarların ÖTESİNE ışınlanıyordu (tünelleme). */
    const delta = Math.min(rawDelta, 0.05)

    if (paused) {
      /* Kart açıkken sahne DURUR. ⚠️ Hız da sıfırlanır: yoksa kart kapanınca
         oyuncu, kartı açtığı andaki hızıyla ileri fırlıyordu. */
      velocity.current.set(0, 0, 0)
      if (lookRef.current) {
        lookRef.current.dx = 0
        lookRef.current.dy = 0
      }
      return
    }

    /* --- Bakış: dokunmatik sürüklemenin birikimini tüket --- */
    const look = lookRef.current
    if (look && (look.dx !== 0 || look.dy !== 0)) {
      angles.current.yaw -= look.dx * LOOK_SENSITIVITY
      angles.current.pitch = THREE.MathUtils.clamp(
        angles.current.pitch - look.dy * LOOK_SENSITIVITY,
        -MAX_PITCH,
        MAX_PITCH,
      )
      look.dx = 0
      look.dy = 0
    }

    /* Açılardan kamera dönüşü. ⚠️ Sıra YXZ olmalı: varsayılan XYZ'de yukarı
       bakarken yatay dönüş eğilir ("uçak" hissi) — FPS'te istenmez. */
    camera.rotation.order = 'YXZ'
    camera.rotation.set(angles.current.pitch, angles.current.yaw, 0)

    /* --- Yürüme --- */
    const k = keys.current
    let forward = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
    let strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)

    const touch = moveRef.current
    if (touch) {
      forward += touch.y
      strafe += touch.x
    }

    const speed = k.ShiftLeft || k.ShiftRight ? RUN_SPEED : WALK_SPEED

    /* Bakış yönü YATAY düzleme indirilir; indirilmezse yukarı bakarken
       oyuncu havaya doğru "yürümeye" çalışıp yavaşlıyordu. */
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const rightVec = new THREE.Vector3().crossVectors(dir, camera.up).normalize()

    const wish = new THREE.Vector3().addScaledVector(dir, forward).addScaledVector(rightVec, strafe)
    if (wish.lengthSq() > 1) wish.normalize()

    velocity.current.addScaledVector(wish, speed * delta * DAMPING)
    velocity.current.multiplyScalar(Math.max(0, 1 - DAMPING * delta))

    const next = camera.position.clone().addScaledVector(velocity.current, delta)
    next.y = EYE_HEIGHT
    resolve(next, boxes)
    camera.position.copy(next)

    /* --- İçeride miyim? --- */
    const inside = stores.find((s) => {
      const facing = s.side === 'RIGHT' ? -1 : 1
      const depthIn = (camera.position.x - s.x) * facing
      const across = Math.abs(camera.position.z - s.z)
      return depthIn < STORE.depth / 2 - 0.2 && depthIn > -STORE.depth / 2 && across < STORE.width / 2
    })
    const id = inside?.id ?? null
    if (id !== insideId.current) {
      insideId.current = id
      onStoreChange(inside ?? null)
    }
  })

  return null
}
