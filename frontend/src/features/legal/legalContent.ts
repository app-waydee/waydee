import type { Locale } from '@/i18n/config'

/**
 * <b>Yasal belge içerikleri — yapı ve yükleyici.</b>
 *
 * <p>🔴 Neden ana sözlükte değil: iki belge × beş dil ≈ <b>25.000 karakter</b>.
 * `i18n/locales/*` bugün gzip <b>1,7–2,2 KB</b>; buraya konsaydı dil paketleri
 * on katına çıkar ve yasal sayfayı hiç açmayan <b>her</b> kullanıcı indirirdi.
 * Ayrıca sözlük düz bir `Record<string, string>`'tir; başlık/paragraf/liste
 * ayrımı olan bir belgeyi orada tutmak `p1`, `p2`, `li3` gibi anlamsız
 * anahtarlar doğururdu.
 *
 * <p>⚠️ <b>Yedek zinciri sözlükle aynı</b>: seçili dil → Türkçe. Çeviri
 * eksikse ekran boş kalmaz, Türkçe belge çizilir.
 */

export type LegalKind = 'privacy' | 'terms'

export type LegalBlock =
  | { k: 'p'; t: string }
  | { k: 'h2'; t: string }
  | { k: 'h3'; t: string }
  | { k: 'ul'; items: string[] }
  /** Terimli liste — "Çerez: küçük veri parçası" gibi tanım satırları. */
  | { k: 'dl'; items: { term: string; desc: string }[] }

export type LegalDoc = LegalBlock[]

export interface LegalBundle {
  privacy: LegalDoc
  terms: LegalDoc
}

/**
 * Diller ayrı parçalar hâlinde iner. Türkçe de dinamiktir: taban dil olsa bile
 * <b>yasal metin</b> ana pakete girmemeli — kullanıcıların çoğu bu sayfayı
 * hiç açmaz.
 */
const loaders: Record<Locale, () => Promise<{ default: LegalBundle }>> = {
  tr: () => import('./content/tr'),
  en: () => import('./content/en'),
  de: () => import('./content/de'),
  es: () => import('./content/es'),
  ar: () => import('./content/ar'),
}

/** Aynı dil ikinci kez istenmez. */
const cache = new Map<Locale, LegalBundle>()

export async function loadLegalDoc(locale: Locale, kind: LegalKind): Promise<LegalDoc> {
  const bundle = await loadBundle(locale)
  return bundle[kind]
}

async function loadBundle(locale: Locale): Promise<LegalBundle> {
  const hit = cache.get(locale)
  if (hit) return hit
  try {
    const mod = await loaders[locale]()
    cache.set(locale, mod.default)
    return mod.default
  } catch {
    /*
     * ⚠️ Ağ hatasında Türkçeye düşülür. Yasal bir sayfada boş ekran
     * göstermek kabul edilemez: kullanıcı sözleşmeyi okuyamadığı hâlde
     * hizmeti kullanmaya devam eder.
     */
    if (locale === 'tr') throw new Error('Yasal belge yüklenemedi')
    return loadBundle('tr')
  }
}
