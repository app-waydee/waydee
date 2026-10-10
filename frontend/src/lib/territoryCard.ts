import { api } from './api'
import { publicApi } from './publicApi'
import type { SocialLinkView, StoreCategory } from '@/types/api'

export interface CardChip {
  code: 'ACTIVE' | 'TREND' | 'VERIFIED' | 'RESERVED' | 'EXPIRING' | 'EXPIRED' | 'LIVE'
  label: string
  tone: 'success' | 'warning' | 'info' | 'danger' | 'violet' | 'neutral'
}

export interface CardOwner {
  id: string | null
  username: string
  displayName: string
  avatarUrl: string | null
  followerCount: number
  followingCount: number
  privateAccount: boolean
  followedByMe: boolean
  followRequested: boolean
  me: boolean
}

export interface CardStat {
  code: 'AREA' | 'VALUE' | 'LEASE' | 'VIEWS'
  label: string
  value: string
  hint: string
  tone: 'mint' | 'peach' | 'lilac' | 'sky' | 'sand'
}

export interface TerritoryCardResponse {
  territoryId: string
  name: string
  regionLabel: string | null
  verified: boolean
  reserved: boolean
  reservedLabel: string | null
  chips: CardChip[]
  owner: CardOwner
  description: string | null
  featuredMediaUrl: string | null
  liveUrl: string | null
  liveActive: boolean
  areaKm2: number
  areaM2: number
  pricePaid: number
  currency: string
  radiusM: number
  viewsToday: number
  viewsTotal: number
  postCount: number
  purchasedAt: string
  leaseStartedAt: string
  expiresAt: string
  daysRemaining: number
  expired: boolean
  renewalCount: number
  profileType: 'STANDARD' | 'WEBSITE' | 'HTML'
  website: string | null
  socialLinks: SocialLinkView[]
  // ---- etkileşim
  likeCount: number
  saveCount: number
  likedByMe: boolean
  savedByMe: boolean
  /** İstek yapan kişi bu dairenin sahibi mi → düzenleme düğmeleri açılır. */
  owned: boolean
  canOpen: boolean
  lockedReason: string | null
  stats: CardStat[]
  /** Mağaza panelinin arka plan görseli (V53); kilitli/rezerve kartta `null`. */
  coverUrl: string | null
  /** Mağazanın kategorisi (V52); seçilmemişse `null`. */
  category: StoreCategory | null
}

/** Oturumlu harita kartı. */
export function getTerritoryCard(territoryId: string) {
  return api.get<TerritoryCardResponse>(`/territories/${territoryId}/card`).then((r) => r.data)
}

/**
 * Vitrin kartı — ziyaretçi geçişiyle kimliksiz okunur.
 * ⚠️ `publicApi`'nin baseURL'i `/api/v1/public`'tir; yol ona GÖRE yazılır.
 */
export function getPublicTerritoryCard(territoryId: string) {
  return publicApi
    .get<TerritoryCardResponse>(`/territories/${territoryId}/card`)
    .then((r) => r.data)
}
