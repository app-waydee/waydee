import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MarketingNav } from '@/components/MarketingNav'
import { useT } from '@/i18n'

/**
 * Giriş / kayıt kabuğu — <b>Squarespace `login.squarespace.com`</b> birebir.
 *
 * ```
 * <div class="waydee-auth">                 // beyaz tuval, Helvetica yığını
 *   <header p:6 (33px) flex justify-between align-center>
 *     logo                          Tertiary → "Hesap oluştur" / "Giriş yap"
 *   <main>
 *     <div max-width:342px margin:0 auto text-align:center>   // Go
 * ```
 *
 * Ölçüler referansın kendi token dökümünden alındı:
 * `@sizes-sizes-700 = 342px` (kart genişliği) · `@space-6 = 33px` (kabuk
 * dolgusu) · `@space-8 = 44px` (başlık altı boşluk).
 *
 * 🔴 <b>KART / ÇERÇEVE YOKTUR.</b> İçerik doğrudan beyaz sayfanın üstünde
 * durur; ne gölge, ne kenarlık, ne cam efekti. (Önceki tasarımdaki fareyi
 * izleyen "cam atmosfer" tamamen kaldırıldı — referansta böyle bir katman
 * yok ve beyaz zemini kirletiyordu.)
 *
 * 🔴 <b>Bu ekran uygulamanın koyu temasını TAKİP ETMEZ</b> (`.waydee-auth`
 * renkleri sabitler). Referans saf beyazdır.
 *
 * ⚠️ <b>Tek bilinçli sapma:</b> dikey ortalama `min-height` ile kurulur,
 * `height` ile değil. Bizim kayıt formumuz referanstakinden uzun; sabit
 * yükseklik + `items-center` içeriği <b>kırpar ve sayfayı kaydırılamaz</b>
 * yapar (vault 12-tuzaklar, bir kez yaşandı).
 */
export function MarketingAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="waydee-auth relative flex min-h-full flex-col">
      {/*
        🔴 10 Ağu 2026 — GİRİŞ/KAYIT ÇUBUĞU ARTIK TEK KAYNAKTAN.
        Buradaki `AuthTopBar` ayrı bir çubuktu (33px dolgu, tertiary bağlantı)
        ve linear.app ölçüleriyle yenilenen ana çubuktan tamamen kopmuştu —
        kullanıcı "login register kısımlarında da navbar tasarımını işle"
        dedi. Artık `MarketingNav`'ın `auth` varyantı çiziliyor: aynı
        yükseklik, aynı ortalanmış kap, aynı beyaz cam, aynı Inter tipografi.
        ⚠️ Karşıt eylem davranışı korundu (girişte "Hesap oluştur").
      */}
      <MarketingNav variant="auth" />
      <main className="flex flex-1 items-start justify-center pb-16 pt-2 sm:items-center sm:pb-24 sm:pt-0">
        <div className="w-full text-center">{children}</div>
      </main>
    </div>
  )
}

/**
 * Başlık bloğu — referans: `Flex flexDirection="column" alignItems="center"
 * mb:8 (44px) px:6 (33px)` + `Text.Title textAlign="center"` ve isteğe bağlı
 * `Text.Caption mt:2 (11px)`.
 */
export function AuthHeading({
  children,
  caption,
  /**
   * Başlık bloğunun altındaki boşluk. Ölçüldü: <b>giriş</b> ekranında
   * 44px (`@space-8`), <b>kayıt</b> ve <b>kurtarma</b> ekranlarında
   * 33px (`@space-6`).
   */
  gap = 'mb-[33px]',
}: {
  children: ReactNode
  caption?: ReactNode
  gap?: string
}) {
  return (
    <div className={`flex flex-col items-center ${gap}`}>
      <h1 className="sq-title text-center">{children}</h1>
      {caption && <p className="sq-caption mt-[11px] text-center">{caption}</p>}
    </div>
  )
}

/**
 * 🔴 <b>Tek kolonlu kart — 342px</b> (`@sizes-sizes-700`), ortalanmış.
 * Referansın <b>kayıt</b> ve <b>parola kurtarma</b> ekranları bu yerleşimi
 * kullanır (giriş ekranı ise iki kolonludur — bkz. {@link AuthColumns}).
 * Dar ekranda kenarlardan 33px boşluk bırakır.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[342px] px-[33px] sm:px-0">{children}</div>
}

/**
 * 🔴 Referansın <b>giriş</b> ekranı yerleşimi: **iki kolon**. Solda form, sağda sağlayıcı
 * düğmeleri, ortada dikey **"veya"** ayracı. Ölçüldü (canlı sayfa, 1280px):
 * dış satır 775px, kolonlar 320,55px, orta kolon 133,9px.
 * ≤767px'te tek kolona iner (referans da öyle yapıyor).
 */
export function AuthColumns({ form, providers }: { form: ReactNode; providers: ReactNode }) {
  const t = useT()
  return (
    <div className="sq-columns">
      <div className="sq-col">{form}</div>
      <div className="sq-or" aria-hidden="true">
        <div className="sq-or-line" />
        <span className="sq-or-label">{t('auth.or')}</span>
        <div className="sq-or-line" />
      </div>
      <div className="sq-col">{providers}</div>
    </div>
  )
}

/**
 * Birincil (dolu siyah) gönder düğmesi — `Button.Primary`, tam genişlik,
 * **üstünde 33px boşluk** (referans: `margin-top: 33px`). Hover'da eğik
 * `#454545` panel soldan sağa süpürür (`sq-wipe`).
 */
export function AuthSubmit({
  children,
  disabled,
  loading,
  onClick,
  type = 'submit',
}: {
  children: ReactNode
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'submit' | 'button'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-live="polite"
      className="sq-btn sq-wipe sq-btn-primary mt-[33px]"
    >
      {loading ? <span className="sq-spinner" /> : children}
    </button>
  )
}

/**
 * `Button.Tertiary` — düz metin eylem. 🔴 <b>Hover'da alt çizgi soldan sağa
 * açılır</b> (`Underline` etkileşimi, `width 0 → 100%`, 0.3s
 * `cubic-bezier(0.32, 0.94, 0.60, 1.00)`). Referansın imza hareketidir;
 * "Create Account", "Log In", "Şifremi unuttum" hepsi bunu kullanır.
 */
export function AuthTertiary({
  children,
  as,
  to,
  onClick,
  type = 'button',
}: {
  children: ReactNode
  as?: typeof Link
  to?: string
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  const inner = (
    <>
      <span>{children}</span>
      <span className="sq-underline" aria-hidden="true" />
    </>
  )

  if (as && to) {
    return (
      <Link to={to} onClick={onClick} className="sq-btn sq-btn-tertiary">
        {inner}
      </Link>
    )
  }
  return (
    <button type={type} onClick={onClick} className="sq-btn sq-btn-tertiary">
      {inner}
    </button>
  )
}

/**
 * Referansın "or" ayracı yoktur — sağlayıcı düğmeleri ile e-posta düğmesi
 * aynı listede durur. Bunun yerine sayfanın altında <b>hukuki metin</b>
 * (`Text.Caption`) bulunur.
 */
export function AuthLegal({
  children,
  className = 'mt-[33px]',
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={`sq-caption inline-block text-center ${className}`}>{children}</p>
}
