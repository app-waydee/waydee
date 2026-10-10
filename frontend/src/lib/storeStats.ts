import { api } from './api'

/**
 * <b>Mağaza istatistikleri</b> (97. tur, 24 Ağu 2026) — 3B caddede kapıdan kaç
 * kişi geçti, içeride ne kadar kaldı.
 *
 * 🔴 Vault kuralı (91. tur, *"gösterilen ama artmayan sayaç"*): burada okunan
 * her sayının karşılığında sunucuda gerçekten artan bir kayıt var. Yazan uç
 * {@link reportStoreVisit}, okuyan uç {@link getStoreStats}.
 */

/** Grafiğin tek günü. */
export interface VisitDay {
  /** ISO gün (UTC) — sunucu UTC gününe göre grupluyor. */
  day: string
  visits: number
  dwellSeconds: number
}

export interface StoreStats {
  listingId: string
  title: string
  marketplaceSlug: string | null
  days: number
  /** Kapıdan geçiş — aynı kişinin ikinci girişi ikinci geçiştir. */
  visits: number
  /** Tekil ziyaretçi — "kaç kişi" sorusunun cevabı. */
  uniqueVisitors: number
  /**
   * Süresi ÖLÇÜLEBİLMİŞ ziyaret sayısı.
   * ⚠️ Ortalamanın paydası budur, `visits` değil: sekmesini içeride kapatan
   * ziyaretçinin süresi hiç ölçülemez ve onu 0 sayarak katmak ortalamayı
   * sistematik olarak aşağı çekerdi.
   */
  measuredVisits: number
  totalDwellSeconds: number
  avgDwellSeconds: number
  likeCount: number
  viewCount: number
  shelfSize: number
  daily: VisitDay[]
}

/**
 * Kapıdan giriş / çıkış bildirimi.
 *
 * <p>⚠️ Hata SESSİZ yutulur ve `void` döner: ölçüm ürünün kendisi değil, arka
 * planıdır. Bir ziyaret kaydının düşmesi, gezinen kullanıcıya kırmızı bir
 * uyarı göstermeye değmez — yapabileceği hiçbir şey yok.
 */
export function reportStoreVisit(listingId: string, entering: boolean, dwellSeconds?: number) {
  return api
    .post(`/marketplace/listings/${listingId}/visits`, { entering, dwellSeconds: dwellSeconds ?? null })
    .then(() => undefined)
    .catch(() => undefined)
}

/**
 * Ziyaret bildirimini <b>sayfa kapanırken bile</b> gönderir.
 *
 * <p>🔴 Çıkış olayı sekme kapanışında da gelir ve orada normal bir XHR iptal
 * edilir: son ziyaret hiç kapanmaz, yani kullanıcının içeride geçirdiği bütün
 * süre kaybolurdu. `sendBeacon` isteği tarayıcıya devreder, sayfa ölse bile
 * gider.
 *
 * <p>⚠️ `sendBeacon` <b>başlık taşımaz</b> → oturum çerezle gitmiyorsa kimlik
 * de gitmez. Bu yüzden önce normal istek denenir (`keepalive` ile) ve beacon
 * yalnız o kurulamıyorsa devreye girer.
 */
export function reportStoreExitBeacon(listingId: string, dwellSeconds: number) {
  /* Normal istek `keepalive` ile sayfa kapanışında da tamamlanır ve
     Authorization başlığını taşır — tercih edilen yol budur. */
  return reportStoreVisit(listingId, false, dwellSeconds)
}

export const getStoreStats = (listingId: string, days = 30) =>
  api
    .get<StoreStats>(`/marketplace/listings/${listingId}/stats`, { params: { days } })
    .then((r) => r.data)

/**
 * Saniyeyi okunur süreye çevirir — "2 dk 14 sn".
 *
 * ⚠️ Birim adları çeviriden gelir: sabit "dk/sn" yazmak, İngilizce açan
 * kullanıcıya Türkçe kısaltma gösterirdi (vault: `*Label` kuralı).
 */
export function splitDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}
