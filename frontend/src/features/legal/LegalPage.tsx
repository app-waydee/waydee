import { useEffect, useState } from 'react'
import { MarketingNav } from '@/components/MarketingNav'
import { useScrollTopOnMount, useSmoothScroll } from '@/lib/smoothScroll'
import { useT } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'
import { Footer } from '@/features/landing/marketing/LandingPage'
import { loadLegalDoc, type LegalBlock, type LegalDoc, type LegalKind } from './legalContent'

/**
 * <b>Yasal metin sayfası</b> (Gizlilik · Kullanım Koşulları).
 * Tasarım referansı <code>taag.app/privacy-policy</code> ve
 * <code>taag.app/terms-of-service</code>.
 *
 * <p>🔴 Değerler <b>siteyi açıp ölçerek</b> alındı (8 Ağu 2026, 1280px):
 * <table>
 *   <tr><td>kap</td><td><code>max-width 768px</code> · dolgu <code>96px 24px</code> → içerik <b>720px</b></td></tr>
 *   <tr><td>h1</td><td>60px / 60px · <b>700</b> · ls <code>-3px</code> · <b>ORTALI</b> · alt boşluk 24px</td></tr>
 *   <tr><td>alt yazı + "güncellendi"</td><td>18px / 29.25px · 500 · <code>#6b7280</code> · ortalı</td></tr>
 *   <tr><td>h2</td><td>24px / 36px · 600 · üst boşluk <b>32px</b></td></tr>
 *   <tr><td>h3</td><td>19.2px / 28.8px · 600 · üst boşluk 24px</td></tr>
 *   <tr><td>p · li</td><td>16px / 24px · <b>500</b> · üst boşluk 8px</td></tr>
 *   <tr><td>ul</td><td><code>disc</code> · üst boşluk 16px</td></tr>
 * </table>
 *
 * <p>⚠️ Gövde metninin ağırlığı <b>500</b>'dür, 400 değil — referansın yasal
 * sayfaları normalden bir tık kalın yazılmış; 400 ile "birebir" olmuyordu.
 *
 * <p>⚠️ Sayfa <b>her iki temada da AÇIK</b>. Tanıtım yüzeyi (`MarketingNav`
 * zaten her zaman beyaz) ile aynı aileye ait; renkler token'dan değil
 * doğrudan yazılır ve Tailwind <code>dark:</code> <b>kullanılmaz</b> (vault:
 * bu projede `dark:` işletim sistemine bağlanır, tema düğmesinden kopar).
 *
 * <p>🔴 <b>İçerik ana sözlükte DEĞİL.</b> İki belge beş dilde ~25.000 karakter
 * eder; `i18n/locales/*` içine konsaydı dil paketleri (bugün 1,7–2,2 KB gzip)
 * on katına çıkar ve <b>her</b> kullanıcı, yasal sayfayı hiç açmasa bile
 * indirirdi. Bu yüzden `legalContent.ts` ayrı bir <code>import()</code>
 * parçasıdır ve yalnız bu sayfa açılınca inar.
 */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const [doc, setDoc] = useState<LegalDoc | null>(null)

  useSmoothScroll()
  useScrollTopOnMount()

  useEffect(() => {
    let alive = true
    loadLegalDoc(locale, kind).then((d) => {
      if (alive) setDoc(d)
    })
    return () => {
      alive = false
    }
  }, [locale, kind])

  useEffect(() => {
    const previous = document.title
    document.title = `${t(kind === 'privacy' ? 'landing.legal.privacyTitle' : 'landing.legal.termsTitle')} · Waydee`
    return () => {
      document.title = previous
    }
  }, [t, kind])

  const title = t(kind === 'privacy' ? 'landing.legal.privacyTitle' : 'landing.legal.termsTitle')
  const subtitle = t(kind === 'privacy' ? 'landing.legal.privacyIntro' : 'landing.legal.termsIntro')

  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav anchorPrefix="/" />
      <main>
        {/* Ölçülen kap: 768px + 96/24 dolgu. */}
        <div className="mx-auto w-full max-w-[768px] px-6 py-16 sm:px-6 sm:py-24">
          <h1 className="mb-6 text-center text-[36px] font-bold leading-[1.05] tracking-[-0.05em] sm:text-[60px] sm:leading-[60px]">
            {title}
          </h1>
          <p className="text-center text-[18px] font-medium leading-[29.25px] text-[#6b7280]">
            {subtitle}
          </p>
          <p className="text-center text-[18px] font-medium leading-[29.25px] text-[#6b7280]">
            {t('landing.legal.updatedAt')}
          </p>

          {/*
            ⚠️ Belge gelene kadar <b>iskelet</b> gösterilir, boş ekran değil:
            `import()` yavaş bir bağlantıda göze çarpar ve "sayfa bozuk" hissi
            verir. Yükseklik kabaca gerçek belgeye yakın tutuldu ki metin
            gelince sayfa zıplamasın.
          */}
          {doc ? (
            <article className="mt-8">
              {doc.map((b, i) => (
                <Block key={i} block={b} />
              ))}
            </article>
          ) : (
            <div className="mt-10 space-y-4" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-black/5"
                  style={{ width: `${[100, 96, 88, 92, 70, 100, 84, 96, 78, 90][i]}%` }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.k) {
    case 'h2':
      return <h2 className="mt-8 text-[24px] font-semibold leading-9">{block.t}</h2>
    case 'h3':
      return <h3 className="mt-6 text-[19.2px] font-semibold leading-[28.8px]">{block.t}</h3>
    case 'ul':
      return (
        // ⚠️ `ps-5` (mantıksal) — `pl-5` Arapçada madde imlerini yanlış kenara atar.
        <ul className="mt-4 list-disc ps-5">
          {block.items.map((it, i) => (
            <li key={i} className="mt-2 text-[16px] font-medium leading-6">
              {it}
            </li>
          ))}
        </ul>
      )
    case 'dl':
      return (
        <ul className="mt-4 list-disc ps-5">
          {block.items.map((it, i) => (
            <li key={i} className="mt-2 text-[16px] font-medium leading-6">
              <span className="font-bold">{it.term}</span>
              {': '}
              {it.desc}
            </li>
          ))}
        </ul>
      )
    default:
      return <p className="mt-2 text-[16px] font-medium leading-6">{block.t}</p>
  }
}
