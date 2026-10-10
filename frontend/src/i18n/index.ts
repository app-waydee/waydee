import { useCallback } from 'react'
import { useI18nStore } from '@/stores/i18n'
import tr from './locales/tr'
import type { Dictionary } from './types'

export { LOCALES, LOCALE_META, type Locale } from './config'

/**
 * `t()` ile kullanılabilecek anahtarlar — `'settings.language'` ya da
 * `'landing.hero.title'` gibi.
 *
 * ⚠️ Eskiden tam olarak **iki** seviyeydi (`bölüm.anahtar`). Tanıtım sayfası
 * ~90 metinle geldi ve hepsini tek düzlemde tutmak (`landingPricingFreeA`)
 * okunmaz hâle geliyordu; tip artık **istediği kadar** derinliğe iner.
 * Mevcut bölümler tek satır bile değişmeden çalışmaya devam eder.
 */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`
}[keyof T & string]

export type TranslationKey = Paths<Dictionary>

/** `{name}` gibi yer tutucuların değerleri. */
export type TranslationVars = Record<string, string | number>

/** Nokta ile ayrılmış yolu sözlükte yürür; yaprak bir metin değilse `undefined`. */
function lookup(dict: unknown, path: string[]): string | undefined {
  let node: unknown = dict
  for (const step of path) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[step]
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(text: string, vars?: TranslationVars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

/**
 * Çeviri araması.
 *
 * ⚠️ Sıra: <b>seçili dil → Türkçe → anahtarın kendisi</b>. Anahtarın kendisine
 * düşmek bir hatadır ama <b>boş ekrandan iyidir</b>: eksik çeviri geliştirmede
 * hemen göze çarpar, kullanıcı da bomboş bir düğme görmez.
 */
export function translate(
  dict: unknown,
  key: TranslationKey,
  vars?: TranslationVars,
): string {
  const path = key.split('.')
  const value = lookup(dict, path) ?? lookup(tr, path) ?? key
  return interpolate(value, vars)
}

/**
 * Bileşenlerde kullanılan çevirmen.
 *
 * ```tsx
 * const t = useT()
 * <Button>{t('common.save')}</Button>
 * ```
 *
 * ⚠️ Bileşen yalnız `dict` değişince yeniden çizilir (zustand seçicisi) —
 * dil değişmediği sürece ek bir render maliyeti yoktur.
 */
export function useT() {
  const dict = useI18nStore((s) => s.dict)
  return useCallback(
    (key: TranslationKey, vars?: TranslationVars) => translate(dict, key, vars),
    [dict],
  )
}

/** React dışında (olay işleyicileri, lib) çeviri gerektiğinde. */
export function t(key: TranslationKey, vars?: TranslationVars): string {
  return translate(useI18nStore.getState().dict, key, vars)
}
