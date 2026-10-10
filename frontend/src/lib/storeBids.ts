import { api } from './api'

/**
 * <b>Mağazanı öne taşı</b> — ödemeli sıralama (98. tur, 25 Ağu 2026).
 *
 * <p>Model {@code bidkick.me}: tek liste, <b>en çok ödeyen üstte</b>, süre yok,
 * biri geçene kadar sırada kalırsın.
 *
 * <p>🔴 Tutarı <b>kullanıcı yazar</b> — fiyat listesi yok. Sunucu yalnız alt
 * ve üst sınırı uygular ve bunları `MyBid` içinde geri gönderir; istemci kendi
 * sınırını yazmaz (iki tarafın farklı sayı göstermesi para söz konusuyken
 * kabul edilemez).
 */

/*
 * 🔴 25 Ağu 2026 — PARA ALANLARI `number`, `string` DEĞİL.
 *
 * Üretimde hata: *"Lidere geçmek için $201"* düğmesine basınca
 * **`o.trim is not a function`**. Sebep tip yalanıydı: sunucu `BigDecimal`
 * gönderiyor ve Jackson onu **JSON sayısı** olarak yazıyor (`"amount": 250.00`),
 * ama burada `string` yazılmıştı. TypeScript derleme anında memnun, çalışma
 * anında `setAmount(201)` bir sayıyı metin state'ine koyuyor ve bir sonraki
 * `amount.trim()` tüm ekranı düşürüyordu.
 *
 * ⚠️ Projenin geri kalanı zaten böyle (`fmtMoney(amount: number)`); ayrıksı
 * olan bu dosyaydı.
 */
export interface BoardRow {
  rank: number
  bidId: string
  territoryId: string
  storeName: string
  ownerUsername: string
  ownerDisplayName: string | null
  avatarUrl: string | null
  /** Mağazanın haritadaki rengi; satırın rozeti onunla boyanır. */
  color: string | null
  lng: number | null
  lat: number | null
  amount: number
  currency: string
  since: string | null
  /** Bu satır benim mağazam mı. */
  mine: boolean
}

export interface MoveRow {
  storeName: string
  ownerUsername: string
  amount: number
  currency: string
  at: string | null
}

export interface MyBid {
  bidId: string | null
  amount: number | null
  currency: string
  rank: number | null
  /** Haritada yürürlükte bir mağazası var mı — yoksa teklif veremez. */
  hasStore: boolean
  /** Listenin başına geçmek için gereken en küçük tutar (sunucu hesaplar). */
  amountToLead: number
  minBid: number
  maxBid: number
}

export interface BidBoard {
  rows: BoardRow[]
  me: MyBid
  latestMoves: MoveRow[]
  allTimeHighest: number
  allTimeTotal: number
  activeCount: number
  currency: string
}

export const getBidBoard = () =>
  api.get<BidBoard>('/store-bids/board').then((r) => r.data)

/**
 * Teklif ver — sunucu bir <b>ödeme sayfası</b> döner.
 *
 * ⚠️ Teklif burada sıraya GİRMEZ; sıraya girmek ödeme tamamlanınca (imzalı
 * webhook) olur. İstemcide sıraya sokmak, ödeme sayfasını açıp vazgeçen
 * herkesi listenin başına taşırdı.
 */
export const placeBid = (amount: number) =>
  api.post<{ checkoutUrl: string }>('/store-bids/checkout', { amount }).then((r) => r.data)

/** Tutarı para birimiyle yazar — `Intl` kullanılır, elle sembol eklenmez. */
export function formatMoney(amount: string | number, currency: string, locale?: string) {
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(value)) return String(amount)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value)
  } catch {
    /* Bilinmeyen para birimi kodu `Intl`i fırlatır — sayı yine gösterilmeli. */
    return `${value} ${currency}`
  }
}

/**
 * <b>Teklif geçmişim</b> — "faturalarım" ekranındaki küçük alan.
 *
 * ⚠️ Faturadan **ayrı** bir liste: fatura *"ne ödedim"*i, bu liste *"o ödeme
 * sıraya girdi mi"*yi anlatır. İkisi tek satırda birleştirilseydi kullanıcı,
 * sırayı yükseltmeyen (daha düşük) bir ödemenin neden faturası olduğunu
 * anlayamazdı.
 */
export interface BidHistoryRow {
  bidId: string
  amount: number
  currency: string
  /** ACTIVE | REPLACED | PENDING | FAILED — kod; metin istemcide çevrilir. */
  status: 'ACTIVE' | 'REPLACED' | 'PENDING' | 'FAILED'
  storeName: string | null
  placedAt: string
  activatedAt: string | null
  invoiceId: string | null
}

export const getMyBids = () => api.get<BidHistoryRow[]>('/store-bids/my').then((r) => r.data)
