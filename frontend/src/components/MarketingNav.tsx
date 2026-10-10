import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { lockScroll } from '@/lib/scrollLock'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useT } from '@/i18n'

/**
 * <b>Üst çubuk — TEK KAYNAK</b> (tanıtım · hakkımızda · yasal · vitrin profili ·
 * herkese açık gönderi sayfası).
 *
 * <p>🔴 <b>10 Ağustos 2026 — LINEAR.APP ÖLÇÜLEREK YENİDEN YAZILDI.</b>
 * Kullanıcı mobilde bozuk duran çubuğu işaret edip <i>"linear.app'in navbarını
 * en arkadaki CSS'ine kadar analiz et, bizimkine uygula"</i> dedi. Değerler
 * <b>10 Ağu 2026'da linear.app sayfası AÇILARAK</b> ölçüldü (paket okunarak
 * değil — minify edilmiş paket token verir, kompozisyon vermez; bu ders
 * vault'ta kayıtlı).
 *
 * <h3>Ölçülen değerler</h3>
 * <table>
 *  <tr><th></th><th>masaüstü (1280)</th><th>mobil (375)</th></tr>
 *  <tr><td>yükseklik</td><td><b>72px</b> + 1px kenar (73)</td><td><b>64px</b> + 1px (65)</td></tr>
 *  <tr><td>iç dolgu</td><td><b>0 41px</b></td><td><b>0 23px</b></td></tr>
 *  <tr><td>konum</td><td colspan="2"><code>position: fixed; top: 0; z-index: 100</code></td></tr>
 *  <tr><td>zemin</td><td colspan="2"><b>saydam</b> + <code>backdrop-filter: blur(20px)</code></td></tr>
 *  <tr><td>alt kenar</td><td colspan="2"><code>1px solid rgba(255,255,255,.08)</code> (koyu tema)</td></tr>
 *  <tr><td>bağlantı</td><td colspan="2"><b>13px/400</b>, yükseklik <b>32</b>, dolgu <b>0 12px</b>, köşe <b>9999px</b>, renk <code>#8a8f98</code></td></tr>
 *  <tr><td>birincil düğme</td><td colspan="2"><b>13px/510</b>, dolu zemin, aynı 32px/pill ölçüsü</td></tr>
 *  <tr><td>liste aralığı</td><td colspan="2"><b>gap: 8px</b></td></tr>
 *  <tr><td>logo</td><td colspan="2">işaret <b>22px</b> yüksek; bağlantı 32px, dolgu <b>0 8px</b>, köşe 6px</td></tr>
 *  <tr><td>geçiş</td><td colspan="2"><code>color/background .1s cubic-bezier(.25,.46,.45,.94)</code></td></tr>
 * </table>
 *
 * <h3>🔴 Yerleşimin can alıcı noktası</h3>
 * Linear'da liste <b>tek bir flex satırıdır</b> ve <b>logo öğesi büyür</b>
 * (<code>flex: 1 1 0</code>), sağ blok <b>büyümez</b> (<code>flex: 0 0 auto</code>).
 * Yani logo <b>sola yapışır</b>, geri kalan her şey sağa itilir; ortada
 * <b>max-width kabı yoktur</b> — çubuk ekranın tamamını kullanır ve logo
 * <b>41px</b> içeriden başlar. Bizde çubuk <code>max-w-[1024px]</code> ile
 * ortalanıyordu; geniş ekranda logo ekranın ortasına doğru kayıyordu.
 *
 * <h3>🔴 Mobilde ne DEĞİŞTİ (şikâyetin özü)</h3>
 * <ol>
 *   <li><b>Giriş/Kayıt mobilde de görünür.</b> Linear'da da öyle: mobilde sırayla
 *       <code>logo · Log in · Sign up · ☰</code>. Bizde bunlar hamburgerin
 *       içine gömülüydü; kayıt olmak iki dokunuş uzaklaşıyordu.</li>
 *   <li><b>Hamburger 64×64 dokunma alanı</b>, ikon <b>16px</b>. Bizimki 36px'lik
 *       bir kutucuktu (parmak hedefi olarak küçük).</li>
 *   <li><b>Menü artık `max-height` animasyonlu bir akordeon değil, TAM EKRAN
 *       katman</b>: <code>position: fixed; top: 64px; height: calc(100dvh-64px)</code>,
 *       <code>padding: 32px 24px</code>, <code>z-index: 700</code>,
 *       <code>overflow-y: auto</code>, arkada blur. Eski akordeon
 *       <code>max-height: 220px</code> ile sabitti — dört bağlantı + iki düğme
 *       sığmıyor, alttakiler <b>kırpılıyordu</b>. Menü öğeleri <b>16px</b> ve
 *       aralarında <b>12px</b>.</li>
 *   <li><b>Gövde kaydırması kilitlenir</b> (Linear'da <code>body.overflow=hidden</code>);
 *       bizde arka plan menü açıkken kayabiliyordu. Kilit projenin kendi
 *       <code>lockScroll</code>'u ile kurulur — çubuk kaybolmasın diye
 *       (vault kuralı).</li>
 * </ol>
 *
 * <p>⚠️ <b>Renk tokenlardan gelir, Linear'ın sabit renklerinden değil.</b>
 * Linear tek temalıdır (koyu); bizde çubuk hem açık hem koyu temada duruyor.
 * Ölçülen olan <b>yapı ve ölçülerdir</b>; `#8a8f98` yerine `--color-muted`,
 * `#f7f8f8` yerine `--color-ink` kullanılır. Sabit renk yazmak, açık temada
 * gri üstüne gri demekti.
 * <p>⚠️ Logo artık `staticColor` DEĞİL: çubuk temadan bağımsız beyaz olmaktan
 * çıktı, dolayısıyla logo da temayı izlemeli.
 *
 * @param anchorPrefix Bölüm bağlantılarının önüne konur. Tanıtım sayfasında
 *   boştur (`#sss` aynı sayfada kaydırır); başka sayfalarda `/` verilir.
 * @param variant `landing` menülü, `minimal` yalnız logo + giriş/kayıt
 *   (vitrin profili ve gönderi sayfası).
 */
