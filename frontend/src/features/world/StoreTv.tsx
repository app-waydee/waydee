import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * <b>Kasa arkasındaki televizyon</b> — mağaza sahibinin stüdyodan yüklediği
 * video, dükkânın arka duvarında oynar.
 *
 * <h2>🔴 Neden `useVideoTexture` (drei) kullanılmadı</h2>
 * <p>drei'nin kancası videoyu <b>askıya alır</b> (Suspense) ve hata durumunda
 * <b>fırlatır</b> — tıpkı 75. turda bütün caddeyi söken {@code useLoader} gibi.
 * Medya adresleri bu projede <b>imzalı ve süreli</b>; 401/404 bir istisna
 * değil, <b>beklenen</b> durumdur. Tek bir dükkânın süresi dolmuş videosu
 * caddeyi yok edemez. Bu yüzden {@code useSafeTexture} ile aynı felsefe:
 * <b>askıya alma, fırlatma, olmazsa çizme</b>.
 *
 * <h2>⚠️ Otomatik oynatma kuralları</h2>
 * <p>Tarayıcılar sesli otomatik oynatmayı engeller. Video <b>daima
 * {@code muted} başlar</b>; ziyaretçi sahnede bir kez tıkladıktan sonra
 * (kullanıcı hareketi) ses açılabilir. Sessiz başlatmasaydık {@code play()}
 * reddedilir ve ekran <b>siyah kalırdı</b> — hem de sessizce.
 */
