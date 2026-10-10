import { useEffect, useLayoutEffect, useRef, useState, Children } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Check,
  ChevronDown,
  ExternalLink,
  Globe2,
  Heart,
  Instagram,
  Layers,
  Link2,
  Mail,
  MapPin,
  Share2,
  ShoppingBag,
  Tag,
  Youtube,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { MarketingNav } from '@/components/MarketingNav'
import {
  formatPrice,
  monthlyOf,
  usePlanPricing,
  yearlyDiscount,
  yearlyTotal,
  type BillingPeriod,
  type PaidPlan,
} from '@/features/plan/proPricing'
import {
  ENTERPRISE_FEATURES,
  FREE_FEATURES,
  INCLUDES,
  PREMIUM_FEATURES,
  PRO_FEATURES,
} from '@/features/plan/planFeatures'
import { useT } from '@/i18n'
import { useSmoothScroll } from '@/lib/smoothScroll'
import {
  COMPANY_ADDRESS_LINES,
  COMPANY_MAP_URL,
  CONTACT_EMAIL,
  SOCIAL_LINKS,
} from '@/lib/siteLinks'
import { cn } from '@/lib/utils'
/* 🗺️ "Dijital pazar alanları" karesinin içi — gerçek Mapbox küresi (102. tur). */
import { WorldMap } from './WorldMap'

/**
 * Tanıtım sayfası (`/`) — referans sayfanın DOM ağacı bölüm bölüm çıkarılarak
 * aynı yerleşim + aynı hareket diliyle kuruldu:
 * <ul>
 *   <li><b>Fare paralaksı:</b> hero'daki üç "düzlem" fareyi farklı katsayılarla
 *       izler (derinlik hissi) — rAF ile tek kareye birleştirilir, React
 *       state'ine yazılmaz (harita kasması dersinin aynısı).</li>
 *   <li><b>Kaydırma reveal'ları:</b> `data-reveal` taşıyan bloklar görünür
 *       alana girince yumuşakça belirir (IntersectionObserver + CSS geçişi;
 *       framer-motion YOK — vault tuzağı).</li>
 *   <li><b>Görseller:</b> `public/landing/*.jpg` — Unsplash'tan indirilen
 *       ÜCRETSİZ LİSANSLI fotoğraflar (ticari kullanım serbest, atıf gerekmez).
 *       ⚠️ Referanstaki Saint Laurent/LOEWE ürün çekimleri TELİFLİDİR ve
 *       kopyalanmaz; kendi ürün fotoğrafları gelince bu dosyalar değiştirilecek.</li>
 * </ul>
 * Vurgu rengi referanstan ölçüldü: <b>#ff006e</b>.
 */
export function LandingPage() {
  const [params] = useSearchParams()
  useScrollReveal()
  useCursor()
  // Referansın hareket dilinin parçası: kaydırma anlık değil, lerp ile yumuşak.
  useSmoothScroll()
  /* Eski QR kodları `/?t=<daireId>` basmıştı — geri alınamaz; haritaya taşı. */
  const deepLink = params.get('t')
  if (deepLink) {
    return <Navigate to={`/map?t=${encodeURIComponent(deepLink)}`} replace />
  }

  return (
    <div className="waydee-landing min-h-full bg-white text-black">
      {/* Üst çubuk TEK KAYNAK: `components/MarketingNav` — vitrin profili de
          aynı bileşeni çizer (kullanıcı isteği, 7 Ağu 2026). */}
      <MarketingNav />
      <main>
        <Hero />
        <Intro />
        <Brands />
        <Analytics />
        <MapDark />
        <Testimonials />
        <TagDemo />
        <QaPhoto />
        <OneLink />
        <HowItWorks />
        <StatementDark />
        {/*
          🗄️ 26 Ağu 2026, 100. tur — BURADA `<EduTile />` VARDI ("Vitrinin
          hazır. Şimdi dünyaya aç." + apple.com kaynaklı hareketli figür
          videoları + arkalarında dönen nokta-matris küre). Kullanıcı isteğiyle
          tanıtım sayfasından kaldırıldı; bileşenleri ve CSS'i **eksiksiz**
          olarak `marketing/_arsiv/` altında duruyor (silinmedi):
            • `_arsiv/EduTile.arsiv.tsx`  • `_arsiv/edu-tile.arsiv.css`
          Geri getirme adımları o dosyaların başındaki notta.
        */}
        <StatementLight />
        <PricingDark />
        <MadeFor />
        <FinalCta />
        <Faq />
      </main>
      <Footer />
    </div>
  )
}

/**
 * Sayfayı gezerken fareyi izleyen pembe imleç (referansın imzası).
 *
 * ⚠️ Konum React state'ine YAZILMAZ — rAF'ta doğrudan `transform`'a yazılır.
 * ⚠️ Öğeler `document.body`'ye eklenir: `overflow:hidden` taşıyan herhangi bir
 * bölüm imleci kırpamamalı. Dokunmatikte CSS `pointer: fine` ile hiç çizilmez.
 */
function useCursor() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const dot = document.createElement('div')
    dot.className = 'waydee-cursor'
    const label = document.createElement('div')
    label.className = 'waydee-cursor-label'
    label.dataset.wcursorLabel = ''
    document.body.append(dot, label)

    /*
     * ⚠️ İmleç fareye YAPIŞMAZ — arkasından yumuşayarak gelir.
     * Hedefe her karede sabit bir oranla yaklaşılır (lerp): `cur += (hedef -
     * cur) * k`. Bu, yayvan bir üstel yumuşama üretir; k küçüldükçe gecikme
     * artar. Nokta (0.15) etikete (0.11) göre biraz daha çevik — ikisi
     * arasındaki fark referanstaki katmanlı his.
     * Doğrudan `x = e.clientX` yazmak (önceki hâl) imleci fareye kilitliyor
     * ve tüm karakteri yok ediyordu.
     */
    let raf = 0
    let tx = -100
    let ty = -100
    let dx = -100
    let dy = -100
    let lx = -100
    let ly = -100

    const tick = () => {
      dx += (tx - dx) * 0.15
      dy += (ty - dy) * 0.15
      lx += (tx - lx) * 0.11
      ly += (ty - ly) * 0.11
      dot.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) translate(-50%, -50%)`
      label.style.transform = `translate3d(${lx.toFixed(2)}px, ${ly.toFixed(2)}px, 0) translate(-50%, -50%)`
      raf = requestAnimationFrame(tick)
    }
    const onMove = (e: MouseEvent) => {
      tx = e.clientX
      ty = e.clientY
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      dot.remove()
      label.remove()
      delete document.documentElement.dataset.wcursor
    }
  }, [])
}

/** Referanstaki mavi doğrulama rozeti (16×16, `#42A5F5` yıldız + beyaz tik). */
function VerifiedBadge() {
  return (
    <svg width="16" height="16" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle' }}>
      <path
        d="M15.8452 0L17.8869 3.16071L21.6488 3.34524L21.8393 7.10714L25 9.14881L23.2857 12.5L25 15.8452L21.8393 17.8869L21.6548 21.6488L17.8929 21.8393L15.8512 25L12.5 23.2857L9.15476 25L7.1131 21.8393L3.35119 21.6548L3.16071 17.8929L0 15.8512L1.71429 12.5L0 9.15476L3.16071 7.1131L3.34524 3.35119L7.10714 3.16071L9.14881 0L12.5 1.71429L15.8452 0Z"
        fill="#42A5F5"
      />
      <path d="M10.9471 16.8158L7.08398 12.9527L8.34589 11.6908L10.9709 14.3098L16.6614 8.79199L17.9054 10.0718L10.9471 16.8158Z" fill="white" />
    </svg>
  )
}


/* ------------------------------------------------------------- animasyonlar */

/**
 * `[data-reveal]` öğelerini görünür alana girince `waydee-shown` ile açar.
 * `data-reveal="2|3"` kademeli gecikme verir (CSS'te). Hareket azaltma
 * tercihinde her şey anında görünür.
 */
function useScrollReveal() {
  useLayoutEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!els.length) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    /*
     * ⚠️ İÇERİK VARSAYILAN OLARAK GÖRÜNÜRDÜR — gizleme CSS'ten değil,
     * BURADAN yapılır (`waydee-armed`). Önceki hâlde `[data-reveal]` CSS'te
     * `opacity: 0` idi; gözlemci herhangi bir sebeple tetiklenmezse öğeler
     * 28px aşağı kaymış ve görünmez kalıyordu — "butonlar alta gidip
     * kayboluyor" şikâyeti tam olarak buydu. Artık JS çalışmazsa/erken
     * biterse sayfa yine dolu görünür; en kötü ihtimalde animasyon olmaz.
     *
     * ⚠️ IntersectionObserver KULLANILMIYOR: bazı ortamlarda (kare üretmeyen
     * gömülü tarayıcılar, arka planda açılan sekmeler) geri çağrısı hiç
     * gelmiyor. Kaydırma + rAF ile konum ölçmek her yerde çalışır.
     */
    els.forEach((el) => el.classList.add('waydee-armed'))

    let raf = 0
    let kalan = els.slice()
    const gozden = () => {
      raf = 0
      const esik = window.innerHeight * 0.92
      kalan = kalan.filter((el) => {
        if (el.getBoundingClientRect().top < esik) {
          el.classList.add('waydee-shown')
          return false
        }
        return true
      })
      if (!kalan.length) sok()
    }
    const tetikle = () => {
      if (!raf) raf = requestAnimationFrame(gozden)
    }
    const sok = () => {
      window.removeEventListener('scroll', tetikle)
      window.removeEventListener('resize', tetikle)
    }
    window.addEventListener('scroll', tetikle, { passive: true })
    window.addEventListener('resize', tetikle)
    gozden()
    /* Son sigorta: rAF hiç akmayan bir ortamda bile 3 sn sonra hepsi açılır. */
    const sigorta = window.setTimeout(() => {
      els.forEach((el) => el.classList.add('waydee-shown'))
    }, 3000)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.clearTimeout(sigorta)
      sok()
    }
  }, [])
}

/* ----------------------------------------------------------------- gezinme */

/* ------------------------------------------------------------------- hero */

/**
 * Yüzen ürün kartı — konumlar referans CSS'inden (left/top yüzdeleri).
 *
 * <p>⚠️ <b>Kutu ölçüsü SABİTTİR</b> (`h-40 w-32` = 160×128, 4:5) ve öyle
 * kalmalıdır: yedi kart aynı ızgarada yüzer, biri büyürse referansın
 * kompozisyonu bozulur. Farklı en-boy oranındaki kaynak görseller
 * `object-cover` ile kırpılır — <b>ölçü değil, kırpma noktası</b> ayarlanır.
 *
 * <p><code>pos</code> = `object-position`. Ürünün kadrajın ortasında olmadığı
 * kaynaklarda (ör. tam boy model fotoğrafında pantolon alt yarıdadır) bu
 * olmadan kart yanlış yeri gösterir.
 */
