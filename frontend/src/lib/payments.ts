import { api } from './api'

/**
 * Ödeme oturumu istemcisi.
 *
 * ⚠️ Satın alma **tek istekte bitmez**. Sunucu bir ödeme sayfası açar, alanı
 * rezerve eder ve URL döner; kullanıcı oraya gider, bölge ancak sağlayıcının
 * bildirimi gelince oluşur. Bu yüzden burada bir `TerritoryResponse` beklenmez.
 */
export type CheckoutStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'

export interface CheckoutView {
  id: string
  /**
   * ⚠️ Üyelik ödemeleri de bu kaydı kullanır (`PLAN_*`). Tür eskiden yalnız
   * bölge ödemelerini sayıyordu ve dönüş ekranı üyelik ödemesini "bölge alımı"
   * sanıp *"Bölgen hazır"* diyordu — bölge adı boş olduğu için de ekranda
   * yalnız fiyat kalıyordu.
   */
  kind: 'TERRITORY_PURCHASE' | 'TERRITORY_RENEWAL' | 'PLAN_PRO' | 'PLAN_PREMIUM'
  status: CheckoutStatus
  /** 'MOCK' → sahte ödeme ekranı; gerçek sağlayıcıda 'POLAR'. */
  provider: string
  checkoutUrl: string | null
  /** Tahsil edilecek tutar — kupon uygulandıysa İNDİRİMLİ tutardır. */
  amount: string
  /** İndirim öncesi liste fiyatı (kupon yoksa `amount` ile aynı). */
  originalAmount: string | null
  couponCode: string | null
  discountAmount: string | null
  currency: string
  territoryName: string | null
  regionLabel: string | null
  expiresAt: string
  paidAt: string | null
  failureReason: string | null
}

export interface TerritoryCheckoutPayload {
  lng: number
  lat: number
  radiusM: number
  /** Kiralama süresi (gün); boşsa sunucu 365 kullanır. */
  days?: number
  name?: string
  style?: {
    strokeColor?: string
    fillColor?: string
    fillOpacity?: number
    strokeWidth?: number
    effect?: string
  }
}

/* 🔴 `startTerritoryCheckout` ve `startRenewalCheckout` KALDIRILDI (V38).
   Daire km² fiyatıyla satılan bir ürün olmaktan çıkıp Premium üyeliğin hakkına
   dönüştü; mağaza `POST /territories/store` ile ödemesiz kurulur. Sunucudaki
   uçlar da kaldırıldığı için bu istemci sarmalayıcıları çağrıldıkları anda 404
   verirdi — bırakmak sessiz bir tuzak olurdu.
   ⚠️ `getCheckout`/`myCheckouts` DURUYOR: üyelik ödemeleri ve geçmiş bölge
   ödemeleri hâlâ bu uçlardan okunuyor. */

export async function getCheckout(id: string): Promise<CheckoutView> {
  return (await api.get<CheckoutView>(`/payments/checkouts/${id}`)).data
}

export async function myCheckouts(): Promise<CheckoutView[]> {
  return (await api.get<CheckoutView[]>('/payments/checkouts')).data
}

/** Kullanıcı vazgeçti — rezerve alan hemen serbest kalsın. */
export async function cancelCheckout(id: string): Promise<void> {
  await api.delete(`/payments/checkouts/${id}`)
}

/** Yalnız sahte sağlayıcıda çalışır; gerçek sağlayıcıda sunucu 404 döner. */
export async function confirmMockPayment(id: string): Promise<CheckoutView> {
  return (await api.post<CheckoutView>(`/payments/checkouts/${id}/mock-confirm`)).data
}
