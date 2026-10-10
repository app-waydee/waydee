import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/toast'
import { useT } from '@/i18n'

export interface PlanUsage {
  plan: 'FREE' | 'PRO' | 'PREMIUM'
  /**
   * −1 = sınırsız. Pencere **takvim haftasıdır** (UTC pazartesi) — sınır
   * 10 Ağu 2026'da günlükten haftalığa çekildi ve alan adları da onunla
   * birlikte çevrildi (`dailyPosts` → `weeklyPosts`). Adı bırakmak, kodun
   * ürünle sessizce ayrışması demekti.
   */
  weeklyPosts: number
  tagsPerPost: number
  postsThisWeek: number
  postsLeftThisWeek: number
  /**
   * Üyeliğin bitiş anı (üyelik **sürelidir**, V35); FREE hesapta `null`.
   * ⚠️ Sunucu süresi dolmuşu zaten FREE döndürür — istemci tarih karşılaştırıp
   * kendi kararını vermez.
   */
  expiresAt: string | null
  /** Faturalama dönemi (V37); FREE hesapta `null`. */
  period: 'MONTHLY' | 'YEARLY' | null
  /**
   * <b>Son ödenen plan</b> — "üyeliğimi yenile" düğmesinin koşulu (25 Ağu 2026).
   *
   * 🔴 `plan` alanından FARKLIDIR: `plan` **etkin** plandır ve üyelik bitince
   * FREE döner; bu alan son ödenen planı taşır, yani üyeliği biten kullanıcı
   * için de doludur. Yenilemek isteyen tam olarak o kullanıcıdır.
   */
  renewablePlan: 'PRO' | 'PREMIUM' | null
  /** Son ödenen dönem — yenileme aynı dönemden devam eder. */
  renewablePeriod: 'MONTHLY' | 'YEARLY' | null
  /**
   * Haritada mağaza açabilir mi — yalnız yürürlükteki PREMIUM.
   * ⚠️ `plan === 'PREMIUM'` diye istemcide karar VERİLMEZ: hak sunucunun
   * cevabıdır, ileride bir kampanya planı da bu hakkı verebilir.
   */
  canOwnStore: boolean
  /**
   * Ücretsiz **1 aylık** mağaza denemesi hâlâ duruyor mu (18 Ağu 2026).
   *
   * 🔴 `canOwnStore` ile **karıştırma**: biri "planı buna izin veriyor",
   * diğeri "harcanmamış bir deneme hakkı var". Ücretsiz kullanıcıda birincisi
   * `false` iken bu `true` olur. Kapıyı `useCanOpenStore()` sorar.
   */
  storeTrialAvailable: boolean
  /** Denemenin gün sayısı — metni sunucu söyler, arayüz "30" yazmaz. */
  storeTrialDays: number
}

/** Plan bilgisini tek yerden okur — rozet ve limit kartı aynı veriyi paylaşır. */
export function usePlan() {
  return useQuery({
    queryKey: ['my-plan'],
    queryFn: async () => (await api.get<PlanUsage>('/users/me/plan')).data,
    staleTime: 30_000,
  })
}

/**
 * **Mağaza kapısı — arayüzdeki TEK KAYNAK.**
 *
 * 🔴 18 Ağu 2026. Mağaza artık iki ayrı yoldan açılabiliyor: planın hakkı
 * (`canOwnStore`, Premium) **ya da** harcanmamış ücretsiz deneme
 * (`storeTrialAvailable`). Bu birleşimi her ekranın kendi başına yazması,
 * 88. turdaki hatanın aynısı olurdu — bir eleme dört yüzeyde tek tek
 * uygulanmış, biri unutulmuştu. Kapı **tek cümle** hâlinde burada durur ve
 * harita, mağaza paneli ve profil kartı aynı cümleyi sorar.
 *
 * ⚠️ Bu kapı **yalnız mağaza** içindir. Yapay zekâ etiket önerisi gibi
 * gerçekten Premium'a özel özellikler `canOwnStore`'u sormaya devam eder —
 * deneme onlara hak vermez.
 */
export function useStoreAccess() {
  const { data, isLoading } = usePlan()
  const byPlan = data?.canOwnStore === true
  const byTrial = data?.storeTrialAvailable === true
  return {
    /** Şu anda mağaza açabilir mi (plan hakkı ya da deneme)? */
    canOpen: byPlan || byTrial,
    /** Açabiliyorsa bu bir **deneme** mi — arayüz "30 gün" rozetini buna göre çizer. */
    isTrial: !byPlan && byTrial,
    trialDays: data?.storeTrialDays ?? 30,
    loading: isLoading || data === undefined,
  }
}

/**
 * <b>Pro'ya geçiş.</b>
 *
 * <p>⚠️ Yükseltme burada YAPILMAZ: sunucu bir ödeme sayfası döner ve plan ancak
 * <b>imzalı webhook</b> ile yükselir. İstemcide yükseltmek, ödemeden vazgeçen
 * kullanıcıyı bedava Pro yapardı.
 */
export function useUpgrade() {
  const t = useT()
  return useMutation({
    mutationFn: async (
      /** Varsayılan, rozet gibi tek düğmeli yüzeyler için: Pro · aylık. */
      opts: { plan?: 'PRO' | 'PREMIUM'; period?: 'MONTHLY' | 'YEARLY' } = {},
    ) =>
      (
        await api.post<{ checkoutUrl: string }>('/payments/plan-checkout', null, {
          params: { plan: opts.plan ?? 'PRO', period: opts.period ?? 'MONTHLY' },
        })
      ).data,
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl)
      } else {
        toast.error(t('post.planUpgrade'))
      }
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('post.planUpgrade'))
    },
  })
}