function FloatCard({
  name,
  price,
  img,
  left,
  top,
  delay,
  pos,
}: {
  name: string
  price: string
  img: string
  left: string
  top: string
  delay: string
  pos?: string
}) {
  return (
    <div
      className="waydee-float z-0 flex flex-col gap-3 rounded-none bg-none p-3 shadow-none"
      style={{ left, top, animationDelay: delay }}
    >
      <div className="flex gap-3">
        <div className="relative h-40 w-32 overflow-hidden rounded-none bg-zinc-100">
          <img
            src={img}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover"
            style={pos ? { objectPosition: pos } : undefined}
          />
        </div>
      </div>
      <div>
        <div className="flex max-w-32 flex-col">
          <p className="mt-2 truncate text-xs font-medium text-black">{name}</p>
          <p className="text-xs font-medium text-gray-500">{price}</p>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  const t = useT()
  /* Referanstaki pill, örnek kullanıcı adlarını sırayla gösterir. */
  const handles = ['gezgin', 'elifstyle', 'mertdaily']
  const [handleIx, setHandleIx] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setHandleIx((i) => (i + 1) % handles.length), 2400)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [value, setValue] = useState('')

  /*
   * Fare paralaksı — üç düzlem farklı katsayılarla fareyi izler (derinlik).
   * ⚠️ Konum React state'ine YAZILMAZ; rAF'ta doğrudan DOM'a yazılır
   * (haritadaki kasmanın dersi). Düzlemlerin kendi `transition`'ı hareketi
   * yumuşatır — referanstaki "sürüklenerek takip" hissi budur.
   */
  const heroRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const host = heroRef.current
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const planes = Array.from(host.querySelectorAll<HTMLElement>('[data-plane]'))
    if (!planes.length) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const r = host.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        for (const p of planes) {
          const f = Number(p.dataset.plane || 24)
          p.style.transform = `translate3d(${(-x * f).toFixed(1)}px, ${(-y * f).toFixed(1)}px, 0)`
        }
      })
    }
    const onLeave = () => {
      for (const p of planes) p.style.transform = 'translate3d(0, 0, 0)'
    }
    host.addEventListener('mousemove', onMove)
    host.addEventListener('mouseleave', onLeave)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      host.removeEventListener('mousemove', onMove)
      host.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  const planeStyle = { transition: 'transform .55s cubic-bezier(.22,1,.36,1)' }

  return (
    <section>
      <div ref={heroRef} className="group relative flex min-h-screen w-full flex-col overflow-hidden">
        {/* Üç paralaks düzlemi — kart konumları referans CSS'inden. */}
        <div
          data-plane="20"
          style={planeStyle}
          className="pointer-events-none absolute inset-0 hidden will-change-transform md:block"
        >
          {/*
            🔴 8 Ağu 2026: dört kart kullanıcının verdiği `firstarea1–4` ile
            değişti. Eşleme **ürüne göre** yapıldı (etiket ile fotoğraf aynı
            şeyi anlatmalı): saat→`firstarea1`, deri ceket→`firstarea2`,
            pantolon→`firstarea3`, deri çanta→`firstarea4`. Fotoğraf ürünü
            değiştirdiği için **çeviri anahtarları da güncellendi**
            (`p2` keten→deri ceket, `p5` kot→chino) — beş dilde.
            Eşleşen fotoğrafı olmayan üç kart (kolye · ayakkabı · gözlük)
            eski görselleriyle kaldı: yedi kart referansın imzasıdır.
          */}
          <FloatCard name={t('landing.demo.p4')} price="₺450" img="/landing/p4.jpg" left="90%" top="70%" delay="0s" />
          <FloatCard
            name={t('landing.demo.p1')}
            price="₺890"
            img="/landing/firstarea4.jpg"
            left="5%"
            top="65%"
            delay="1.2s"
          />
          <FloatCard
            name={t('landing.demo.p2')}
            price="₺2.100"
            img="/landing/firstarea2.jpg"
            left="35%"
            top="0%"
            delay="2.1s"
          />
        </div>
        <div
          data-plane="38"
          style={planeStyle}
          className="pointer-events-none absolute inset-0 hidden will-change-transform md:block"
        >
          {/*
            ⚠️ `firstarea3` tam boy bir model karesidir; pantolon kadrajın
            **alt yarısındadır**. `pos` olmadan 4:5 kırpma göğüs hizasını
            gösterip etiketle çelişiyordu (ölçüldü) — kırpma noktası %68'e
            çekildi, kutu ölçüsü değişmedi.
          */}
          <FloatCard
            name={t('landing.demo.p5')}
            price="₺1.100"
            img="/landing/firstarea3.jpg"
            left="80%"
            top="5%"
            delay="0.7s"
            pos="50% 68%"
          />
          <FloatCard name={t('landing.demo.p3')} price="₺1.650" img="/landing/p3.jpg" left="60%" top="60%" delay="1.7s" />
        </div>
        <div
          data-plane="56"
          style={planeStyle}
          className="pointer-events-none absolute inset-0 hidden will-change-transform md:block"
        >
          <FloatCard name={t('landing.demo.p6')} price="₺620" img="/landing/p6.jpg" left="65%" top="2.5%" delay="2.6s" />
          <FloatCard
            name={t('landing.demo.p7')}
            price="₺3.400"
            img="/landing/firstarea1.webp"
            left="8%"
            top="10%"
            delay="0.4s"
          />
        </div>

        <main className="container mx-auto flex flex-1 flex-col items-center justify-center overflow-hidden px-8">
          <section className="z-10 flex flex-col items-center justify-center gap-[18px] sm:gap-6">
            <div className="flex flex-col items-center rounded-[20px] text-center backdrop-blur-sm" data-reveal>
              {/* Kullanıcı adı pill'i — örnek adresleri döndürür. */}
              {/*
                ⚠️ Referansta adresler KAYMAZ — her biri `absolute inset-0`
                üstünde durur ve **opacity + blur + translateY** ile geçer
                (ölçülen satır içi stil: `opacity: 1; filter: blur(0px);
                transform: translateY(-0.17px)`). Yani giden yukarı süzülüp
                bulanıklaşır, gelen alttan netleşerek girer.
                ⚠️ Metnin yanında **mavi doğrulama rozeti** vardır — eksikti.
              */}
              <button
                type="button"
                className="relative flex h-12 items-center justify-center overflow-hidden rounded-xl bg-white/50 px-8 py-2 text-sm font-medium text-black transition-all hover:bg-white/80 hover:shadow-md"
              >
                <div className="relative h-6 w-48 max-w-48 text-center">
                  {handles.map((h, i) => {
                    const active = i === handleIx
                    return (
                      <div
                        key={h}
                        className="absolute inset-0 flex items-center justify-center gap-2"
                        style={{
                          opacity: active ? 1 : 0,
                          filter: active ? 'blur(0px)' : 'blur(4px)',
                          transform: active ? 'translateY(0)' : 'translateY(12px)',
                          transition:
                            'opacity .45s ease, filter .45s ease, transform .45s cubic-bezier(.22,1,.36,1)',
                        }}
                      >
                        <span className="underline decoration-black/20 underline-offset-4">
                          waydee.com/{h}
                        </span>
                        <VerifiedBadge />
                      </div>
                    )
                  })}
                </div>
              </button>

              <div className="text-center text-[clamp(40px,10vw,44px)] font-medium leading-[1.2] tracking-tighter sm:text-[64px]">
                <div className="m-1 flex flex-wrap justify-center gap-x-[0.25em] text-black">
                  {t('landing.hero.title')}
                </div>
                {/* 🔴 Referansta (taag.app) başlığın altındaki ikinci satır
                    "Powered By Vision AI."dir ve DÜZ RENK DEĞİL: beş renkli
                    aurora gradyanı metnin içinde akar (ölçülen satır içi stil,
                    6 Ağu 2026). Aynı punto/ağırlık/harf aralığını üstteki
                    kaptan alır; marka ifadesi olduğu için her dilde İngilizce. */}
                <span className="waydee-aurora-text font-medium">
                  {t('landing.hero.titleAccent')}
                </span>
              </div>

              <div className="z-10">
                <div className="mt-3 flex flex-col items-center self-center md:flex-row">
                  <div className="flex h-12 w-64 items-center gap-3 rounded-xl bg-zinc-100 px-3 shadow-sm">
                    <span className="pointer-events-none text-sm text-zinc-400">waydee.com/</span>
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                      placeholder={t('landing.hero.claim')}
                      aria-label={t('landing.hero.claim')}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                    />
                  </div>
                  <Link
                    to={value ? `/register?u=${encodeURIComponent(value)}` : '/register'}
                    className="m-2 rounded-2xl bg-black p-4 text-sm font-medium leading-5 text-white transition-colors hover:bg-zinc-800"
                  >
                    {t('landing.hero.cta')}
                  </Link>
                </div>
                {/* 🔴 "Kredi kartı gerekmez · Ücretsiz plan sonsuza kadar" satırı
                    kullanıcı isteğiyle KALDIRILDI. Çeviri anahtarı sözlükte
                    duruyor — geri istenirse tek satırla geri gelir. */}
              </div>
            </div>
          </section>
        </main>
      </div>
    </section>
  )
}

/* ----------------------------------------------- giriş (clamp başlık + pill) */

