import type { TranslationKey } from '@/i18n'

/**
 * Ayar <b>kodunu</b> sözlükteki etikete çevirir (V45).
 *
 * <p>🔴 Sunucu yalnız <b>kod</b> döndürür (`FEMALE`, `A25_34`, `SLICKED_BACK`),
 * etiket döndürmez. Vault kuralı (83. tur): <i>"sunucudan gelen `*Label`
 * alanlarını çok dilli arayüzde basma"</i> — İngilizce açan kullanıcı stant
 * kartında Türkçe metin görüyordu. Çeviri istemcide, koda göre yapılır.
 *
 * <p>⚠️ Anahtar <b>çalışma zamanında</b> kuruluyor, bu yüzden `TranslationKey`
 * birleşim tipiyle doğrulanamaz ve tek bir `as` gerekiyor. Bedeli bilinçli:
 * alternatif, on iki kategorinin ~60 kodunu elle tek tek eşleyen bir tablo
 * yazmaktı — sunucu bir seçenek eklediğinde sessizce eskiyecek bir tablo.
 *
 * <p>⚠️ Eksik çeviri <b>boş bırakmaz</b>: `t()` sırası "seçili dil → Türkçe →
 * anahtarın kendisi". Ekranda `ai.opt.gender.FEMALE` görmek bir <b>hatadır</b>
 * ve hemen göze çarpar — istenen davranış budur.
 */
export function optKey(category: string, code: string): TranslationKey {
  return `ai.opt.${category}.${code}` as TranslationKey
}
