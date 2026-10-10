import { displayName } from './creatorFormat'

/**
 * Ülke ve dil seçenekleri (108. tur).
 *
 * ⚠️ 250 ülkenin hepsi listelenmedi: açılır listede 250 satır kimsenin
 * kaydıramayacağı bir duvardır. Influencer pazarlamasının yoğun olduğu
 * pazarlar seçildi; sunucu ISO listesindeki her kodu kabul ettiği için liste
 * genişletmek tek satırlık bir iştir. Adlar `Intl.DisplayNames` ile o anki
 * dilde üretilir ve o dilde alfabetik sıralanır — Türkiye her zaman başta
 * (ürünün ana pazarı).
 */
const COUNTRIES = [
  'TR', 'US', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'PT', 'IE',
  'GR', 'CZ', 'RO', 'HU', 'UA', 'AZ', 'CY', 'AE', 'SA', 'QA', 'KW', 'EG', 'MA', 'IL', 'IN', 'PK', 'ID',
  'MY', 'SG', 'TH', 'VN', 'PH', 'JP', 'KR', 'CN', 'AU', 'NZ', 'CA', 'MX', 'BR', 'AR', 'CO', 'CL', 'ZA', 'NG',
]

const LANGUAGES = [
  'tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ar', 'ru', 'pl', 'sv', 'el', 'az', 'fa', 'hi', 'id',
  'ja', 'ko', 'zh', 'uk', 'ro',
]

export interface CodeOption {
  value: string
  label: string
}

function build(codes: string[], type: 'region' | 'language', locale: string, first: string): CodeOption[] {
  const collator = new Intl.Collator(locale)
  const items = codes.map((code) => ({ value: code, label: displayName(code, type, locale) ?? code }))
  const head = items.filter((o) => o.value === first)
  const rest = items.filter((o) => o.value !== first).sort((a, b) => collator.compare(a.label, b.label))
  return [...head, ...rest]
}

export function countryOptions(locale: string): CodeOption[] {
  return build(COUNTRIES, 'region', locale, 'TR')
}

export function languageOptions(locale: string): CodeOption[] {
  return build(LANGUAGES, 'language', locale, 'tr')
}
