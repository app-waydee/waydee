import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { MarketingNav } from '@/components/MarketingNav'
import { useScrollTopOnMount, useSmoothScroll } from '@/lib/smoothScroll'
import { useT } from '@/i18n'
import { Footer } from './LandingPage'

/**
 * <b>Hakkımızda</b> — tasarım referansı <code>linear.app/about</code>.
 *
 * <p>🔴 Değerler <b>siteyi açıp ölçerek</b> alındı (8 Ağu 2026, 1280×720),
 * ekran görüntüsüne bakarak tahmin edilmedi — vault'taki kural bu
 * (<i>"referans analizinde sayfayı aç"</i>). Ölçülenler:
 *
 * <table>
 *   <tr><td>zemin / metin</td><td><code>#08090a</code> / <code>#f7f8f8</code></td></tr>
 *   <tr><td>ara metin (lead)</td><td><code>#d0d6e0</code> · 24px / 31.92px</td></tr>
 *   <tr><td>gövde metni</td><td><code>#8a8f98</code> · 15px / 24px</td></tr>
 *   <tr><td>h1</td><td>64px / 64px · w510 · ls <code>-1.408px</code> (= -0.022em)</td></tr>
 *   <tr><td>h2</td><td>40px / 44px · w510 · ls <code>-0.88px</code> (= -0.022em)</td></tr>
 *   <tr><td>kap</td><td><code>max-width 1364px</code>, iç dolgu 10px + 32px</td></tr>
 *   <tr><td>bölüm boşluğu</td><td><code>128px 0</code></td></tr>
 *   <tr><td>iki kolon</td><td><code>grid 1fr 1fr</code>; sağ kolon metni <b>495px</b></td></tr>
 *   <tr><td>video</td><td>16:9, köşe <b>8px</b></td></tr>
 *   <tr><td>ekip ızgarası</td><td>5 kolon · satır arası <b>48px</b>, kolon arası <b>4px</b>;
 *       kare görsel, köşe <b>4px</b>, görsel-yazı arası 16px</td></tr>
 * </table>
 *
 * <p>⚠️ <b>Başlık hizası SOLA yaslıdır</b> (ölçüldü: <code>text-align: start</code>,
 * h1 <code>x=40</code>). Linear'ın about sayfası ortalanmış görünür ama değildir;
 * ortalasaydım "birebir değil" olurdu.
 *
 * <p>⚠️ <b>Ağırlık 510 yerine 500.</b> Referans <code>Inter Variable</code>
 * kullanıyor ve 510 ara bir değer; bizim <code>index.html</code>'imiz Inter'i
 * <b>400;500;600;700</b> statik kesitleriyle çekiyor, 510 zaten 500'e yuvarlanır.
 * Değişken font eklemek tek bir başlık için sayfaya fazladan yük olurdu.
 *
 * <p>⚠️ <b>Sayfa her iki temada da KOYU.</b> `data-theme` ile dönmez — tıpkı
 * tanıtım sayfasındaki `PricingDark` / `MapDark` bölümleri gibi bilinçli bir
 * sabit yüzeydir. Bu yüzden renkler token'dan değil doğrudan yazılır;
 * Tailwind `dark:` <b>kullanılmaz</b> (vault: `dark:` bu projede işletim
 * sisteminin ayarına bağlanır ve tema düğmesinden kopar).
 *
 * <p>⚠️ <b>Rota guard'ların DIŞINDADIR.</b> `RedirectIfAuthed` altına
 * konsaydı oturum açmış bir kullanıcı footer'daki "Hakkımızda"ya bastığında
 * `/map`'e atılırdı. Sayfa hiçbir veri ucu çağırmaz, geçişe de ihtiyacı yok.
 *
 * <p>🔴 <b>Yol `/about`</b>, `/hakkimizda` değil (8 Ağu 2026, kullanıcı uyardı).
 * Ürünün tüm dış yüzeyi beş dilli; Türkçe bir yolu beş dilin hepsine dayatmak
 * tutarsızdı. Diğer yasal yollar da İngilizce: `/privacy`, `/terms`.
 */
