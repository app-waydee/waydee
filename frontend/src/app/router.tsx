import { lazy, Suspense } from 'react'
import { PublicCollectionPage } from '@/features/collection/PublicCollectionPage'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageSpinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/stores/auth'
import { RedirectIfAuthed, RequireAuth } from './guards'
import { LandingPage } from '@/features/landing/marketing/LandingPage'
import { AboutPage } from '@/features/landing/marketing/AboutPage'
import { LegalPage } from '@/features/legal/LegalPage'
import { PublicMapPage } from '@/features/landing/PublicMapPage'
import { PublicProfilePage } from '@/features/landing/PublicProfilePage'
import { VisitorGate } from '@/features/landing/VisitorGate'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { GoogleCallbackPage } from '@/features/auth/GoogleCallbackPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { MapPage } from '@/features/map/MapPage'
import { StoreRedirect } from '@/features/territory/StoreRedirect'
import { MePage } from '@/features/me/MePage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { MarketplaceDetailPage } from '@/features/marketplace/MarketplaceDetailPage'
import { MarketplacesPage } from '@/features/marketplace/MarketplacesPage'
import { UserRedirect } from '@/features/user/UserRedirect'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'
import { HomePage } from '@/features/home/HomePage'
import { CollectionPage } from '@/features/collection/CollectionPage'
import { TagProfilePage } from '@/features/profile/TagProfilePage'
import { StoreStudioPage } from '@/features/marketplace/StoreStudioPage'
import { StoreStatsPage } from '@/features/marketplace/StoreStatsPage'
import { PostEditPage } from '@/features/post/PostEditPage'
import { PostDetailPage } from '@/features/post/PostDetailPage'
import { PublicPostPage } from '@/features/post/PublicPostPage'
import { SavedPostsPage } from '@/features/post/SavedPostsPage'
import { InvoicesPage } from '@/features/billing/InvoicesPage'
import { PlanPage } from '@/features/plan/PlanPage'
import { PaymentReturnPage } from '@/features/payment/PaymentReturnPage'
import { ShareCardPage } from '@/features/share/ShareCardPage'
import { AiStudioPage } from '@/features/ai/AiStudioPage'
import { CreatorsPage } from '@/features/creators/CreatorsPage'

/**
 * Kullanıcı uygulaması yönlendirmeleri.
 * Yönetim ekranları ayrı bir uygulamada (waydee-admin) yayınlanır; burada hiçbir admin rotası yoktur.
 */
/**
 * <b>Harita kapısı</b> — `/map` adresinde hangi haritanın açılacağına karar verir.
 *
 * <p>Ziyaretçi: vitrin haritası (kimliksiz, ziyaretçi geçişiyle).
 * Oturumlu: uygulamanın haritası — `RequireAuth` yeniden kullanılır, böylece
 * kabuk, e-posta şeridi ve tam-tuval yerleşimi <b>kopyalanmaz</b>.
 */
function MapGateway() {
  const user = useAuthStore((s) => s.user)
  if (!user) {
    return (
      <VisitorGate>
        <PublicMapPage />
      </VisitorGate>
    )
  }
  return <RequireAuth />
}

/** Eski `/harita` adresi — sorgu dizesi korunarak `/map`'e taşınır. */
function LegacyMapRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/map${search}`} replace />
}

/**
 * Eski <b>Türkçe</b> pazar yeri adresleri → İngilizce karşılıkları.
 *
 * <p>🔴 16 Ağu 2026, kullanıcı talimatı: <i>"URL'lerde özel isim (pazar yeri
 * adı gibi) hariç tüm kısımlar İngilizce olsun."</i> Ürünün tüm dış yüzeyi
 * beş dilli; adres çubuğuna tek bir dilin (üstelik ASCII'ye düşürülmüş)
 * yazımını sabitlemek tutarsızdı. Aynı gerekçeyle `/hakkimizda` 8 Ağustos'ta
 * `/about` olmuştu.
 *
 * <p>Yeni adresler: `/pazar` → <b>`/market`</b>, `magazam` → <b>`my-store`</b>.
 *
 * <p>⚠️ Eski yollar SİLİNMEDİ. Silinselerdi `/pazar` en alttaki `/:tag`
 * kuralına düşer ve kullanıcı "pazar" adlı bir <b>vitrin profili</b> arayan
 * 404 ekranı görürdü — dışarıda paylaşılmış her bağlantı sessizce kırılırdı.
 * ⚠️ Sorgu dizesi korunur; `?tab=` gibi parametreler yönlendirmede kaybolmaz.
 */
function LegacyMarketRedirect() {
  const { pathname, search } = useLocation()
  const next = pathname.replace(/^\/pazar/, '/market').replace('/magazam/', '/my-store/')
  return <Navigate to={`${next}${search}`} replace />
}

/** Eski `/kartim` adresi → `/my-card` (aynı gerekçe, bkz. yukarısı). */
function LegacyCardRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/my-card${search}`} replace />
}