function Intro() {
  const t = useT()
  /* ⚠️ `g` ve `h` 99. turda EKLENDİ (Global Keşif · 3D mağazalar) ve `c` ile `e`
     Waydee'nin gerçek özellikleriyle değiştirildi — başlık artık haritayı
     anlatırken şeritte "TikTok vitrini" yazması, sayfanın kendi vaadiyle
     çelişiyordu. ⚠️ `f` DEĞİŞTİRİLMEDİ: bu dosyanın alt bölümlerinde de
     kullanılıyor ve anlamı orada farklı bir cümlenin parçası. */
  const pills = [
    t('landing.marquee.a'),
    t('landing.marquee.b'),
    t('landing.marquee.c'),
    t('landing.marquee.d'),
    t('landing.marquee.e'),
    t('landing.marquee.f'),
    t('landing.marquee.g'),
    t('landing.marquee.h'),
  ]
  const bestFor = [
    t('landing.bestFor.a'),
    t('landing.bestFor.b'),
    t('landing.bestFor.c'),
    t('landing.bestFor.d'),
    t('landing.bestFor.e'),
    t('landing.bestFor.f'),
    t('landing.bestFor.g'),
    t('landing.bestFor.h'),
  ]
  return (
    /* 🔴 `md:py-40` → alt dolgu `pb-10`: bu bölümün hemen ardından destekçi
       logo şeridi geliyor ve 160px'lik alt dolgu, "KİMLER İÇİN" satırıyla
       logolar arasında **236px** boşluk bırakıyordu (ölçüldü). Üst dolgu
       korunur — orada bir öncekiyle arayı o açıyor. */
    <section
      id="nasil"
      className="relative flex items-center justify-center bg-none pb-10 pt-20 text-black md:pt-40"
    >
      <div className="container relative z-10 mx-auto max-w-7xl px-6 md:px-12">
        <h2
          data-reveal
          className="max-w-6xl text-[clamp(2.5rem,6vw,5.5rem)] font-medium leading-[1.05] tracking-tighter"
        >
          {t('landing.intro.a')}{' '}
          <span className="font-serif italic text-[#ff006e]">{t('landing.intro.serif')}</span>{' '}
          {t('landing.intro.b')}
          {/* 🔴 "Bugün kazanmaya başla." artık üstteki "60 saniyede" ile AYNI
              renkte (#ff006e) — kullanıcı isteği. Önce mavi→mor gradyandı. */}
          <span className="mt-2 block font-bold text-[#ff006e] md:mt-4">
            {t('landing.intro.block')}
          </span>
        </h2>
        <p
          data-reveal="2"
          className="mt-8 max-w-4xl text-[clamp(1.1rem,2vw,1.5rem)] font-normal leading-relaxed text-gray-500 md:mt-12"
        >
          {t('landing.hero.subtitle')}
        </p>
        <div data-reveal="3" className="mt-10 flex flex-wrap gap-3">
          {pills.map((p) => (
            <span
              key={p}
              className="rounded-full border border-black/10 bg-gray-50/50 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              {p}
            </span>
          ))}
        </div>
        <div data-reveal="2" className="mt-12 border-t border-black/5 pt-8">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-400">
            {t('landing.bestFor.title')}
          </h3>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {bestFor.map((b) => (
              <span
                key={b}
                className="group flex cursor-default items-center gap-2 text-base font-medium text-gray-700 transition-colors hover:text-black"
              >
                <span className="h-1 w-1 rounded-full bg-[#ff006e] transition-transform duration-200 group-hover:scale-[2]" />
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- markalar */

/** Başlığın son yarısına gradyan — dil bağımsız kaba bölme. */
function GradientTitle({ text, gradient }: { text: string; gradient: string }) {
  const words = text.split(' ')
  const cut = Math.ceil(words.length / 2)
  return (
    <>
      {words.slice(0, cut).join(' ')}{' '}
      <span className={cn('bg-clip-text text-transparent', gradient)}>
        {words.slice(cut).join(' ')}
      </span>
    </>
  )
}


/**
 * <b>Destekçi / iş birliği logoları</b> — `public/landing/supporter/`.
 *
 * <p>Dosyalar aynı ölçüde hazırlandığı için hepsi <b>tek yükseklikte</b>
 * (`h-10`, mobilde `h-8`) ve <code>object-contain</code> ile çizilir; genişlik
 * logonun kendi oranına bırakılır — sabit genişlik vermek dar logoları gerer,
 * geniş olanları ezerdi.
 *
 * <p>⚠️ Şerit <b>iki kez</b> basılır ve animasyon <code>-50%</code>'ye kadar
 * kayar: dizi tam ortada başa döndüğü için akış <b>dikişsiz</b> görünür
 * (marka kelimelerinde kullanılan aynı teknik).
 *
 * <p>⚠️ Hover <b>öğe bazındadır</b>, şerit bazında değil: fare bir logonun
 * üstündeyken yalnız o logo renklenir. Şerit durmaz — durdurmak akışı
 * kesintili gösteriyordu.
 */
const SUPPORTERS: { file: string; name: string }[] = [
  { file: 'amazon.png', name: 'Amazon' },
  { file: 'google.png', name: 'Google' },
  { file: 'meta.png', name: 'Meta' },
  { file: 'turkcell.png', name: 'Turkcell' },
  { file: 'bilisimvadisi.png', name: 'Bilişim Vadisi' },
  { file: 'ankarakalkınmaajnsı.png', name: 'Ankara Kalkınma Ajansı' },
  { file: 'enterprisesingapure.png', name: 'Enterprise Singapore' },
  { file: 'futuremakers.png', name: 'Future Makers' },
  { file: 'topcompanies.png', name: 'Top Companies' },
  { file: 'ybi.png', name: 'YBI' },
]

function SupporterStrip() {
  /* Dikişsiz akış için dizi iki kez basılır (bkz. bileşen notu). */
  const strip = [...SUPPORTERS, ...SUPPORTERS]
  return (
    <div data-reveal className="relative mb-10 w-full overflow-hidden py-2">
      {/* Kenarlarda sis — logolar kesilerek bitmesin. */}
      <div className="absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white md:w-40" />
      <div className="absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white md:w-40" />
      <div className="waydee-marquee-slow flex w-max items-center gap-12 md:gap-20">
        {strip.map((s, i) => (
          <img
            key={`${s.file}-${i}`}
            src={`/landing/supporter/${s.file}`}
            alt={s.name}
            loading="lazy"
            draggable={false}
            className="waydee-supporter-logo"
            /* İkinci kopya ekran okuyucuda tekrarlanmasın. */
            aria-hidden={i >= SUPPORTERS.length}
          />
        ))}
      </div>
    </div>
  )
}

/* Marka şeridi — bölümün ALTINDAKİ akış. ⚠️ Bu şeride ve üstteki destekçi
   logolarına DOKUNULMAZ (25 Ağu 2026, kullanıcı uyarısı): değişen yalnız
   ikisinin ARASINDAKİ metin bloğu. */
const BRAND_WORDS = [
  'MODA CO',
  'ATELIER',
  'LA MAISON',
  'URBAN',
  'NORTE',
  'VOGA',
  'LINEA',
  'FORMA',
  'ESTILO',
  'PRIMA',
  'CASA',
  'STUDIO',
]

/**
 * <b>Entegrasyonlar</b> — destekçi şeridi ile marka şeridinin arasındaki blok
 * (25 Ağu 2026).
 *
 * <p>Eski hâli *"Binlerce markayla çalışmaya hazır ol"* başlığı ve iki
 * sütunluk bir metindi. Yerine <b>gerçek</b> entegrasyonlar geldi: çalıştığımız
 * iki sağlayıcı (fal.ai, Accio) ve ürünün üç yeteneği.
 *
 * <h3>🔴 Sayfanın kendi dili kullanılır</h3>
 * <p>İlk sürüm reddedildi (*"iğrenç, AI hissiyatı çok fazla"*): krem zemin,
 * serif başlık, turuncu ray — hiçbiri bu sayfada yok. Tanıtım sayfasının dili
 * şu ve buradaki blok da <b>birebir</b> onu kullanır:
 * <ul>
 *   <li>hap biçiminde etiket (`rounded-full border-gray-200 bg-gray-100`),</li>
 *   <li>kalın sans başlık, ikinci yarısı <b>mavi→mor</b> gradyan
 *       ({@link GradientTitle}) — sayfadaki her bölüm başlığı böyle,</li>
 *   <li>`rounded-3xl border-gray-100 bg-gray-50/50` kartlar, hover'da gölge,</li>
 *   <li>`zinc` metin tonları.</li>
 * </ul>
 *
 * <p>⚠️ Üstteki destekçi logoları ve alttaki marka şeridi <b>olduğu gibi
 * kaldı</b>: kullanıcı yalnız aradaki bloğun değişmesini istedi.
 *
 * <p>⚠️ Hover'da kart <b>yükselir + gölgelenir</b> ve altından mavi→mor bir
 * çizgi açılır; logo hafifçe canlanır. Hepsi `transform`/`opacity` ile —
 * bu sayfada `width`/`height` animasyonu defalarca takıldı (vault kuralı).
 */
interface IntegrationItem {
  key: string
  /** Sağlayıcı logosu (fal.ai · Accio) — yoksa {@link icon} çizilir. */
  logo?: string
  icon?: typeof BarChart3
}

const INTEGRATIONS: IntegrationItem[] = [
  { key: 'fal', logo: '/landing/integrations/fal.png' },
  { key: 'accio', logo: '/landing/integrations/accio.png' },
  { key: 'analytics', icon: BarChart3 },
  { key: 'sales', icon: ShoppingBag },
  { key: 'marketing', icon: Share2 },
]

function Brands() {
  const t = useT()
  const strip = [...BRAND_WORDS, ...BRAND_WORDS]
  return (
    <>
      {/* ⚠️ Destekçi şeridi krem bandın DIŞINDA: kenar sisi `from-white` ile
          çiziliyor ve krem zeminde yanlış görünürdü. */}
      <section className="w-full overflow-hidden bg-none px-6 pt-2 md:px-12">
        <div className="mx-auto max-w-7xl">
          <SupporterStrip />
        </div>
      </section>

      {/* ══ ENTEGRASYONLAR — referans tasarımın birebir uygulaması ══
          Krem bant tam genişlikte; içerik yine `max-w-7xl` kolonunda. */}
      <section className="waydee-int-band w-full overflow-hidden px-6 py-24 md:px-12 md:py-28">
        {/* 🔴 Kolon `max-w-7xl` DEĞİL: referansta içerik ekranın neredeyse
            tamamını kaplıyor (2000px ekranda ~1800px). 1280px'e sıkıştırınca
            başlık iki satıra kırılıyor ve kartlar dar şeritlere dönüşüyordu —
            ilk denemedeki en görünür fark buydu. */}
        <div className="mx-auto w-full max-w-[1800px]">
          {/* Başlık solda, açıklama sağda ve DAR — referanstaki düzen.
              ⚠️ Açıklamayı başlığın altına tam genişlikte sermek, ikisini tek
              bir metin bloğu gibi gösteriyordu. */}
          <div data-reveal className="grid gap-8 md:grid-cols-[1.45fr_1fr] md:items-start md:gap-20">
            <div>
              <div className="waydee-int-eyebrow mb-6">{t('landing.integrations.eyebrow')}</div>
              <h2 className="waydee-int-title">{t('landing.integrations.title')}</h2>
            </div>
            <p className="waydee-int-lead max-w-[34rem] md:pt-2">
              {t('landing.integrations.subtitle')}
            </p>
          </div>

          {/* Ray + kartlar. `pt-*` kartları rayın altına indirir; aradaki
              boşluğu her kartın kendi sapı doldurur. */}
          <div data-reveal="2" className="relative mt-20 md:mt-28">
            <span className="waydee-int-rail" aria-hidden />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5 lg:pt-[var(--waydee-int-drop)]">
              {INTEGRATIONS.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.key} className="waydee-int-card">
                    <span className="waydee-int-dot" aria-hidden />
                    <span className="waydee-int-stem" aria-hidden />
                    <div className="waydee-int-face">
                      <span className="waydee-int-mark">
                        {Icon ? (
                          <Icon className="h-6 w-6" strokeWidth={2.1} />
                        ) : (
                          <img
                            src={item.logo}
                            alt=""
                            loading="lazy"
                            draggable={false}
                            className="waydee-int-logo"
                          />
                        )}
                      </span>
                      <h3 className="waydee-int-name">
                        {t(`landing.integrations.${item.key}` as never)}
                      </h3>
                      <p className="waydee-int-desc">
                        {t(`landing.integrations.${item.key}Desc` as never)}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ⚠️ Marka şeridi de bandın DIŞINDA ve DOKUNULMADI. */}
      <section className="w-full overflow-hidden bg-none px-6 pb-32 pt-10 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div data-reveal="3" className="relative w-full overflow-hidden py-10">
            <div className="absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white md:w-48" />
            <div className="absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white md:w-48" />
            <div className="waydee-marquee flex w-max items-center gap-16 md:gap-24">
              {strip.map((w, i) => (
                <div
                  key={`${w}-${i}`}
                  className="flex items-center justify-center opacity-40 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0"
                >
                  <div className="relative flex h-14 w-32 items-center justify-center whitespace-nowrap text-xl font-bold tracking-tight text-zinc-500 transition-colors hover:text-black">
                    {w}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/* --------------------------------------------------------------- analitik */

/**
 * Analitik bölümü.
 *
 * <p>⚠️ Referansta özellik kartlarında <b>ikon YOKTUR</b> — başlık + açıklama
 * metni vardır (ben lucide ikonu koymuştum, açıklamalar eksikti).
 * ⚠️ Panodaki ilerleme çubukları <b>0 genişlikle</b> durur ve kart görünür
 * alana girince değerlerine <b>açılır</b> (`width: 0px` başlangıç değeri
 * referansın DOM'unda birebir görülüyor).
 */
function Analytics() {
  const t = useT()
  const features = [
    { title: t('landing.analytics.a'), desc: t('landing.analytics.aDesc') },
    { title: t('landing.analytics.b'), desc: t('landing.analytics.bDesc') },
    { title: t('landing.analytics.c'), desc: t('landing.analytics.cDesc') },
  ]
  /* 🔴 Panodaki rakamlar kullanıcı isteğiyle yükseltildi (7 Ağu 2026):
     günlük trafik 12.482 → 48.360, ülke 42 → 96, etkileşim %8,4 → %14,6,
     bölgeler 4.249/2.842/1.942 → 18.740/12.310/9.480. Çubuk genişlikleri
     de yeni oranlara göre güncellendi. */
  const regions = [
    { name: 'İstanbul, TR', value: '18.740', w: '86%' },
    { name: 'Berlin, DE', value: '12.310', w: '62%' },
    { name: 'London, UK', value: '9.480', w: '46%' },
  ]
  /* Çubuklar kart göründükten sonra açılır — reveal ile aynı eşik. */
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [barsOn, setBarsOn] = useState(false)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    if (!('IntersectionObserver' in window)) return setBarsOn(true)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setBarsOn(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    const safety = window.setTimeout(() => setBarsOn(true), 2500)
    return () => {
      window.clearTimeout(safety)
      io.disconnect()
    }
  }, [])
  return (
    <section className="relative overflow-hidden bg-none py-24">
      <div className="container relative z-10 mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-col items-center gap-16 lg:flex-row">
          <div data-reveal className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-black">
              {t('landing.brands.c')}
            </div>
            <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 md:text-5xl lg:text-6xl">
              {t('landing.analytics.title')}{' '}
              {/* 🔴 "anlamlı veriye çevir." artık ÜSTÜNDEKİ başlıkla aynı renkte
                  (`text-zinc-900`) — kullanıcı isteği. Önce mavi→mor gradyandı. */}
              <span>{t('landing.analytics.titleAccent')}</span>
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
              {t('landing.analytics.subtitle')}
            </p>
            <div className="grid gap-6 pt-4 sm:grid-cols-2">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group flex gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 transition-colors hover:bg-zinc-100/80"
                >
                  <div>
                    <h3 className="mb-1 font-semibold text-zinc-900">{f.title}</h3>
                    <p className="text-sm leading-snug text-zinc-500">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div ref={cardRef} data-reveal="2" className="h-fit w-full flex-1 lg:max-w-[600px]">
            <div className="relative aspect-square md:aspect-video lg:aspect-square">
              <div className="relative inset-0 rounded-3xl border border-zinc-200 bg-white p-8">
                <div className="mb-12 flex items-end justify-between">
                  <div>
                    <h4 className="mb-1 text-sm font-medium uppercase tracking-tighter text-zinc-500">
                      {t('landing.analytics.traffic')}
                    </h4>
                    <p className="text-3xl font-bold tracking-tighter text-zinc-900">
                      48.360
                      <span className="ml-1 text-xs text-emerald-600">+21,7%</span>
                    </p>
                  </div>
                </div>
                {/* ⚠️ Referansta bu kutularda İKON YOKTUR — yalnız etiket
                    metni. Renk sınıfı (`text-blue-600`/`text-purple-600`)
                    sarmalayıcıda kalır. */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2 text-blue-600">
                      <span className="text-xs font-bold uppercase tracking-tighter text-black">
                        {t('landing.brands.b')}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-zinc-900">96 {t('landing.analytics.countries')}</p>
                    {/* ⚠️ Referansta bu çubuğun dolgusunda RENK SINIFI YOK
                        (`class="h-full"`); yalnız ikinci çubuk `bg-purple-500`
                        taşıyor. Mavi yapmıştım — kaldırıldı, birebir. */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full"
                        style={{ width: barsOn ? '78%' : 0, transition: 'width 1.1s cubic-bezier(.22,1,.36,1)' }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2 text-purple-600">
                      <span className="text-xs font-bold uppercase tracking-tighter text-black">
                        {t('landing.analytics.engagement')}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-zinc-900">%14,6</p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                      <div
                        /* 🔴 Soldaki "42 ülke" çubuğuyla AYNI olacak (kullanıcı
                           isteği): renk sınıfı YOK, dolgu varsayılan renkte kalır.
                           Referansta bu çubuk `bg-purple-500` taşıyordu ama iki
                           çubuğun aynı görünmesi istendi. */
                        className="h-full"
                        style={{ width: barsOn ? '62%' : 0, transition: 'width 1.1s cubic-bezier(.22,1,.36,1) .1s' }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <h4 className="mb-4 text-xs font-bold uppercase tracking-tighter text-zinc-500">
                    {t('landing.analytics.regions')}
                  </h4>
                  {regions.map((r, i) => (
                    <div key={r.name} className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-900">
                        <span>{r.name}</span>
                        <span className="text-zinc-500">{r.value}</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full bg-zinc-300"
                          style={{
                            width: barsOn ? r.w : 0,
                            transition: `width 1.1s cubic-bezier(.22,1,.36,1) ${0.15 + i * 0.1}s`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------- koyu bölüm: harita = mağaza */

function MapDark() {
  const t = useT()
  const items = [
    { title: t('landing.map.a'), desc: t('landing.map.aDesc') },
    { title: t('landing.map.b'), desc: t('landing.map.bDesc') },
    { title: t('landing.map.d'), desc: t('landing.map.dDesc') },
    { title: t('landing.map.c'), desc: t('landing.map.cDesc') },
  ]
  return (
    <section id="harita" className="relative w-full overflow-hidden bg-black px-6 py-24 md:px-12">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-16 lg:flex-row">
          <div data-reveal className="flex-1 lg:pr-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {t('landing.map.eyebrow')}
            </div>
            <h2 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              {t('landing.map.title')}{' '}
              <span className="bg-gradient-to-r from-gray-400 to-white bg-clip-text text-transparent">
                {t('landing.map.titleAccent')}
              </span>
            </h2>
            <p className="mb-10 max-w-xl text-lg font-light leading-relaxed text-gray-400 md:text-xl">
              {t('landing.map.subtitle')}
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {items.map((i) => (
                <div key={i.title} className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold text-white">{i.title}</h3>
                  <p className="text-sm font-light leading-relaxed text-gray-400">{i.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Telefonvari çerçeve — referans: rounded-[50px] + border-8 border-white/10 */}
          <div data-reveal="2" className="w-full max-w-2xl flex-1 lg:max-w-none">
            <div className="relative z-10 flex flex-col gap-6 rounded-[50px] border-8 border-white/10 bg-black/40 p-6">
              {/*
                🔴 26 Ağu 2026, 102. tur — BU KARE ARTIK FOTOĞRAF DEĞİL, GERÇEK
                BİR MAPBOX KÜRESİ ({@link WorldMap}).

                Kullanıcı fotoğrafın kaldırılıp yerine dönen bir dünya konmasını
                istedi ve iki tur yanlış yoldan gidildi — 100. tur `cobe` (nokta
                bulutu), 101. tur elde çizilen küre; ikisi de reddedildi.
                🔴 Ders: ürün ZATEN bir harita uygulaması. Mapbox kurulu,
                anahtarı çözülmüş ve küre görünümü (`projection: 'globe'` + sis)
                vitrin sayfasında çoktan çalışıyordu.

                `map-area.jpg` DOSYASI DURUYOR (`public/landing/`) — bir
                yüzeyden kaldırmak silmek değildir (vault kuralı).

                ⚠️ Çerçeveye yine DOKUNULMADI: dış `rounded-[50px] border-8
                border-white/10` kabuk, alttaki `@waydee` şeridi, konum işareti
                ve haritaya giden çağrı aynen duruyor.

                ⚠️ Oran KARE: küre kısa kenara oturur; 16/9'da iki yanda geniş
                boşluk kalıyor ve mağaza kartları kürenin uzağına düşüyordu.

                ⚠️ İçerideki harita bir DEKORDUR ve bütün girdileri kapalıdır.
                Açık olsaydı karo sayfanın kaydırmasını yakalar, ziyaretçi
                burada hapsolurdu — gidilecek yer zaten alttaki düğme.
              */}
              <div className="relative aspect-square overflow-hidden rounded-3xl bg-zinc-950">
                <WorldMap />
                {/* Alttaki çağrının okunması için alttan yukarı koyulaşan
                    perde. ⚠️ Küre canlı olduğu için perde `pointer-events`
                    almaz; almasaydı hiçbir şey olmazdı ama üstteki bağlantı
                    da tıklanamazdı. */}
                <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                {/*
                  🔴 9 Ağu 2026 — kare üstündeki BAŞLIK VE AÇIKLAMA KALDIRILDI
                  (kullanıcı isteği). "Dijital pazar alanları" başlığı ve
                  açıklaması zaten solda, dört özellik listesinde birebir aynı
                  metinle duruyordu; fotoğrafın üstünde ikinci kez yazmak aynı
                  cümleyi iki kez okutuyordu. Kalan: konum işareti + çağrı.

                  🔴 Düğme MOBİLDE DE İÇERİĞİ KADAR (kullanıcı: "pc'deki gibi
                  minimal dursun"). `w-full sm:w-auto` mobilde düğmeyi kartın
                  bir kenarından ötekine geriyordu; şimdi her ekranda `w-auto`.
                */}
                <div className="absolute inset-x-0 bottom-0 z-[4] flex flex-col items-center gap-3 p-5 text-center sm:items-start sm:gap-4 sm:p-7 sm:text-start">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <Link
                    to="/map"
                    className="inline-flex w-auto items-center justify-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-zinc-200 sm:px-6 sm:py-3"
                  >
                    {t('landing.nav.map')} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-between border-t-2 border-white/10 pt-6">
                <div className="flex items-center gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-white">@waydee</h4>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">İstanbul, TR</p>
                  </div>
                </div>
                {/* 🔴 10 Ağu 2026 — SAYAÇ METNİ KALDIRILDI, YERİNE ETKİLEŞİM
                    İKONLARI (kullanıcı isteği). "12 gönderi · 3 koleksiyon"
                    uydurma bir istatistikti ve ürünün ne yaptığını anlatmıyordu;
                    beğeni ve kaydetme, gönderi kartının gerçek eylemleridir ve
                    uygulamadaki karşılıklarıyla (kalp + yer imi) aynı ikonlar. */}
                <div className="flex items-center gap-4 pt-2 text-gray-300">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-[18px] w-[18px]" aria-hidden />
                    <span className="text-sm font-semibold text-white">128</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Bookmark className="h-[18px] w-[18px]" aria-hidden />
                    <span className="text-sm font-semibold text-white">36</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ referanslar */

function Testimonials() {
  const t = useT()
  const items = [
    /*
     * 🔴 8 Ağu 2026: `a1.jpg` değişti (kullanıcı isteği — "daha tatlı biri").
     * Kaynak: Unsplash `photo-1630939687530-241d630735df`
     * (`unsplash.com/photos/smiling-woman-in-black-tank-top-dzbSQkqZzUw`),
     * 512×512 yüz-merkezli kırpma. Unsplash lisansı ticari kullanıma açıktır.
     *
     * ⚠️ <b>DOSYA İKİ YERDE KULLANILIYOR</b>: burada (referans kartı, 48px
     * yuvarlak) ve aşağıdaki koleksiyon telefon mockup'ında (96px yuvarlak).
     * Bilinçli olarak **dosyanın kendisi** değiştirildi, `src` değil — yoksa
     * biri yenilenip diğeri eskisiyle kalırdı (kullanıcı ikisini de istedi).
     * Bu yüzden yeni görsel **kare** ve **baş-omuz** kadrajlı seçildi: her iki
     * yuvarlak kırpmada da yüz ortada kalıyor.
     */
    { quote: t('landing.testimonials.a'), name: 'Elif K.', handle: '@elifstyle', img: '/landing/a1.jpg' },
    { quote: t('landing.testimonials.b'), name: 'Mert A.', handle: '@mertdaily', img: '/landing/a2.jpg' },
    { quote: t('landing.testimonials.c'), name: 'Zeynep S.', handle: '@zeynepcurates', img: '/landing/a3.jpg' },
  ]
  return (
    <section className="w-full bg-white px-6 py-24 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {items.map((i, ix) => (
            <div
              key={i.handle}
              data-reveal={ix === 0 ? undefined : String(ix + 1)}
              className="flex flex-col justify-between rounded-3xl border border-gray-100 bg-gray-50/50 p-8 transition-shadow duration-300 hover:shadow-lg"
            >
              <p className="mb-8 text-lg leading-relaxed text-gray-700">“{i.quote}”</p>
              <div className="flex items-center gap-3">
                <img
                  src={i.img}
                  alt={i.name}
                  loading="lazy"
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <h4 className="mb-1 cursor-pointer font-bold leading-none text-gray-900 hover:text-[#ff006e] hover:underline">
                    {i.name}
                  </h4>
                  <span className="text-sm text-gray-500">{i.handle}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------- etiket demosu (masonry) */

/**
 * Etiket demosu — solda ürün listesi, sağda masonry.
 *
 * <p>⚠️ İki taraf BAĞLIDIR: soldaki satır etkinleşince sağdaki karonun
 * üstünde <b>tespit kutusu</b> belirir. Kutu `inset-0` DEĞİL — referansta
 * görselin içinde `top:15% left:15% w:70% h:70%` konumlu bir çerçevedir ve
 * altında <b>ürün adı · %99</b> etiketi taşır (`font-mono uppercase`,
 * `bg-black/90`, aralarında `w-px h-5` ayraç).
 * <p>Etkin satır kendiliğinden döner; fareyle bir satıra gelince o sabitlenir.
 */
function TagDemo() {
  const t = useT()
  const [activeIx, setActiveIx] = useState(0)
  const [pinned, setPinned] = useState(false)

  /*
   * 🔴 7 Ağu 2026: üç ürün `product1–3.webp` ile değişti (kullanıcı isteği).
   * ⚠️ **Güneş gözlüğü karesine DOKUNULMADI** — kullanıcı onun kalmasını
   * istedi; dizinin son satırı hep o.
   *
   * Sol listedeki küçük görsel ile sağdaki karo **aynı dosyadır**: liste bir
   * satıra gelince o karonun tespit kutusu açılır, yani ikisi eşleşmezse
   * kutu "yanlış ürünün üstünde" görünür. Eskiden liste `p2/p5/p1`, karolar
   * `p11/p8/p12` idi — farklı çekimlerdi ve eşleşme yalnız isimden geliyordu.
   *
   * Kutu koordinatları **görseller açılıp ürünün yeri ölçülerek** yazıldı:
   *  · `product1` — siyah örgü hırka, gövdenin üst yarısı
   *  · `product2` — bej kanvas çanta, kucakta, yeşil saplı
   *  · `product3` — haki deri seyahat çantası, sol elde, alt bölgede
   */
  const products = [
    { name: t('landing.demo.p8'), price: '₺2.450', img: '/landing/product1.webp' },
    { name: t('landing.demo.p9'), price: '₺1.890', img: '/landing/product2.webp' },
    { name: t('landing.demo.p10'), price: '₺3.200', img: '/landing/product3.webp' },
    { name: t('landing.demo.p6'), price: '₺320', img: '/landing/p6.jpg' },
  ]
  const tiles = [
    { img: '/landing/product1.webp', name: t('landing.demo.p8'), box: { top: '17%', left: '35%', width: '28%', height: '29%' } },
    { img: '/landing/product2.webp', name: t('landing.demo.p9'), box: { top: '33%', left: '26%', width: '45%', height: '42%' } },
    { img: '/landing/product3.webp', name: t('landing.demo.p10'), box: { top: '52%', left: '27%', width: '17%', height: '24%' } },
    { img: '/landing/p6.jpg', name: t('landing.demo.p6'), box: { top: '22%', left: '20%', width: '60%', height: '55%' } },
  ]

  /* Etkin ürün kendiliğinden döner — fare bir satırda beklerken durur. */
  useEffect(() => {
    if (pinned) return
    const id = window.setInterval(() => setActiveIx((i) => (i + 1) % products.length), 2200)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned])
  return (
    <section className="relative w-full overflow-hidden bg-white py-24 text-black">
      <div className="container relative z-10 mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-col items-center justify-center gap-16 lg:flex-row">
          <div className="flex w-full flex-1 flex-col gap-6 lg:w-1/3">
            <div data-reveal>
              <div className="mb-4 flex items-center gap-2">
                {/* ⚠️ Rozet DÜZ RENK DEĞİL: metnin içinde akan beş renkli
                    aurora gradyanı + mor kenar + mor parıltı (.waydee-aurora). */}
                <span className="waydee-aurora rounded-lg px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider">
                  Waydee Tag
                </span>
                <span className="h-px w-10 bg-gradient-to-r from-[#3A86FF] to-transparent opacity-50" />
                {/* 🔴 7 Ağu 2026: buradaki "Powered By Vision AI." KALDIRILDI.
                    Ölçüldü (aynı gün, sayfa açılarak): referansta bu cümle
                    sayfada YALNIZ BİR KEZ geçer ve yeri kahraman başlığının
                    altıdır — ikinci geçiş yalnız JSON-LD içinde, ekranda değil.
                    Cümle artık kahramanda aurora gradyanıyla duruyor; burada
                    bırakmak aynı cümleyi sayfada iki kez gösterirdi. */}
              </div>
              {/* Referansta başlık iki satır: "See beyond <br> the pixels." */}
              <h2 className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 md:text-5xl lg:text-6xl">
                {t('landing.tagdemo.title')}
              </h2>
              <p className="max-w-md text-lg leading-relaxed text-zinc-600">
                {t('landing.tagdemo.subtitle')}{' '}
                <span className="font-medium text-black">{t('landing.tagdemo.accuracy')}</span>
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              {/* ⚠️ Satırlara `data-reveal` VERİLMEZ — zaten görünür bir
                  bloğun içindeler; tek tek gizlemek onları "aşağıda kalmış"
                  gösterme riskini boşuna doğuruyordu. */}
              {products.map((p, i) => (
                <div
                  key={p.name}
                  onMouseEnter={() => {
                    setActiveIx(i)
                    setPinned(true)
                  }}
                  onMouseLeave={() => setPinned(false)}
                  className={cn(
                    'group relative cursor-pointer rounded-xl border p-4 transition-all duration-200',
                    activeIx === i
                      ? 'border-gray-300 bg-gray-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-xl bg-gray-100 p-1">
                      <img
                        src={p.img}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full rounded-xl object-contain"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold uppercase text-zinc-900">{p.name}</h3>
                      <p className="font-mono text-sm text-gray-500">{p.price}</p>
                    </div>
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full transition-colors duration-200',
                        activeIx === i ? 'bg-[#ff006e]' : 'bg-gray-300 group-hover:bg-[#ff006e]',
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal="2" className="relative flex h-fit w-full flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl columns-2 gap-2 space-y-2 sm:gap-4 sm:space-y-4">
              {tiles.map((tile, i) => (
                <div
                  key={tile.img}
                  className="relative mb-2 break-inside-avoid overflow-hidden rounded-xl sm:mb-4"
                >
                  {/* Görsel doğal yükseklikte (`h-auto`) — masonry bundan doğar. */}
                  <img src={tile.img} alt="" loading="lazy" className="h-auto w-full object-cover" />
                  {/* Tespit kutusu: görselin İÇİNDE bir çerçeve + alt etiket. */}
                  <div
                    className={cn(
                      'absolute z-30 transition-opacity duration-200',
                      activeIx === i ? 'opacity-100' : 'opacity-0',
                    )}
                    style={tile.box}
                  >
                    <div className="absolute inset-0 border-2 border-white shadow-sm" />
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 border border-white/20 bg-black/90 px-3 py-1.5 font-mono text-sm uppercase tracking-wider text-white backdrop-blur-md">
                      <span className="font-bold">{tile.name}</span>
                      <span className="h-5 w-px bg-white/30" />
                      <span>%99</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------ büyük fotoğraf + yüzen soru balonları */

/**
 * Fare paralaksı — her öğe kendi <b>derinlik katsayısıyla</b> kayar.
 *
 * <p>Referansta ölçülen değerler tek bir fare ofsetinin katlarıydı
 * (15.64 · 23.46 · 31.28 · 39.1 · 62.56 → 7.82 × 2/3/4/5/8), yani her etiketin
 * bir `factor`'ü var. Konum rAF'ta doğrudan DOM'a yazılır.
 *
 * <p>🔴 7 Ağu 2026'da bir tur boyunca kaldırılmıştı; <b>geri getirildi</b>.
 * Referansın (`taag.app`, "Where are the pants from?") imza hareketi bu:
 * yedi yüzen öğenin hepsi <code>will-change-transform</code> taşır ve fareyle
 * birlikte farklı hızlarda kayar. Onsuz bölüm ölü duruyordu.
 */
function usePointerParallax(hostRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = hostRef.current
    if (!host || !window.matchMedia('(pointer: fine)').matches) return
    const items = Array.from(host.querySelectorAll<HTMLElement>('[data-depth]'))
    if (!items.length) return
    let raf = 0
    let ox = 0
    let oy = 0
    const paint = () => {
      raf = 0
      for (const el of items) {
        const f = Number(el.dataset.depth || 1)
        el.style.transform = `translateX(${(ox * f).toFixed(2)}px) translateY(${(oy * f).toFixed(2)}px)`
      }
    }
    const onMove = (e: MouseEvent) => {
      const r = host.getBoundingClientRect()
      ox = ((e.clientX - r.left) / r.width - 0.5) * 16
      oy = ((e.clientY - r.top) / r.height - 0.5) * 6
      if (!raf) raf = requestAnimationFrame(paint)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
    }
  }, [hostRef])
}

/**
 * <b>Alan galerisi</b> — büyük fotoğraf + <b>fareyi izleyen</b> etiketler,
 * yana kayan üç kare.
 *
 * <p>Referans (`taag.app`) bu bölümde <b>yedi yüzen öğe</b> taşır: üç soru
 * balonu (<code>bg-white/10 · border-white/20 · rounded-2xl · backdrop-blur-sm</code>,
 * bir köşesi düz) ve dört ürün etiketi (<code>bg-black/50 · rounded-full ·
 * backdrop-blur-md · px-3 py-1.5</code>) — hepsi <code>will-change-transform</code>
 * ve fareyle birlikte <b>farklı hızlarda</b> kayıyor.
 *
 * <p>🔴 Bizde ayrıca üç <b>alan</b> arasında kayan bir galeri var; etiketler
 * her karenin kendi ürünlerine oturuyor ve görseller açılıp içerikleri
 * okunarak yazıldı: stüdyo masası (ekran · Mac · klavye · fare · kartela ·
 * makine) · tepedeki elektrikli SUV (araç · jant · cam tavan · kombin) ·
 * turuncu çantalı krem kombin (çanta · ceket · pantolon).
 *
 * <p>⚠️ <b>Kayma hareketi RAY'da.</b> Ray tek bir CSS `translateX` ile kayar;
 * etiketlerin kendi `transform`'u yalnız <b>paralaks</b> içindir ve rAF'ta
 * doğrudan DOM'a yazılır (React state'i kullanılsaydı fare hareketi saniyede
 * ~60 render tetiklerdi). Görünürlük yalnız <b>opaklıkla</b> döner — konumu
 * kritik bir öğede geçişli transform bu projede defalarca takıldı.
 *
 * <p>⚠️ Paralaks yalnız <code>pointer: fine</code> cihazlarda çalışır;
 * dokunmatikte etiketler sabit durur, kaydırma parmakla yapılır.
 *
 * <p>⚠️ Mobil: oran kademeli (<code>4/5 → 3/2 → 16/9</code>), ikincil
 * etiketler <code>sm</code> altında gizlenir (kalabalık ediyordu), oklar
 * küçülür.
 */
function QaPhoto() {
  const t = useT()
  const [ix, setIx] = useState(0)
  const [paused, setPaused] = useState(false)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const touchX = useRef<number | null>(null)
  usePointerParallax(hostRef)

  /**
   * Etiket konumları görsellerin İÇİNDEKİ nesneler ölçülerek yazıldı.
   * `depth` referanstaki katsayı ailesi (2–8): büyük olan fareyi daha çok izler.
   * `minor` işaretliler mobilde gizlenir.
   */
  const slides = [
    {
      img: '/landing/area1.jpg',
      asks: [
        { text: t('landing.qa.ask1'), top: '8%', left: '5%', depth: 2, corner: 'rounded-bl-none' },
        { text: t('landing.qa.ask1b'), top: '84%', left: '62%', depth: 3, corner: 'rounded-br-none' },
      ],
      tags: [
        { name: t('landing.qa.a1t1'), price: '₺62.000', top: '26%', left: '50%', depth: 8 },
        { name: t('landing.qa.a1t4'), price: '₺78.000', top: '58%', left: '70%', depth: 5 },
        { name: t('landing.qa.a1t2'), price: '₺4.200', top: '72%', left: '38%', depth: 6 },
        { name: t('landing.qa.a1t5'), price: '₺3.100', top: '84%', left: '20%', depth: 4, minor: true },
        { name: t('landing.qa.a1t3'), price: '₺1.150', top: '44%', left: '36%', depth: 4, minor: true },
        { name: t('landing.qa.a1t6'), price: '₺54.000', top: '38%', left: '84%', depth: 5, minor: true },
      ],
    },
    {
      img: '/landing/area2.jpg',
      asks: [
        { text: t('landing.qa.ask2'), top: '10%', left: '56%', depth: 3, corner: 'rounded-br-none' },
      ],
      tags: [
        { name: t('landing.qa.a2t1'), price: '₺2.450.000', top: '50%', left: '46%', depth: 8 },
        { name: t('landing.qa.a2t2'), price: '₺48.000', top: '78%', left: '30%', depth: 5 },
        { name: t('landing.qa.a2t3'), price: '₺32.000', top: '38%', left: '58%', depth: 4, minor: true },
        { name: t('landing.qa.a2t4'), price: '₺2.100', top: '52%', left: '9%', depth: 6, minor: true },
      ],
    },
    {
      /*
       * 🔴 9 Ağu 2026 — görsel `area3.jpg` → **`area3.png`** ile değişti.
       * ⚠️ Eski yol zaten KIRIKTI: diskte `area3.jpg` diye bir dosya yoktu
       * (yalnız `area1.jpg` ve `area2.jpg` vardı), yani üçüncü kare
       * <b>boş bir çerçeve</b> olarak dönüyordu. Yeni dosya konurken uzantı
       * da düzeltildi.
       *
       * Etiket konumları YENİ fotoğraf ölçülerek yazıldı (1660×930, yan
       * profilden yürüyen model):
       *   turuncu çanta  sağ üst blok  → %64 / %35
       *   krem ceket     gövde         → %51 / %43
       *   krem pantolon  bacaklar      → %47 / %68
       *   deri bot       ayaklar       → %41 / %88
       * ⚠️ Çeviri anahtarları zaten bu fotoğrafı anlatıyordu (turuncu çanta,
       * krem ceket, deri bot, krem pantolon) — metin değişmedi, yalnız
       * `a3t3` (bot) nihayet kullanılıyor; önceden hiçbir yere bağlı değildi.
       */
      img: '/landing/area3.png',
      asks: [
        { text: t('landing.qa.ask3'), top: '9%', left: '8%', depth: 2, corner: 'rounded-bl-none' },
      ],
      tags: [
        { name: t('landing.qa.a3t1'), price: '₺4.900', top: '35%', left: '64%', depth: 8 },
        { name: t('landing.qa.a3t2'), price: '₺3.200', top: '43%', left: '51%', depth: 5 },
        { name: t('landing.qa.a3t4'), price: '₺1.850', top: '68%', left: '47%', depth: 6, minor: true },
        { name: t('landing.qa.a3t3'), price: '₺2.700', top: '88%', left: '41%', depth: 4, minor: true },
      ],
    },
  ]

  const go = (next: number) => setIx((next + slides.length) % slides.length)

  /* Kendiliğinden ilerler; fare üstündeyken durur (okumak isteyen kaçırmasın). */
  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => setIx((i) => (i + 1) % slides.length), 6000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  return (
    <section className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-white py-16 md:py-24">
      <div
        ref={hostRef}
        data-reveal
        className="group relative w-full max-w-7xl px-4 md:px-12"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="relative mx-auto w-full overflow-hidden rounded-3xl"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX
            setPaused(true)
          }}
          onTouchEnd={(e) => {
            const start = touchX.current
            touchX.current = null
            setPaused(false)
            if (start == null) return
            const dx = e.changedTouches[0].clientX - start
            /* 40px altındaki hareket kaydırma sayılmaz — dokunmayla karışır. */
            if (Math.abs(dx) < 40) return
            go(ix + (dx < 0 ? 1 : -1))
          }}
        >
          {/* Ray: TEK transform ile kayar (etiketlerinki paralaks içindir). */}
          <div
            className="flex w-full transition-transform duration-[700ms] ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ transform: `translateX(-${ix * 100}%)` }}
          >
            {slides.map((s, i) => (
              <div key={s.img} className="relative w-full shrink-0">
                <img
                  src={s.img}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                  draggable={false}
                  /* 🔴 9 Ağu 2026 — MOBİL ORAN 4/5 → 4/3 (kullanıcı: "mobilde
                     yüksekliği biraz düşürelim, fotoğrafların yatay uzunluğu
                     biraz daha görünsün"). 4:5 dikey bir kutu, `object-cover`
                     ile fotoğrafın SAĞINI VE SOLUNU kesiyordu; 4:3 hem kareyi
                     alçaltır hem yatayda daha çoğunu gösterir.
                     ⚠️ `sm` ve `lg` oranlarına dokunulmadı — şikâyet yalnız
                     mobildeydi ve masaüstü kadraj zaten ölçülerek seçilmişti. */
                  className="aspect-[4/3] w-full select-none object-cover sm:aspect-[3/2] lg:aspect-[16/9]"
                />
                {/* Etiketlerin okunması için çok hafif bir perde. */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />

                {/* Soru balonları — referanstaki cam kutular. */}
                {s.asks.map((a) => (
                  <div
                    key={a.text + a.left}
                    data-depth={ix === i ? a.depth : 0}
                    className={cn(
                      'waydee-qa-ask absolute z-10',
                      a.corner,
                      ix === i ? 'opacity-100' : 'opacity-0',
                    )}
                    style={{ top: a.top, left: a.left }}
                  >
                    {a.text}
                  </div>
                ))}

                {/* Ürün etiketleri — referanstaki siyah haplar. */}
                {s.tags.map((tag, ti) => (
                  <div
                    key={tag.name}
                    data-depth={ix === i ? tag.depth : 0}
                    className={cn(
                      'waydee-qa-tag absolute z-20',
                      ix === i ? 'opacity-100' : 'opacity-0',
                      'minor' in tag && tag.minor ? 'hidden sm:flex' : 'flex',
                    )}
                    style={{
                      top: tag.top,
                      left: tag.left,
                      transitionDelay: ix === i ? `${140 + ti * 90}ms` : '0ms',
                    }}
                  >
                    <span className="waydee-qa-dot" />
                    <span className="truncate">
                      {tag.name} <span className="opacity-70">• {tag.price}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Oklar — dokunmatikte de görünür; hover'a saklamak mobilde
              erişilemez kılardı. */}
          <button
            type="button"
            aria-label={t('landing.qa.prev')}
            onClick={() => go(ix - 1)}
            className="waydee-qa-arrow start-2 md:start-5"
          >
            <ChevronDown className="h-5 w-5 rotate-90" />
          </button>
          <button
            type="button"
            aria-label={t('landing.qa.next')}
            onClick={() => go(ix + 1)}
            className="waydee-qa-arrow end-2 md:end-5"
          >
            <ChevronDown className="h-5 w-5 -rotate-90" />
          </button>
        </div>

        {/* Noktalar */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.img}
              type="button"
              aria-label={t('landing.qa.goTo').replace('{n}', String(i + 1))}
              aria-current={ix === i}
              onClick={() => go(i)}
              className={cn('waydee-qa-dotnav', ix === i && 'waydee-qa-dotnav-on')}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------ çözüm: gönderi + koleksiyon */

function OneLink() {
  const t = useT()
  return (
    <section className="relative bg-white px-6 py-24 text-black">
      <div className="container relative z-10 mx-auto max-w-6xl">
        <div data-reveal className="mb-20 text-center">
          <div className="mb-4 inline-block rounded-full border border-black/10 bg-gray-100 px-4 py-1.5 text-sm font-medium">
            {t('landing.onelink.badge')}
          </div>
          <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
            {t('landing.onelink.title')}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-500">{t('landing.onelink.subtitle')}</p>
        </div>

        <div className="grid items-start gap-12 md:grid-cols-2 lg:gap-24">
          {/* Gönderi mock'u */}
          <div data-reveal="2" className="flex flex-col gap-6 will-change-transform">
            {/*
              ⚠️ Fotoğraf TAM KAPLAMAZ. Referansta gri degrade bir zeminin
              üstünde, alta oturan **kalın siyah çerçeveli** bir kart var:
              `w-3/4 h-3/4 bg-[#F6F5F3] border-x-[5px] border-t-[5px]
              border-black rounded-t-[4rem]`. Arkasında hafif döndürülmüş,
              bulanık bir dikdörtgen derinlik verir.
            */}
            <div className="group relative aspect-[4/5] overflow-hidden rounded-3xl border border-gray-200 bg-gray-100 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300">
                <div className="absolute inset-0 bg-black/[0.03] mix-blend-overlay" />
                <div className="absolute left-1/4 top-1/4 h-1/2 w-1/2 rotate-3 rounded-2xl bg-gray-300 opacity-50 blur-sm" />
                <div className="absolute bottom-0 left-1/2 h-3/4 w-3/4 -translate-x-1/2 overflow-hidden rounded-t-[4rem] border-x-[5px] border-t-[5px] border-black bg-[#F6F5F3] shadow-lg">
                  <img
                    src="/landing/p11.jpg"
                    alt=""
                    loading="lazy"
                    className="mt-1 h-full w-full rounded-t-[4rem] object-cover"
                  />
                </div>
              </div>
              <div className="absolute right-6 top-6 cursor-pointer rounded-full bg-black/20 p-2 backdrop-blur-md transition-colors hover:bg-black/40">
                <Heart className="h-4 w-4 text-white" />
              </div>
              {/* ⚠️ Ürün balonu HEP AÇIKTIR (hover'a bağlı değil) — referansta
                  `opacity-0` yok; etiketin ne yaptığını anlatan şey bu. */}
              <div className="absolute left-[55%] top-[45%] z-20 will-change-transform">
                <div className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-110">
                  <div className="h-3 w-3 rounded-full bg-black" />
                </div>
                <div className="absolute bottom-full left-1/2 mb-3 w-48 -translate-x-1/2 cursor-pointer rounded-lg border border-white/50 bg-white/90 p-3 text-left shadow-xl backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-gray-200">
                      <img
                        src="/landing/p6.jpg"
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight text-black">{t('landing.demo.p6')}</p>
                      <p className="text-xs text-gray-500">₺620</p>
                    </div>
                    <div className="ml-auto">
                      <ExternalLink className="h-4 w-4 text-black/50" />
                    </div>
                  </div>
                </div>
              </div>
              {/* ⚠️ Küçük, koyu, saydam pill — tam genişlik beyaz buton DEĞİL. */}
              <div className="absolute bottom-6 left-6 right-6">
                <button
                  type="button"
                  className="inline-block h-10 min-w-20 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-opacity hover:opacity-80"
                >
                  {t('landing.onelink.tapToShop')}
                </button>
              </div>
            </div>
            <div className="px-2 text-center md:text-left">
              <h3 className="mb-2 flex items-center justify-center gap-2 text-xl font-bold md:justify-start">
                <Tag className="h-5 w-5" /> {t('landing.onelink.postTitle')}
              </h3>
              <p className="text-sm text-gray-500">{t('landing.onelink.postDesc')}</p>
            </div>
          </div>

          {/* Profil telefonu — Koleksiyonlar sekmesi açık */}
          <div data-reveal="3" className="flex flex-col gap-6 will-change-transform">
            <div className="relative flex aspect-[4/5] justify-center overflow-hidden rounded-3xl border border-gray-200 bg-gray-100 shadow-xl">
              <div className="absolute bottom-0 top-[10%] w-[70%] max-w-[320px] rounded-t-[3.5rem] border-x border-t border-gray-700 bg-black p-1 pb-0 shadow-2xl">
                <div className="relative flex h-full w-full flex-col overflow-hidden rounded-t-[3.2rem] bg-[#F8F5F2]">
                  <div className="cursor-pointer px-6 pb-6 pt-12 text-center">
                    <div className="mb-4 flex flex-col items-center">
                      <div className="mb-3 h-24 w-24 rounded-full border-2 border-black p-3">
                        <img
                          src="/landing/a1.jpg"
                          alt=""
                          loading="lazy"
                          className="h-full w-full rounded-full object-cover"
                        />
                      </div>
                      <div className="relative mb-1 inline-flex items-center justify-center">
                        <h4 className="text-center text-lg font-bold tracking-tight">@waydee</h4>
                        {/* 🔴 Doğrulama rozeti MAVİ (kullanıcı isteği, 7 Ağu 2026).
                            Önce mor (`#8338EC`) idi; artık sayfadaki diğer
                            rozetle (`VerifiedBadge`) aynı mavi: `#42A5F5`. */}
                        <div className="absolute left-full ml-1 grid h-4 w-4 place-items-center rounded-full border border-white/50 bg-[#42A5F5] p-[2px]">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      </div>
                    </div>
                    {/* 🔴 Sosyal ikonlar MOR değil SİYAH (kullanıcı isteği, 7 Ağu 2026). */}
                    <div className="mb-4 flex justify-center gap-3 text-black">
                      <Instagram className="h-4 w-4" />
                      <Youtube className="h-4 w-4" />
                      <Globe2 className="h-4 w-4" />
                      <Link2 className="h-4 w-4" />
                      <Mail className="h-4 w-4" />
                    </div>
                    <p className="mx-auto mb-2 max-w-[220px] text-xs leading-relaxed text-gray-500">
                      {t('landing.footer.tagline')}
                    </p>
                  </div>
                  <div className="mb-4 flex items-center justify-center gap-6 border-b border-gray-100 px-4 pb-2">
                    <div className="flex cursor-pointer items-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-black">
                      <Link2 className="h-3 w-3" /> Link
                    </div>
                    <div className="flex cursor-pointer items-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-black">
                      <Tag className="h-3 w-3" /> {t('landing.onelink.postTitle')}
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black shadow-sm">
                      <Layers className="h-3 w-3" /> {t('landing.onelink.collectionTitle')}
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-50/50 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { name: t('landing.bestFor.a'), imgs: ['p1', 'p2', 'p3', 'p6'] },
                        { name: t('landing.bestFor.g'), imgs: ['p8', 'p9', 'p10', 'p7'] },
                      ].map((c) => (
                        <div
                          key={c.name}
                          className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                            <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
                              {c.imgs.map((n) => (
                                <img
                                  key={n}
                                  src={`/landing/${n}.jpg`}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ))}
                            </div>
                          </div>
                          <p className="truncate text-xs font-bold">{c.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-2 text-center md:text-left">
              <h3 className="mb-2 flex items-center justify-center gap-2 text-xl font-bold md:justify-start">
                <Layers className="h-5 w-5" /> {t('landing.onelink.collectionTitle')}
              </h3>
              <p className="text-sm text-gray-500">{t('landing.onelink.collectionDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- how it works */

/**
 * "Nasıl çalışır" — referansın imza etkisi.
 *
 * <p>Her satır üstten 2px siyah çizgiyle ayrılır; satırın üstüne gelince
 * metnin yanındaki görsel kabı **genişliği 0'dan 10vw'ye açılır** ve metin
 * kenara doğru itilir (`.waydee-hiw-row` — `index.css`). Mobilde görsel
 * gizlenir, yazı boyutu sabitlenir (`3.7vw` telefonda okunmaz olurdu).
 */
function HowItWorks() {
  const t = useT()
  /** Mobilde dokunmayla açılan satır (masaüstünde hover kullanılır). */
  const [open, setOpen] = useState<number | null>(null)
  /* 🔴 7 Ağu 2026: adım sayısı 4 → 5 ve görseller kullanıcının verdiği
     sırayla değişti (aa4 · aa5 · aa1 · aa2 · aa3). Beşinci adım haritadaki
     dijital alanı anlatır — Waydee'yi bir "link aracı"ndan ayıran şey o. */
  const steps = [
    { text: t('landing.how.s1'), img: '/landing/aa4.jpg' },
    { text: t('landing.how.s2'), img: '/landing/aa5.jpg' },
    { text: t('landing.how.s3'), img: '/landing/aa1.jpg' },
    { text: t('landing.how.s4'), img: '/landing/aa2.jpg' },
    { text: t('landing.how.s5'), img: '/landing/aa3.jpg' },
  ]
  return (
    <section id="nasil-calisir" className="flex min-h-screen w-full flex-col overflow-hidden text-black">
      <main className="container mx-auto flex flex-1 flex-col items-center justify-center overflow-hidden px-8">
        {/* ⚠️ `w-full` YOK — referansta bu kutu içeriği kadar genişler.
            `w-full` verilince satırlar tüm konteyneri kaplayıp devleşiyordu. */}
        <section className="z-10 flex flex-col items-center justify-center gap-[18px]">
          <div className="text-center text-[clamp(40px,10vw,44px)] font-bold leading-[1.2]">
            <div
              data-reveal
              className="my-3 bg-black p-5 uppercase text-white max-sm:text-2xl"
            >
              {t('landing.how.title')}
            </div>
            {steps.map((s, i) => (
              <div key={s.text}>
                {/*
                  🔴 9 Ağu 2026 — MOBİLDE DOKUNUNCA GÖRSEL AÇILIR (kullanıcı
                  isteği). Masaüstünde etki `:hover`'dır; telefonda hover diye
                  bir şey yok, bu yüzden görsel `display:none` ile tamamen
                  gizleniyordu ve adımların yanındaki fotoğraflar mobil
                  ziyaretçiye HİÇ görünmüyordu.
                  Açık satır `data-open` ile işaretlenir; CSS mobilde bu
                  seçiciyle genişliği açar (masaüstü kuralı `:hover` olarak
                  aynen durur — iki davranış birbirine karışmaz).
                */}
                <div
                  className="waydee-hiw-row"
                  data-open={open === i ? 'true' : undefined}
                  onClick={() => setOpen((v) => (v === i ? null : i))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setOpen((v) => (v === i ? null : i))
                    }
                  }}
                >
                  <p className="max-sm:hidden">{s.text}</p>
                  <div className="flex flex-col p-1 text-lg">
                    <div className="max-sm:block sm:hidden">{s.text}</div>
                  </div>
                  <div className="waydee-hiw-img will-change-transform">
                    <img alt="" loading="lazy" src={s.img} className="object-cover" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </section>
  )
}

/* -------------------------------------------------------------- statements */

function StatementDark() {
  const t = useT()
  return (
    <section className="flex w-full flex-col items-center gap-8 bg-black px-6 py-24 text-center md:py-32">
      <h2
        data-reveal
        className="max-w-5xl text-4xl font-bold leading-[1.1] tracking-tighter text-white sm:text-6xl md:text-7xl"
      >
        {t('landing.statement1')}
      </h2>
      <p data-reveal="2" className="max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
        {t('landing.pro.subtitle')}
      </p>
      <div data-reveal="3" className="pt-4">
        <Link
          to="/register"
          className="inline-flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-medium leading-5 text-black transition-colors hover:bg-zinc-200"
        >
          {t('landing.nav.signup')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}


function StatementLight() {
  const t = useT()
  return (
    <section className="flex w-full flex-col items-center gap-8 bg-white px-6 py-24 text-center md:py-32">
      <h2
        data-reveal
        className="max-w-5xl text-4xl font-bold leading-[1.1] tracking-tighter text-black sm:text-6xl md:text-7xl"
      >
        {t('landing.statement2')}
      </h2>
      <p data-reveal="2" className="max-w-2xl text-lg leading-relaxed text-zinc-500 sm:text-xl">
        {t('landing.cta.subtitle')}
      </p>
      <div data-reveal="3" className="pt-4">
        <Link
          to="/register"
          className="inline-flex items-center gap-2 rounded-2xl bg-black p-4 text-sm font-medium leading-5 text-white transition-colors hover:bg-zinc-800"
        >
          {t('landing.hero.cta')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- fiyatlar */

function PricingDark() {
  const t = useT()
  /* 🔴 Fiyat SUNUCUDAN gelir (yönetim panelinden değişir) — eskiden burada
     `$10` yazıyordu ve panelden değiştirilse bile vitrin eskiyi gösteriyordu.
     Gelene kadar yerinde ince bir yer tutucu durur. */
  const pricing = usePlanPricing()
  /* 🔴 V37: dört hücreli fiyat tablosu → vitrinde de DÖNEM ANAHTARI olmalı.
     Yıllık varsayılan seçili: indirimli olan odur ve kullanıcıya önce en iyi
     teklifi göstermek, sonra pahalıya çıkarmaktan dürüsttür. */
  const [period, setPeriod] = useState<BillingPeriod>('YEARLY')

  /* 🔴 Listeler TEK KAYNAKTAN gelir (`planFeatures.ts`). Burada ve plan
     ekranında ayrı ayrı yazılıyorlardı ve ayrışmışlardı: yapay zekâ paketi ile
     öncelikli destek Pro'daydı, Premium'da yoktu — üst plan alttan fakir
     görünüyordu. Ayrıca aynı hak iki farklı cümleyle yazılmıştı
     ("Profilinde mavi doğrulama tiki" / "Mavi tik").
     ⚠️ Merdiven kuralı: her plan öncekini KAPSAR, listeler tekrar etmez;
     kartın başındaki "…'daki her şey, artı:" satırı bunu söyler. */
  const free = FREE_FEATURES.map((k) => t(k))
  const pro = PRO_FEATURES.map((k) => t(k))
  const premium = PREMIUM_FEATURES.map((k) => t(k))
  const enterprise = ENTERPRISE_FEATURES.map((k) => t(k))

  /** Bir planın gösterilecek fiyat etiketi + altındaki yıllık tahsilat satırı. */
  const priceOf = (plan: PaidPlan) => {
    if (!pricing) return null
    const monthly = monthlyOf(pricing, plan, period)
    return {
      label: formatPrice(monthly, pricing.currency),
      yearlyTotal: formatPrice(yearlyTotal(pricing, plan), pricing.currency),
      discount: yearlyDiscount(pricing, plan),
    }
  }
  const proPrice = priceOf('PRO')
  const premiumPrice = priceOf('PREMIUM')

  return (
    <section id="fiyatlar" className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black">
      <section className="z-10 w-full px-4 py-16 md:px-8 lg:px-16">
        <div className="relative mx-auto max-w-7xl space-y-12">
          <header data-reveal className="space-y-6 text-center">
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              {t('landing.pricing.eyebrow')}
            </span>
            <h2 className="text-4xl font-bold leading-[1.1] tracking-tighter text-white sm:text-5xl md:text-6xl">
              <GradientTitle
                text={t('landing.compare')}
                gradient="bg-gradient-to-b from-white to-white/40"
              />
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
              {t('landing.pricing.subtitle')}
            </p>

            {/*
              Dönem anahtarı — TEK ve tüm kartların üstünde.
              ⚠️ Kart başına ayrı anahtar, kullanıcının iki kartı farklı
              dönemde karşılaştırmasına yol açardı; "hangisi ucuz" sorusu
              anlamını yitirirdi.
            */}
            <div className="flex justify-center">
              <div
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] p-1"
                role="tablist"
                aria-label={t('plan.billingPeriod')}
              >
                {(['MONTHLY', 'YEARLY'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={period === p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wider transition-colors',
                      period === p ? 'bg-white text-black' : 'text-zinc-400 hover:text-white',
                    )}
                  >
                    {p === 'MONTHLY' ? t('plan.monthlyTab') : t('plan.yearlyTab')}
                    {p === 'YEARLY' && (premiumPrice?.discount ?? 0) > 0 && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                          period === 'YEARLY' ? 'bg-black text-white' : 'bg-white/15 text-white',
                        )}
                      >
                        −%{premiumPrice?.discount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {/*
            ⚠️ Izgara 1 → 2 → 4. Kırılımlar: `md` iki kolon (dört kart iki
            satır), `xl` dörtlü tek satır. `lg`de dördü yan yana koymak
            1024px'te fiyat rakamını (`text-5xl`) taşırıyordu — üç kartla
            yaşanan sorunun aynısı, bir kart daha eklenince `lg` de yetmiyor.
          */}
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 xl:max-w-none xl:grid-cols-4">
            {/* Free */}
            <PlanColumn title={t('landing.pricing.free')} features={free}>
              <p className="text-5xl font-bold tracking-tighter text-white">
                ₺0
                <span className="ml-2 text-lg font-normal text-zinc-400">
                  {t('landing.pricing.monthly')}
                </span>
              </p>
              <PlanCta to="/register">{t('landing.pricing.freeCta')}</PlanCta>
            </PlanColumn>

            {/* Pro */}
            <PlanColumn title={t('landing.pricing.pro')} features={pro} includes={t(INCLUDES.PRO)}>
              <div>
                <p className="text-5xl font-bold tracking-tighter text-white">
                  {proPrice ? (
                    proPrice.label
                  ) : (
                    <span className="inline-block h-9 w-24 rounded bg-white/10 align-middle" />
                  )}
                  <span className="ml-2 text-lg font-normal text-zinc-400">
                    {t('landing.pricing.monthly')}
                  </span>
                </p>
                {/* ⚠️ Yıllıkta tahsil edilen tutar AÇIKÇA yazılır: yalnız aylık
                    eşdeğeri göstermek, kullanıcının 12 katını ödeme sayfasında
                    öğrenmesi demek olurdu. */}
                {period === 'YEARLY' && proPrice && (
                  <p className="mt-2 text-sm text-zinc-400">
                    {t('plan.billedYearly')} {proPrice.yearlyTotal}
                  </p>
                )}
              </div>
              <PlanCta to="/register" solid>
                {t('landing.pricing.proCta')} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
              </PlanCta>
            </PlanColumn>

            {/* Premium — öne çıkan */}
            <PlanColumn
              title={t('plan.premium')}
              features={premium}
              includes={t(INCLUDES.PREMIUM)}
              featured
              badge={t('landing.pricing.proBadge')}
            >
              <div>
                <p className="text-5xl font-bold tracking-tighter text-white">
                  {premiumPrice ? (
                    premiumPrice.label
                  ) : (
                    <span className="inline-block h-9 w-24 rounded bg-white/10 align-middle" />
                  )}
                  <span className="ml-2 text-lg font-normal text-zinc-400">
                    {t('landing.pricing.monthly')}
                  </span>
                </p>
                {period === 'YEARLY' && premiumPrice && (
                  <p className="mt-2 text-sm text-zinc-400">
                    {t('plan.billedYearly')} {premiumPrice.yearlyTotal}
                  </p>
                )}
              </div>
              {/* 🔴 9 Ağu 2026 — PREMIUM kartında "Pro'ya geç" yazıyordu.
                  Her iki kart da `pricing.proCta` kullanıyordu; üst planın
                  altında alt planın adını yazmak fiyat tablosunun anlamını
                  bozuyordu (aynı hata `PlanPage`'te de yaşanıp düzeltilmişti). */}
              <PlanCta to="/register" solid>
                {t('landing.pricing.premiumCta')} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
              </PlanCta>
            </PlanColumn>

            {/* Kurumsal (Enterprise) */}
            <PlanColumn
              title={t('landing.pricing.enterprise')}
              features={enterprise}
              includes={t(INCLUDES.ENTERPRISE)}
            >
              <div>
                {/*
                  ⚠️ Rakam yerine metin — ama tipografi diğer kartlarla AYNI
                  hizada durmalı. `text-5xl` bir cümlede taşacağı için
                  `text-3xl` + aynı `tracking-tighter` kullanılıyor.
                */}
                <p className="text-3xl font-bold leading-tight tracking-tighter text-white">
                  {t('landing.pricing.entPrice')}
                </p>
                <p className="mt-2 text-sm text-zinc-400">{t('landing.pricing.entDesc')}</p>
              </div>
              <div className="flex w-full flex-col items-stretch gap-3">
                {/*
                  🔴 Bu düğme kayıt akışına GİTMEZ — kurumsal talep bir satış
                  görüşmesidir. `mailto:` seçildi çünkü sunucuda bir form ucu
                  yok; konu ve gövde önceden doldurulur ki gelen kutusunda
                  talep ayırt edilebilsin. Metinler çeviriden gelir, bu yüzden
                  Almanca/Arapça bir talep de kendi dilinde düşer.
                  ⚠️ `encodeURIComponent` şart: çeviri metinlerinde boşluk ve
                  `&` gibi karakterler var; ham konu satırı gövdeyi kesiyordu.
                */}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    t('landing.pricing.entMailSubject'),
                  )}&body=${encodeURIComponent(t('landing.pricing.entMailBody'))}`}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-black"
                >
                  {t('landing.pricing.entCta')} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </a>
                {/* Posta istemcisi açılmayan cihazda adres yine de okunabilsin. */}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-center text-xs font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
                  dir="ltr"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </PlanColumn>
          </div>

          <p className="text-center text-[13px] font-medium text-zinc-500">
            {t('plan.mapNote')}
          </p>
        </div>
      </section>
    </section>
  )
}

/**
 * Tek plan sütunu.
 *
 * <p>🔴 Dört kart neredeyse aynı iskeleti taşıyordu; ayrı ayrı yazılınca
 * kenarlık/dolgu/hizalama üç yerde tutup dördüncüde kaçıyordu. Ortak iskelet
 * burada; fark eden yalnız <b>fiyat bloğu</b> ve <b>düğme</b>, ikisi de
 * {@code children} olarak geliyor.
 *
 * <p>⚠️ Fiyat bloğu ile düğme arasındaki özellik listesi <code>flex-auto</code>:
 * farklı uzunluktaki listelerde düğmeler <b>aynı hizada</b> kalsın diye.
 */
function PlanColumn({
  title,
  features,
  includes,
  featured,
  badge,
  children,
}: {
  title: string
  features: string[]
  /** "Öncekinin hepsi, artı:" satırı — Ücretsiz kartında yoktur. */
  includes?: string
  featured?: boolean
  badge?: string
  children: React.ReactNode
}) {
  const [price, cta] = Children.toArray(children)
  return (
    <div
      data-reveal="2"
      className={cn(
        'relative flex h-auto flex-col rounded-2xl border p-5 transition-colors duration-300',
        featured
          ? 'border-white/25 bg-white/[0.04] hover:border-white/50'
          : 'border-white/10 bg-white/[0.02] hover:border-white/25',
      )}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap bg-white px-4 py-1 text-xs font-bold uppercase tracking-wider text-black">
          {badge}
        </div>
      )}
      <div className="flex w-full items-center p-3">
        <h3 className="text-2xl font-semibold tracking-tight text-white">{title}</h3>
      </div>
      <div className="flex flex-auto flex-col gap-8 p-3 text-left">
        {price}
        <div className="flex-auto">
          {/* ⚠️ Merdiven satırı listenin ÜSTÜNDE: görünmezse üst plan eksik
              görünür — tam olarak yaşanan şikâyet buydu. */}
          {includes && <p className="mb-3 text-sm font-semibold text-zinc-400">{includes}</p>}
          <ul className="space-y-4">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-zinc-300">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex w-full items-center px-3 pb-0 pt-8">{cta}</div>
    </div>
  )
}

function PlanCta({
  to,
  solid,
  children,
}: {
  to: string
  solid?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium uppercase tracking-wider transition-colors',
        solid
          ? 'bg-white text-black hover:bg-zinc-200'
          : 'border border-white/20 text-white hover:bg-white hover:text-black',
      )}
    >
      {children}
    </Link>
  )
}

/* --------------------------------------------------------------- made for */

/**
 * "Made for" — referansın en karakteristik bölümü.
 *
 * <p>Üstte esneyen bir SVG eğrisi, altında satırlar; bir satırın üstüne
 * gelince <b>imleci izleyen 250×250 bir görsel penceresi</b> açılır, içindeki
 * şerit o satırın görseline kayar ve imleç <b>80px pembe daireye</b> büyüyüp
 * içine etiket yazısı alır.
 *
 * <p>⚠️ Pencerenin ve eğrinin konumu her karede <b>doğrudan DOM'a</b> yazılır
 * (rAF ile birleştirilmiş) — React state'i kullanılsaydı fare hareketi
 * saniyede ~60 render tetiklerdi (haritadaki kasmanın dersi).
 */
function MadeFor() {
  const t = useT()
  /*
   * 🔴 7 Ağu 2026: satırlar **beşe** çıktı (yeni: "İstekli her birey") ve
   * hover görselleri `category1–5` ile değişti (kullanıcı isteği).
   * ⚠️ Sıra `waydee-modal-slider`'ın dikey kaymasıyla birebir bağlı:
   * `enter(i)` şeridi `-i * 100%` konumuna götürür, yani dizideki sıra ile
   * penceredeki görsel sırası **aynı olmak zorundadır**.
   */
  const rows = [
    { label: t('landing.bestFor.a'), img: '/landing/category1.webp' },
    { label: t('landing.bestFor.d'), img: '/landing/category2.jpg' },
    { label: t('landing.bestFor.e'), img: '/landing/category3.webp' },
    { label: t('landing.bestFor.g'), img: '/landing/category4.webp' },
    { label: t('landing.bestFor.i'), img: '/landing/category5.jpg' },
  ]

  const modalRef = useRef<HTMLDivElement | null>(null)
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const pathRef = useRef<SVGPathElement | null>(null)
  const curveHostRef = useRef<HTMLDivElement | null>(null)

  /* Görsel penceresi fareyi izler — rAF'ta tek yazım. */
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    let x = 0
    let y = 0
    const paint = () => {
      raf = 0
      const el = modalRef.current
      if (el) el.style.transform = `translate3d(${x - 125}px, ${y - 125}px, 0)`
    }
    const onMove = (e: MouseEvent) => {
      x = e.clientX - window.innerWidth / 2
      y = e.clientY - window.innerHeight / 2
      if (!raf) raf = requestAnimationFrame(paint)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  /*
   * Esneyen çizgi: şeridin üstünde fare gezerken eğrinin orta kontrol noktası
   * imlece doğru bükülür, çıkınca düzlenir. Referanstaki `Q768 250, 1536 250`
   * yolunun canlı hâli.
   */
  useEffect(() => {
    const host = curveHostRef.current
    const path = pathRef.current
    if (!host || !path || !window.matchMedia('(pointer: fine)').matches) return
    const flat = () => {
      const w = host.clientWidth || 1536
      return `M0 250 Q${w / 2} 250, ${w} 250`
    }
    path.setAttribute('d', flat())
    let raf = 0
    let cy = 250
    const onMove = (e: MouseEvent) => {
      const r = host.getBoundingClientRect()
      cy = 250 + (e.clientY - r.top) * 2
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const w = host.clientWidth || 1536
        path.setAttribute('d', `M0 250 Q${w / 2} ${cy}, ${w} 250`)
      })
    }
    const onLeave = () => {
      path.style.transition = 'none'
      path.setAttribute('d', flat())
    }
    host.addEventListener('mousemove', onMove)
    host.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', onLeave)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      host.removeEventListener('mousemove', onMove)
      host.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', onLeave)
    }
  }, [])

  const enter = (i: number) => {
    modalRef.current?.classList.add('is-open')
    if (sliderRef.current) sliderRef.current.style.top = `${-i * 100}%`
    document.documentElement.dataset.wcursor = 'lg'
    const label = document.querySelector<HTMLElement>('[data-wcursor-label]')
    if (label) label.textContent = t('landing.madefor.label')
  }
  const leave = () => {
    modalRef.current?.classList.remove('is-open')
    delete document.documentElement.dataset.wcursor
    const label = document.querySelector<HTMLElement>('[data-wcursor-label]')
    if (label) label.textContent = ''
  }

  return (
    <div className="flex w-full flex-col items-center justify-between bg-black p-6 text-white md:p-24">
      {/* imleci izleyen görsel penceresi */}
      <div ref={modalRef} className="waydee-modal">
        <div ref={sliderRef} className="waydee-modal-slider" style={{ top: 0 }}>
          {rows.map((r) => (
            <div key={r.img} className="waydee-modal-item">
              <img src={r.img} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      {/*
        🔴 7 Ağu 2026 (kullanıcı isteği): marka adı çizginin **ÜSTÜNE** ve
        **ORTAYA** alındı; açıklama çizginin **altında tek satır** duruyor.
        Önceki hâlde ikisi de çizginin altında, yan yana ve sağa yaslıydı.
        ⚠️ Blok artık `w-full` — ortalama ancak tam genişlikte anlamlı.
      */}
      <div className="flex w-full flex-col items-center">
        <p className="mb-4 text-center text-base">{t('landing.madefor.brand')}</p>

        {/* esneyen çizgi — üstündeki şerit fareyi yakalar */}
        <div ref={curveHostRef} className="relative mb-5 h-px w-full">
          <div className="relative top-[-40px] z-10 h-10 w-full" />
          <svg className="absolute top-[-250px] h-[300px] w-full">
            <path ref={pathRef} className="fill-none stroke-white stroke-[1px]" d="M0 250 Q768 250, 1536 250" />
          </svg>
        </div>

        {/* ⚠️ `text-balance` + `whitespace-nowrap` YOK: cümle uzun ve mobilde
            zorla tek satırda tutmak taşma üretirdi. Masaüstünde zaten tek
            satıra sığıyor (ölçüldü). */}
        <p className="max-w-5xl text-center text-xl leading-snug md:text-3xl">
          {t('landing.madefor.tagline')}
        </p>
      </div>

      {/*
        ⚠️ `w-full` YOK — ne burada ne gövdede. Referansta `main` içeriği
        kadar genişler ve dış kabın `items-center`'ı onu ORTALAR. `w-full`
        verilince blok tüm satırı kaplıyor, üstüne `ml-10vw` de eklenince
        sağa kayıp dağınık duruyordu. (`animate_projects`: flex-row ·
        items-center · margin-top 50px · padding 0 20px)
      */}
      <main className="mt-[50px] flex flex-row items-center px-5">
        {/*
          ⚠️ `ml-[10vw]` KALDIRILDI. Referansın `animate_body`'sinde var ama
          orada blok zaten sola yaslı akıyor; bizim dış kabımız `items-center`
          ile ortaladığı için sol marj bloğu ekran genişliğinin **yarısı
          kadar** (10vw/2) sağa itiyordu. Asimetrik marj + ortalama bir arada
          çalışmaz — ortalama kazanmalı.
        */}
        <div>
          <p className="mt-2.5 text-[8vw] uppercase leading-none md:text-[3vw]">
            {t('landing.bestFor.title')}
          </p>
          {rows.map((r, i) => (
            <div key={r.label} className="waydee-project mt-12" onMouseEnter={() => enter(i)} onMouseLeave={leave}>
              <div className="flex w-full flex-wrap gap-2.5">
                <p className="w-80 max-w-full rounded-none border border-white px-3 py-2.5 text-center text-lg uppercase transition-all duration-300 hover:scale-110 hover:border-[#ff006e] hover:bg-[#ff006e]">
                  {r.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

/* ---------------------------------------------------------------- kapanış */

function FinalCta() {
  const t = useT()
  return (
    <div className="relative w-full bg-black text-white">
      <div className="relative mx-auto flex flex-col items-center px-6 py-32 text-center md:py-40">
        <span
          data-reveal
          className="mb-4 block rounded-full bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-widest"
        >
          {t('landing.marquee.f')}
        </span>
        <h2
          data-reveal="2"
          className="mx-auto mb-6 max-w-6xl text-[clamp(2.5rem,5vw,4.5rem)] font-bold leading-[1.1] tracking-tighter"
        >
          {t('landing.cta.title')}
        </h2>
        <p
          data-reveal="3"
          className="mx-auto mb-16 max-w-4xl text-lg font-light leading-relaxed text-white/60 md:text-xl"
        >
          {t('landing.cta.subtitle')}
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-medium leading-5 text-black transition-colors hover:bg-zinc-200"
        >
          {t('landing.cta.button')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- sss */

function Faq() {
  const t = useT()
  /*
   * 🔴 8 Ağu 2026: SSS **6 → 14** soruya çıktı; sorular ve cevaplar
   * `taag.app` akordiyonundan **açılarak ölçüldü** (paneller kapalıyken DOM'da
   * metin yok — her biri tek tek açılıp okundu).
   *
   * ⚠️ Referansın 14 sorusunun 12'si birebir karşılanıyor; **ikisi Waydee'de
   * karşılıksızdı** ve körlemesine kopyalanmadı:
   *  · "Profil görünümünü özelleştirebilir miyim?" → referansta 'Elegant/Modern'
   *    profil stilleri var, bizde yok; soru **haritadaki dairenin görünümüne**
   *    (renk, dolgu, efekt) çevrildi — bizdeki gerçek karşılığı budur.
   *  · "App Store'da var mı?" → referans PWA diyor; bizim uygulama da web/PWA,
   *    cevap kendi durumumuza göre yazıldı.
   * Ayrıca **bize özgü iki soru** (harita dairesi ve kira süresi) korundu:
   * ürünün en çok sorulan kısmı o ve referansta karşılığı yok.
   */
  const items = Array.from({ length: 14 }, (_, i) => ({
    q: t(`landing.faq.q${i + 1}` as Parameters<typeof t>[0]),
    a: t(`landing.faq.a${i + 1}` as Parameters<typeof t>[0]),
  }))
  return (
    <section id="sss" className="flex w-full flex-col items-center bg-white px-6 py-16 text-black">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div data-reveal>
          <h2 className="mb-1 text-2xl font-bold tracking-tight">{t('landing.faq.title')}</h2>
          <p className="text-black/70">{t('landing.faq.subtitle')}</p>
        </div>
        <div data-reveal="2" className="flex w-full flex-col gap-2 px-0">
          {items.map((i) => (
            <FaqItem key={i.q} q={i.q} a={i.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  return (
    <div
      className={cn(
        'rounded-none border border-zinc-200 bg-white px-4 shadow-none transition-colors duration-200',
        open ? 'bg-gray-50/80' : 'hover:bg-gray-50',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex h-full w-full items-center gap-3 py-4"
      >
        <div className="flex flex-1 flex-col text-start">
          <span className="font-medium text-black transition-colors group-hover:text-[#ff006e]">
            {q}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-300 group-hover:text-black',
            open ? '-rotate-180' : 'rotate-0',
          )}
        />
      </button>
      {/* Yükseklik geçişi satır içi stille — vault tuzağı. */}
      <div
        ref={bodyRef}
        className="overflow-hidden"
        style={{
          maxHeight: open ? (bodyRef.current?.scrollHeight ?? 400) + 24 : 0,
          opacity: open ? 1 : 0,
          transition: 'max-height .3s cubic-bezier(.22,1,.36,1), opacity .22s',
        }}
      >
        <p className="pb-4 text-[15px] leading-relaxed text-zinc-500">{a}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ footer */

/**
 * Sosyal ikonlar — referanstakilerin birebir yolları (24×24, `currentColor`).
 *
 * <p>🔴 8 Ağu 2026: adresler <b>düzeltildi ve tek kaynağa</b> (`lib/siteLinks`)
 * taşındı. Buradaki değerler <b>uydurmaydı</b> — `@waydee`, `hi@waydee.com`,
 * hatta hiç açılmamış bir <b>Threads</b> hesabı. Gerçek hesaplar
 * <code>@waydeeapp</code> ve adres <code>info@waydee.com</code>.
 * ⚠️ <b>Threads çıkarıldı, X eklendi</b>: var olmayan bir hesaba bağlantı
 * vermek 404'e götürür ve markayı terk edilmiş gösterir.
 */
const SOCIAL: { label: string; href: string; viewBox?: string; path: React.ReactNode }[] = [
  {
    label: 'E-posta',
    href: `mailto:${CONTACT_EMAIL}`,
    path: (
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 12c0-3.771 0-5.657 1.172-6.828S6.229 4 10 4h4c3.771 0 5.657 0 6.828 1.172S22 8.229 22 12s0 5.657-1.172 6.828S17.771 20 14 20h-4c-3.771 0-5.657 0-6.828-1.172S2 15.771 2 12Z" />
        <path strokeLinecap="round" d="m6 8l2.159 1.8c1.837 1.53 2.755 2.295 3.841 2.295s2.005-.765 3.841-2.296L18 8" />
      </g>
    ),
  },
  {
    label: 'TikTok',
    href: SOCIAL_LINKS.tiktok,
    path: (
      <path
        fill="currentColor"
        d="M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64c0 3.33 2.76 5.7 5.69 5.7c3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48"
      />
    ),
  },
  {
    label: 'Instagram',
    href: SOCIAL_LINKS.instagram,
    path: (
      <path
        fill="currentColor"
        d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3"
      />
    ),
  },
  {
    label: 'X',
    href: SOCIAL_LINKS.x,
    /* ⚠️ İkon da değişti — yol hâlâ Threads'in "@" sarmalıydı; yalnız adresi
       değiştirmek X'e giden bir Threads simgesi bırakırdı. */
    path: (
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26l8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    ),
  },
]

/**
 * Alt bilgi — <b>tek kaynak</b>. 8 Ağu 2026'da `export` edildi: Hakkımızda
 * sayfası da bunu çiziyor. Kopyalansaydı iki footer zamanla ayrışırdı
 * (UI/dash bileşenlerinin iki uygulamada kopya olması zaten bilinen bedel).
 */
export function Footer() {
  const t = useT()
  const year = 2026
  return (
    <footer className="relative w-full overflow-hidden bg-black pt-20 text-white">
      <div className="container relative z-10 mx-auto px-8 md:px-4">
        <div className="mb-16 flex flex-col items-center justify-between gap-10 md:flex-row">
          {/* 🔴 8 Ağu 2026: düz metin yerine gerçek logo. ⚠️ `onDark` şart —
              footer temadan bağımsız SİYAHTIR; `waydee-brand-logo` yalnız koyu
              temada beyaza çevirdiği için açık tema seçili kullanıcıda logo
              siyah zeminde siyah kalıyordu (görünmezdi). */}
          <Logo imgClassName="h-8" onDark />
          <div className="flex items-center gap-4">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all duration-300 hover:bg-white hover:text-black"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  role="img"
                  width="24"
                  height="24"
                  viewBox={s.viewBox ?? '0 0 24 24'}
                >
                  {s.path}
                </svg>
              </a>
            ))}
          </div>
        </div>
        {/*
          🔴 8 Ağu 2026 — İLETİŞİM BLOĞU. Footer'da yalnız üç bağlantı ve telif
          satırı vardı; kayıtlı adres ve kurumsal e-posta hiçbir yerde yazmıyordu.
          Bir ticari sitede bunların bulunması hem güven hem de çoğu ülkede
          bilgilendirme yükümlülüğüdür.
          ⚠️ Adres `<address>` etiketinde: anlamsal olarak doğrusu bu ve ekran
          okuyucular bloğu "iletişim bilgisi" olarak duyurur. Varsayılan italik
          `not-italic` ile kapatıldı.
        */}
        <div className="grid gap-10 border-t border-white/10 pt-10 text-sm text-zinc-400 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t('landing.footer.addressTitle')}
            </h3>
            <address className="not-italic leading-relaxed">
              {COMPANY_ADDRESS_LINES.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <a
              href={COMPANY_MAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-70"
            >
              <MapPin className="h-4 w-4" />
              {t('landing.footer.location')}
            </a>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t('landing.footer.contactTitle')}
            </h3>
            {/* ⚠️ `dir="ltr"`: Arapça sayfada e-posta adresi sağdan sola dizilip
                okunamaz hâle geliyordu (nokta ve @ yanlış yere kayıyor). */}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              dir="ltr"
              className="inline-flex items-center gap-2 transition-colors hover:text-white"
            >
              <Mail className="h-4 w-4" />
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {/* ⚠️ Alt şerit `text-sm` + soluk gri; bağlantılar uppercase + tracking-wider. */}
        <div className="mt-10 flex flex-col justify-between gap-6 border-t border-white/10 pb-10 pt-8 text-sm text-zinc-500 md:flex-row md:items-center max-sm:items-start">
          <div className="flex gap-6 max-sm:flex-col">
            {/* 🔴 8 Ağu 2026: üçü de artık GERÇEK sayfalara gidiyor. Öncesinde
                üçü birden `#sss`'e (SSS bölümüne) gidiyordu — yani "Gizlilik"e
                basan kullanıcı sıkça sorulan sorulara düşüyordu. */}
            <Link to="/about" className="uppercase tracking-wider transition-colors hover:text-white">
              {t('landing.footer.about')}
            </Link>
            <Link to="/privacy" className="uppercase tracking-wider transition-colors hover:text-white">
              {t('landing.footer.privacy')}
            </Link>
            <Link to="/terms" className="uppercase tracking-wider transition-colors hover:text-white">
              {t('landing.footer.terms')}
            </Link>
          </div>
          <div>
            © {year} Waydee. {t('landing.footer.rights')}
          </div>
        </div>
      </div>
      {/*
        Dev wordmark — referansın imzası.
        ⚠️ Rengi BEYAZ DEĞİL: `text-white-950` = **rgb(41,41,41)**. Siyah zeminde
        ancak seçilen koyu gri bir kabartma; beyaz yazınca sayfayı bağırıyordu.
      */}
      <div className="pointer-events-none relative z-10 mt-8 flex w-full select-none items-end justify-center px-4 font-bold md:mt-12">
        <h1
          aria-hidden="true"
          className="whitespace-nowrap pb-2 text-[25vw] font-extrabold leading-tight tracking-tighter text-[rgb(41,41,41)] md:pb-4 md:leading-none"
        >
          Waydee
        </h1>
      </div>
    </footer>
  )
}
