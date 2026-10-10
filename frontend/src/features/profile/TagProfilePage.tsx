import { useState } from 'react'
import { safeHref } from '@/lib/safeHref'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Image as ImageIcon } from 'lucide-react'
import { MarketingNav } from '@/components/MarketingNav'
import { PageSpinner } from '@/components/ui/spinner'
import { Pagination } from '@/components/ui/pagination'
import { VerifiedTick } from '@/components/VerifiedTick'
import { SocialLinks } from '@/components/social/SocialIcons'
import type { SocialLinkView } from '@/types/api'
import { toast } from '@/components/ui/toast'
import { publicApi } from '@/lib/publicApi'
import { useAuthStore } from '@/stores/auth'
import { useSeo, shareImageForUser } from '@/lib/seo'
import { getRelationship } from '@/lib/follow'
import { useFollowMutation } from '@/features/follow/useFollowMutation'
import { PostDetailModal } from '@/features/post/PostDetailModal'
import { ProfileStoryRing } from '@/features/story/ProfileStoryRing'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { reportLinkClick } from '@/lib/linkStats'
import { useT } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'
import {
  IconClaimTag,
  IconCollections,
  IconLinks,
  IconPosts,
  IconShare,
} from './profileIcons'

interface Profile {
  id: string
  tag: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  privateAccount: boolean
  /** İçerik BU ziyaretçiye açık mı? Gizli hesapta takipçi için de true olur. */
  canViewContent: boolean
  /** Mavi tik — sunucu planı okuyup karar verir, istemci türetmez. */
  verified: boolean
  linkCount: number
  postCount: number
  collectionCount: number
  /**
   * Takipçi/takip sayısı (18 Ağu 2026).
   *
   * ⚠️ Bu ikisi `canViewContent` kapısına TAKILMAZ (sunucu da öyle döner):
   * hesabın büyüklüğü içerik değildir ve ziyaretçinin "takip edeyim mi"
   * kararını veren şey tam olarak budur. Gizlenen şey içeriktir.
   */
  followerCount: number
  followingCount: number
  /** Profil başlığındaki sosyal medya ikonları (referans: kullanıcı adının altı). */
  socialLinks: SocialLinkView[]
}
interface Page<T> {
  content: T[]
  totalPages: number
}
interface LinkRow { id: string; title: string; url: string; iconUrl: string | null; domainLabel: string | null }
interface PostRow { id: string; title: string | null; imageUrl: string | null }
interface CollectionRow { id: string; title: string; coverUrl: string | null }

type TabKey = 'links' | 'posts' | 'collections'

/**
 * <b>Vitrin profili</b> (`/{tag}`) — referans `taginbio.com/hesapbu` <b>birebir</b>.
 *
 * <p>🔴 <b>7 Ağu 2026, ikinci geçiş.</b> İlk sürümde üç şey eksikti ve
 * kullanıcı haklı olarak "birebir değil" dedi:
 * <ol>
 *   <li><b>Üst çubuk yoktu.</b> Referansta profil sayfasının da kendi
 *       navbar'ı var: buzlu beyaz (<code>bg-white/70 · blur(16px)
 *       saturate(1.5)</code>), <b>64px</b>, içerik <code>max-w-[1024px]
 *       px-6</code>; solda logo, sağda <b>BÜYÜK HARF 14px/500</b> iki düz
 *       metin bağlantı (<code>Login</code> → <code>/login?callbackUrl=…</code>,
 *       <code>Sign up</code> → <code>/signup</code>).</li>
 *   <li><b>Sekmelerde ikon yoktu.</b> İlk ölçümde yalnız
 *       <code>textContent</code>'e bakmıştım; ikonlar <code>svg</code>
 *       çocuğundaydı. Referansta her sekme
 *       <code>&lt;div class="flex items-center space-x-2"&gt;</code> içinde
 *       <b>ikon + BÜYÜK HARF etiket</b> taşır. Path verileri
 *       <code>profileIcons.tsx</code>'te referansın kendi verisidir.</li>
 *   <li><b>Paylaş ikonu yanlıştı.</b> Lucide <code>Share2</code> değil,
 *       Phosphor <b>export</b> ikonu (kutudan çıkan ok, 256'lık viewBox).</li>
 * </ol>
 *
 * <p>Ölçülen diğer değerler (sayfa <b>açılarak</b>, paket okunarak değil):
 * avatar <b>112px kare</b> · <code>rounded-small (8px)</code> · <b>2px</b>
 * çerçeve · baş harfler <b>30px</b>; ad <b>24px UPPERCASE</b>; tag <b>18px</b>
 * gri; paylaş düğmesi <b>40×40</b>, <code>#71717a</code>, sağ üstte mutlak;
 * sekme <b>h-8 · px-3 py-1 · rounded-small</b>, seçilinin altında
 * <code>absolute inset-0 rounded-small bg-background shadow-small</code>
 * beyaz pill; ızgara <b>3 kolon</b> <code>gap-1 md:gap-2</code>, görseller
 * <b>kare ve köşesiz</b>, hover'da <code>drop-shadow</code>; ızgaranın altında
 * <b>altı çizili BÜYÜK HARF</b> giriş bağlantısı, sonra sayfalama; en altta
 * <b>SABİT</b> davet şeridi (<code>w-64 · p-2 · border-2 · rounded 11.2px ·
 * backdrop-blur(40px)</code>) ve içinde <b>20×20 etiket işareti</b>.
 *
 * <p>⚠️ Bu sayfa <b>kimlik istemez</b> — ziyaretçi geçişiyle çalışır (`publicApi`).
 * ⚠️ Yollarda <b>`/public` ÖNEKİ YAZILMAZ</b>: `publicApi`'nin baseURL'i zaten
 *    `/api/v1/public`; yazıldığında adres `/public/public/...` olup <b>404</b>
 *    veriyordu (ölçüldü).
 * ⚠️ Gizli hesapta başlık görünür, sekmeler <b>403</b> döner: hesabın varlığı
 *    sır değildir, içeriği sırdır.
 */
