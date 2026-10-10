import { Fragment, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Search } from 'lucide-react'
import { PRIMARY_NAV, type PrimaryNavItem } from '@/app/primaryNav'
import { Avatar } from '@/components/ui/avatar'
import { Logo } from '@/components/Logo'
import { CreateMenu } from '@/components/layout/CreateMenu'
import { NotificationsBell } from '@/features/notifications/NotificationsBell'
import { SearchDialog } from '@/features/discovery/SearchDialog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useT } from '@/i18n'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

/**
 * Uygulama kabuğu — <b>`home.html` referansıyla birebir</b>.
 *
 * Referansın yapısı (DOM dökümünden):
 * ```
 * <div class="flex waydee-app-h w-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
 *   <div class="hidden md:flex flex-col items-center waydee-app-h w-[80px]
 *               bg-transparent backdrop-blur-2xl py-6 z-50">        ← SOL SIDEBAR
 *     <div class="flex-1 w-full px-2 overflow-y-auto
 *                 flex flex-col justify-center">                     ← ikonlar DİKEYDE ORTALI
 *   <div class="md:hidden flex fixed bottom-0 pb-4 left-0 right-0 h-20
 *               bg-transparent backdrop-blur-lg z-50
 *               items-center justify-around px-2">                   ← MOBİL ALT BAR
 *   <div class="flex-1 flex flex-col waydee-app-h overflow-y-auto bg-transparent">
 *     <nav sticky top-0 backdrop-blur-lg backdrop-saturate-150 bg-transparent
 *          style="--navbar-height:4rem">
 *       <header class="px-6 gap-4 h-[var(--navbar-height)] max-w-[1024px]">
 *     <main class="flex-1 w-full mx-auto max-w-7xl">
 *       <div class="p-4 md:p-6 pb-24 md:pb-8">
 * ```
 *
 * 🔴 <b>Sidebar ve navbar SAYDAMDIR</b> — renk vermezler, yalnız
 * `backdrop-blur` uygularlar. Zemin rengi tek yerde: dış kaptaki
 * `bg-zinc-50 / dark:bg-zinc-950`. Bunlara zemin rengi eklemek referansın
 * "tek tuval" hissini bozar.
 *
 * ⚠️ <b>Kaydırma İÇERİK SÜTUNUNDADIR</b>, pencerede değil: dış kap
 * `waydee-app-h overflow-hidden`. Sidebar bu yüzden sayfa kaydıkça yerinde kalır
 * (`position: sticky` gerekmez).
 *
 * ⚠️ İkonlar referansta Phosphor 26px; burada projenin mevcut `lucide` seti
 * <b>aynı 26px kutuda</b> kullanılır — ikinci bir ikon paketi eklemek 40 KB'lık
 * bir bağımlılığı yalnız çizim farkı için getirirdi.
 */
