import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner'
import { AppShell } from '@/components/layout/AppShell'
import { subscribeMyMessages, subscribeMyNotifications } from '@/lib/ws'
import { useAuthStore } from '@/stores/auth'
import { UsernameSetupDialog } from '@/features/auth/UsernameSetupDialog'
import { StoreInviteDialog } from '@/features/store/StoreInviteDialog'
import { StoreCategoryDialog } from '@/features/category/StoreCategoryDialog'

/**
 * Tuvali baştan sona kaplayan ekranlar — dolgu ve genişlik sınırı almazlar.
 *
 * Harita: kesintisiz dünya görünümü. Sohbet: mesaj listesi içeride kayar,
 * yazma alanı altta sabit durur; ikisi de kendi yüksekliklerini yönetir.
 */
const FULL_BLEED_ROUTES = new Set(['/map'])
const CHAT_THREAD = /^\/chat\/[^/]+$/

/** API tamamen kapalı olduğundan harita dahil tüm içerik oturum ister. */
export function RequireAuth() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const queryClient = useQueryClient()
  /* "Sonra" denince bu oturumda bir daha açılmaz; sunucudaki bayrak açık
     kalır, yani soru bir sonraki girişte yeniden sorulur. */
  const [dismissed, setDismissed] = useState(false)
  const [categoryDone, setCategoryDone] = useState(false)

  // Canlı DM köprüsü: hangi sayfada olursak olalım rozet + sohbet listesi tazelenir.
  useEffect(() => {
    if (!user) return
    return subscribeMyMessages(() => {
      void queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })
  }, [user, queryClient])

  /*
   * 🔴 18 Ağu 2026 — CANLI BİLDİRİM KÖPRÜSÜ.
   *
   * Bildirimler yalnız yoklamayla geliyordu (zil 30 sn'de bir sayaç, liste
   * ancak sayfa yenilenince). Artık sunucu "sana bildirim geldi" der demez
   * hem rozet hem liste tazelenir.
   *
   * ⚠️ DM köprüsüyle AYNI yerde: ikisi de oturum açan her yüzeyde çalışmalı,
   * yalnız bildirimler sayfasında değil — rozetin görevi zaten kullanıcı
   * başka bir yerdeyken haber vermek.
   *
   * ⚠️ İki sorgu birden: `notifications-unread` rozeti, `notifications`
   * listeyi besler. Yalnız rozeti tazelemek, listeyi açan kullanıcıya "3 yeni"
   * deyip boş liste göstermek olurdu.
   */
  useEffect(() => {
    if (!user) return
    return subscribeMyNotifications(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })
  }, [user, queryClient])

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  const fullBleed = FULL_BLEED_ROUTES.has(location.pathname) || CHAT_THREAD.test(location.pathname)

  /*
   * ⚠️ Alt boşluk artık BURADA verilmez. Eski kabuk yüzen bir alt çubuk
   * kullanıyordu ve her sayfaya `pb-20 md:pb-24` eklemek gerekiyordu; yeni
   * kabukta bu boşluk `AppShell`'in kendi `main` dolgusundadır
   * (`p-4 pb-24 md:p-6 md:pb-8`) — referansın yaptığı da budur.
   */
  return (
    <AppShell fullBleed={fullBleed}>
      {/* Doğrulanmamış e-posta şeridi; doğrulanmış hesapta hiç render edilmez. */}
      <EmailVerificationBanner />
      {/*
        🔴 17 Ağu 2026 — Google ile açılan hesabın kullanıcı adı e-posta
        yerel kısmından TÜRETİLİYOR ve kullanıcıya sorulmuyordu. Bayrak
        sunucuda kalıcı bir kolon (V47): atlanırsa bir sonraki girişte
        yeniden sorulur.
        ⚠️ `RequireAuth` içinde: oturum açan HER yüzeyde çıkmalı, yalnız
        /home'da değil — Google dönüşü kullanıcıyı başka bir sayfaya da
        bırakabilir (`callbackUrl`).
      */}
      {user.usernamePending && !dismissed && (
        <UsernameSetupDialog onDone={() => setDismissed(true)} />
      )}
      {/*
        🔴 18 Ağu 2026 — "mağazanı açabilirsin" daveti. `RequireAuth` içinde
        olmasının sebebi `UsernameSetupDialog` ile aynı: davet oturum açan HER
        yüzeyde çıkmalı, yalnız /home'da değil.
        ⚠️ Bileşen kendi koşullarını kendi sorar ve hakkı olmayana HİÇ render
        edilmez (doğrulanmamış e-posta · hakkı yok · mağazası var · haritada ·
        daha önce kapatmış). Koşulları buraya taşımak, guard'ı mağaza iş
        kuralını bilmek zorunda bırakırdı.
      */}
      {/*
        🔴 24 Ağu 2026 — KAYIT SONRASI KATEGORİ POPUP'I (V52).

        ⚠️ `usernamePending` ile AYNI ANDA çıkmaz: iki modal üst üste
        binerdi ve kullanıcı ilk ekranında iki soru birden görürdü. Sıra
        bilinçli — kullanıcı adı kimliğin kendisidir, kategori bir tercihtir.

        ⚠️ Kapı `needsStoreCategory`; `storeCategoryId === null` DEĞİL.
        "Geç" diyenin de kategorisi boştur ve popup her açılışta yeniden
        çıkardı. Gerekçe: `StoreCategoryDialog`.

        ⚠️ `categoryDone` yalnız YEREL bir sustur — asıl kayıt sunucuda.
        Cevap gönderildikten sonra `/users/me` tazeleniyor; bayrak
        istemcide de sunucuda da düşüyor.
      */}
      {!user.usernamePending && user.needsStoreCategory && !categoryDone && (
        <StoreCategoryDialog onDone={() => setCategoryDone(true)} />
      )}
      <StoreInviteDialog />
      {fullBleed ? (
        <div className="flex h-full min-h-0 flex-col">
          <Outlet />
        </div>
      ) : (
        <Outlet />
      )}
    </AppShell>
  )
}

