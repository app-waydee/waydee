import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Copy,
  ExternalLink,
  LifeBuoy,
  MapPin,
  Power,
  Receipt,
  Settings as SettingsIcon,
  Share2,
  Sparkles,
  Store,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FollowListDialog } from '@/features/follow/FollowListDialog'
import { SocialLinks } from '@/components/social/SocialIcons'
import { VerifiedTick } from '@/components/VerifiedTick'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { getMySocialLinks } from '@/lib/account'
import { getRelationship } from '@/lib/follow'
import { fmtArea, fmtRadius } from '@/lib/format'
import { formatRemaining, leaseTone } from '@/lib/lease'
import { CONTACT_EMAIL } from '@/lib/siteLinks'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useStoreAccess } from '@/features/plan/PlanBadge'
import { StoreSettingsForm } from '@/features/store/StoreSettingsForm'
import { ProfileStoryAvatar } from '@/features/story/ProfileStoryAvatar'
import { useT } from '@/i18n'
import type { TerritoryResponse } from '@/types/api'

/**
 * <b>Profilim (`/me`)</b> — 8 Ağu 2026'da kullanıcının verdiği ekran
 * görüntüsüne göre yeniden kuruldu.
 *
 * <p>Referans düzen (tek, dar, <b>ortalanmış sütun</b>):
 * ```
 *  PROFİLİM                                    [paylaş]
 *  ┌──────────┐  Ad Soyad
 *  │  kare    │  e-posta
 *  │  avatar  │
 *  └──────────┘
 *        ┌─────────────────┐
 *        │  biyografi      │
 *        └─────────────────┘
 *        ( Sosyal bağlantılar )    ← mor kenarlık
 *        ( Profil fotoğrafı    )
 *        ( Profili düzenle     )
 *        ( Çıkış yap           )   ← pembe kenarlık + güç ikonu
 *              Yardım              ← altı çizili
 *          waydee.com/tag          ← altı çizili
 * ```
 *
 * <p>🔴 <b>Ekran görüntüsündeki BUTONLAR birebir kopyalanmadı</b> —
 * kullanıcının şartı buydu: <i>"me tarafını ŞU ANKİ KISIMLARLA fotoğraftaki
 * gibi tasarlayacaksın"</i>. Referanstaki "Change Username" ve "Delete
 * Account" bizde <b>yok</b> (ne uç ne akış); onları çizmek <b>tıklayınca
 * hiçbir şey yapmayan düğmeler</b> bırakırdı — bu projede defalarca yaşanmış
 * bir hata. Yerlerine gerçekten çalışan kendi akışlarımız kondu:
 * profil düzenleme, sosyal bağlantılar, vitrin adresi, <b>daireler</b>.
 * Alınan şey <b>tasarım dili</b>: dar sütun · kare avatar · hap düğmeler ·
 * altı çizili metin bağlantıları.
 *
 * <p>🔴 <b>"Gönderiler genel bakışı" KALDIRILDI</b> (kullanıcı isteği) — üç
 * sekmeli yapı (Genel bakış · Gönderiler · Dairelerim) tamamen gitti.
 * Gönderiler zaten ana sayfanın işi; burada portföy ve hesap var.
 *
 * <p>🔴 Ana sayfadan taşınanlar burada: <b>vitrin adresi</b> ve
 * <b>daireler</b> (eski `ProfileHeader`), ayrıca <b>hikaye şeridi</b>.
 * Hiçbiri silinmedi, yer değiştirdi.
 *
 * <p>⚠️ <b>Mobil önce.</b> Sütun `max-w-[420px]` ve her zaman ortalıdır;
 * referansın kendisi zaten dar bir telefon düzenidir, masaüstünde de aynı
 * sütun ortada durur — genişletmek düğmeleri absürt uzunlukta yapardı.
 * Daireler bölümü tek istisnadır: geniş ekranda iki kolona açılır.
 */