/**
 * 🔴 3B evren <b>ayrı bir paket parçasıdır</b>.
 *
 * <p>three.js + `@react-three/fiber` + `drei` birlikte ~600 KB gzip tutuyor.
 * Doğrudan `import` edilseydi bu ağırlık <b>ana pakete</b> girer ve uygulamayı
 * yalnız harita için açan herkes indirirdi. `lazy` sayesinde ücret, evrene
 * gerçekten giren kişiye kesiliyor.
 */
const MarketplaceWorldPage = lazy(() =>
  import('@/features/world/MarketplaceWorldPage').then((m) => ({ default: m.MarketplaceWorldPage })),
)

function LazyWorld() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <MarketplaceWorldPage />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  // E-posta akışları HİÇBİR guard'ın altında değildir: doğrulama bağlantısına
  // başka bir cihazdan tıklanabilir (oturum yok) ya da oturum açıkken tıklanabilir
  // (RedirectIfAuthed altında olsaydı /map'e atılır, doğrulama hiç çalışmazdı).
  /*
   * Kurumsal / yasal sayfalar — guard'ların DIŞINDA: `RedirectIfAuthed` altına
   * konsaydı oturum açmış bir kullanıcı footer'daki bağlantıya bastığında
   * `/map`'e atılırdı. Hiçbiri veri ucu çağırmaz → ziyaretçi geçişi de gerekmez.
   *
   * 🔴 Yollar İNGİLİZCE (8 Ağu 2026, kullanıcı uyardı: "hakkimizda diye about
   * yapacaksın"). Ürünün tüm dış yüzeyi beş dilli; tek bir dilin yazımını
   * (üstelik ASCII'ye düşürülmüş hâlini) adres çubuğuna sabitlemek tutarsızdı.
   */
  { path: '/about', element: <AboutPage /> },
  { path: '/privacy', element: <LegalPage kind="privacy" /> },
  { path: '/terms', element: <LegalPage kind="terms" /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  // Google dönüşü de guard'ların DIŞINDA: `setSession` çalışır çalışmaz
  // `RedirectIfAuthed` devreye girip `next` hedefini ezerdi (bkz. sayfa notu).
  { path: '/auth/google', element: <GoogleCallbackPage /> },
  {
    // Oturum açıkken vitrin/giriş/kayıt görünmez → /map'e yönlenir.
    element: <RedirectIfAuthed />,
    children: [
      /*
       * Tanıtım sayfası — ⚠️ ziyaretçi kapısının DIŞINDA.
       * Hiçbir veri ucu çağırmadığı için geçişe ihtiyacı yok; ürünü ilk kez
       * duyan birinin önüne Cloudflare doğrulaması koymak dönüşümü kırıyordu.
       */
      { path: '/', element: <LandingPage /> },
      // Vitrin haritası: gerçek haritanın görüntüleme-yalnız hali (kimliksiz
      // public uçlar) — bunlar geçiş ister, o yüzden kapının ALTINDA kalır.
      {
        element: (
          <VisitorGate>
            <Outlet />
          </VisitorGate>
        ),
        children: [
          { path: '/p/:userId', element: <PublicProfilePage /> },
        ],
      },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/home', element: <HomePage /> },
      // Koleksiyon detayı — ad düzenleme · sil/kopyala/paylaş · gönderi ızgarası
      { path: '/collections/:collectionId', element: <CollectionPage /> },
      // 🔴 Gönderi düzenleme TAM EKRAN bir sayfadır, modal değil.
      { path: '/posts/:postId/edit', element: <PostEditPage /> },
      /* Gonderi detayi: begeni/kaydetme dugmelerinin bulundugu tek gonderi
         ekrani. `/edit`ten SONRA gelmez - React Router statik segmenti
         (`edit`) zaten once eslestirir, ama okuma sirasi bozulmasin diye
         yan yana duruyorlar. */
      { path: '/posts/:postId', element: <PostDetailPage /> },
      /* Begendiklerim / kaydettiklerim - profilden acilir. */
      { path: '/saved', element: <SavedPostsPage /> },
      /*
       * 🔴 8 Ağu 2026 — `/chat`, `/chat/requests`, `/chat/:id` ve `/explore`
       * rotaları KALDIRILDI (kullanıcı: "şimdilik kapat"). Sayfa bileşenleri
       * depoda duruyor; geri açmak dört satır ve iki backend bayrağıdır
       * (`MESSAGING_ENABLED` / `EXPLORE_ENABLED`).
       * ⚠️ Yalnız üst bardaki düğmeleri gizlemek YETMEZDİ: rota tanımlı
       * kaldıkça adres elle yazılıp açılabilir ve kapalı uçlara istek atan
       * bir ekran çizilirdi.
       */
      /* 🔴 Daire sayfası KALDIRILDI: daireye tıklayınca artık SAHİBİNİN
         profili açılır. Eski ekran bölgenin mini sitesiydi (kiralama bilgisi,
         gömülü site/HTML, anket, etkinlik); daire artık Premium üyenin
         mağazası ve arkasında bir kişi var. */
      { path: '/t/:territoryId', element: <StoreRedirect /> },
      { path: '/me', element: <MePage /> },
      { path: '/settings', element: <SettingsPage /> },
      // Üyelik: plan, bugünkü kullanım, Pro'nun getirdikleri ve güncel ücret.
      { path: '/plan', element: <PlanPage /> },
      { path: '/invoices', element: <InvoicesPage /> },
      // Ödemeden dönüş: sonucu SUNUCUDAN yoklar (sağlayıcı bildirimi oraya gider).
      { path: '/payment/return', element: <PaymentReturnPage /> },
      // "Ben de Waydee'deyim!" paylaşım kartı — kayıttan sonra ve profilden.
      { path: '/my-card', element: <ShareCardPage /> },
      { path: '/kartim', element: <LegacyCardRedirect /> },
      { path: '/reports', element: <ReportsPage /> },
      // Analytics — referans ekranı. Eski /reports geriye dönük duruyor.
      { path: '/analytics', element: <AnalyticsPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      /*
       * 🔴 Yapay zekâ stüdyosu (V45) — üst çubuktaki kıvılcım düğmesi buraya
       * getirir. Yol İNGİLİZCE (`/ai`), vault kuralı gereği.
       * ⚠️ `RequireAuth` altında: her uç oturum istiyor ve ziyaretçiye
       * gösterilecek hiçbir şey yok. Plan kapısı ayrıca SUNUCUDA — ücretsiz
       * hesap sayfayı açar ama üretim yapamaz (ekranda yükseltme kartı çıkar).
       */
      { path: '/ai', element: <AiStudioPage /> },
      /*
       * 🔴 108. tur — Influencer keşfi (V61). Yol İNGİLİZCE (vault kuralı).
       * ⚠️ `RequireAuth` altında: her uç oturum ve kredi istiyor. Sağlayıcı
       * yapılandırılmamışsa ekran açılır ama "henüz etkin değil" der — kapı
       * SUNUCUDA, kimseden para alınmaz.
       */
      { path: '/creators', element: <CreatorsPage /> },
      /*
       * 🔴 8 Ağu 2026 — `/u/:id` artık BİR SAYFA DEĞİL, KÖPRÜ. Eski
       * `UserProfilePage` (Instagram düzeni) silindi; tek gerçek profil
       * vitrin profilidir (`/{tag}`). Rota silinmedi çünkü `/u/:id`
       * uygulamanın on beş yerinde kullanılıyor ve çoğunun elinde yalnız
       * kimlik var — köprü kimliği ada çevirip yönlendirir.
       */
      { path: '/u/:userId', element: <UserRedirect /> },
      /*
       * Pazar yeri: vitrin listesi + tek pazarın stant ızgarası.
       * 🔴 16 Ağu 2026 — yollar İNGİLİZCE (`/pazar` → `/market`). Slug bir
       * ÖZEL İSİMdir ve olduğu gibi kalır: `/market/tekno`.
       */
      { path: '/market', element: <MarketplacesPage /> },
      { path: '/market/:slug', element: <MarketplaceDetailPage /> },
      /*
       * 🔴 Mağaza stüdyosu — kabul edilen stant sahibinin paneli.
       * Kapı SUNUCUDA (`StoreStudioService.requireOwned`): rota herkese
       * açık görünse de onaylı olmayan/başkasına ait stant 400/403 döner.
       */
      { path: '/market/:slug/my-store/:listingId', element: <StoreStudioPage /> },
      /* 🔴 İstatistikler stüdyonun ALTINDA bir yol (97. tur): ikisi de aynı
         stanta ait ve aynı sahiplik kapısından geçiyor. Ayrı bir kök yol
         açmak, "hangi mağazanın raporu" bilgisini adresten düşürürdü. */
      { path: '/market/:slug/my-store/:listingId/stats', element: <StoreStatsPage /> },
      /*
       * 🔴 3B evren (11 Ağu 2026) — pazarın gezilebilir hâli.
       * ⚠️ `lazy`: three.js + R3F paketi ~600 KB gzip. Ana pakete girseydi
       * haritaya girmek isteyen herkes bunu da indirirdi.
       */
      { path: '/market/:slug/3d', element: <LazyWorld /> },
      /* Eski Türkçe adresler — dört yolun hepsini tek splat karşılar. */
      { path: '/pazar/*', element: <LegacyMarketRedirect /> },
      { path: '/pazar', element: <LegacyMarketRedirect /> },
    ],
  },

  /*
   * Vitrin profili: `/{tag}` — <b>herkese açık</b>.
   *
   * 🔴 Bilerek EN ÜST SEVİYEDE ve iki guard'ın da DIŞINDA:
   *  · `RedirectIfAuthed` altında olsaydı **giriş yapmış** kullanıcı başkasının
   *    profiline bakamaz, `/map`'e atılırdı (ölçüldü: `/hesapbu` → `/map`).
   *  · `RequireAuth` altında olsaydı ziyaretçi hiç giremezdi.
   * Ziyaretçi kapısı yine geçerli: sayfa `publicApi` ile okur ve geçiş ister.
   * ⚠️ Dizinin SONUNDA durur; React Router statik segmentleri (`/login`)
   * dinamikten (`/:tag`) önce sıralar, yani mevcut rotaları gölgelemez.
   */
  /*
   * 🔴 HARİTA TEK ADRESTE: `/map` (10 Ağu 2026, kullanıcı isteği —
   * "`/harita` yolunu map olarak değiştir").
   *
   * <b>Neden bir "kapı" bileşeni gerekti:</b> `/map` iki farklı ekranın
   * adresidir — ziyaretçide vitrin haritası, oturumluda uygulamanın haritası.
   * Public haritayı `RedirectIfAuthed` altına koymak <b>sonsuz döngü</b>
   * üretirdi: o guard oturumluyu `/map`'e yollar, `/map` de onun çocuğu olurdu.
   * Bu yüzden rota iki guard'ın da DIŞINDA ve seçimi `MapGateway` yapıyor.
   *
   * ⚠️ Eski `/harita` adresi SİLİNMEDİ, kalıcı olarak `/map`'e yönlendirir:
   * paylaşım kartlarındaki QR kodları ve dışarıda paylaşılmış bağlantılar
   * o adrese gidiyor (`?t=<daireId>` parametresi de korunur).
   */
  { path: '/map', element: <MapGateway />, children: [{ index: true, element: <MapPage /> }] },
  { path: '/harita', element: <LegacyMapRedirect /> },

  /*
   * Herkese açık gönderi — `/post/:postId`.
   *
   * 🔴 Vitrin profiliyle AYNI sebeplerle iki guard'ın da dışında: paylaşılan
   * bir gönderi bağlantısına hem ziyaretçi hem giriş yapmış kullanıcı
   * tıklayabilir. `RequireAuth` altında ziyaretçi giremez, `RedirectIfAuthed`
   * altında ise oturumlu kullanıcı `/map`'e atılırdı.
   * ⚠️ `/:tag`'ten ÖNCE durur — React Router statik segmenti zaten önceler,
   * ama okuma sırası da doğru olsun.
   */
  { path: '/post/:postId', element: <VisitorGate><PublicPostPage /></VisitorGate> },
  /*
   * 🔴 17 Ağu 2026 — HERKESE AÇIK KOLEKSİYON. Adres standardı:
   *   /{username}       profil      (herkese açık)
   *   /post/{id}        gönderi     (herkese açık)
   *   /collection/{id}  koleksiyon  (herkese açık)  ← bu
   *   /collections/{id} koleksiyon  (SAHİBİN YÖNETİMİ)
   * ⚠️ Tekil/çoğul ayrımı bilinçli: paylaşılan adres düzenleme
   * düğmesi göstermemeli, yönetim adresi arama motoruna girmemeli.
   * ⚠️ `VisitorGate` gönderi sayfasındaki gibi: ziyaretçi önce
   * Turnstile kapısından geçer, sonra veri gelir.
   */
  { path: '/collection/:collectionId', element: <VisitorGate><PublicCollectionPage /></VisitorGate> },
  { path: '/:tag', element: <VisitorGate><TagProfilePage /></VisitorGate> },
])
