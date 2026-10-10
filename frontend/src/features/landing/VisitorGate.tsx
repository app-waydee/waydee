import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { Spinner } from '@/components/ui/spinner'
import { TurnstileWidget, turnstileEnabled, useTurnstile } from '@/components/security/Turnstile'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/i18n'
import {
  clearVisitorPass,
  getGateStatus,
  readVisitorPass,
  verifyVisitor,
  VISITOR_PASS_EXPIRED,
} from '@/lib/publicApi'

/**
 * **Vitrin kapısı** — ziyaretçi siteye girdiğinde sayfanın tam ortasında
 * Cloudflare Turnstile doğrulaması gösterir; geçmeden harita/profil açılmaz.
 *
 * Doğrulama gerçektir: jeton sunucuda Cloudflare'e sorulur ve karşılığında
 * kısa ömürlü **ziyaretçi geçişi** verilir. `/api/v1/public/**` uçları bu geçişi
 * ister — yani kapı sadece görsel bir perde değil, veriye erişimin ön koşuludur.
 *
 * Turnstile kapalıysa (site key yok ya da `TURNSTILE_ENABLED=false`) kapı hiç
 * görünmez, içerik doğrudan açılır.
 */
export function VisitorGate({ children }: { children: ReactNode }) {
  // 'checking' → sunucuya soruyoruz, 'open' → içerik serbest, 'gate' → doğrulama gerekli
  const [phase, setPhase] = useState<'checking' | 'gate' | 'open'>('checking')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useT()
  const turnstile = useTurnstile()
  /*
   * 🔴 8 Ağu 2026 — OTURUM AÇMIŞ KULLANICI KAPIYI GÖRMEZ.
   *
   * Kapının işi botu elemek; giriş yapmış kişi zaten Turnstile'lı kayıt ve
   * giriş akışından geçti. Aynı kişiden ikinci kez robot olmadığını
   * kanıtlamasını istemek koruma değil sürtünmedir.
   *
   * ⚠️ Bu ZORUNLU hâle geldi: uygulama içindeki tüm profil bağlantıları artık
   * vitrin profiline (`/{tag}`) gidiyor. Muafiyet olmasaydı kullanıcı
   * bildirimden ya da aramadan bir profile her dokunduğunda üretimde
   * Cloudflare doğrulaması görürdü.
   *
   * ⚠️ Yalnız arayüzü açmak YETMEZ — `/public/**` uçları geçiş istiyordu.
   * Sunucuda da aynı muafiyet eklendi (`PublicViewController.requireVisitorPass`);
   * biri olmadan diğeri "kapı yok ama veri de yok" ekranı üretirdi.
   */
  const authed = useAuthStore((s) => !!s.accessToken)

  useEffect(() => {
    let cancelled = false
    // Widget hiç yoksa jeton üretilemez; sunucuya sormaya da gerek yok.
    if (!turnstileEnabled || authed) {
      setPhase('open')
      return
    }
    getGateStatus()
      .then((status) => {
        if (cancelled) return
        if (!status.required) {
          setPhase('open')
        } else {
          // Aynı oturumda daha önce doğrulandıysa geçiş hâlâ geçerli olabilir.
          setPhase(readVisitorPass() ? 'open' : 'gate')
        }
      })
      .catch(() => {
        // Sunucuya ulaşılamıyorsa kapıyı göster: geçişsiz veri zaten gelmeyecek.
        if (!cancelled) setPhase('gate')
      })
    return () => {
      cancelled = true
    }
  }, [authed])

  // Geçiş süresi dolarsa (sunucu VISITOR_PASS_REQUIRED döndü) kapı yeniden açılır.
  useEffect(() => {
    const onExpired = () => {
      setPhase((current) => (current === 'open' ? 'gate' : current))
      turnstile.reset()
    }
    window.addEventListener(VISITOR_PASS_EXPIRED, onExpired)
    return () => window.removeEventListener(VISITOR_PASS_EXPIRED, onExpired)
  }, [turnstile])

  const submit = useCallback(
    async (token: string) => {
      setSubmitting(true)
      setError(null)
      try {
        await verifyVisitor(token)
        setPhase('open')
      } catch {
        clearVisitorPass()
        setError(t('gate.failed'))
        turnstile.reset()
      } finally {
        setSubmitting(false)
      }
    },
    [turnstile, t],
  )

  if (phase === 'open') return <>{children}</>

  /*
   * 🔴 16 Ağu 2026 — CLOUDFLARE'İN ARA SAYFASININ DÜZENİ BİREBİR ALINDI.
   * (8 Ağu'daki "tam ekran koyu kapı" kararı geçerli, düzeni bu tur değişti.)
   *
   * Kullanıcı örnek bir ekran görüntüsü verdi (`techolay.net`): Cloudflare'in
   * kendi ara sayfası <b>sola yaslı</b>dır ve şu sırayı izler:
   *   ① kare site ikonu + <b>alan adı</b> (iri, ikonla aynı satırda)
   *   ② "İnsan olduğunuz doğrulanıyor…" başlığı
   *   ③ widget
   *   ④ altta açıklama cümlesi
   * Bizimki ortalanmış, rozetli ve iki paragraflıydı; yan yana konunca aynı
   * ürünün parçası gibi durmuyordu.
   *
   * ⚠️ <b>Renkler doğrudan yazılır, token'dan gelmez.</b> Bu yüzey temadan
   * bağımsız koyudur. Tailwind `dark:` KULLANILMAZ (vault: bu projede işletim
   * sistemine bağlanır ve tema düğmesinden kopar).
   *
   * ⚠️ İşarete <code>onDark</code> verilir. Bayrak <b>bu turda eklendi</b>:
   * `LogoMark` yalnız `waydee-brand-logo` sınıfına bakıyordu, o da beyaza
   * çevirmeyi <b>yalnız koyu temada</b> yapar — açık tema seçili bir
   * ziyaretçide işaret koyu zeminde koyu kalıyordu ("logo buglu").
   *
   * ⚠️ Widget'a <code>forceTheme="dark"</code>: uygulamanın teması açıkken
   * Cloudflare kutusu koyu zeminde <b>beyaz bir dikdörtgen</b> gibi duruyordu.
   *
   * ⚠️ <code>fixed inset-0</code> + <code>z-[200]</code>: kapı gerçekten TAM
   * EKRAN olmalı. `min-h-full` iken sayfanın kalanı altta kalıyor ve
   * kaydırıldığında görünüyordu — kapı perde değil, ön koşuldur.
   */
  const site = window.location.host

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#0b0b0d] text-[#f5f5f7]">
      {/* Çok hafif bir derinlik — Cloudflare'in düz siyahına yakın kalsın diye
          yalnız iki soluk halo; kart, kenarlık ve gölge YOK. */}
      <div className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-[#1d4ed8]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-[#7c3aed]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-full w-full max-w-[680px] flex-col justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full"
        >
          {/* ① ikon + alan adı — referansın en belirgin öğesi */}
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#2a85ff]">
              <LogoMark onDark className="h-7 w-7" />
            </span>
            <span className="truncate text-[30px] font-semibold leading-none tracking-tight md:text-[38px]">
              {site}
            </span>
          </div>

          {/* ② başlık: beklerken "doğrulanıyor", widget beklerken "doğrula" */}
          <h1 className="mt-5 text-[19px] font-medium leading-snug text-[#f5b944] md:text-[21px]">
            {phase === 'checking' ? t('gate.title') : t('gate.titleAction')}{' '}
            <span className="text-[#f5f5f7]/70">{t('gate.subtitle')}</span>
          </h1>

          {/* ③ widget */}
          <div className="mt-7 flex flex-col items-start gap-3">
            {phase === 'checking' ? (
              <span className="flex items-center gap-2 text-[13px] font-medium text-white/60">
                <Spinner className="h-4 w-4" /> {t('gate.checking')}
              </span>
            ) : (
              <>
                <TurnstileWidget
                  forceTheme="dark"
                  handleRef={turnstile.handleRef}
                  onToken={(token) => {
                    turnstile.setToken(token)
                    if (token) void submit(token)
                  }}
                />
                {submitting && (
                  <span className="flex items-center gap-2 text-[13px] font-medium text-white/60">
                    <Spinner className="h-4 w-4" /> {t('gate.checking')}
                  </span>
                )}
                {error && <p className="text-[13px] font-semibold text-[#ff6a55]">{error}</p>}
              </>
            )}
          </div>

          {/* ④ açıklama — referansta widget'ın ALTINDA ve daha soluk */}
          <p className="mt-8 max-w-[46ch] text-[15px] leading-relaxed text-white/60">
            {t('gate.note', { site })}
          </p>

          <span className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-white/35">
            <ShieldCheck className="h-3.5 w-3.5" /> {t('gate.protected')}
          </span>
        </motion.div>
      </div>
    </div>
  )
}