export function AboutPage() {
  const t = useT()
  /*
   * ⚠️ Footer sayfanın EN ALTINDADIR: oradan buraya gelen kullanıcı, rota
   * değişse de eski kaydırma konumunda kalıyordu (sayfanın ortasına düşüyordu).
   * Yumuşakça en üste alınır — kullanıcı bunu açıkça istedi.
   */
  useSmoothScroll()
  useScrollTopOnMount()

  useEffect(() => {
    const previous = document.title
    document.title = `${t('landing.about.metaTitle')} · Waydee`
    return () => {
      document.title = previous
    }
  }, [t])

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f7f8f8]">
      <MarketingNav anchorPrefix="/" />
      <main>
        <AboutHero />
        <AboutIntro />
        <AboutTeam />
      </main>
      <Footer />
    </div>
  )
}

/** Ölçülen kap: `max-width 1364px`, dolgu 10px + 32px (toplam 42px). */
function Shell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1364px] px-6 sm:px-[42px] ${className}`}>{children}</div>
  )
}

/** h2 — 40px/44px, w500, ls -0.022em. Mobilde 28px'e iner. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[28px] font-medium leading-[1.1] tracking-[-0.022em] text-[#f7f8f8] sm:text-[40px] sm:leading-[44px]">
      {children}
    </h2>
  )
}

function AboutHero() {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  /*
   * ⚠️ Otomatik oynatma **hareket tercihine** saygı duyar. `prefers-reduced-motion`
   * açıkken video ilk karesinde durur; `autoPlay` özniteliğini şartlı yazmak
   * yetmez, tarayıcı öğeyi zaten oynatmaya başlamış olabilir → `pause()`.
   * ⚠️ `muted` + `playsInline` ŞART: sessiz olmayan bir video mobilde hiç
   * başlamaz (iOS/Android otomatik oynatmayı engeller) ve `playsInline`
   * olmadan iOS videoyu tam ekrana alır.
   */
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.autoplay = false
      v.pause()
    }
  }, [])

  return (
    <section className="pt-24 sm:pt-32">
      <Shell>
        <div className="max-w-[1183px]">
          {/* Ölçüldü: hizalama `start` — referans ortalı DEĞİL. */}
          <h1 className="text-[40px] font-medium leading-[1.03] tracking-[-0.022em] text-[#f7f8f8] sm:text-[56px] lg:text-[64px] lg:leading-[64px]">
            {t('landing.about.heroTitle')}
          </h1>
          <p className="mt-5 max-w-[420px] text-[15px] leading-6 text-[#8a8f98]">
            {t('landing.about.heroSubtitle')}
          </p>
        </div>

        {/*
          🔴 <b>VİDEO DIŞ KAYNAKTIR</b> — `apple.com/newsroom` üzerinde barındırılan
          bir tanıtım dosyası (kullanıcı bu adresi verdi). Tıpkı `bts-*`
          varlıkları gibi <b>yer tutucudur</b>: kalıcı kullanım için Waydee'nin
          kendi çekimi konmalıdır. Adres tek bir sabitte durur ki değiştirmek
          tek satır olsun.
          ⚠️ `preload="metadata"`: dosya <b>24 MB</b>; `auto` olsaydı sayfayı
          ilk açan herkes tamamını indirirdi.
        */}
        <div className="mt-12 overflow-hidden rounded-lg bg-black sm:mt-16">
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            src={ABOUT_VIDEO_URL}
            aria-label={t('landing.about.videoLabel')}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        </div>
      </Shell>
    </section>
  )
}

/**
 * Dış kaynaklı tanıtım videosu. <b>Yer tutucu</b> — Waydee'nin kendi çekimi
 * hazır olduğunda bu satır değişir (ve dosya `public/`'e taşınırsa dış
 * bağımlılık da biter).
 */
const ABOUT_VIDEO_URL =
  'https://www.apple.com/newsroom/videos/2026/autoplay/01/apple-kyle-hanagami-hero/large_2x.mp4'

/** Kurumsal talepler — tanıtım sayfasındaki kartla aynı adres. */
const CONTACT_EMAIL = 'info@waydee.com'

/**
 * İki kolonlu anlatı bölümü — referansın omurgası.
 *
 * <p>⚠️ Sağ kolonun <b>metni 495px</b>'tir, kolonun kendisi 590px. Metni
 * kolona yaymak satır uzunluğunu okunamaz hâle getiriyordu (referans da
 * yaymıyor). `md` altında tek kolona iner ve başlık metnin üstüne geçer.
 */
function AboutIntro() {
  const t = useT()
  return (
    <section className="py-20 sm:py-32">
      <Shell>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-0">
          <div>
            <SectionTitle>{t('landing.about.introTitle')}</SectionTitle>
          </div>
          <div className="flex max-w-[495px] flex-col gap-6 md:ps-8">
            {/* Lead — 24px, açık gri (`#d0d6e0`); gövdeden bilinçli olarak ayrı. */}
            <p className="text-[19px] leading-[1.33] text-[#d0d6e0] sm:text-[24px]">
              {t('landing.about.introLead')}
            </p>
            <p className="text-[15px] leading-6 text-[#8a8f98]">{t('landing.about.introP1')}</p>
            <p className="text-[15px] leading-6 text-[#8a8f98]">{t('landing.about.introP2')}</p>
          </div>
        </div>
      </Shell>
    </section>
  )
}

