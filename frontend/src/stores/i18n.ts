import { create } from 'zustand'
import {
  applyDocumentLocale,
  detectBrowserLocale,
  FALLBACK_LOCALE,
  isLocale,
  type Locale,
} from '@/i18n/config'
import tr from '@/i18n/locales/tr'
import type { PartialDictionary } from '@/i18n/types'

/**
 * Dil durumu.
 *
 * ⚠️ <b>Yalnız açık olan dilin sözlüğü indirilir.</b> Türkçe pakete gömülüdür
 * (taban dil, eksik anahtarlar buraya düşer); diğer dört dil `import()` ile
 * ihtiyaç anında gelir. Beş sözlüğü birden paketlemek ana paketi büyütür ve
 * kullanıcıların çoğu tek dil görür.
 *
 * ⚠️ Seçim <b>üç kaynaktan</b> çözülür, öncelik sırasıyla:
 *   1. Hesabın kayıtlı dili (`users.locale`) — cihaz değiştirince de gelir,
 *   2. Bu cihazdaki son seçim (`localStorage`) — oturum açılmadan önce de geçerli,
 *   3. Tarayıcının dili — hiç seçim yapılmamışsa.
 * "Cihazımın dili" seçeneği 1 ve 2'yi <b>temizler</b>, böylece tarayıcı yeniden
 * belirleyici olur.
 */

const STORAGE_KEY = 'waydee-locale'

/** Ek diller — ihtiyaç anında yüklenir. */
const loaders: Record<Exclude<Locale, 'tr'>, () => Promise<{ default: PartialDictionary }>> = {
  en: () => import('@/i18n/locales/en'),
  ar: () => import('@/i18n/locales/ar'),
  de: () => import('@/i18n/locales/de'),
  es: () => import('@/i18n/locales/es'),
}

/** Aynı dil için ikinci bir ağ isteği yapılmaz. */
const cache = new Map<Locale, PartialDictionary>([['tr', tr]])

interface I18nState {
  locale: Locale
  /** Kullanıcı açıkça bir dil seçti mi? false ise tarayıcı takip edilir. */
  explicit: boolean
  dict: PartialDictionary
  /**
   * Dili değiştirir; sözlük gelene kadar mevcut metinler ekranda kalır.
   * `explicit=false` yalnız açılışta kullanılır (tarayıcıdan çözülen dil
   * "kullanıcı seçimi" sayılmamalı).
   */
  setLocale: (locale: Locale, explicit?: boolean) => Promise<void>
  /** "Cihazımın dili": kayıtlı seçimi siler ve tarayıcıya döner. */
  useSystemLocale: () => Promise<void>
  /** Oturum açıldığında hesaptaki dili uygular (varsa). */
  hydrateFromUser: (locale: string | null | undefined) => void
}

function readStored(): { locale: Locale; explicit: boolean } {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return { locale: saved, explicit: true }
  }
  return { locale: detectBrowserLocale(), explicit: false }
}

const initial = readStored()

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: initial.locale,
  explicit: initial.explicit,
  dict: cache.get(initial.locale) ?? tr,

  setLocale: async (locale, explicit = true) => {
    if (typeof localStorage !== 'undefined') {
      if (explicit) localStorage.setItem(STORAGE_KEY, locale)
      else localStorage.removeItem(STORAGE_KEY)
    }
    applyDocumentLocale(locale)
    const cached = cache.get(locale)
    if (cached) {
      set({ locale, explicit, dict: cached })
      return
    }
    // Sözlük gelene kadar dili yazma: yarım çevrilmiş bir ekran yerine
    // mevcut metinler dursun, tek seferde değişsin.
    const loaded = (await loaders[locale as Exclude<Locale, 'tr'>]().then((m) => m.default)) ?? {}
    cache.set(locale, loaded)
    set({ locale, explicit, dict: loaded })
  },

  useSystemLocale: async () => {
    await get().setLocale(detectBrowserLocale(), false)
  },

  hydrateFromUser: (locale) => {
    // Hesapta kayıtlı dil, bu cihazdaki seçimden ÖNCE gelir: kullanıcı dilini
    // hesabına bağlamışsa her cihazda aynı dili görmeli.
    if (!isLocale(locale)) return
    if (get().locale === locale) return
    void get().setLocale(locale)
  },
}))

/**
 * Uygulama açılışında bir kez — `<html lang/dir>` ve gerekiyorsa sözlük.
 *
 * ⚠️ `explicit` bayrağı korunur: tarayıcıdan çözülen dil, kullanıcının
 * ayarlardan yaptığı seçimle aynı şey değildir (biri sonradan değişebilir,
 * diğeri kalıcıdır).
 */
export function initI18n() {
  const { locale, explicit, setLocale } = useI18nStore.getState()
  applyDocumentLocale(locale)
  if (locale !== FALLBACK_LOCALE) void setLocale(locale, explicit)
}