export function MarketingNav({
  anchorPrefix = '',
  variant = 'landing',
}: {
  anchorPrefix?: string
  variant?: 'landing' | 'minimal' | 'auth'
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  // Dış yüz: sistem tercihini izle (elle seçim yoksa).
  const applyAreaDefault = useThemeStore((s) => s.applyAreaDefault)
  useEffect(() => applyAreaDefault('site'), [applyAreaDefault])
  /* Oturum açıkken Giriş/Kayıt yerine panele dönüş gösterilir — giriş yapmış
     birine "Giriş yap" göstermek anlamsız. */
  const me = useAuthStore((s) => s.user)
  /* `auth` varyantı hangi sayfada olduğumuza bakar (karşıt eylemi göstermek
     için). Diğer varyantlarda kullanılmaz. */
  const { pathname } = useLocation()
  const onLoginPage = pathname === '/login'
  const authTarget = onLoginPage ? '/register' : '/login'

  const links: { href?: string; to?: string; label: string }[] =
    variant !== 'landing'
      ? []
      : [
          /*
           * 🔴 15 Ağu 2026 — İKİ BAĞLANTI YANLIŞ HEDEFTEYDİ (kullanıcı:
           * "hakkımızda'ya tıklıyorum apayrı saçma yere gidiyor").
           *
           * ① "Hakkında" → `#sss` idi, yani SSS bölümüne kaydırıyordu.
           *    Oysa gerçek bir **`/about` sayfası var** (`AboutPage`,
           *    router.tsx). Çapa, var olan sayfanın yerine geçmişti.
           *    ⚠️ Bu yüzden artık `to:` (rota) — `href:` (çapa) değil.
           *
           * ② "Nasıl çalışır" → `#nasil` idi. `id="nasil"` sayfanın
           *    **giriş/hero bölümüdür** ("Bugün kazanmaya başla"), en üstte.
           *    Yani düğme neredeyse hiçbir şey yapmıyor gibi görünüyordu.
           *    Asıl bölümün kimliği **`nasil-calisir`**. İki çapa adının
           *    birbirine bu kadar benzemesi hatayı görünmez kılmıştı.
           *
           * ⚠️ Doğrulama yolu: çapa eklerken `grep -o 'id="[a-z-]*"'` ile
           * kimliğin GERÇEKTEN o bölüme ait olduğunu teyit et; ad benzerliği
           * kanıt değildir.
           */
          { to: '/about', label: t('landing.nav.about') },
          { href: `${anchorPrefix}#nasil-calisir`, label: t('landing.nav.how') },
          { href: `${anchorPrefix}#fiyatlar`, label: t('landing.nav.pricing') },
          /* 🔴 10 Ağu 2026 — "Harita" artık bir bölüm çapası DEĞİL, gerçek
             rota. Kullanıcı: "landing'deki haritaya tıklayınca haritadaki
             online mağazaları görüntülesin, yani harita açılsın". `#harita`
             sayfanın içindeki tanıtım bölümüne kaydırıyordu; ziyaretçi
             gerçek haritayı hiç görmüyordu. */
          { to: '/map', label: t('landing.nav.map') },
        ]

  /*
   * Menü açıkken gövde kilitlenir (Linear: `body { overflow: hidden }`).
   * ⚠️ Kilit `overflow:hidden` ile DEĞİL, projenin sayaçlı `lockScroll`'u ile
   * kurulur: doğrudan `hidden` yazmak kaydırma çubuğunu kaldırıyor ve sayfa
   * her açılışta 8px kayıyordu (vault tuzağı).
   */
  useEffect(() => {
    if (!open) return
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [open])

  // Adres değişince menü kapanır (bağlantıya basıldığında açık kalmasın).
  useEffect(() => setOpen(false), [variant])

  /**
   * 🔴 **10 Ağustos 2026 — BÖLÜM BAĞLANTILARI ARTIK YUMUŞAK KAYIYOR.**
   *
   * Kullanıcı: *"navbardaki kısımlara tıklayınca soft şekilde gidip gelmeli,
   * bir anda gidiyor pat diye"*. Doğruydu: bağlantılar düz `<a href="#sss">`
   * idi ve tarayıcının varsayılanı **anında sıçramaktır**.
   *
   * ⚠️ Çözüm `html { scroll-behavior: smooth }` DEĞİL. O, kaydırmayı
   * uygulamanın **her yerinde** ele geçirir: rota değişimlerinde sayfa başına
   * dönüş, sohbette en alta inme, modal açılışları — hepsi animasyona girer ve
   * geri/ileri düğmesinde konum geri yüklemesi görünür şekilde savrulur.
   * Burada yalnız <b>bu dört bağlantı</b> yumuşatılır.
   *
   * ⚠️ Hedef, yapışkan çubuğun <b>altına</b> hizalanır: `scrollIntoView` bölümü
   * ekranın tepesine koyar ve başlık çubuğun arkasında kalırdı.
   *
   * ⚠️ `prefers-reduced-motion` açıksa animasyon yapılmaz — hareket duyarlılığı
   * olan kullanıcı için bu bir süs değil, rahatsızlık kaynağıdır.
   *
   * ⚠️ Yalnız hedef **bu sayfada varsa** devralınır. Başka bir sayfadayken
   * (`anchorPrefix = '/'`) bağlantı önce tanıtım sayfasına gitmelidir; orada
   * eleman yoktur, `preventDefault` çağırmayız ve tarayıcının normal gezinmesi
   * çalışır.
   */
  const smoothScrollTo = (href: string | undefined) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const hash = href?.includes('#') ? href.slice(href.indexOf('#')) : ''
    if (!hash || hash.length < 2) return
    const target = document.querySelector(hash)
    if (!target) return
    e.preventDefault()
    const wasOpen = open
    setOpen(false)

    const run = () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      /* Çubuk yüksekliği ölçülür, sabit yazılmaz: 64px (mobil) ve 72px (768+)
         iki ayrı değer ve ileride yine değişebilir. */
      const barHeight = document.querySelector('.waydee-nav')?.getBoundingClientRect().height ?? 0
      const top = target.getBoundingClientRect().top + window.scrollY - barHeight
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
      // Adres çubuğu da hedefi göstersin (paylaşılabilir bağlantı) — sıçratmadan.
      history.replaceState(null, '', hash)
    }

    /*
     * 🔴 MOBİLDE KAYDIRMA, KİLİT KALKTIKTAN SONRA YAPILMALI.
     * Tam ekran menü açıkken gövde `position: fixed` ile sabittir ve
     * `lockScroll`'un çözücüsü kapanışta `window.scrollTo(0, savedScrollY)`
     * çağırır — hemen kaydırsaydık ölçüm sabit gövdeden alınır, ardından kilit
     * çözücüsü bizi eski konuma geri fırlatırdı. Kilit `open` durumunu izleyen
     * effect'in temizliğinde kalkıyor, yani bir sonraki karede: iki `rAF` ile
     * o karenin ötesine geçiyoruz.
     */
    if (wasOpen) {
      requestAnimationFrame(() => requestAnimationFrame(run))
    } else {
      run()
    }
  }

  return (
    <>
      <header className="waydee-nav">
        <nav className="waydee-nav-inner" aria-label="Waydee">
          {/* ⚠️ `flex: 1 1 0` — logo sola yapışır, geri kalan sağa itilir. */}
          <div className="waydee-nav-logo">
            <Link to="/" aria-label="Waydee" className="waydee-nav-logo-link">
              {/* ⚠️ `staticColor` GERİ GELDİ: çubuk temadan bağımsız BEYAZ cam.
                  Kaldırıldığında koyu temalı bir işletim sisteminde logo
                  beyaza çevrilip beyaz camın üstünde kayboluyordu. */}
              <Logo imgClassName="h-[22px]" staticColor />
            </Link>
          </div>

          {/* Orta menü: yalnız `landing` varyantında ve yalnız masaüstünde. */}
          {links.length > 0 && (
            <ul className="waydee-nav-list">
              {links.map((l) => (
                <li key={l.to ?? l.href}>
                  {/* ⚠️ Rota olan öğe `Link` ile çizilir: `<a href="/map">`
                      tam sayfa yeniden yükleme yapar ve uygulama sıfırdan
                      açılırdı. Çapa olanlar `<a>` kalır. */}
                  {l.to ? (
                    <Link to={l.to} className="waydee-nav-link">
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} onClick={smoothScrollTo(l.href)} className="waydee-nav-link">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="waydee-nav-actions">
            {/* 🔴 Linear'daki DİKEY AYIRICI (`TZTsQG_navDivider`): 1×16px,
                `margin: 0 8px`, mobilde gizli. Ölçüldü 10 Ağu 2026.
                Bölüm menüsü ile hesap eylemlerini ayırır; bizde hiç yoktu ve
                "Harita" ile "Giriş yap" tek bir sıra gibi okunuyordu. */}
            {links.length > 0 && <span className="waydee-nav-divider" aria-hidden />}
            {/*
              🔴 `auth` varyantı: giriş/kayıt ekranlarının çubuğu. Referansın
              (ve bizim eski `AuthTopBar`'ın) davranışı korunur — <b>karşıt</b>
              eylem gösterilir: giriştaysan "Hesap oluştur", kayıttaysan
              "Giriş yap". Aynı sayfaya götüren bir düğme göstermek anlamsızdı.
              ⚠️ Bu ekranlar için ayrı bir çubuk YAZILMADI: iki farklı üst çubuk
              zaten bu projede bir kez ayrışmıştı (7 Ağu, vitrin profili).
            */}
            {variant === 'auth' ? (
              <Link
                to={authTarget}
                className="waydee-nav-link waydee-nav-cta"
              >
                {onLoginPage ? t('auth.createAccount') : t('auth.login')}
              </Link>
            ) : me ? (
              <Link to="/home" className="waydee-nav-link waydee-nav-cta">
                {t('nav.dashboard')}
              </Link>
            ) : (
              <>
                {/* ⚠️ İkisi de MOBİLDE DE görünür (Linear'ın davranışı). */}
                <Link to="/login" className="waydee-nav-link">
                  {t('landing.nav.login')}
                </Link>
                <Link to="/register" className="waydee-nav-link waydee-nav-cta">
                  {t('landing.nav.signup')}
                </Link>
              </>
            )}

            {/* Hamburger: 64×64 dokunma alanı, 16px ikon — yalnız menü varsa. */}
            {links.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="waydee-nav-burger"
                aria-label={open ? t('common.close') : 'Menu'}
                aria-expanded={open}
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* ---- mobil katman: çubuğun ALTINDAN başlar, ekranı kaplar ---- */}
      {links.length > 0 && open && (
        <div className="waydee-nav-sheet" role="dialog" aria-modal="true">
          <ul className="waydee-nav-sheet-list">
            {links.map((l) => (
              <li key={l.to ?? l.href}>
                {l.to ? (
                  <Link to={l.to} onClick={() => setOpen(false)} className="waydee-nav-sheet-link">
                    {l.label}
                  </Link>
                ) : (
                  // Mobil katmanda da aynı yumuşak kayma; `smoothScrollTo`
                  // katmanı kendisi kapatır ve kilit kalkana dek bekler.
                  <a href={l.href} onClick={smoothScrollTo(l.href)} className="waydee-nav-sheet-link">
                    {l.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <div className="waydee-nav-sheet-divider" />
          <ul className="waydee-nav-sheet-list">
            {me ? (
              <li>
                <Link to="/home" onClick={() => setOpen(false)} className="waydee-nav-sheet-link">
                  {t('nav.dashboard')}
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link to="/login" onClick={() => setOpen(false)} className="waydee-nav-sheet-link">
                    {t('landing.nav.login')}
                  </Link>
                </li>
                <li>
                  <Link to="/register" onClick={() => setOpen(false)} className="waydee-nav-sheet-link">
                    {t('landing.nav.signup')}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </>
  )
}