/**
 * <b>Üyeliğimi yenile</b> — aynı plandan bir dönem daha (25 Ağu 2026).
 *
 * <p>Kullanıcı: *"ödeme tekrarı diye geliştirme ekle ... üyeliğim kısmında
 * plan kısmında, üyeliğimi yenile olsun; bunu yaparsa mağaza açma hakkı
 * gelsin"*.
 *
 * <p>🔴 Plan ve dönem <b>gönderilmez</b>: sunucu kullanıcı satırından okur.
 * İstemcinin plan göndermesi, süresi biten bir Premium üyenin ekranındaki bir
 * hatayla Pro'ya <b>düşmesi</b> demekti.
 *
 * <p>⚠️ "Mağaza açma hakkı" için ayrı bir çağrı YOK ve olmamalı: hak planın
 * kendisinden türüyor ({@code canOwnStore}), üyelik uzayınca kendiliğinden
 * geri geliyor. İstemcide "hak ver" demek, ödemeden vazgeçen kullanıcıya
 * bedava mağaza vermek olurdu.
 */
export function useRenewPlan() {
  const t = useT()
  return useMutation({
    mutationFn: async () => (await api.post<{ checkoutUrl: string }>('/payments/plan-renewal')).data,
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl)
      } else {
        toast.error(t('plan.renewFailed'))
      }
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('plan.renewFailed'))
    },
  })
}

/**
 * Sekme şeridinin yanındaki küçük plan rozeti: <b>Ücretsiz · Bu hafta 0/1</b>.
 *
 * <p>Kullanıcı hakkının ne kadarını kullandığını <b>limite çarpmadan önce</b>
 * görmeli; yalnız hata mesajı göstermek, kotayı ancak engellendiğinde
 * öğrenmesi demekti.
 */
export function PlanBadge() {
  const t = useT()
  const navigate = useNavigate()
  const { data } = usePlan()
  if (!data) return null

  /*
   * 🔴 10 Ağu 2026 — ROZET ARTIK PLANI DOĞRU SÖYLÜYOR.
   *
   * Önceki hâli `plan !== 'FREE'` diye ikiye ayırıyor ve ücretsiz olmayan
   * herkese <b>"Pro"</b> yazıyordu — <b>Premium</b> üye de ana sayfada "Pro"
   * görüyordu (kullanıcı bildirdi). Plan üç değerlidir; rozet de üç değerli.
   *
   * 🔴 Rozet artık HER PLANDA TIKLANABİLİR ve `/plan` sayfasına götürür:
   * kullanıcı paketinin içeriğini, bitiş tarihini ve hakkını orada görür.
   * Önceden Pro/Premium'da düğme `disabled`'dı — yani üye olan kişi kendi
   * paketine dair hiçbir şeye tıklayamıyordu.
   */
  const label =
    data.plan === 'PREMIUM'
      ? t('plan.premium')
      : data.plan === 'PRO'
        ? t('plan.pro')
        : t('post.planFree')

  const paid = data.plan !== 'FREE'
  return (
    <button
      type="button"
      className={`waydee-plan-badge ${data.plan === 'PREMIUM' ? 'waydee-plan-premium' : data.plan === 'PRO' ? 'waydee-plan-pro' : ''}`}
      onClick={() => navigate('/plan')}
      title={t('plan.title')}
    >
      {paid ? (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          {label}
          {/* ⚠️ Sınırsız planda sayaç YAZILMAZ: "0/-1" gibi bir şey görünürdü.
              Bunun yerine üyeliğin bitiş tarihi gösterilir — süreli üyelikte
              kullanıcının gerçekten merak ettiği bilgi budur (V35). */}
          {data.expiresAt && (
            <span className="waydee-plan-count">
              {new Date(data.expiresAt).toLocaleDateString()}
            </span>
          )}
        </>
      ) : (
        <>
          {label}
          <span className="waydee-plan-count">
            {t('post.planThisWeek')} {data.postsThisWeek}/{data.weeklyPosts}
          </span>
        </>
      )}
    </button>
  )
}

/**
 * Kota dolduğunda ızgaranın üstünde çıkan yükseltme kartı.
 *
 * <p>⚠️ Yalnız <b>gerçekten dolduğunda</b> çizilir; her zaman duran bir reklam
 * kartı, ücretsiz kullanıcıyı her açılışta rahatsız ederdi.
 */
export function PlanLimitCard() {
  const t = useT()
  const { data } = usePlan()
  const upgrade = useUpgrade()
  if (!data || data.plan !== 'FREE' || data.postsLeftThisWeek > 0) return null

  return (
    <div className="waydee-plan-card">
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-ink">{t('post.planLimitTitle')}</p>
        <p className="mt-0.5 text-[13px] text-muted">{t('post.planLimitBody')}</p>
      </div>
      <button
        type="button"
        className="waydee-pill waydee-pill-violet-solid shrink-0"
        onClick={() => upgrade.mutate({})}
        disabled={upgrade.isPending}
      >
        {t('post.planUpgrade')}
      </button>
    </div>
  )
}
