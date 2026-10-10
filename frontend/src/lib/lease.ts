/** Kiralama uyarı eşikleri — kart, panel ve rozet aynı sınırları kullanır. */
export const LEASE_WARN_DAYS = 30
export const LEASE_CRITICAL_DAYS = 7

export type LeaseTone = 'expired' | 'critical' | 'warn' | 'ok'

export function leaseTone(daysRemaining: number, expired = false): LeaseTone {
  if (expired || daysRemaining <= 0) return 'expired'
  if (daysRemaining <= LEASE_CRITICAL_DAYS) return 'critical'
  if (daysRemaining <= LEASE_WARN_DAYS) return 'warn'
  return 'ok'
}

/**
 * "12 gün kaldı" / "1 yıl 2 ay kaldı" gibi insan okunur kalan süre.
 * Uzun sürelerde gün sayısı anlamsızlaşır; yıl/ay'a yuvarlanır.
 */
export function formatRemaining(days: number): string {
  if (days <= 0) return 'Süresi doldu'
  if (days === 1) return 'Son gün'
  if (days < 45) return `${days} gün kaldı`
  const months = Math.round(days / 30.4)
  if (months < 12) return `${months} ay kaldı`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest === 0 ? `${years} yıl kaldı` : `${years} yıl ${rest} ay kaldı`
}

/* 🔴 `startRenewal` KALDIRILDI (V38): kira uzatma ödemesi diye bir şey yok.
   Mağazanın ömrü ÜYELİĞE bağlı — üyeliği yenileyince sunucu mağazanın bitişini
   de ileri taşır (`TerritoryService.syncStoreLeaseWithPlan`). Ayrı bir uzatma
   düğmesi, kullanıcıyı aynı şey için ikinci kez ödemeye çağırırdı.
   ⚠️ Kalan süre yardımcıları (`leaseTone`, `formatRemaining`) DURUYOR: mağaza
   kartı "şu kadar gün kaldı" yazmaya devam ediyor. */