export function MePage() {
  const t = useT()
  const navigate = useNavigate()
  const { user, refreshToken, clear } = useAuthStore()
  const [storeOpen, setStoreOpen] = useState(false)
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null)

  const relQuery = useQuery({
    queryKey: ['relationship', user?.id],
    queryFn: () => getRelationship(user!.id),
    enabled: !!user,
  })
  const territoriesQuery = useQuery({
    queryKey: ['my-territories'],
    queryFn: async () => (await api.get<TerritoryResponse[]>('/territories/my')).data,
  })
  const socialQuery = useQuery({ queryKey: ['my-social-links'], queryFn: getMySocialLinks })
  /* Mağaza hakkı sunucudan: kart hangi hâlde çizilecek buna bakar. */
  const storeAccess = useStoreAccess()

  /**
   * <b>Mağazam</b> — en fazla bir tane (V38 tekil indeksi).
   *
   * ⚠️ Yine de listeden SÜZÜLEREK alınır, `[0]` ile değil: V38 öncesinden kalan
   * hesaplarda birden çok satır olabilir ve süresi dolmuş bir daireyi "mağazam"
   * diye göstermek kullanıcıyı yanıltırdı.
   */
  const store = useMemo(
    () => (territoriesQuery.data ?? []).find((x) => x.status === 'ACTIVE') ?? null,
    [territoriesQuery.data],
  )

  if (!user) return null

  const tag = user.username
  const path = `/${tag}`
  /* ⚠️ Adres ortamdan kurulur: yerelde `localhost:5175`, üretimde
     `app.waydee.com`. Sabit yazmak yerelde tıklanamaz bağlantı üretirdi. */
  const url = `${window.location.origin}${path}`
  const urlLabel = `${window.location.host.replace(/^www\./, '')}${path}`

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    toast.success(t('common.copied'))
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: user.displayName ?? tag, url })
        return
      } catch {
        /* kullanıcı vazgeçti */
      }
    }
    await copy()
  }
  const logout = async () => {
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken })
    } catch {
      /* oturum zaten kapanmış olabilir */
    } finally {
      clear()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-full">
      <main className="mx-auto flex w-full max-w-[420px] flex-col px-1 pb-10 pt-2">
        {/* --------- başlık + paylaş --------- */}
        <div className="flex items-start justify-between">
          <h1 className="text-[22px] font-extrabold uppercase tracking-tight">
            {t('me.title')}
          </h1>
          <button
            type="button"
            onClick={share}
            aria-label={t('collection.share')}
            title={t('collection.share')}
            className="rounded-xl p-1.5 text-muted transition-colors hover:text-ink"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {/* --------- kimlik: kare avatar + ad + e-posta --------- */}
        <div className="mt-5 flex items-center gap-5">
          {/*
            ⚠️ Avatar KARE (referansta öyle) — uygulamanın geri kalanındaki
            yuvarlak `Avatar` bileşeni burada kullanılmadı. `shrink-0` şart:
            uzun bir e-posta adresi kutuyu eziyordu (ölçüldü).
          */}
          {/*
            🔴 8 Ağu 2026 — HİKAYE PROFİLLE BİRLEŞTİ (kullanıcı isteği).
            Ayrı bir hikaye şeridi yerine giriş noktası <b>avatarın kendisi</b>:
            hikayen varsa çevresinde halka çıkar ve dokunuşla izlenir, yoksa
            köşedeki + ile eklenir. Instagram'ın da yaptığı budur ve `/me`'yi
            tek ekranda tutar — şerit sayfanın üstünde ayrı bir satır yiyordu.
            ⚠️ `shape="square"`: referans tasarımda avatar kare; halka, iç
            çerçeve ve avatar aynı yarıçapı paylaşır.
          */}
          <div className="shrink-0">
            <ProfileStoryAvatar
              ownerUserId={user.id}
              author={{
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              }}
              avatarSrc={user.avatarUrl}
              avatarName={user.displayName || tag}
              isOwner
              shape="square"
              sizeClassName="h-[104px] w-[104px] text-[30px]"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[22px] font-semibold leading-tight">
                {user.displayName || tag}
              </h2>
              {user.verified && <VerifiedTick size={18} title={t('profile.verified')} />}
            </div>
            {/* ⚠️ `break-all` + `dir=ltr`: uzun adresler taşıyordu, Arapçada da
                e-posta ters diziliyordu. */}
            <p dir="ltr" className="mt-1 break-all text-[14px] text-muted">
              {user.email}
            </p>
            {user.privateAccount && (
              <Badge tone="neutral" className="mt-2">
                {t('me.privateAccount')}
              </Badge>
            )}
          </div>
        </div>

        {/* --------- sayaçlar --------- */}
        <div className="mt-5 flex items-center justify-center gap-7">
          <Counter label={t('me.followers')} value={relQuery.data?.followerCount ?? 0} onClick={() => setFollowList('followers')} />
          <Counter label={t('me.following')} value={relQuery.data?.followingCount ?? 0} onClick={() => setFollowList('following')} />
          {/*
            🔴 V38 — "Daireler" SAYACI KALDIRILDI, yerine MAĞAZA İKONU geldi.
            Sayaç bir sayı gösteriyordu; artık kullanıcı başına en fazla BİR
            mağaza var, yani sayının alabileceği tek anlamlı değer 0 ya da 1
            (bkz. V38 tekil indeksi). "1 Daire" yazan bir sayaç bilgi değil
            gürültüydü. İkon doğrudan haritadaki mağazaya götürür; mağaza yoksa
            kurma akışını açar.
          */}
          {/* 🔴 9 Ağu 2026 — ikon artık haritaya GİTMİYOR, MAĞAZA PENCERESİNİ
              açıyor. Mağaza bilgisi profilde sosyal ikonların üstünde tam
              genişlikte bir kart olarak duruyordu ve profilin akışını
              bölüyordu; oysa herkesin her ziyarette okuması gereken bir bilgi
              değil. Artık isteyen ikona dokunup detayı görüyor. */}
          <button
            type="button"
            className="waydee-store-pin"
            onClick={() => setStoreOpen(true)}
            title={store ? store.name : t('store.title')}
            aria-label={store ? store.name : t('store.title')}
          >
            <Store className="h-5 w-5" />
            <span>{store ? t('me.myStore') : t('me.noStoreShort')}</span>
          </button>
          {/* 🔴 9 Ağu 2026 — "Kaydettiklerim" hap düğmeden ÇIKIP buraya,
              mağaza ikonunun SAĞINA taşındı (kullanıcı isteği). Hap düğmeler
              artık panel bağlantılarına ayrıldı; kaydettiklerim bir sayfa
              değil, bir kısayol. */}
          <button
            type="button"
            className="waydee-store-pin"
            onClick={() => navigate('/saved')}
            title={t('me.savedAndLiked')}
            aria-label={t('me.savedAndLiked')}
          >
            <Bookmark className="h-5 w-5" />
            <span>{t('saved.savedTab')}</span>
          </button>
        </div>

        {/*
          🔴 V38 — BİYOGRAFİ KUTUSU ve "Profil fotoğrafı yükle" hapı KALDIRILDI.
          İkisi de tek yaptığı iş `EditProfileDialog`'u açmaktı; "Profili
          düzenle" hapı zaten aynı pencereyi açıyordu. Yani ekranın en geniş
          bloğu, üç düğmenin üçüncü kez tekrarıydı. Biyografi metni başlıkta
          zaten görünüyor.

          Boşalan yere MAĞAZA KARTI geldi: kullanıcının Premium ile aldığı
          hakkın karşılığı burada somutlaşır — mağazası varsa kartı, yoksa
          kurma daveti.
        */}

        {socialQuery.data?.length ? (
          <SocialLinks links={socialQuery.data} size="sm" className="mt-4 justify-center" />
        ) : null}

        {/* --------- hap düğmeler: PANEL BAĞLANTILARI ---------
            🔴 9 Ağu 2026 — kullanıcı isteğiyle değişti. Kaldırılanlar:
            "Sosyal bağlantı ekle", "Profili düzenle", "Kaydettiklerim".
            İlk ikisi Ayarlar → Profil / Sosyal medya bölümlerinin tekrarıydı;
            üçüncüsü mağaza ikonunun yanına kısayol olarak taşındı.
            Yerlerine PANEL BAĞLANTILARI geldi: sekme şeridi (`DashShell`)
            yatayda kaydığı ve dar ekranda bölümlerin çoğu görünmediği için
            hepsi buraya, dikey ve tek bakışta okunur hâlde alındı.
            ⚠️ Ayarlar, "Çıkış yap"ın hemen ÜSTÜNDE durur — üst bardaki ikon
            kaldırıldığı için tek giriş noktası burasıdır. */}
        {/* 🔴 HİZA DÜZELTMESİ (9 Ağu 2026): düğmeler hizasızdı çünkü genişlik
            İKİ yerde tanımlıydı — saran `Link` 19rem, `PillButton` ise kendi
            içinde `max-w-[260px]`. Bağlantıyla sarılan düğmeler 304px'lik
            kabın SOLUNA yaslanıp 260px kalıyor, sarılmayan "Çıkış yap" ise
            kabın ortasında duruyordu; sonuç kayık bir sütun.
            Artık genişlik TEK yerde: bu kap. İçindeki her şey `w-full`. */}
        <div className="mx-auto mt-6 flex w-full max-w-[19rem] flex-col items-stretch gap-3">
          {PANEL_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="block w-full">
              <PillButton tone={link.tone} icon={link.icon}>
                {t(link.labelKey)}
              </PillButton>
            </Link>
          ))}
          <PillButton tone="brand" icon={Power} onClick={logout}>
            {t('nav.logout')}
          </PillButton>
        </div>

        {/* --------- yardım --------- */}
        <div className="mt-6 text-center">
          {/*
            🔴 15 Ağu 2026 — Yardım artık SSS bölümüne değil, DOĞRUDAN destek
            e-postasına gider (kullanıcı isteği). SSS bir sayfaydı; "yardım"a
            basan kullanıcının aradığı şey ise bir insana ulaşmaktı.

            ⚠️ `<Link>` değil ham `<a>`: React Router `mailto:` şemasını kendi
            rotası sanıp gezinmeye çalışır ve posta istemcisi hiç açılmaz.
          */}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-1.5 text-[14px] font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            <LifeBuoy className="h-4 w-4" /> {t('me.help')}
          </a>
        </div>

        {/*
          🔴 Vitrin adresi buradan ÇIKTI — sayfanın en altında, akışın sonunda
          duruyordu ve kullanıcının kaydırması gerekiyordu. Artık ekranın
          altında **yüzen** bir şerit (aşağıda `UrlBar`); kullanıcı isteği:
          "alta yapışık ama biraz yukarıda popup şeklinde sürekli olsun".
        */}
      </main>

      {/*
        🔴 Daireler bölümü de sayfadan ÇIKTI (yukarıdaki sayaca bağlandı).
        `/me` artık kaydırma gerektirmeyen tek ekran.
      */}

      <UrlBar label={urlLabel} path={path} onCopy={copy} />

      {/* 🔴 Profil düzenleme ve sosyal bağlantı PENCERELERİ kaldırıldı:
          ikisi de artık Ayarlar'ın kendi bölümleri (Profil · Sosyal medya).
          Aynı formu iki ayrı yerde tutmak, alan eklendiğinde birini
          güncellemeyi unutturuyordu. */}
      {storeOpen && (
        <Dialog open onClose={() => setStoreOpen(false)} title={t('store.title')} className="max-w-md">
          <StoreCard
            store={store}
            loading={territoriesQuery.isLoading}
            /* 🔴 18 Ağu 2026 — deneme hakkı da mağaza açtırır (bkz.
               `useStoreAccess`). `plan?.canOwnStore` okunsaydı ücretsiz
               kullanıcıya hakkı olduğu hâlde Premium duvarı çıkardı. */
            canOwnStore={storeAccess.canOpen}
            onNavigate={() => setStoreOpen(false)}
          />
        </Dialog>
      )}
      {followList && (
        <FollowListDialog userId={user.id} mode={followList} onClose={() => setFollowList(null)} />
      )}
      {/* 🔴 "Dairelerim" PENCERESİ KALDIRILDI (V38): tek mağaza artık sayfada
          kart olarak duruyor, listelenecek bir çokluk yok. */}
    </div>
  )
}