/**
 * Giriş yapmış kullanıcı landing/giriş/kayıt sayfalarını görmez.
 * (Oturum açıkken tanıtım sayfasına dönüş yolu bilinçli olarak kapalıdır.)
 *
 * <p>🔴 <b>10 Ağustos 2026 — HEDEF `/map` DEĞİL `/home`.</b> Kullanıcı:
 * *"login olduğumuzda kart oluşturmasını kapat, home'a aktar"*. İki şey
 * birden değişti:
 * <ul>
 *   <li>Yeni kayıt olanı paylaşım kartına (`/kartim`) yollayan
 *       <code>ONBOARDING_FLAG</code> dalı <b>kaldırıldı</b> — kart artık
 *       mağaza duyuru kartıdır ve yalnız haritada mağaza açılınca üretilir.</li>
 *   <li>Oturumlu giriş noktası <b>ana sayfa</b> oldu.</li>
 * </ul>
 * ⚠️ Bayrak mekanizması da gitti ve <b>gitmesi gerekiyordu</b>: bayrak,
 * guard'ın `RegisterPage`'teki <code>navigate(...)</code>'ı ezmesi yüzünden
 * vardı. Guard'ın hedefi artık kayıt ekranının hedefiyle aynı (`/home`), yani
 * ezmesi bir sorun değil.
 */
export function RedirectIfAuthed() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (user) {
    /*
     * ⚠️ TEK İSTİSNA — `?t=<daireId>`: mağaza kartındaki QR bu adrese gelir.
     * Derin bağlantı ana sayfaya çevrilirse kodu okutan kişi mağazayı değil
     * kendi panosunu görür. Parametre varsa haritaya, sorgu dizesi korunarak.
     */
    if (location.search.includes('t=')) {
      return <Navigate to={`/map${location.search}`} replace />
    }
    return <Navigate to="/home" replace />
  }
  return <Outlet />
}
