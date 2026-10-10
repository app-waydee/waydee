/**
 * Sayfa kaydırma kilidi (modal/tam ekran katman açıkken).
 *
 * **Kaymayı önleyen mekanizma:** `body { overflow: hidden }` kaydırma çubuğunu
 * kaldırıp sayfayı ~8px genişletiyordu; her modal açılışında üst bar ve ikonlar
 * zıplıyordu. Bunun yerine html kaydırılabilir bırakılır (çubuk yerinde kalır,
 * bkz. `index.css`'teki `overflow-y: scroll`) ve **gövde bulunduğu kaydırma
 * konumunda sabitlenir**. Ölçüldü: bu yöntemde içerik genişliği hiç değişmez.
 *
 * **İç içe katmanlar:** sayaç tutulur; üstteki katman kapanınca alttaki hâlâ
 * açıksa kilit çözülmez (eskiden ilk kapanan kilidi kaldırıyordu).
 */

const LOCK_CLASS = 'waydee-scroll-locked'
let locks = 0
/** Kilit açılırken geri dönülecek kaydırma konumu (en dıştaki kilit belirler). */
let savedScrollY = 0

/** Kaydırmayı kilitler; dönen fonksiyon effect cleanup'ında çağrılır. */
export function lockScroll(): () => void {
  if (locks === 0) {
    savedScrollY = window.scrollY
    document.documentElement.classList.add(LOCK_CLASS)
    // Gövde sabitlenince akış tepeye kayar; negatif top ile aynı yerde görünür.
    document.body.style.top = `-${savedScrollY}px`
  }
  locks += 1

  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (locks === 0) {
      document.documentElement.classList.remove(LOCK_CLASS)
      document.body.style.top = ''
      window.scrollTo(0, savedScrollY)
    }
  }
}
