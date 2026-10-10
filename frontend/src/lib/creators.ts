import { api } from '@/lib/api'

/**
 * <b>Influencer keşfi</b> — istemci sözleşmeleri (108. tur).
 *
 * ⚠️ Türler sunucudaki `CreatorModels` / `CreatorDtos` ile birebir aynıdır.
 * Kodlar (platform, kademe, kategori, sinyal) sunucudan gelir; ekrandaki
 * etiketleri sözlük verir — beş dil de aynı listeyi kendi dilinde gösterir.
 */

export const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'X', 'TWITCH', 'LINKEDIN'] as const
export type Platform = (typeof PLATFORMS)[number]

export const TIERS = ['NANO', 'MICRO', 'MID', 'MACRO', 'MEGA'] as const
export type SizeTier = (typeof TIERS)[number]

export const FORMATS = ['SHORT_VIDEO', 'LONG_VIDEO', 'LIVE', 'PHOTO', 'PODCAST'] as const
export type ContentFormat = (typeof FORMATS)[number]

export const CATEGORIES = [
  'FASHION', 'BEAUTY', 'TECH', 'GAMING', 'FOOD', 'TRAVEL', 'FITNESS', 'HEALTH', 'PARENTING', 'FINANCE',
  'BUSINESS', 'EDUCATION', 'MUSIC', 'ART', 'COMEDY', 'SPORTS', 'AUTO', 'HOME', 'PETS', 'LIFESTYLE',
] as const
export type CreatorCategory = (typeof CATEGORIES)[number]

/** Radar grafiğinin eksenleri — sıra, grafikteki saat yönü sırasıdır. */
export const SIGNALS = [
  'AUDIENCE', 'CONTENT_FIT', 'GEO', 'LANGUAGE', 'BUDGET', 'ENGAGEMENT', 'REACH', 'MOMENTUM',
] as const
export type Signal = (typeof SIGNALS)[number]
export type Weights = Record<Signal, number>

/**
 * Sunucudaki `Signal.defaultWeight` ile BİREBİR aynı.
 * ⚠️ Ölçek büyük (en ağırı 75): puan göreli olduğu için oran değişmez, ama küçük
 * değerler radarı merkeze sıkıştırıyordu (108. turda ölçüldü).
 */
export const DEFAULT_WEIGHTS: Weights = {
  AUDIENCE: 30, CONTENT_FIT: 60, GEO: 30, LANGUAGE: 15, BUDGET: 45, ENGAGEMENT: 75, REACH: 30, MOMENTUM: 15,
}

export const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

export type Gender = 'ANY' | 'FEMALE' | 'MALE'
export type Momentum = 'EMERGING' | 'VIRAL' | 'STEADY' | 'UNKNOWN'
export type SearchStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
export type StepKey = 'ACCESS' | 'REFINE' | 'SEARCH' | 'EXTRACT' | 'SCORE'
export type StepState = 'QUEUED' | 'ACTIVE' | 'DONE' | 'FAILED'

export type DropReason =
  | 'UNVERIFIED_SOURCE' | 'INVALID_HANDLE' | 'PLATFORM_NOT_REQUESTED' | 'DUPLICATE' | 'OUT_OF_TIER'
  | 'BELOW_ENGAGEMENT' | 'COUNTRY_MISMATCH' | 'LANGUAGE_MISMATCH' | 'OVER_LIMIT'

/** Hata kodları — `CreatorSearchRunner.errorCode` + süpürücünün `TIMEOUT`'u. */
export type SearchErrorCode =
  | 'NO_PROVIDER' | 'PROVIDER_AUTH' | 'PROVIDER_LIMIT' | 'PROVIDER_DOWN' | 'REFUSED' | 'MALFORMED'
  | 'INTERNAL' | 'TIMEOUT'

export interface Filters {
  platforms: Platform[]
  categories: CreatorCategory[]
  formats: ContentFormat[]
  tiers: SizeTier[]
  country: string | null
  language: string | null
  gender: Gender
  minEngagementPct: number | null
  emergingOnly: boolean
  budgetMax: number | null
  currency: Currency | null
  brandSafe: boolean
  resultCount: number
}

export interface Criteria {
  summary: string
  niche: string
  keywords: string[]
  searchQueries: string[]
  locationHint: string | null
  languageHint: string | null
  exclusions: string[]
}

export interface Step {
  key: StepKey
  state: StepState
  provider: string | null
  model: string | null
  durationMs: number | null
  failedOver: string[]
  metrics: Record<string, number>
}

export interface Evidence {
  url: string
  title: string | null
  claim: string | null
  /** Araştırma adımında gerçekten okunan sayfalardan biri mi. */
  verified: boolean
}

export interface Creator {
  /** `PLATFORM:handle` — kısa listeye ekleme kimliği. */
  id: string
  platform: Platform
  handle: string
  displayName: string
  profileUrl: string
  /** Platformdan alınıp depomuza yazılmış gerçek profil fotoğrafı; bulunamadıysa null. */
  avatarUrl?: string | null
  country: string | null
  language: string | null
  categories: CreatorCategory[]
  followers: number | null
  tier: SizeTier | null
  engagementRatePct: number | null
  avgViews: number | null
  growth30dPct: number | null
  estCostMin: number | null
  estCostMax: number | null
  costCurrency: Currency | null
  contentFit: number
  momentum: Momentum
  summary: string
  fitReasons: string[]
  watchouts: string[]
  evidence: Evidence[]
  /**
   * ⚠️ Anahtar yok = kullanıcı bu boyutu istemedi (hesaba katılmaz);
   * değer `null` = veri bulunamadı (nötr sayılır). İkisi farklı şeyler.
   */
  signals: Partial<Record<Signal, number | null>>
  score: number
  coverage: number
}