/**
 * Ekip bölümü.
 *
 * <p>🔴 <b>Izgara BİLEREK boştur.</b> Referansta burada ~150 gerçek kişinin
 * adı, unvanı ve fotoğrafı var. Waydee ekibinin verisi bana verilmedi;
 * uydurma isim ve stok fotoğraf koymak <b>olmayan insanları varmış gibi
 * göstermek</b> olurdu — bir "hakkımızda" sayfasında bu yanlış beyandır.
 * Yapı hazır: `MEMBERS` dizisine gerçek kayıtlar eklendiği anda ızgara
 * ölçülen düzende (5 kolon · satır 48px · kolon 4px · kare görsel, köşe 4px)
 * çizilir. Dizi boşken bölüm yalnız başlık + metin + iletişim çağrısı gösterir.
 */
type Member = { name: string; title: string; photo: string }

const MEMBERS: Member[] = []

function AboutTeam() {
  const t = useT()
  return (
    <section className="pb-20 sm:pb-32">
      <Shell>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-0">
          <div>
            <SectionTitle>{t('landing.about.teamTitle')}</SectionTitle>
          </div>
          <div className="flex max-w-[495px] flex-col gap-6 md:ps-8">
            <p className="text-[19px] leading-[1.33] text-[#d0d6e0] sm:text-[24px]">
              {t('landing.about.teamLead')}
            </p>
            {/* Referansta burada "We're hiring →" durur; bizde iletişim kanalı. */}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                t('landing.about.contactSubject'),
              )}`}
              className="inline-flex w-fit items-center gap-2 text-[15px] leading-6 text-[#f7f8f8] transition-opacity hover:opacity-70"
            >
              {t('landing.about.contactCta')}
              <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </a>
          </div>
        </div>

        {MEMBERS.length > 0 && (
          <ul className="mt-16 grid grid-cols-2 gap-x-1 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
            {MEMBERS.map((m) => (
              <li key={m.name} className="flex flex-col gap-4">
                <img
                  src={m.photo}
                  alt={m.name}
                  loading="lazy"
                  className="aspect-square w-full rounded object-cover"
                />
                <div>
                  <p className="text-[15px] leading-6 text-[#f7f8f8]">{m.name}</p>
                  <p className="text-[15px] leading-6 text-[#8a8f98]">{m.title}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-16 border-t border-white/10 pt-10">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
          >
            {t('landing.hero.cta')}
            <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </div>
      </Shell>
    </section>
  )
}
