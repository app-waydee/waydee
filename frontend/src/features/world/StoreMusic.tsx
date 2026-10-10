import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * <b>Mağaza müziği</b> — dükkâna yaklaşınca duyulur, uzaklaşınca söner.
 *
 * <h2>🔴 Neden three.js'in `PositionalAudio`'su kullanılmadı</h2>
 * <p>{@code THREE.PositionalAudio} bir {@code AudioListener} ve Web Audio
 * grafiği kurar; her mağaza için ayrı bir çözücü (decoder) demektir ve
 * <b>tüm dosyayı belleğe çözer</b>. Kırk dükkânlık bir caddede bu, onlarca
 * megabaytlık çözülmüş PCM ve orta seviye telefonlarda çökme demekti.
 *
 * <p>Bunun yerine sıradan bir {@code <audio>} elemanının <b>ses seviyesi</b>
 * mesafeye göre sürülüyor: akış halinde çalar, bellekte durmaz, ve kulakta
 * sonuç neredeyse aynıdır (yatay düzlemde tek kaynak).
 *
 * <h2>⚠️ Otomatik oynatma</h2>
 * <p>Tarayıcı, kullanıcı sayfayla etkileşmeden ses çalmayı reddeder.
 * {@code play()} sözü sessizce yutulur ve <b>her yaklaşmada yeniden denenir</b>:
 * ziyaretçi sahnede bir kez tıkladığı anda (fare kilidi zaten tıklamayla
 * başlar) müzik kendiliğinden gelir.
 */
export function StoreMusic({
  url,
  volume,
  position,
  /** Bu mesafede ses tamamen kesilir (metre). */
  maxDistance = 14,
  /** Bu mesafenin içinde ses tam seviyededir. */
  fullDistance = 4,
}: {
  url: string | null
  volume: number
  position: [number, number, number]
  maxDistance?: number
  fullDistance?: number
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { camera } = useThree()
  const anchor = useRef(new THREE.Vector3(...position))

  useEffect(() => {
    anchor.current.set(position[0], position[1], position[2])
  }, [position])

  useEffect(() => {
    if (!url) return
    const audio = document.createElement('audio')
    audio.src = url
    audio.loop = true
    audio.preload = 'none' // ⚠️ Yaklaşana kadar indirme; cadde açılışında 40 dosya çekmesin.
    audio.volume = 0
    audioRef.current = audio
    return () => {
      audio.pause()
      /* `src` boşaltılmazsa tarayıcı indirmeyi sürdürür (StoreTv ile aynı ders). */
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }
  }, [url])

  useFrame(() => {
    const audio = audioRef.current
    if (!audio) return

    const distance = camera.position.distanceTo(anchor.current)

    /* Doğrusal sönüm: tam seviye → sıfır. */
    const t = THREE.MathUtils.clamp(
      (maxDistance - distance) / Math.max(maxDistance - fullDistance, 0.001),
      0,
      1,
    )
    const target = t * THREE.MathUtils.clamp(volume, 0, 100) / 100

    /* ⚠️ Ani sıçrama değil yumuşak geçiş — kapıdan girerken sesin "patlaması"
       rahatsız ediciydi. Kare hızından bağımsız olması gerekmiyor: ses
       değişimi göze değil kulağa hitap ediyor ve fark edilmiyor. */
    audio.volume = THREE.MathUtils.lerp(audio.volume, target, 0.08)

    if (target > 0.001 && audio.paused) {
      /* 🔴 Reddedilen sözü YUT: kullanıcı henüz etkileşmediyse normaldir ve
         bir sonraki karede yeniden denenir. */
      audio.play().catch(() => undefined)
    } else if (target <= 0.001 && !audio.paused) {
      audio.pause()
    }
  })

  return null
}
