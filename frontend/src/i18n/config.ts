/**
 * Çok dillilik — desteklenen diller ve dil çözümleme kuralları.
 *
 * ⚠️ <b>Neden kendi altyapımız:</b> i18next + tarayıcı algılayıcı + React
 * bağlayıcısı birlikte ~40 KB gzip getiriyor; Waydee'nin ihtiyacı ise düz bir
 * sözlük araması. Buradaki çekirdek ~1 KB ve <b>yalnız açık dilin sözlüğü</b>
 * indirilir (Türkçe pakette, diğerleri dinamik `import`). Kütüphane gerektiren
 * bir şey (çoğul kuralları, ICU biçimleri) gerekirse o zaman eklenir.
 */

export const LOCALES = ['tr', 'en', 'ar', 'de', 'es'] as const
export type Locale = (typeof LOCALES)[number]

/** Sözlüğü pakette gelen taban dil — eksik çeviriler buraya düşer. */
export const FALLBACK_LOCALE: Locale = 'tr'

export interface LocaleMeta {
  /** Dilin KENDİ adı — dil seçicide herkes kendi dilini okuyabilmeli. */
  native: string
  /** Türkçe adı (yönetim/log tarafı için). */
  label: string
  dir: 'ltr' | 'rtl'
  flag: string
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  tr: { native: 'Türkçe', label: 'Türkçe', dir: 'ltr', flag: '🇹🇷' },
  en: { native: 'English', label: 'İngilizce', dir: 'ltr', flag: '🇬🇧' },
  ar: { native: 'العربية', label: 'Arapça', dir: 'rtl', flag: '🇸🇦' },
  de: { native: 'Deutsch', label: 'Almanca', dir: 'ltr', flag: '🇩🇪' },
  es: { native: 'Español', label: 'Español', dir: 'ltr', flag: '🇪🇸' },
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Tarayıcının dil listesinden desteklediğimiz ilk dili seçer.
 *
 * ⚠️ `navigator.languages` sırayla denenir ve **bölge eki atılır**:
 * `en-GB` → `en`, `de-AT` → `de`. Yalnız `navigator.language`'a bakmak,
 * birincil dili desteklemediğimiz kullanıcıda (ör. `nl-NL, en-US, de-DE`)
 * ikinci tercihini görmezden gelip Türkçe açardı.
 */
export function detectBrowserLocale(): Locale {
  const candidates = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []
  for (const raw of candidates) {
    if (!raw) continue
    const base = raw.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  /*
   * 🔴 Desteklemediğimiz bir dilde gelen ziyaretçiye **İngilizce** açılır,
   * Türkçe değil (kullanıcı isteği).
   *
   * ⚠️ `FALLBACK_LOCALE` (tr) burada KULLANILMAZ: o, sözlükte eksik kalan
   * bir anahtarın hangi dile düşeceğini belirler — taban sözlük Türkçedir.
   * "Hangi dili göstereceğiz" ile "eksik çeviri nereye düşecek" ayrı iki
   * sorudur; ikisini tek sabite bağlamak, Fransız bir ziyaretçiye Türkçe
   * bir sayfa açıyordu.
   */
  return 'en'
}

/** `<html lang dir>` — Arapçada yazı yönü sağdan sola döner. */
export function applyDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = LOCALE_META[locale].dir
}