export function StoreTv({
  url,
  muted,
  width = 2.4,
  height = 1.35,
  position,
  rotation,
  screenColor = '#0a0c0e',
}: {
  url: string | null
  muted: boolean
  width?: number
  height?: number
  position: [number, number, number]
  rotation?: [number, number, number]
  screenColor?: string
}) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }
    /*
     * ⚠️ Video elemanı DOM'a EKLENMEZ. `crossOrigin` + `playsInline` ile
     * bellekte durur; three.js onu doku olarak okur. DOM'a eklemek, sahnenin
     * üstünde görünmez bir oynatıcı bırakırdı.
     */
    const video = document.createElement('video')
    video.src = url
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true // ⚠️ play() reddedilmesin diye HER ZAMAN sessiz başlar
    video.playsInline = true
    video.preload = 'auto'
    videoRef.current = video

    let disposed = false
    const tex = new THREE.VideoTexture(video)
    tex.colorSpace = THREE.SRGBColorSpace
    /* ⚠️ Mipmap YOK: video her karede değişir, mipmap üretimi boşuna GPU işi. */
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter

    /*
     * 🔴 15 Ağu 2026 — DOKU, `play()` BAŞARISINI BEKLEMEZ.
     *
     * Bildirilen hata: *"video stüdyoda oynuyor ama 3B'de oynatmıyor."*
     * Kök neden buydu: doku yalnız `play()` sözü **çözülürse** kuruluyordu.
     * Tarayıcı otomatik oynatmayı reddettiğinde (sessiz videoda bile bazı
     * ayarlarda olur) söz reddediliyor, doku hiç kurulmuyor ve ekran
     * <b>sonsuza dek koyu</b> kalıyordu — kullanıcı sahneye tıklasa bile,
     * çünkü tek deneme `canplay` anındaydı ve bir daha denenmiyordu.
     *
     * Artık doku `canplay` anında **koşulsuz** kurulur (ilk kare zaten
     * hazırdır) ve oynatma ayrıca, tekrar tekrar denenir.
     */
    const tryPlay = () => {
      if (disposed || !video.paused) return
      /* Reddedilen sözü YUT: kullanıcı henüz sayfayla etkileşmediyse normaldir. */
      video.play().catch(() => undefined)
    }

    const start = () => {
      if (disposed) return
      setTexture(tex)
      tryPlay()
    }
    video.addEventListener('canplay', start, { once: true })
    /* Yükleme hatasında doku HİÇ kurulmaz; ekran koyu bir yüzey olarak kalır. */
    video.addEventListener('error', () => undefined, { once: true })

    /*
     * 🔴 Kullanıcı hareketinde YENİDEN DENE. Otomatik oynatma politikası
     * gereği ilk `play()` reddedilmiş olabilir; sahneye tıklamak (fare kilidi
     * zaten tıklamayla başlar) ya da bir tuşa basmak videoyu başlatır.
     * ⚠️ Dinleyiciler `window`da ve `capture`: sahne tuvali olayları
     * yutabiliyor.
     */
    window.addEventListener('pointerdown', tryPlay, true)
    window.addEventListener('keydown', tryPlay, true)

    return () => {
      disposed = true
      window.removeEventListener('pointerdown', tryPlay, true)
      window.removeEventListener('keydown', tryPlay, true)
      video.pause()
      /* 🔴 `src` boşaltılıp `load()` çağrılmazsa tarayıcı indirmeyi SÜRDÜRÜR:
         caddede 40 dükkân varsa 40 video arka planda akmaya devam eder. */
      video.removeAttribute('src')
      video.load()
      tex.dispose()
      videoRef.current = null
    }
  }, [url])

  /*
   * Sessizlik ayrı bir etkide: ziyaretçi stüdyoda "sesi aç" demişse ve
   * tarayıcı izin veriyorsa açılır. Doku yeniden kurulmaz — `url` değişmedi.
   */
  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = muted
  }, [muted])

  /*
   * ═══════════════════════════════════════════════════════════════════
   * 🔴 15 Ağu 2026 — EKRAN SİYAH KALIYORDU: `needsUpdate` HER KAREDE GEREKLİ
   *
   * <b>Ölçüldü (tarayıcıda, gerçek WebGL bağlamıyla):</b> video oynuyor
   * (`paused:false`, `currentTime` ilerliyor, `readyState:4`) ama dokudan
   * okunan piksel <b>[0,0,0,255] — SİYAH</b>. Aynı karede
   * `texture.needsUpdate = true` yazılıp tekrar render edilince piksel
   * <b>[255,255,0,255]</b> geliyor, yani <b>gerçek video karesi</b>.
   *
   * <b>Sebep:</b> `THREE.VideoTexture` kareyi GPU'ya kendiliğinden yüklemez;
   * yüklemeyi `requestVideoFrameCallback` tetikler. O geri çağrı sekme
   * görünmezken, bazı tarayıcı/sürücü bileşimlerinde ve DOM'a eklenmemiş
   * video elemanlarında <b>çalışmayabilir</b> — bu durumda doku ilk (boş)
   * hâlinde donar ve televizyon kapkara görünür.
   *
   * <b>Çözüm:</b> videoda kare varken bayrağı biz koyuyoruz. Maliyeti yok
   * sayılır (karede bir boolean); karşılığında televizyon tarayıcıdan
   * bağımsız olarak <b>her koşulda</b> akar.
   *
   * ⚠️ `readyState` kontrolü şart: veri yokken `needsUpdate` koymak boş bir
   * kareyi yükler ve WebGL uyarısı basar.
   * ⚠️ Duraklatılmış videoda da güncelleme yapılmaz — gereksiz GPU yüklemesi.
   * ═══════════════════════════════════════════════════════════════════
   */
  useFrame(() => {
    const video = videoRef.current
    if (!texture || !video || video.paused) return
    if (video.readyState >= video.HAVE_CURRENT_DATA) {
      texture.needsUpdate = true
    }
  })

  const screenMaterial = useMemo(
    () =>
      texture
        ? new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
        : new THREE.MeshBasicMaterial({ color: screenColor }),
    [texture, screenColor],
  )

  useEffect(() => () => screenMaterial.dispose(), [screenMaterial])

  return (
    <group position={position} rotation={rotation}>
      {/* Kasa — koyu çerçeve, ekrandan biraz büyük. */}
      <mesh castShadow>
        <boxGeometry args={[width + 0.12, height + 0.12, 0.08]} />
        <meshStandardMaterial color="#111316" roughness={0.6} metalness={0.2} />
      </mesh>
      {/*
        Ekran. ⚠️ `meshBasicMaterial` + `toneMapped={false}`: televizyon bir
        yüzey değil bir IŞIK KAYNAĞIdır; sahne aydınlatmasıyla kararmamalı
        (76. turdaki logo dersinin aynısı).
      */}
      <mesh position={[0, 0, 0.045]} material={screenMaterial}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  )
}