export function AppShell({
  children,
  /** Harita gibi tuvali kaplayan ekranlar: dolgu ve genişlik sınırı uygulanmaz. */
  fullBleed = false,
}: {
  children: React.ReactNode
  fullBleed?: boolean
}) {
  /*
   * 🔴 9 Ağu 2026 — UYGULAMANIN İÇİ VARSAYILAN KOYU (kullanıcı isteği:
   * "ilk açılışta dark mod açılacak, site değil uygulama içerisi").
   * Karar alan bazlıdır: dış yüz (`MarketingNav`) sistem tercihini izler.
   * ⚠️ Kullanıcı tema düğmesine bir kez bastıysa (`explicit`) burası hiçbir
   * şey yapmaz — aksi halde düğme her sayfa geçişinde eziliyor olurdu.
   */
  const applyAreaDefault = useThemeStore((s) => s.applyAreaDefault)
  useEffect(() => applyAreaDefault('app'), [applyAreaDefault])

  return (
    <div className="waydee-app flex waydee-app-h w-full overflow-hidden">
      <SideBar />
      <MobileBar />
      {/* Referans: `flex-1 flex flex-col waydee-app-h overflow-y-auto relative bg-transparent`
          — ⚠️ full-bleed'de `overflow-hidden`, yoksa harita tuvali içeride kayardı. */}
      <div
        /*
         * 🔴 25 Ağu 2026 (3. tur) — full-bleed'de masaüstünde `overflow-visible`.
         *
         * Harita tuvali bilerek sol kolonun ve üst çubuğun ALTINA taşıyor
         * (`waydee-map-bleed`) ki camın arkasında gerçek harita olsun. Bu
         * kolondaki `overflow-hidden` o taşmayı en dıştaki kaptan önce
         * kırpıyordu, yani kolonun arkası yine boş kalıyordu.
         *
         * ⚠️ Taşma başıboş değil: kabuk (`waydee-app`) hâlâ `overflow-hidden`
         * ve taşan tuvali ekran kenarında kesiyor — sayfa büyümüyor,
         * kaydırma çubuğu çıkmıyor.
         */
        className={`relative flex waydee-app-h flex-1 flex-col bg-transparent ${
          fullBleed ? 'overflow-hidden md:overflow-visible' : 'overflow-y-auto'
        }`}
      >
        <TopBar />
        {fullBleed ? (
          <main className="min-h-0 w-full flex-1">{children}</main>
        ) : (
          <main className="mx-auto w-full max-w-7xl flex-1">
            <div className="p-4 pb-24 md:p-6 md:pb-8">{children}</div>
          </main>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ sidebar */

function SideBar() {
  return (
    /* 🔴 25 Ağu 2026 — APPLE CAM (kullanıcı isteği). `bg-transparent` +
       `backdrop-blur-2xl` yalnız BULANIKLIKTI: zemin yoktu, doygunluk yoktu,
       kenar yoktu — yani "cam" değil, arkasındaki her şeyin soluk bir kopyası.
       Cam artık tek yerden geliyor (`.waydee-glass-nav`, gerekçe orada). */
    /* ⚠️ `relative` ŞART: `z-50` konumlanmamış bir öğede HİÇBİR ŞEY yapmaz ve
       boyama sırası DOM sırasına düşerdi — harita tuvali kolonun altına
       taşıdığı için kolonun ÜSTÜNE çizilir, cam yerine tuval görünürdü. */
    <div className="waydee-glass-nav waydee-glass-rail relative z-50 hidden waydee-app-h w-[80px] flex-col items-center py-6 transition-colors md:flex">
      {/* ⚠️ Kaydırma çubuğu GİZLİ (referansta satır içi stille) ve öğeler
          `justify-center` ile dikeyde ortalı — üstte logo, altta menü yok. */}
      <div
        className="flex w-full flex-1 flex-col justify-center overflow-y-auto px-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {/* ⚠️ + TAM ORTADA kalmalı. Liste 16 Ağu 2026'da <b>beş</b> öğeye
            çıktı (yapay zekâ eklendi), bu yüzden bölme noktası 2'den
            <b>3</b>'e taşındı. 7 Eki 2026'da influencer keşfi + düğmesinin
            SAĞINA eklendi: artık <b>üç · + · üç</b> — yedi yuvanın tam ortası. */}
        {PRIMARY_NAV.slice(0, 3).map((item) => (
          <SideItem key={item.to} item={item} />
        ))}
        <CreateMenu />
        {PRIMARY_NAV.slice(3).map((item) => (
          <SideItem key={item.to} item={item} />
        ))}
      </div>
    </div>
  )
}

function SideItem({ item }: { item: PrimaryNavItem }) {
  const t = useT()
  const Icon = item.icon
  const user = useAuthStore((s) => s.user)
  const label = t(item.labelKey)

  return (
    <NavLink
      to={item.to}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        `waydee-side-item ${isActive ? 'waydee-side-item-on' : ''}`
      }
    >
      {item.avatar && user ? (
        <Avatar src={user.avatarUrl ?? undefined} name={user.displayName} className="h-7 w-7" />
      ) : (
        /* ⚠️ Yapay zekâ sekmesi degradeli çizilir (`waydee-nav-spark`) — yeni
           bir yetenek ve fark edilmesi gerekiyor. Aktif hâlde vurgu
           `waydee-side-item-on`dan gelir, renk ondan bağımsızdır. */
        <Icon
          className={`h-[26px] w-[26px] ${item.glow ? 'waydee-nav-spark' : ''}`}
          strokeWidth={1.9}
        />
      )}
    </NavLink>
  )
}

/* --------------------------------------------------------------- mobil bar */

function MobileBar() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  return (
    /* 🔴 ÇUBUĞUN KENDİ ZEMİNİ VAR (9 Ağu 2026).
       Eskiden `bg-transparent` idi ve arkasında ne varsa o görünüyordu. Harita
       yüzeylerinde altta `MapScrim` duruyor — `from-black/70` ile 112px'lik
       KOYU bir perde. Çubuk 80px olduğu için tamamı o perdenin içine düşüyor,
       aktif ikon (`#18181b`, neredeyse siyah) siyah zemine oturup KAYBOLUYORDU.
       Mobil yatayda ekran kısaldığı için perde oransal olarak daha çok yer
       kaplıyor ve sorun her seferinde görünür hâle geliyordu.
       ⚠️ Çözüm "perdeyi kısaltmak" DEĞİL: perde Mapbox künyesini bastırmak için
       var ve beş harita yüzeyinde de aynı. Çubuğa kendi yüzeyini vermek,
       arkasında ne olursa olsun kontrastı garantiler. */
    /* 🔴 25 Ağu 2026 — burası da Apple cam. ⚠️ Yukarıdaki notun kuralı
       KORUNUYOR: çubuğun KENDİ zemini var (`.waydee-glass-nav` %62 opak) ve
       ikonlar cam üstünde ayrıca sertleştirildi — `MapScrim`in koyu perdesi
       altında aktif ikon yine kaybolurdu. */
    <div className="waydee-glass-nav waydee-glass-tabbar fixed inset-x-0 bottom-0 z-50 flex h-20 items-center justify-around px-2 pb-4 md:hidden">
      {PRIMARY_NAV.map((item, i) => {
        const Icon = item.icon
        const label = t(item.labelKey)
        // Mobilde de + ortada durur — üçüncü öğeden sonra (bkz. sidebar notu).
        const plus = i === 3 ? <CreateMenu compact /> : null
        // ⚠️ `key` DIŞ öğeye verilir. Boş `<>` fragment key taşıyamaz; anahtar
        // içerideki `NavLink`'e yazıldığı için React "unique key" uyarısı
        // basıyordu (konsol her render'da kirleniyordu).
        return (
          <Fragment key={item.to}>
          {plus}
          <NavLink
            to={item.to}
            aria-label={label}
            className={({ isActive }) =>
              `waydee-side-item ${isActive ? 'waydee-side-item-on' : ''}`
            }
          >
            {item.avatar && user ? (
              <Avatar src={user.avatarUrl ?? undefined} name={user.displayName} className="h-6 w-6" />
            ) : (
              /* Referans: mobilde 22px, aktifken 28px. */
              <Icon
                className={`h-[22px] w-[22px] ${item.glow ? 'waydee-nav-spark' : ''}`}
                strokeWidth={1.9}
              />
            )}
                </NavLink>
          </Fragment>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------- navbar */

function TopBar() {
  const t = useT()
  const navigate = useNavigate()
  const { refreshToken, clear } = useAuthStore()
  const [searchOpen, setSearchOpen] = useState(false)

  const logout = async () => {
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken })
    } catch {
      // oturum zaten kapanmış olabilir
    } finally {
      clear()
      navigate('/login', { replace: true })
    }
  }

  return (
    /*
     * 🔴 25 Ağu 2026 (2. tur) — ÜST ÇUBUK DA `.waydee-glass-nav`.
     *
     * Bildirilen hata: *"PC'de sol tarafla üst tarafın kesişim noktasında
     * keskinlik istemiyorum, birebir aynı tonda olsun"*. Sebep iki yüzeyin
     * FARKLI tarifler kullanmasıydı: kolon `%62 opak yüzey + blur(22px) +
     * saturate(180%)`, üst çubuk ise `bg-transparent + backdrop-blur-lg`
     * (zemin yok, doygunluk yok). İki farklı formül = iki farklı ton, ve
     * ikisinin birleştiği köşede net bir sınır.
     *
     * ⚠️ Ton artık TEK sınıftan geliyor; burada Tailwind ile ikinci bir blur
     * TANIMLANMAZ — üst üste binen iki `backdrop-filter` aynı bölgeyi iki kez
     * bulanıklaştırıp köşeyi yine koyulaştırırdı.
     */
    <nav
      className="waydee-glass-nav sticky inset-x-0 top-0 z-40 flex h-auto w-full items-center justify-center"
      style={{ ['--navbar-height' as string]: '4rem' }}
    >
      {/* 🔴 25 Ağu 2026 — masaüstünde LOGO SOLA ALINDI (kullanıcı isteği).
          Başlık `max-w-[1024px]` ile ortalanıyordu; geniş ekranda logo, sol
          kenardaki gezinme kolonundan kopup ekranın ortasına doğru kayıyordu.
          Artık masaüstünde genişlik sınırı yok ve dolgu daralıyor — logo
          kolonun hemen sağında başlıyor. ⚠️ Mobilde eski dolgu (`px-6`)
          korunuyor: orada sol kolon yok ve logo kenara yapışırdı. */}
      <header className="relative z-40 flex h-[var(--navbar-height)] w-full max-w-[1024px] flex-row flex-nowrap items-center justify-between gap-4 bg-transparent px-6 md:max-w-none md:ps-3 md:pe-6">
        {/*
          🔴 8 Ağu 2026 — GERÇEK LOGO (kullanıcı: "navbarda hâlâ saçma sapan
          logo var"). Burada düz metin "Waydee" yazıyordu; marka işareti
          `public/logo.svg` olarak zaten vardı ve tanıtım sayfası, giriş
          ekranı ve yönetim paneli onu kullanıyordu — <b>yalnız uygulamanın
          kendi üst çubuğu</b> metinde kalmıştı.
          ⚠️ `Logo` bileşeni kullanılır, yeni bir `img` yazılmaz: koyu tema
          dönüşümü (`waydee-brand-logo`) orada tek noktada çözülü.
        */}
        <div className="mr-4 flex flex-grow basis-0 flex-row flex-nowrap items-center justify-start whitespace-nowrap">
          <NavLink to="/home" aria-label="Waydee" className="waydee-topbar-brand">
            <Logo imgClassName="h-7" />
          </NavLink>
        </div>
        {/* Sağda yalnız ikincil eylemler — birincil gezinme sidebar'dadır. */}
        <div className="flex h-full flex-row flex-nowrap items-center gap-1">
          {/*
            🔴 16 Ağu 2026 — YAPAY ZEKÂ DÜĞMESİ BURADAN KALDIRILDI, birincil
            gezinmeye taşındı (kullanıcı: "ai butonunu profilin sol tarafına
            taşı, o navbara taşıyacaksın"). Tanımı `app/primaryNav.ts`'de,
            profilin hemen öncesinde.
            ⚠️ İki yerde birden bırakılmadı: aynı hedefe iki giriş noktası,
            kullanıcıya "bunlar farklı şeyler mi?" dedirtir.
          */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t('common.search')}
            className="waydee-topbar-btn"
          >
            <Search className="h-5 w-5" />
          </button>
          {/*
            🔴 8 Ağu 2026 — SOHBET ve KEŞFET düğmeleri KALDIRILDI (kullanıcı isteği:
            "şimdilik kapat, front tarafında hiçbir şekilde görünmesinler").
            Backend uçları da aynı turda kapatıldı
            (`waydee.features.messaging.enabled` / `explore.enabled` → **404**).
            ⚠️ Yalnız düğmeyi gizlemek yetmezdi: rotalar hâlâ elle yazılabilirdi
            ve açık uçlar kalırdı. Rotalar `router.tsx`'ten de çıkarıldı.
            Geri açmak: buraya iki `NavLink`, router'a üç rota, backend'de iki bayrak.
          */}
          <NotificationsBell />
          <ThemeToggle />
          {/* 🔴 9 Ağu 2026 — üst bardaki AYARLAR ikonu kaldırıldı (kullanıcı
              isteği). Ayarlar artık profilde, "Çıkış yap"ın hemen üstünde bir
              hap düğme: panel bağlantılarının hepsi tek yerde toplandı.
              ⚠️ `/settings` rotası DURUYOR — doğrudan adres ve eski yer
              imleri çalışmaya devam etmeli. */}
          <button
            type="button"
            onClick={logout}
            aria-label={t('nav.logout')}
            className="waydee-topbar-btn"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      {/* ⚠️ SearchDialog `open` prop'u almaz — koşullu render edilir. */}
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </nav>
  )
}