/**
 * <b>Yüzen vitrin adresi şeridi.</b>
 *
 * <p>🔴 8 Ağu 2026 — kullanıcı isteği: <i>"alttaki vitrin adresi kısmı alta
 * yapışık ama biraz yukarıda popup şeklinde sürekli olsun"</i>. Önceden
 * sayfanın en altında, akışın sonunda duruyordu; görmek için kaydırmak
 * gerekiyordu ve `/me`'yi tek ekran yapma amacına ters düşüyordu.
 *
 * <p>⚠️ <b>`fixed` + `bottom` hesabı mobilde kritik:</b> alt gezinme çubuğu
 * <code>h-20</code> (80px) ve <code>pb-4</code> taşır; şerit doğrudan
 * <code>bottom-0</code> olsaydı çubuğun ALTINDA kalırdı. Bu yüzden mobilde
 * <code>bottom-24</code> (96px), çubuğun olmadığı masaüstünde
 * <code>md:bottom-6</code>.
 *
 * <p>⚠️ <b>Yalnız `/me`'de</b> çizilir (kullanıcı: "profilde sadece") —
 * bileşen bu sayfanın içindedir, kabuğa konmadı.
 *
 * <p>⚠️ <code>pointer-events-none</code> dış kapta + <code>auto</code> şeritte:
 * şeridin iki yanındaki boşluk arkadaki içeriğin tıklanmasını engellemez.
 * Aksi halde ekranın alt şeridi görünmez bir kalkana dönüşürdü.
 */
