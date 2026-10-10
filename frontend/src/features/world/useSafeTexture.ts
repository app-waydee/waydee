import { useEffect, useState } from 'react'
import * as THREE from 'three'

/**
 * Bir görseli dokuya çevirir — <b>ASLA askıya almaz, ASLA fırlatmaz.</b>
 *
 * <h3>Neden `useLoader` değil?</h3>
 * <p>🔴 11 Ağu 2026 — "bazen 3B ekran yüklenmiyor, gri kalıyor" şikâyetinin
 * kök nedeni buydu. `useLoader` iki şey yapar: yüklenene kadar <b>askıya alır</b>
 * (Suspense) ve hata alırsa <b>fırlatır</b>. Fırlatılan hatayı yakalayan bir
 * sınır yoktu; React bütün ağacı söküyor, geriye <b>boş gri tuval</b> kalıyordu.
 * Yani <b>tek bir raf fotoğrafının 401/404 dönmesi bütün caddeyi yok ediyordu</b>
 * — ve medya adresleri <b>imzalı ve süreli</b> olduğu için bu istisna değil,
 * beklenen bir durumdur.
 *
 * <p>Bu kanca yerine: doku <b>arka planda</b> yüklenir, hazır olunca gelir,
 * olmazsa `null` döner ve çağıran yerine bir yer tutucu çizer. Mağaza hiçbir
 * koşulda fotoğrafın yüklenmesini <b>beklemez</b>.
 *
 * <p>⚠️ Doku sökülürken `dispose` edilir. GPU belleği çöp toplayıcıya tabi
 * değildir; caddede gezinirken bırakılan dokular birikir ve sekme çöker.
 */
export function useSafeTexture(url: string | null | undefined) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }
    let alive = true
    let loaded: THREE.Texture | null = null

    new THREE.TextureLoader().load(
      url,
      (tex) => {
        if (!alive) {
          /* Bileşen yüklenme bitmeden söküldü — dokuyu bırak, state'e yazma. */
          tex.dispose()
          return
        }
        /* ⚠️ sRGB işaretlenmezse fotoğraflar sahnede yıkanmış görünür:
           three.js dokuları varsayılan olarak doğrusal kabul eder. */
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        loaded = tex
        setTexture(tex)
      },
      undefined,
      () => {
        /* Sessiz: yer tutucu çizilir. Rafın bir gözünün boş kalması,
           bütün caddenin kaybolmasından iyidir. */
        if (alive) setTexture(null)
      },
    )

    return () => {
      alive = false
      loaded?.dispose()
    }
  }, [url])

  return texture
}

/**
 * Bir görseli <b>belirtilen çözünürlükte rasterleştirip</b> dokuya çevirir.
 *
 * <h3>Neden ayrı bir kanca?</h3>
 * <p>🔴 11 Ağu 2026 — marka kelime markası `public/logo.svg`'dir (7 Ağu'da
 * `waydee-logo.png`'nin yerini aldı: vektör, her ölçekte keskin). Ama
 * {@link useSafeTexture} onu <b>olduğu gibi</b> dokuya alırsa iki sorun çıkar:
 * <ul>
 *   <li>doku, svg'nin içsel boyutunda (691×186) rasterleşir ve 4 metrelik
 *       bir tabelada <b>bulanık</b> kalır;</li>
 *   <li>içsel boyutu olmayan bir svg <b>0×0</b> çizilir ve doku boş olur.</li>
 * </ul>
 * Burada görsel önce bir tuvale <b>istenen piksel genişliğinde</b> çizilir;
 * çıktı her zaman keskin ve boyutu kesindir.
 *
 * <p>⚠️ `CanvasTexture` kullanılır, `Texture` değil: kaynak bir `<canvas>`
 * olduğunda three'ye yüklemenin doğru yolu budur.
 *
 * <p>⚠️ Yükleme başarısızsa `null` döner — {@link useSafeTexture} ile aynı
 * sözleşme: <b>askıya almaz, fırlatmaz</b>.
 */
export function useVectorTexture(src: string, pixelWidth = 1024) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    let alive = true
    let made: THREE.CanvasTexture | null = null

    const img = new Image()
    /* ⚠️ Aynı köken (public/) olsa da açıkça belirtiliyor: doku bir tuvalden
       geçtiği için kaynak "kirli" (tainted) olursa `drawImage` sonrası
       okuma patlar. */
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      if (!alive) return
      const ratio = img.naturalHeight / img.naturalWidth || 1
      const canvas = document.createElement('canvas')
      canvas.width = pixelWidth
      canvas.height = Math.max(1, Math.round(pixelWidth * ratio))
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      made = new THREE.CanvasTexture(canvas)
      made.colorSpace = THREE.SRGBColorSpace
      made.anisotropy = 4
      setTexture(made)
    }
    img.onerror = () => {
      if (alive) setTexture(null)
    }
    img.src = src

    return () => {
      alive = false
      made?.dispose()
    }
  }, [src, pixelWidth])

  return texture
}