export interface Dropped {
  platform: string
  handle: string
  reason: DropReason
}

export interface SearchDetail {
  id: string
  status: SearchStatus
  brief: string
  filters: Filters
  weights: Weights
  criteria: Criteria | null
  steps: Step[]
  results: Creator[] | null
  dropped: Dropped[] | null
  resultCount: number
  requestedCount: number
  cost: number
  errorCode: SearchErrorCode | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface SearchSummary {
  id: string
  status: SearchStatus
  brief: string
  platforms: Platform[]
  resultCount: number
  requestedCount: number
  cost: number
  errorCode: SearchErrorCode | null
  createdAt: string
  finishedAt: string | null
}

export interface ShortlistItem {
  id: string
  platform: Platform
  handle: string
  creator: Creator
  note: string | null
  sourceSearchId: string | null
  createdAt: string
}

export interface CreatorConfig {
  available: boolean
  costSmall: number
  costLarge: number
}

export interface SearchRequest extends Omit<Filters, 'currency'> {
  brief: string
  currency: Currency | null
  weights: Weights
  locale: string
}

// ----------------------------------------------------------------------- uçlar

export async function getCreatorConfig(): Promise<CreatorConfig> {
  return (await api.get<CreatorConfig>('/creators/config')).data
}

export async function startCreatorSearch(body: SearchRequest): Promise<SearchDetail> {
  return (await api.post<SearchDetail>('/creators/searches', body)).data
}

export async function getCreatorSearch(id: string): Promise<SearchDetail> {
  return (await api.get<SearchDetail>(`/creators/searches/${id}`)).data
}

export async function listCreatorSearches(limit = 30): Promise<SearchSummary[]> {
  return (await api.get<SearchSummary[]>('/creators/searches', { params: { limit } })).data
}

export async function saveSearchWeights(id: string, weights: Weights): Promise<Weights> {
  return (await api.put<Weights>(`/creators/searches/${id}/weights`, { weights })).data
}

export async function listShortlist(): Promise<ShortlistItem[]> {
  return (await api.get<ShortlistItem[]>('/creators/shortlist')).data
}

export async function addToShortlist(searchId: string, creatorId: string): Promise<ShortlistItem> {
  return (await api.post<ShortlistItem>('/creators/shortlist', { searchId, creatorId })).data
}

export async function updateShortlistNote(id: string, note: string): Promise<ShortlistItem> {
  return (await api.patch<ShortlistItem>(`/creators/shortlist/${id}`, { note })).data
}

export async function removeFromShortlist(id: string): Promise<void> {
  await api.delete(`/creators/shortlist/${id}`)
}

// ------------------------------------------------- detaylı veriler (109. tur)

/** TRACKED = bizim ölçtüğümüz · REPORTED = bir sayfada yazıyor · ESTIMATED = platform/kademe ortalaması */
export type Basis = 'TRACKED' | 'REPORTED' | 'ESTIMATED'
export type InsightPhase = 'PROFILE' | 'RESEARCH' | 'ANALYZE'

export interface InsightWindow {
  days: 7 | 14 | 30
  engagementRatePct: number
  avgViews: number
  avgLikes: number
  avgComments: number
  posts: number
  followerGrowthPct: number | null
  followerChange: number | null
  basis: Basis
  growthBasis: Basis
}

export interface InsightReport {
  generatedAt: string
  followers: number
  followersBasis: Basis
  windows: InsightWindow[]
  collaborations: { brand: string; date: string | null; kind: string | null; url: string | null }[]
  audience: { topCountries: string[]; femalePct: number | null; mainAgeRange: string | null; basis: Basis } | null
  contentThemes: string[]
  postsPerWeek: number
  postsBasis: Basis
  bestFormat: string | null
  estCostMin: number | null
  estCostMax: number | null
  costCurrency: Currency | null
  summary: string | null
  strengths: string[]
  risks: string[]
  sources: { url: string; claim: string | null; verified: boolean }[]
}

export interface InsightView {
  entryId: string
  status: 'NONE' | SearchStatus
  phase: InsightPhase | null
  errorCode: SearchErrorCode | 'NOT_FOUND' | null
  cost: number
  report: InsightReport | null
  reportAt: string | null
  avatarUrl: string | null
  tracking: {
    since: string
    points: { followers: number; at: string }[]
    change: number | null
    changePct: number | null
  }
}

export async function getInsights(entryId: string): Promise<InsightView> {
  return (await api.get<InsightView>(`/creators/shortlist/${entryId}/insights`)).data
}

export async function startInsights(entryId: string, locale: string): Promise<InsightView> {
  return (await api.post<InsightView>(`/creators/shortlist/${entryId}/insights`, null, { params: { locale } })).data
}