function UrlBar({
  label,
  path,
  onCopy,
}: {
  label: string
  path: string
  onCopy: () => void
}) {
  const t = useT()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 md:bottom-6">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-line bg-surface/95 py-1.5 ps-4 pe-1.5 shadow-float backdrop-blur">
        {/* ⚠️ Vitrin AYRI yüzey → yeni sekme: kullanıcı panelinden çıkmadan
            kendi vitrinine bakabilmeli. */}
        <Link
          to={path}
          target="_blank"
          rel="noopener"
          dir="ltr"
          className="min-w-0 truncate text-[13px] font-medium hover:underline"
        >
          {label}
        </Link>
        <button
          type="button"
          onClick={onCopy}
          aria-label={t('profile.copyUrl')}
          title={t('profile.copyUrl')}
          className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <Copy className="h-4 w-4" />
        </button>
        <Link
          to={path}
          target="_blank"
          rel="noopener"
          aria-label={t('profile.openUrl')}
          title={t('profile.openUrl')}
          className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

/**
 * Referansın <b>hap düğmesi</b>: tam yuvarlak, 2px kenarlık, ortalı metin.
 *
 * <p>⚠️ Genişlik <code>w-full</code> + <code>max-w-[260px]</code>: dar telefonda
 * kenardan kenara, geniş ekranda referanstaki ölçüde kalır. Sabit piksel
 * verilseydi 320px'lik bir ekranda taşardı.
 *
 * <p>⚠️ <b>Marka pembesi token DEĞİL</b> — tasarım sisteminde karşılığı yok
 * (`--color-danger` turuncuya çalar ve "hata" anlamı taşır; çıkış bir hata
 * değildir). Tanıtım sayfasının imza rengi <code>#ff006e</code> burada da
 * doğrudan yazılır ve iki temada da okunur (kenarlık + metin, dolgu değil).
 */
/*
 * 🔴 `StoreNameField` KALDIRILDI (24 Ağu 2026).
 *
 * Satır içi ad düzenleyicisiydi. Mağaza adı artık `StoreSettingsForm`'da —
 * yani haritadaki panelle {@code /me} penceresinin PAYLAŞTIĞI tek formda.
 * İkisini birden bırakmak, aynı alan için iki ayrı düzenleyici ve iki ayrı
 * kaydetme yolu demekti; kullanıcı "hangisi geçerli?" diye sorardı.
 *
 * ⚠️ Buradaki tazeleme `['territories']` anahtarını geçersizleştiriyordu,
 * ortak form ise `['map','territories']` — yani ikisi zaten AYRI anahtarlara
 * yazıyordu ve biri haritayı tazelemiyordu. Tek forma inmek bu sessiz
 * ayrışmayı da bitirdi.
 */

function PillButton({
  children,
  onClick,
  icon: Icon,
  tone,
}: {
  children: React.ReactNode
  onClick?: () => void
  icon?: typeof MapPin
  tone: 'ink' | 'violet' | 'brand'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        /* ⚠️ Genişlik BURADA sınırlanmaz — saran kap belirler. İki yerde
           sınırlamak, bağlantıyla sarılan ve sarılmayan düğmeleri farklı
           genişliğe düşürüyordu. */
        'flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 px-5 text-[14px] font-medium transition-colors',
        tone === 'ink' && 'border-ink text-ink hover:bg-ink hover:text-on-ink',
        tone === 'violet' && 'border-violet text-violet hover:bg-violet hover:text-white',
        tone === 'brand' && 'border-[#ff006e] text-[#ff006e] hover:bg-[#ff006e] hover:text-white',
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  )
}

function Counter({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const content = (
    <>
      <span className="block text-[18px] font-semibold tabular-nums leading-none">{value}</span>
      <span className="mt-1 block text-[12px] font-medium text-faint">{label}</span>
    </>
  )
  if (!onClick) return <span className="text-center">{content}</span>
  return (
    <button type="button" onClick={onClick} className="text-center transition-colors hover:text-accent">
      {content}
    </button>
  )
}

/**
 * Profildeki panel bağlantıları.
 *
 * <p>⚠️ Etiketler <b>çeviri anahtarı</b> olarak durur, hazır metin değil:
 * modül sabiti olduğu için hazır metin, dili değiştiren kullanıcıda Türkçe
 * kalırdı (aynı kural `app/userNav.ts`'te de var).
 *
 * <p>⚠️ Sıra bilinçli: önce içerik/para bölümleri, en sonda Ayarlar — altında
 * "Çıkış yap" gelir ve ikisi birlikte "hesap" öbeğini kurar.
 */
const PANEL_LINKS = [
  { to: '/market', icon: Store, labelKey: 'nav.marketplaces', tone: 'ink' },
  { to: '/invoices', icon: Receipt, labelKey: 'nav.invoices', tone: 'ink' },
  { to: '/plan', icon: Sparkles, labelKey: 'nav.plan', tone: 'violet' },
  { to: '/reports', icon: BarChart3, labelKey: 'nav.reports', tone: 'ink' },
  { to: '/settings', icon: SettingsIcon, labelKey: 'nav.settings', tone: 'ink' },
] as const

/**
 * <b>Mağaza penceresi</b> — profildeki mağaza ikonuna dokununca açılır.
 *
 * <p>🔴 Önceden profil akışında <b>tam genişlikte bir kart</b>tı ve sosyal
 * ikonların hemen üstünde duruyordu. Mağaza bilgisi her ziyarette okunması
 * gereken bir şey değil; akışı bölüyordu. Artık isteyen ikona dokunup açıyor.
 *
 * <p>🔴 <b>Üç hâli var ve üçü de bir işe yarar:</b> mağazası olan kullanıcı
 * konumuna gidebilir ya da mağaza sayfasını açabilir; Premium olup henüz
 * kurmamış olan doğrudan kurma akışına girer; Premium olmayan neyi kaçırdığını
 * ve nereye gideceğini görür. Tek bir "mağazan yok" cümlesi, hakkı olan
 * kullanıcıyı da olmayanı da aynı çıkmaza sokardı.
 *
 * <p>⚠️ Hak kontrolü <code>canOwnStore</code> ile yapılır, plan adıyla değil —
 * sunucu neyi verdiğini kendi söyler.
 */
function StoreCard({
  store,
  loading,
  canOwnStore,
  onNavigate,
}: {
  store: TerritoryResponse | null
  loading: boolean
  canOwnStore: boolean
  onNavigate?: () => void
}) {
  const t = useT()

  if (loading) {
    return <div className="h-28 w-full animate-pulse rounded-2xl bg-subtle" />
  }

  if (!store) {
    return (
      <div className="py-2 text-center">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-subtle text-muted">
          <Store className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold">
          {canOwnStore ? t('me.storeReadyTitle') : t('store.premiumOnly')}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-muted">
          {canOwnStore ? t('me.storeReadyDesc') : t('store.premiumOnlyBody')}
        </p>
        <Link to={canOwnStore ? '/map' : '/plan'} onClick={onNavigate} className="mt-4 inline-block">
          <PillButton tone={canOwnStore ? 'ink' : 'violet'} icon={canOwnStore ? MapPin : Sparkles}>
            {canOwnStore ? t('store.title') : t('store.seePlans')}
          </PillButton>
        </Link>
      </div>
    )
  }

  const tone = leaseTone(store.daysRemaining, store.expired)
  return (
    <div>
      {/* --- başlık --- */}
      <div className="flex items-center gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: store.style?.fillColor ?? 'var(--color-violet, #8e59ff)' }}
          aria-hidden
        >
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {/* 🔴 24 Ağu 2026 — satır içi ad düzenleyici KALDIRILDI.
              Ad artık aşağıdaki `StoreSettingsForm`'da; iki ayrı ad alanı
              kullanıcıya "hangisi geçerli?" diye sordurur ve ikisi farklı
              uçlara yazıyordu. */}
          <p className="truncate text-[15px] font-bold">{store.name}</p>
          <p className="truncate text-[13px] text-faint">{store.regionLabel ?? '—'}</p>
        </div>
      </div>

      {/* --- detaylar --- */}
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <Detail label={t('store.radius')} value={fmtRadius(store.radiusM)} />
        <Detail label={t('me.storeArea')} value={fmtArea(store.areaKm2)} />
        <Detail
          label={t('me.storeCoords')}
          value={`${store.lat.toFixed(4)}, ${store.lng.toFixed(4)}`}
        />
        <Detail label={t('me.storeLease')} value={formatRemaining(store.daysRemaining)} />
      </dl>

      <div className="mt-3">
        <Badge
          tone={
            tone === 'expired' || tone === 'critical'
              ? 'danger'
              : tone === 'warn'
                ? 'warning'
                : 'success'
          }
        >
          {formatRemaining(store.daysRemaining)}
        </Badge>
      </div>

      {/* --- eylemler ---
          ⚠️ İki ayrı hedef: "konumuna git" HARİTAYI o noktaya taşır,
          "mağazayı aç" mağazanın SAYFASINI açar. Tek düğmeye indirmek,
          kullanıcının hangisine ihtiyacı olduğunu bizim adımıza seçmek olurdu. */}
      <div className="mt-4 flex flex-col gap-2">
        <Link to={`/map?t=${store.id}`} onClick={onNavigate} className="block w-full">
          <PillButton tone="ink" icon={MapPin}>
            {t('me.storeGoToMap')}
          </PillButton>
        </Link>
        <Link to={`/t/${store.id}`} onClick={onNavigate} className="block w-full">
          <PillButton tone="violet" icon={ArrowRight}>
            {t('me.storeOpen')}
          </PillButton>
        </Link>
      </div>

      {/* --- tüm ayarlar ---
          🔴 24 Ağu 2026 (kullanıcı: *"me kısmında mağaza kısmına da tüm
          ayarları taşı"*). Haritadaki düzenleme paneliyle <b>aynı</b> bileşen:
          alanlar, doğrulama, kaydetme ve silme tek kopya
          (`StoreSettingsForm`). İkinci bir form yazmak, bu projede defalarca
          yaşanmış "birinde değiştirdim diğerini unuttum" hatasıydı.

          ⚠️ `onPreview` VERİLMEZ: burada önizlenecek bir harita yok. Form onu
          opsiyonel bekliyor; boş bir geri çağırma uydurmak, "burada neden bir
          şey olmuyor?" sorusunu koda gömerdi.

          ⚠️ `currentColor` de verilmez: sunucunun çözdüğü otomatik palet rengi
          yalnız HARİTA verisinde durur. Form o yoksa kayıtlı renge düşer —
          kullanıcı rengini hiç seçmediyse burada varsayılan görünür ve
          kaydederse artık seçmiş olur. Yanlış bir renk göstermektense
          nötr bir başlangıç doğru. */}
      <div className="mt-5 border-t border-line pt-5">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-muted">
          {t('me.storeSettings')}
        </p>
        <StoreSettingsForm store={store} onDeleted={onNavigate} />
      </div>
    </div>
  )
}

/** Etiket + değer satırı — mağaza penceresindeki dört alan aynı dili konuşsun. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-subtle px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-semibold">{value}</dd>
    </div>
  )
}
