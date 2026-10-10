import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Store, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useStoreAccess } from '@/features/plan/PlanBadge'

/**
 * <b>"Mağazanı açabilirsin" daveti</b> (18 Ağu 2026, kullanıcı talimatı:
 * *"hesaplarını onaylayan kullanıcılara mağazanızı açabilirsiniz tarzında
 * güzel bir popup aç ve mağazalarını açsınlar"*).
 *
 * <h3>🔴 Tasarım dili: <code>/me</code> kartlarının aynısı</h3>
 * <p>İlk sürüm <b>reddedildi</b> (*"şu anki berbat"*): degradeli mor bir
 * madalyon, etrafında halkalar ve kendi tipografisi vardı — uygulamanın hiçbir
 * yerinde olmayan bir dil. Şimdi <b>MePage'in kart gramerini</b> birebir
 * kullanıyor ve hiçbir yeni görsel fikir icat etmiyor:
 * <ul>
 *   <li>ikon <b>{@code h-12 w-12 rounded-2xl bg-subtle}</b> karo, mor madalyon değil;</li>
 *   <li>başlık {@code text-[15px] font-semibold}, gövde
 *       {@code text-[13px] leading-snug text-muted};</li>
 *   <li>eylem, {@code MePage.PillButton}'ın <b>çerçeveli hap</b> biçimi
 *       ({@code h-12 rounded-full border-2});</li>
 *   <li>kabuk {@code rounded-card} + {@code shadow-card} hairline yüzey.</li>
 * </ul>
 * <p>Ders (88. tur): <b>bir tasarım dilini kopyalarken "neden"ini kopyala.</b>
 * Buradaki neden, davetin uygulamanın <b>parçası</b> gibi görünmesi; kendi
 * başına bir kampanya afişi gibi değil.
 *
 * <h3>🔴 Neden koşullar bu kadar dar</h3>
 * <p>Bu bir <b>kesinti</b>: kullanıcının yaptığı işin üstüne kapanır. Beş
 * koşulun <b>hepsi</b> sağlanmalı — biri gevşerse davet "kapatılası bir
 * reklam" olur:
 * <ol>
 *   <li><b>E-posta doğrulanmış.</b> Doğrulanmamış hesapta mağaza kurulumu
 *       sunucuda zaten <b>403</b> ({@code EMAIL_NOT_VERIFIED}); daveti ona
 *       göstermek, tıklayınca duvara çarpacağı bir yola çağırmak olurdu.</li>
 *   <li><b>Hakkı var</b> ({@code useStoreAccess}) — plan hakkı ya da
 *       harcanmamış ücretsiz deneme.</li>
 *   <li><b>Mağazası yok.</b> Kullanıcı başına tek mağaza.</li>
 *   <li><b>Haritada değil.</b> Oranın kendi daveti var; ikisi üst üste biner.</li>
 *   <li><b>Daha önce kapatmamış.</b></li>
 * </ol>
 *
 * <h3>⚠️ Kapatma kaydı <code>localStorage</code>'ta, oturumda değil</h3>
 * <p>Haritadaki davet {@code sessionStorage} kullanır çünkü orası <b>zaten</b>
 * mağaza ekranıdır. Bu ise uygulamanın <b>her</b> yüzeyinde açılan bir modal —
 * her oturumda yeniden gelmesi kullanıcıyı yorar. Anahtar <b>kullanıcı
 * kimliğini içerir</b>: aynı tarayıcıda ikinci bir hesap açan kişi, birincinin
 * kapattığı daveti görmeliydi.
 *
 * <h3>⚠️ Animasyon yalnız <code>opacity</code></h3>
 * <p>Kalıcı tuzak: framer-motion v12 + React 19'da konumu kritik öğede
 * {@code y}/{@code scale} başlangıç değerinde takılıyor (üç kez ısırdı).
 */
export function StoreInviteDialog() {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const access = useStoreAccess()

  const storageKey = user ? `waydee-store-offer-seen:${user.id}` : null
  const [dismissed, setDismissed] = useState(
    () => !!storageKey && localStorage.getItem(storageKey) === '1',
  )

  /* Mağazası var mı? Yalnız hakkı olan ve daveti henüz kapatmamış kullanıcı
     için sorulur — herkese sormak, davet hiç çıkmayacakken de bir istek
     harcamak olurdu. */
  const eligible = !!user && user.emailVerified && access.canOpen && !dismissed
  const territories = useQuery({
    queryKey: ['my-territories'],
    queryFn: async () => (await api.get<{ status: string }[]>('/territories/my')).data,
    enabled: eligible,
    staleTime: 60_000,
  })

  const hasStore = (territories.data ?? []).some((x) => x.status === 'ACTIVE')
  const onMap = location.pathname === '/map'
  const open = eligible && territories.isSuccess && !hasStore && !onMap

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    const release = lockScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      release()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    if (storageKey) localStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  function go() {
    close()
    navigate('/map')
  }

  if (!open) return null

  const days = String(access.trialDays)

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-invite-title"
    >
      <motion.div
        /* ⚠️ `shadow-card` + `shadow-float` BİRLİKTE YAZILAMAZ — ikisi de aynı
           Tailwind özelliğini (`box-shadow`) kurar ve sonuncusu diğerini ezer;
           hairline sessizce kaybolurdu. Hairline `border`dan, yükseklik
           gölgeden gelir. */
        className="w-full max-w-sm overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-float"
        style={{ maxHeight: '90vh' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, delay: 0.04 }}
      >
        {/* Başlık satırı: ikon karosu solda, kapatma sağda — /me kartlarındaki
            hizanın aynısı. */}
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-subtle text-muted">
            <Store className="h-5 w-5" />
          </span>
          <button
            type="button"
            onClick={close}
            aria-label={t('common.close')}
            className="-me-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p id="store-invite-title" className="mt-4 text-[15px] font-semibold">
          {t('storeInvite.title')}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-muted">
          {access.isTrial
            ? t('storeInvite.descTrial').replace('{days}', days)
            : t('storeInvite.desc')}
        </p>

        {/* ⚠️ Deneme rozeti yalnız DENEME hâlinde. Premium kullanıcıya "30 gün"
            yazmak, süresiz hakkını süreli göstermek olurdu. */}
        {access.isTrial && (
          <span className="mt-3 inline-flex items-center rounded-full bg-subtle px-2.5 py-1 text-[12px] font-medium text-muted">
            {t('storeInvite.trialBadge').replace('{days}', days)}
          </span>
        )}

        <ul className="mt-4 space-y-2">
          {(['point1', 'point2', 'point3'] as const).map((k) => (
            <li key={k} className="flex items-start gap-2 text-[13px] leading-snug text-muted">
              <MapPin className="mt-px h-4 w-4 shrink-0 text-faint" />
              <span>{t(`storeInvite.${k}` as never)}</span>
            </li>
          ))}
        </ul>

        {/* Eylem: MePage'in `PillButton` biçimi (h-12 · rounded-full · border-2).
            Yeni bir düğme dili icat etmemek için birebir kopyalandı. */}
        <button type="button" onClick={go} className={pill}>
          <MapPin className="h-4 w-4 shrink-0" />
          {t('storeInvite.cta')}
        </button>
        <button
          type="button"
          onClick={close}
          className="mt-2 h-9 w-full text-[13px] font-medium text-faint transition-colors hover:text-ink"
        >
          {t('storeInvite.later')}
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

/** `MePage.PillButton` (tone="ink") ile aynı biçim. */
const pill = cn(
  'mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 px-5',
  'text-[14px] font-medium transition-colors',
  'border-ink text-ink hover:bg-ink hover:text-on-ink',
)