export function TagProfilePage() {
  const t = useT()
  const { tag = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) || 'links'
  const page = Math.max(Number(params.get('page') || '1'), 1)
  const [copied, setCopied] = useState(false)
  /** Izgaradan açılan gönderi — pencere sahibin ekranındakiyle aynı bileşen. */
  const [openPost, setOpenPost] = useState<string | null>(null)
  /* Oturum açıksa üst çubukta giriş/kayıt yerine panele dönüş gösterilir —
     giriş yapmış birine "Giriş yap" göstermek referansın da yapmayacağı şey. */
  const me = useAuthStore((s) => s.user)

  /*
   * 🔴 9 Ağu 2026 — oturum varsa istek `api` ile (JWT'li) gider.
   * `publicApi` kimlik taşımaz; sunucu isteği ziyaretçi sanıyor ve **gizli bir
   * hesabı takip eden kullanıcı bile** gönderileri göremiyordu (bildirilen
   * hata: `app.waydee.com/yasinventures`). JWT gidince sunucu takip ilişkisine
   * bakabiliyor. Oturumsuzda `publicApi` (ziyaretçi geçişini o taşır).
   */
  const profile = useQuery({
    queryKey: ['tag-profile', tag, me?.id ?? 'guest'],
    queryFn: async () =>
      me
        ? (await api.get<Profile>(`/public/profiles/${tag}`)).data
        : (await publicApi.get<Profile>(`/profiles/${tag}`)).data,
  })

  /* ⚠️ URL'de gizlenmiş bir sekme yazıyorsa (eski yer imi ya da elle yazılan
     `?tab=links`) var olan İLK sekmeye düşülür; yoksa ekran boş kalırdı.
     ⚠️ Sayaçlar profil yanıtından gelir; profil henüz yüklenmediyse istekte
     bulunulan sekme korunur (sorgu zaten `enabled: !!profile.data`). */
  const prof = profile.data
  const visibleTabs: TabKey[] = !prof
    ? ['links', 'posts', 'collections']
    : ([
        prof.linkCount > 0 ? 'links' : null,
        prof.postCount > 0 ? 'posts' : null,
        prof.collectionCount > 0 ? 'collections' : null,
      ].filter(Boolean) as TabKey[])
  const activeTab: TabKey = visibleTabs.includes(tab) ? tab : (visibleTabs[0] ?? 'posts')

  const list = useQuery({
    queryKey: ['tag-profile-list', tag, activeTab, page, me?.id ?? 'guest'],
    queryFn: async () =>
      me
        ? (await api.get<Page<LinkRow & PostRow & CollectionRow>>(
            `/public/profiles/${tag}/${activeTab}?page=${page - 1}`,
          )).data
        : (await publicApi.get<Page<LinkRow & PostRow & CollectionRow>>(
            `/profiles/${tag}/${activeTab}?page=${page - 1}`,
          )).data,
    // ⚠️ `privateAccount` DEĞİL `canViewContent`: gizli hesabın takipçisi de
    // içeriği çekebilmeli, yoksa sekmeler boş kalır.
    enabled: !!profile.data && profile.data.canViewContent,
  })

  const setTab = (next: TabKey) => {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    p.delete('page')
    setParams(p, { replace: true })
  }
  const setPage = (next: number) => {
    const p = new URLSearchParams(params)
    p.set('page', String(next))
    setParams(p, { replace: true })
  }

  const p = profile.data

  const initials = !p
    ? ''
    : (p.displayName || p.tag)
        .split(' ')
        .map((w) => w.charAt(0))
        .slice(0, 2)
        .join('')

  /*
   * 🔴 BOŞ SEKME ÇİZİLMEZ (referans davranışı, ölçüldü): `angnxyy62`
   * profilinde yalnız "Posts" sekmesi var — o hesabın bağlantısı ve
   * koleksiyonu yok. Boş bir sekme, tıklayınca "burada bir şey yok" diyen
   * ölü bir yol demektir.
   *
   * ⚠️ Sayılar profil başlığıyla AYNI istekte geliyor (`linkCount` vb.), bu
   * yüzden sekmeleri gizlemek ek bir çağrı gerektirmiyor.
   */
  const ALL_TABS: { key: TabKey; label: string; Icon: typeof IconLinks }[] = [
    { key: 'links', label: t('home.tabLinks'), Icon: IconLinks },
    { key: 'posts', label: t('home.tabPosts'), Icon: IconPosts },
    { key: 'collections', label: t('home.tabCollections'), Icon: IconCollections },
  ]
  const TABS = ALL_TABS.filter((x) => visibleTabs.includes(x.key))

  const rows = list.data?.content ?? []

  /*
   * 🔴 KULLANICI BAZLI SEO (9 Ağu 2026).
   * Vitrin profili ürünün arama motoruna açılan yüzüdür; başlık, açıklama,
   * kanonik adres ve `Person` yapılandırılmış verisi burada kurulur. Gizli
   * hesapta `noindex`: içeriği gizlerken adresini indeksletmek çelişki olurdu.
   * ⚠️ Kapak görseli KALICI uçtan gelir (imzalı bağlantı 7 günde ölür).
   */
  useSeo(
    !p
      ? null
      : {
          title: `${p.displayName || p.tag} (@${p.tag}) · Waydee`,
          description:
            p.bio ||
            t('seo.profileFallback').replace('{name}', p.displayName || p.tag),
          canonicalPath: `/${p.tag}`,
          image: p.avatarUrl ? shareImageForUser(p.id) : null,
          type: 'profile',
          noindex: p.privateAccount,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            url: `${window.location.origin}/${p.tag}`,
            mainEntity: {
              '@type': 'Person',
              name: p.displayName || p.tag,
              alternateName: `@${p.tag}`,
              url: `${window.location.origin}/${p.tag}`,
              ...(p.bio ? { description: p.bio } : {}),
              ...(p.avatarUrl ? { image: shareImageForUser(p.id) } : {}),
              ...(p.socialLinks?.length
                ? { sameAs: p.socialLinks.map((s) => s.url).filter(Boolean) }
                : {}),
            },
          },
        },
  )

  const share = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: p?.displayName ?? tag, url })
        return
      } catch {
        /* vazgeçildi */
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success(t('common.copied'))
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    /*
     * 🔴 16 Ağu 2026 — `data-claim` bayrağı.
     *
     * Davet şeridi `position: fixed` ve ekranın altına yapışıktır; sayfanın
     * akışında yer KAPLAMAZ. Ziyaretçide sayfalama tam onun altına düşüyor,
     * sayfa numaraları şeridin arkasında kalıyordu ("sayfa numarasıyla
     * birbirine giriyor"). Şeridin yüksekliği kadar alt dolgu buradan, tek
     * noktadan veriliyor — şerit yokken (oturumlu kullanıcı) dolgu da yok.
     */
    <div
      data-claim={me ? undefined : 'on'}
      className="waydee-vitrin flex min-h-full w-full flex-col items-center"
    >
      {/* ============================================================ üst çubuk
          🔴 Referansın (`taginbio.com/hesapbu`) VİTRİN çubuğu ölçüldü: başlıkta
          tam **iki `ul`** var — solda logo, sağda Giriş/Kayıt; **orta menü
          YOK**. Menülü çubuk koymak "birebir değil" şikâyetinin sebebiydi,
          bu yüzden `minimal` varyant. Zemin/ölçü/hover aynı bileşenden gelir. */}
      <MarketingNav variant="minimal" />

      {profile.isLoading ? (
        <PageSpinner label={t('feed.loading')} />
      ) : profile.isError || !p ? (
        <div className="waydee-empty mt-10">
          <h3 className="text-lg font-semibold">{t('profile.notFound')}</h3>
        </div>
      ) : (
        <>
          {/* ======================================================== başlık
              ⚠️ `pt-6`: paylaş düğmesi başlığın sağ ÜST köşesinde durur ve
              boşluk olmadan üst çubuğa **yapışık** görünüyordu (şikâyet
              buydu). Referansta çubuk sade olduğu için sorun etmiyordu;
              bizim çubuğumuz menü de taşıdığı için nefes payı şart. */}
          <div className="flex w-full flex-col items-center pt-6">
            <main className="relative flex w-full max-w-2xl flex-col justify-center">
              <div className="m-4">
                <div className="relative flex flex-col items-center justify-center md:flex-row">
                  {/*
                    🔴 16 Ağu 2026 — AVATARIN ÇEVRESİNDE HİKAYE HALKASI.
                    Vitrin profili bugüne kadar hikayeleri hiç göstermiyordu:
                    bir kişinin hikayesi yalnız ana sayfa şeridinde ya da
                    `/me`'de görünüyordu, oysa profil tam da "bu kişide ne var"
                    diye bakılan yer. Halka yalnız hikayesi olan profilde
                    çizilir ve avatarı bir piksel bile oynatmaz.
                    ⚠️ `enabled={!!me}` — hikaye ucu kimlik ister; ziyaretçide
                    sorgu hiç atılmaz (401 gürültüsü olurdu).
                  */}
                  <ProfileStoryRing
                    ownerUserId={p.id}
                    author={{
                      id: p.id,
                      username: p.tag,
                      displayName: p.displayName || p.tag,
                      avatarUrl: p.avatarUrl,
                    }}
                    enabled={!!me}
                  >
                    <span className="waydee-tag-avatar">
                      {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : initials}
                    </span>
                  </ProfileStoryRing>
                  {/*
                    🔴 15 Ağu 2026 — BAŞLIK ARTIK SABİT BİR KALIP.

                    Şikâyet: *"loginsizken kişi profillerine girdiğimizde eğer
                    sosyal medya yoksa bio falan kayıyor"*. Doğruydu ve sebebi
                    yerleşimin **veriye bağımlı** olmasıydı: satır
                    `items-center` ile hizalanıyor, sosyal ikon sırası (40px)
                    olmayınca metin sütunu kısalıyor, avatar ona göre yeniden
                    ortalanıyor ve altındaki bio yukarı kayıyordu. Yani boş
                    alanların **varlığı** çerçeveyi oynatıyordu.

                    Çözüm: isteğe bağlı her alan kendi **ayrılmış yuvasında**
                    durur (`waydee-tag-social-slot` · `waydee-tag-bio-slot`).
                    Yuva, içi boş olsa da yerini korur → avatar, ad, tutamaç ve
                    bio her profilde **aynı piksellerde** çizilir.

                    ⚠️ Bedeli bilinçli: sosyal hesabı olmayan profilde tutamacın
                    altında ~40px boşluk kalır. Alternatifi, profilden profile
                    zıplayan bir başlıktı; sabit çerçeve daha az rahatsız eder
                    ve istenen de buydu.
                  */}
                  <div className="waydee-tag-headtext p-3 text-center md:p-8 md:text-start">
                    {/* 🔴 9 Ağu 2026 — TAKİP DÜĞMESİ adın SAĞINDA (kullanıcı
                        isteği). Vitrin profili bugüne kadar tamamen "okunur"
                        bir sayfaydı: ziyaretçi kişiyi beğenip takip edecek
                        hiçbir yol bulamıyordu — oysa takip, ana sayfadaki
                        hikaye şeridinin de tek girdisidir. */}
                    <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                      <span className="waydee-tag-name">{p.displayName || p.tag}</span>
                      {p.verified && <VerifiedTick size={20} title={t('profile.verified')} />}
                      <ProfileFollowButton userId={p.id} tag={p.tag} />
                    </div>
                    <div className="waydee-tag-handle mb-1 truncate">{p.tag}</div>
                    {/*
                      🔴 18 Ağu 2026 — TAKİPÇİ SAYAÇLARI EKLENDİ.
                      Vitrin profili takipçi sayısını HİÇ göstermiyordu; oysa
                      oturum içindeki profil gösteriyordu. Ziyaretçi bir hesabın
                      ne kadar izlendiğini göremeden karar veriyordu.

                      ⚠️ Yuva KOŞULSUZ çizilir (sosyal ikon ve bio yuvalarıyla
                      aynı ilke): sayaçlar sıfır olsa bile satır durur, yoksa
                      altındaki her şey yukarı kayar ve başlık profilden
                      profile zıplar.
                      ⚠️ Takipçi/takip TIKLANABİLİR DEĞİL: listeyi açmak, gizli
                      hesabın çevresini sızdıran ayrı bir karardır ve bu turun
                      kapsamında değil. Sayı bilgi, liste ise erişimdir.
                    */}
                    <div className="waydee-tag-stats">
                      {/* ⚠️ `profile.following` KULLANILMAZ — o anahtar takip
                          DÜĞMESİNİN durumudur ("Takiptesin"). Sayaç etiketi
                          ayrı: `statFollowing` ("Takip"). Aynı kelimeyi iki
                          farklı anlamda paylaşmak, birini düzeltince diğerini
                          bozardı. */}
                      <ProfileStat value={p.followerCount ?? 0} label={t('profile.statFollowers')} />
                      <ProfileStat value={p.followingCount ?? 0} label={t('profile.statFollowing')} />
                      <ProfileStat value={p.postCount ?? 0} label={t('profile.statPosts')} />
                    </div>
                    {/* 🔴 Referansta (`taginbio.com/angnxyy62`) sosyal ikonlar
                        tam olarak BURADA: kullanıcı adının hemen altında, dört
                        adet 40×40 ikon. Bizde bio'nun altındaydı ve ziyaretçi
                        kişinin hesaplarına ulaşmak için önce metni okumak
                        zorundaydı.
                        ⚠️ Masaüstünde başlık sola yaslı olduğu için ikon sırası
                        da sola yaslanır; mobilde ortalanır. */}
                    {/* ⚠️ Yuva KOŞULSUZ çizilir; koşul yalnız içeriktedir.
                        `SocialLinks` boş listede `null` döndüğü için sarmalayıcı
                        olmasa satır tamamen kaybolur ve kayma geri gelirdi. */}
                    <div className="waydee-tag-social-slot">
                      {p.socialLinks?.length > 0 && (
                        <SocialLinks
                          links={p.socialLinks}
                          className="justify-center md:justify-start"
                        />
                      )}
                    </div>
                  </div>
                </div>
                {/* Bio yuvası da koşulsuz: bio'su olan ve olmayan profilde
                    altındaki sekme şeridi aynı yükseklikte başlasın. */}
                <div className="waydee-tag-bio-slot">
                  {p.bio && <p className="max-w-md text-sm text-muted md:text-base">{p.bio}</p>}
                </div>
              </div>
              {/* Referans: `absolute top-0 right-0`, 40×40, zinc-500. */}
              <div className="absolute end-0 top-0">
                <button
                  type="button"
                  aria-label={t('collection.share')}
                  onClick={share}
                  className="waydee-vitrin-share"
                >
                  <IconShare className="h-5 w-5" />
                  <span className="sr-only">
                    {copied ? t('common.copied') : t('collection.share')}
                  </span>
                </button>
              </div>
            </main>
          </div>

          {/* ======================================================== sekmeler */}
          <div className="flex flex-col items-center">
            <div className="waydee-ptabs" role="tablist">
              {TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  onClick={() => setTab(key)}
                  className="waydee-ptab"
                >
                  {activeTab === key && <span className="waydee-ptab-cursor" aria-hidden />}
                  <span className="waydee-ptab-content">
                    <Icon />
                    <span className="uppercase">{label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ========================================================= içerik */}
          <div className="w-full px-2 py-3 md:px-5">
            {!p.canViewContent ? (
              <div className="waydee-empty">
                <h3 className="text-lg font-semibold">{t('profile.private')}</h3>
              </div>
            ) : list.isLoading ? (
              <PageSpinner label={t('feed.loading')} />
            ) : rows.length === 0 ? (
              <div className="waydee-empty">
                <h3 className="text-lg font-semibold">
                  {activeTab === 'links'
                    ? t('home.noLinks')
                    : activeTab === 'posts'
                      ? t('home.noPosts')
                      : t('home.noCollections')}
                </h3>
              </div>
            ) : (
              /* Referans: `grid grid-cols-3 gap-1 md:gap-2 place-items-center`. */
              <div className="waydee-pgrid">
                {rows.map((row) =>
                  activeTab === 'links' ? (
                    <a
                      key={row.id}
                      href={safeHref(row.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="waydee-ptile"
                      title={row.title}
                      /*
                       * 🔴 16 Ağu 2026 — TIKLAMA ARTIK ÖLÇÜLÜYOR (V46).
                       * Buraya kadar hiçbir yerde bildirilmiyordu: sunucudaki
                       * `click_count` kolonu arayüzde gösteriliyor ama hiç
                       * artmıyordu, yani "bağlantı analizi" her zaman sıfır
                       * gösteriyordu.
                       * ⚠️ Bildirim BEKLENMEZ (`keepalive`): ziyaretçi hedefe
                       * gecikmeden gider ve sayfa değişse bile istek tamamlanır.
                       */
                      onClick={() => reportLinkClick(row.id)}
                      /* ⚠️ Orta tık / "yeni sekmede aç" `click` üretmez ama
                         `auxclick` üretir; onsuz gerçek tıklamaların bir kısmı
                         sessizce sayılmazdı. */
                      onAuxClick={() => reportLinkClick(row.id)}
                    >
                      {row.iconUrl ? (
                        <img src={row.iconUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="waydee-ptile-fallback">
                          {row.domainLabel ?? row.title}
                        </span>
                      )}
                    </a>
                  ) : activeTab === 'collections' ? (
                    <Link
                      key={row.id}
                      to={`/collections/${row.id}`}
                      className="waydee-ptile"
                      title={row.title ?? ''}
                    >
                      {row.coverUrl ? (
                        <img src={row.coverUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="waydee-ptile-fallback">
                          <ImageIcon className="h-6 w-6" />
                        </span>
                      )}
                    </Link>
                  ) : (
                    /* 🔴 9 Ağu 2026 — GÖNDERİ KAROSU ARTIK TIKLANABİLİR.
                       Burada `<div>` vardı: ziyaretçi (ve profilini vitrinden
                       açan sahibi) bir gönderiyi hiçbir şekilde açamıyor,
                       beğenemiyor, ürün etiketlerini göremiyordu. Ürünün ana
                       akışı tam burada kopuyordu. */
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setOpenPost(row.id)}
                      className="waydee-ptile"
                      title={row.title ?? ''}
                      aria-label={row.title || t('home.tabPosts')}
                    >
                      {row.imageUrl ? (
                        <img src={row.imageUrl} alt={row.title ?? ''} loading="lazy" />
                      ) : (
                        <span className="waydee-ptile-fallback">
                          <ImageIcon className="h-6 w-6" />
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            )}

            {/* Referansta ızgaranın altında altı çizili BÜYÜK HARF giriş
                bağlantısı durur (`mt-10`), sonra sayfalama (`mt-5`). */}
            {!me && (
              <div className="mt-10 flex flex-col items-center">
                <div className="m-2 flex w-full justify-center text-center">
                  <Link
                    to={`/login?next=${encodeURIComponent(`/${tag}`)}`}
                    className="waydee-vitrin-login"
                  >
                    {t('landing.nav.login')}
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-5 flex w-full justify-center">
              <Pagination
                page={page}
                totalPages={Math.max(list.data?.totalPages ?? 0, 1)}
                onChange={setPage}
              />
            </div>
          </div>
        </>
      )}

      {openPost && (
        <PostDetailModal
          postId={openPost}
          owner={!!me && !!p && me.id === p.id}
          onClose={() => setOpenPost(null)}
        />
      )}

      {/* ================================================ sabit davet şeridi
          🔴 16 Ağu 2026 — YALNIZ ZİYARETÇİYE. Şerit "waydee.com/kullaniciadi
          al" diyerek KAYIT ekranına götürür; oturum açmış bir kullanıcı
          başkasının vitrinine baktığında da çıkıyordu, yani hesabı olan
          kişiye "hesap aç" deniyordu. Kendi profilinde de aynı şey oluyordu.
          Kapı `me` ile: sunucudan gelen oturum sahibi varsa şerit hiç çizilmez
          (üst çubuk zaten aynı koşulla giriş/kayıt yerine panele dönüyor). */}
      {!me && (
        <div className="waydee-claim-dock">
          <Link to="/register" className="waydee-claim">
            <IconClaimTag className="shrink-0" />
            <span className="truncate">{t('profile.claim')}</span>
          </Link>
        </div>
      )}
    </div>
  )
}

/**
 * <b>Takip et</b> — vitrin profilinde, adın sağında.
 *
 * <p>🔴 Neden `features/follow/FollowButton` doğrudan kullanılmadı: o bileşen
 * ilişkiyi <b>dışarıdan</b> alır (`relationship` prop) ve onu getiren ekranlar
 * oturumlu sayfalardı. Vitrin profili ise <b>ziyaretçiye de açıktır</b>; burada
 * ilişki sorgusu ancak oturum varsa atılabilir. Sorguyu yukarıya taşımak,
 * ziyaretçide 401 üreten bir istek anlamına gelirdi.
 *
 * <p>⚠️ Oturumsuz kullanıcıda düğme <b>gizlenmez</b>: giriş ekranına dönüş
 * adresiyle götürür. Gizlemek, ziyaretçiye ürünün ne yaptığını hiç göstermezdi.
 * <p>⚠️ Kendi profilinde hiç çizilmez (`isSelf`).
 */
/**
 * Tek bir sayaç: kalın sayı + altında sönük etiket.
 *
 * <p>⚠️ Sayı {@code Intl.NumberFormat} ile biçimlenir — beş dilde binlik
 * ayıracı farklıdır ve elle nokta koymak Almanca/İngilizce'de yanlış çıkardı.
 * Dil {@code i18n} deposundan gelir, {@code navigator.language}'dan değil
 * (88. turun dersi).
 */
function ProfileStat({ value, label }: { value: number; label: string }) {
  const locale = useI18nStore((st) => st.locale)
  return (
    <span className="waydee-tag-stat">
      <b>{new Intl.NumberFormat(locale).format(value)}</b>
      <span>{label}</span>
    </span>
  )
}

function ProfileFollowButton({ userId, tag }: { userId: string; tag: string }) {
  const t = useT()
  const me = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const rel = useQuery({
    queryKey: ['relationship', userId],
    queryFn: () => getRelationship(userId),
    enabled: !!me && me.id !== userId,
  })

  /*
   * 🔴 18 Ağu 2026 — TAZELEME ARTIK PAYLAŞILAN KANCADA (`useFollowMutation`).
   *
   * Burada elle yazılmış liste yalnız `relationship` ve `story-feed`'i
   * tazeliyordu; takipçi SAYACI ise profil yanıtından (`tag-profile`) geliyor
   * ve o sorgu hiç geçersizleştirilmiyordu. Sonuç, kullanıcının bildirdiği
   * hata: düğme "Takiptesin"e dönüyor ama yanındaki sayı eski kalıyordu.
   * Liste tek yere alındı ki dördüncü bir takip düğmesi de unutulmasın.
   */
  const mutation = useFollowMutation(
    userId,
    !!(rel.data?.following || rel.data?.requested),
  )

  if (me && me.id === userId) return null

  if (!me) {
    return (
      <button
        type="button"
        className="waydee-follow-btn"
        onClick={() => navigate(`/login?next=${encodeURIComponent(`/${tag}`)}`)}
      >
        {t('profile.follow')}
      </button>
    )
  }

  const on = rel.data?.following || rel.data?.requested
  return (
    <button
      type="button"
      className={on ? 'waydee-follow-btn waydee-follow-on' : 'waydee-follow-btn'}
      disabled={mutation.isPending || rel.isLoading}
      onClick={() => mutation.mutate()}
      aria-pressed={!!on}
    >
      {mutation.isPending ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : rel.data?.following ? (
        t('profile.following')
      ) : rel.data?.requested ? (
        t('profile.requested')
      ) : (
        t('profile.follow')
      )}
    </button>
  )
}
