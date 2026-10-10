import type { TranslationKey } from '@/i18n'

/**
 * <b>Plan içerikleri — TEK KAYNAK.</b>
 *
 * <p>🔴 <b>Neden bu dosya var:</b> listeler iki ayrı yerde tanımlıydı —
 * tanıtım sayfası kendi `landing.pricing.*` anahtarlarını, uygulama içindeki
 * plan ekranı kendi `plan.feat*` anahtarlarını kullanıyordu. Sonuç ölçüldü ve
 * saçmaydı:
 * <ul>
 *   <li><b>Pro, Premium'dan zengin görünüyordu</b> — yapay zekâ paketi ve
 *       öncelikli destek Pro'da vardı, Premium'da yoktu.</li>
 *   <li>Aynı hak iki farklı cümleyle yazılmıştı: Pro'da
 *       "Profilinde mavi doğrulama tiki", Premium'da "Mavi tik".</li>
 * </ul>
 * Artık iki ekran da bu diziyi okuyor; bir hak eklendiğinde tek yerde eklenir.
 *
 * <p>🔴 <b>Merdiven kuralı:</b> her plan bir öncekini <b>kapsar</b>. Bu yüzden
 * listeler tekrar etmez; kartın başında "Pro'daki her şey, artı:" satırı durur
 * ({@link INCLUDES}). Bütün hakları her kartta tekrarlamak, kartları okunamaz
 * hâle getirir ve "hangisi neyi fazladan veriyor" sorusunu gizlerdi.
 */

/**
 * Ücretsiz plan — başlangıç.
 *
 * <p>🔴 <b>18 Ağu 2026 — iki DENEME hakkı eklendi</b> (kullanıcı talimatı:
 * *"free pakete 1 aylık mağaza açma hakkı vereceğiz ve bir defa ai toolu max
 * kullanacak kadar kredi"*). İkisi de <b>hesap ömründe bir kezdir</b> ve
 * listenin <b>başında</b> durur: kartın en ikna edici satırı odur, altta
 * kalırsa okunmaz.
 *
 * <p>⚠️ Merdiven kuralı gereği Pro kartı "Ücretsiz'deki her şey, artı:" diyor.
 * Deneme hakları <b>tekrarlanan bir hak değildir</b>, yani Pro kullanıcısına
 * "1 ay ücretsiz mağaza" vaat edilmiş olmuyor — Pro'nun mağaza satırı zaten
 * Premium'da ve <b>süresizdir</b>. Metinler bunu "deneme" diyerek söylüyor.
 */
export const FREE_FEATURES: TranslationKey[] = [
  'plan.featFreeStoreTrial',
  'plan.featFreeAiTrial',
  'plan.featWeeklyPost',
  'plan.featTagLimit',
  'plan.featOneLink',
  'plan.featBasicStats',
]

/** Pro — sınırların kalktığı plan. */
export const PRO_FEATURES: TranslationKey[] = [
  /* 🔴 16 Ağu 2026 (V45) — YAPAY ZEKÂ KREDİSİ SATILAN BİR HAKTIR ve kartta
     yazmak zorunda: kullanıcı Pro'ya geçerken ne aldığını bilmeli. Bu satır
     olmadan stüdyo, parasını ödediği hâlde varlığından haberdar olmadığı bir
     özellik olurdu. */
  'plan.featAiCredits',
  'plan.featUnlimitedPosts',
  'plan.featUnlimitedTags',
  'plan.featUnlimitedCollections',
  'plan.featVerified',
  'plan.featAnalytics',
  'plan.featDiscovery',
]

/**
 * Premium — Pro'nun üstüne <b>mağaza</b> ve <b>yapay zekâ</b>.
 *
 * <p>⚠️ Yapay zekâ araçları ve öncelikli destek buraya <b>taşındı</b>; eskiden
 * Pro'daydı ve üst planı boş bırakıyordu.
 */
export const PREMIUM_FEATURES: TranslationKey[] = [
  /* Merdiven kuralı: Premium Pro'yu kapsar, o yüzden burada yalnız FARK yazar
     — aynı hakkın daha büyük hâli (2.000 → 10.000). */
  'plan.featAiCreditsPremium',
  'plan.featStoreCircle',
  'plan.featStoreCard',
  'plan.featAiCaption',
  'plan.featAiTagging',
  'plan.featAiInsights',
  'plan.featRevenueReports',
  'plan.featPriority',
  'plan.featEarlyAccess',
]

/** Kurumsal — fiyatı görüşmeye bağlı. */
export const ENTERPRISE_FEATURES: TranslationKey[] = [
  'plan.featSeats',
  'plan.featReservedArea',
  'plan.featBranding',
  'plan.featAccessControl',
  'plan.featSla',
  'plan.featBilling',
]

/** Kartın en üstündeki "önceki planın hepsi, artı:" satırı. */
export const INCLUDES: Record<'PRO' | 'PREMIUM' | 'ENTERPRISE', TranslationKey> = {
  PRO: 'plan.includesFree',
  PREMIUM: 'plan.includesPro',
  ENTERPRISE: 'plan.includesPremium',
}
