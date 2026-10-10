import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Waydee marka işaretleri — **tek kaynak**.
 *
 * İki varlık vardır ve ikisi de gerçek marka dosyasıdır:
 * - `public/logo.svg` — işaret + **Waydee** kelime markası (yatay yuvalar).
 *   🔴 7 Ağu 2026'da `waydee-logo.png`'nin yerini aldı: **vektör**, her
 *   ölçekte keskin ve dosya 6 KB (PNG 16 KB'tı). Oran **691×186 ≈ 3.7:1**.
 * - `public/waydee-mark.png` — yalnız yuvarlak **W** işareti (kare yuvalar için).
 *   ⚠️ Bu **logo.svg'ye çevrilmedi**: svg yatay bir kilit (lockup), kare bir
 *   yuvaya konunca ya ezilir ya küçücük kalır. Kare işaret ayrı bir varlıktır.
 *
 * ⚠️ Logo gösteren yeni bir yer eklerken buradaki bileşenleri kullan, yeni bir
 * çizim üretme.
 *
 * ⚠️ **Koyu tema:** `logo.svg`'nin tüm yolları `fill="black"`. Koyu temada
 * `.waydee-brand-logo` sınıfı `brightness(0) invert(1)` uygular → **tam beyaz**.
 * (Eski `invert(1) brightness(1.9)` kaynak rengine bağlıydı ve farklı tonlarda
 * kirli griler üretebiliyordu; `brightness(0)` önce her şeyi siyaha indirir,
 * `invert(1)` sonra kesin beyaz verir — kaynak ne olursa olsun.)
 */
export function LogoMark({
  className,
  onDark,
}: {
  className?: string
  /**
   * <b>Zemini HER ZAMAN koyu olan yüzeyler</b> — işaret daima beyaz çizilir.
   *
   * <p>🔴 16 Ağustos 2026'da eklendi. `Logo`'da bu bayrak vardı ama
   * `LogoMark`'ta <b>yoktu</b>, yani kare işaret temadan kaçamıyordu:
   * `waydee-brand-logo` beyaza çevirmeyi <b>yalnız koyu temada</b> yapar.
   * Ziyaretçi kapısı (temadan bağımsız koyu bir yüzey) açık tema seçili bir
   * kullanıcıda işareti <b>hiç çevirmiyor</b> ve koyu zeminde koyu bir işaret
   * bırakıyordu — kullanıcının bildirdiği "logo buglu, kayboluyor" tam buydu.
   *
   * <p>⚠️ Sınıfla değil SATIR İÇİ filtre ile: sınıf koşulludur (`[data-theme]`),
   * burada gereken ise <b>koşulsuz</b> beyazdır.
   */
  onDark?: boolean
}) {
  return (
    <img
      src="/waydee-mark.png"
      alt="Waydee"
      draggable={false}
      className={cn(!onDark && 'waydee-brand-logo', 'h-10 w-10 select-none object-contain', className)}
      style={onDark ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  )
}

interface LogoProps {
  className?: string
  /**
   * Verilirse logo bağlantıya sarılır. **Varsayılanı yoktur**: vitrin ve giriş
   * ekranında oturum olmadığı için `/map`'e giden bir bağlantı işe yaramaz.
   */
  to?: string
  subtitle?: string
  /** Yüksekliği sınıfla ver (varsayılan h-8). */
  imgClassName?: string
  /**
   * <b>Tema dönüşümünü KAPAT.</b>
   *
   * <p>🔴 Zemini <b>her zaman beyaz</b> olan yüzeylerde şart: tanıtım sayfası
   * (`bg-white text-black`) ve `MarketingNav` (`bg-white/70`) temadan
   * bağımsız beyazdır. Bayrak olmadan koyu tema seçili bir kullanıcıda logo
   * beyaza çevrilir ve <b>beyaz zeminde kaybolur</b> — ölçüldü:
   * `theme=dark` iken `navBg` beyaz, `filter: brightness(0) invert(1)`.
   */
  staticColor?: boolean
  /**
   * <b>Zemini HER ZAMAN KOYU olan yüzeyler</b> — logo daima beyaz çizilir.
   *
   * <p>🔴 8 Ağu 2026'da eklendi. `staticColor`'ın tam tersidir ve aynı derde
   * bakar: `waydee-brand-logo` beyaza çevirmeyi <b>yalnız koyu temada</b>
   * yapar. Tanıtım sayfasının footer'ı gibi temadan bağımsız <b>siyah</b> bir
   * blokta, açık tema seçili kullanıcıda logo <b>siyah zeminde siyah</b>
   * kalırdı — yani görünmezdi.
   */
  onDark?: boolean
}

/** İşaret + kelime markası. Görsel "Waydee" yazısını zaten içerir — yanına metin yazma. */
export function Logo({ className, to, subtitle, imgClassName, staticColor, onDark }: LogoProps) {
  const content = (
    <>
      <img
        src="/logo.svg"
        alt="Waydee"
        draggable={false}
        className={cn(
          !staticColor && !onDark && 'waydee-brand-logo',
          'w-auto select-none',
          imgClassName ?? 'h-8',
        )}
        /* ⚠️ Sınıfla değil SATIR İÇİ: `waydee-brand-logo` yalnız koyu temada
           çevirir; burada tema ne olursa olsun beyaz gerekiyor. */
        style={onDark ? { filter: 'brightness(0) invert(1)' } : undefined}
      />
      {subtitle && <span className="text-xs font-medium text-faint">{subtitle}</span>}
    </>
  )
  if (!to) {
    return <span className={cn('inline-flex items-center gap-3', className)}>{content}</span>
  }
  return (
    <Link to={to} className={cn('inline-flex items-center gap-3', className)} aria-label="Waydee">
      {content}
    </Link>
  )
}
