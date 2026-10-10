import Lenis from 'lenis'
import { useEffect } from 'react'

/**
 * Yumuşak kaydırma — referansın kullandığı kütüphanenin aynısı.
 *
 * ⚠️ Bu bir "hoşluk" değil, referansın <b>hareket dilinin parçası</b>:
 * `taag.app` paketinde `lenisVersion = "1.0.42"` bulundu. Tekerlek olayları
 * yakalanır ve sayfa hedefe **lerp** ile yaklaşır; bizim sitede kaydırma
 * anlık zıplıyordu.
 *
 * Referansta ayarlar <b>varsayılan</b> bırakılmış (pakette lerp/multiplier
 * override'ı yok) — burada da öyle:
 * ```
 * smoothWheel: true · lerp: 0.1 · wheelMultiplier: 1 · syncTouch: false
 * ```
 * ⚠️ `syncTouch: false` bilinçli: dokunmatik cihazlarda işletim sisteminin
 * kendi ataleti zaten var, üstüne binmek kaydırmayı ağırlaştırır.
 *
 * 🔴 <b>YALNIZ TANITIM YÜZEYLERİNDE</b> çalıştırılır (`/`, `/login`,
 * `/register`). Uygulamanın kendisinde (harita, sohbet, paneller) kendi
 * kaydırma kapları ve yükseklik zincirleri var; global bir kaydırma
 * devralması onları bozar.
 */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    // Hareket azaltma tercihi varsa devralma — tarayıcının kendi kaydırması kalsın.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      smoothWheel: true,
      lerp: 0.1,
      wheelMultiplier: 1,
      syncTouch: false,
    })
    activeLenis = lenis

    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
      if (activeLenis === lenis) activeLenis = null
    }
  }, [enabled])
}

/**
 * Açık olan örnek — modal açılırken durdurulup kapanınca sürdürülür.
 *
 * ⚠️ Gerekli: modal açıkken gövde `position: fixed` ile kilitleniyor
 * (`lockScroll`). Lenis bu sırada çalışmaya devam ederse kilitlenmiş gövdeyi
 * kaydırmaya çalışır ve arka plan modalın altında sürüklenir.
 */
let activeLenis: Lenis | null = null

export function pauseSmoothScroll() {
  activeLenis?.stop()
}

export function resumeSmoothScroll() {
  activeLenis?.start()
}

/**
 * Sayfayı <b>yumuşakça</b> en üste alır.
 *
 * <p>🔴 8 Ağu 2026 — yaşanmış sorun: footer <b>sayfanın en altındadır</b>.
 * Oradaki "Hakkımızda / Gizlilik / Koşullar" bağlantısına basınca React Router
 * yeni rotayı çiziyor ama <b>kaydırma konumunu korunuyor</b> → kullanıcı yeni
 * sayfanın ortasına/altına düşüyordu. Kullanıcının şikâyeti tam buydu.
 *
 * <p>⚠️ <b>Lenis varsa ONA söylenir.</b> Lenis kaydırmayı devraldığı için
 * `window.scrollTo` çağrısı onun hedefiyle çakışır: tarayıcı 0'a giderken
 * Lenis kendi son hedefine geri çeker ve sayfa "zıplar". `activeLenis` yoksa
 * (hareket azaltma tercihi ya da tanıtım dışı yüzey) tarayıcının kendi
 * yumuşak kaydırması kullanılır.
 */
export function scrollToTopSmooth() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (activeLenis && !reduce) {
    activeLenis.scrollTo(0, { immediate: false })
  } else {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  /*
   * 🔴 <b>EMNİYET AĞI — kaydırma motoru donmuş olabilir.</b>
   * Hem Lenis'in `scrollTo`'su hem tarayıcının `behavior: 'smooth'`'u
   * <b>kare üretimine</b> bağlıdır. Kare akmadığı ortamlarda (arka plan
   * sekmesi, kısılmış `requestAnimationFrame`, önizleme paneli görünmezken)
   * animasyon hiç başlamaz ve kullanıcı <b>sayfanın ortasında kalır</b> —
   * ölçüldü: footer'dan `/privacy`'ye geçişte `scrollY` 15567 → 7030'da
   * takılı kaldı, 0'a hiç gitmedi.
   *
   * Bu yüzden 700 ms sonra tek bir kontrol yapılır: hâlâ tepede değilsek
   * anında yukarı alınır. Yumuşak geçiş çalıştıysa `scrollY` zaten 0'dır ve
   * bu satır hiçbir şey yapmaz; çalışmadıysa kullanıcı doğru yerde başlar.
   * <b>Görsel incelik uğruna doğru konumdan vazgeçilmez.</b>
   */
  window.setTimeout(() => {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' })
  }, 700)
}

/**
 * Sayfa açılışında yumuşakça en üste alır.
 *
 * <p>⚠️ <b>`requestAnimationFrame` KULLANILMAZ.</b> İlk yazımda bir kare
 * beklemek için rAF kullanılmıştı; kare üretmeyen bir ortamda geri çağrı
 * <b>hiç çalışmıyor</b> ve kaydırma sıfırlanmıyordu. `setTimeout(0)` zamanlayıcı
 * kuyruğundadır ve kare akışından bağımsız çalışır — beklemenin amacı zaten
 * Lenis örneğinin kurulmasını sağlamaktı, bir kare çizilmesini değil.
 */
export function useScrollTopOnMount() {
  useEffect(() => {
    const id = window.setTimeout(() => scrollToTopSmooth(), 0)
    return () => window.clearTimeout(id)
  }, [])
}
