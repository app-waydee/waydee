import type { Dictionary } from './locales/tr'

/**
 * Çeviri sözlüğünün şekli.
 *
 * ⚠️ Diğer diller `PartialDictionary`'dir: bir bölüm ya da anahtar eksik
 * kalabilir ve Türkçesine düşer. Tam `Dictionary` istemek, tek bir yeni
 * anahtar eklendiğinde dört dilin de derlemeyi kırması demekti — pratikte
 * çeviriler koda göre biraz geriden gelir ve bu kabul edilebilir.
 */
type Translated<T> = {
  [K in keyof T]?: T[K] extends string ? string : Translated<T[K]>
}

export type PartialDictionary = Translated<Dictionary>
/*
 * ⚠️ Değer tipi bilinçli olarak `string`. Türkçe sözlük `as const` olduğu için
 * her değeri KENDİ metnine daralır (`'Kaydet'` tipi gibi); `Partial<...>` bunu
 * korur ve çeviriler "Type '\"Guardar\"' is not assignable to type '\"Kaydet\"'"
 * ile derlemeyi kırardı. Anahtar adları yine denetlenir — yazım hatası yakalanır.
 */

export type { Dictionary }
