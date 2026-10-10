import { api } from './api'
import type { TranslationKey } from '@/i18n'
import type { FeatureCollection } from '@/types/api'

export type MarketplaceStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED'
export type MarketplaceKind =
  | 'GENERAL' | 'STARTUP' | 'LISTING' | 'EVENT' | 'TOUR' | 'WALK' | 'FOOD' | 'ART'

/** Formda açılıp kapatılabilen hazır alanlar (sunucudaki enum ile birebir). */
export type FormFieldCode =
  | 'TAGLINE' | 'WEBSITE' | 'CONTACT_EMAIL' | 'CONTACT_PHONE' | 'LOGO' | 'COVER' | 'GALLERY'
  | 'STAGE' | 'FOUNDED_YEAR' | 'TEAM_SIZE' | 'LOOKING_FOR'
  | 'STARTS_AT' | 'ENDS_AT' | 'LOCATION' | 'CAPACITY' | 'PRICE' | 'CONDITION'

export interface ResolvedField {
  field: FormFieldCode
  enabled: boolean
  required: boolean
  label: string
  help: string | null
}

export interface ResolvedQuestion {
  key: string
  label: string
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'SELECT' | 'CHECKBOX' | 'DATE'
  required: boolean
  help: string | null
  options: string[] | null
  maxLength: number | null
}

/** Sunucudan gelen, varsayılanları uygulanmış form tanımı. */
export interface ResolvedForm {
  kind: MarketplaceKind
  kindLabel: string
  applicationNote: string | null
  fields: ResolvedField[]
  questions: ResolvedQuestion[]
}
export type ListingStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

export interface MarketplaceResponse {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  ring: [number, number][]
  centerLng: number
  centerLat: number
  areaKm2: number
  accentColor: string
  coverUrl: string | null
  status: MarketplaceStatus
  opensAt: string | null
  closesAt: string | null
  maxListings: number | null
  autoApprove: boolean
  listingCount: number
  acceptingApplications: boolean
  full: boolean
  /** Oturum sahibinin bu pazardaki başvuru durumu (yoksa null). */
  myListingStatus: ListingStatus | null
  myListingId: string | null
  kind?: MarketplaceKind
}

export interface ListingOwner {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface ListingResponse {
  id: string
  marketplaceId: string
  marketplaceName: string | null
  marketplaceSlug: string | null
  owner: ListingOwner
  title: string
  tagline: string | null
  description: string
  category: string
  categoryLabel: string
  stage: string | null
  stageLabel: string | null
  website: string | null
  contactEmail: string | null
  logoUrl: string | null
  coverUrl: string | null
  foundedYear: number | null
  teamSize: number | null
  lookingFor: string | null
  spotLng: number | null
  spotLat: number | null
  status: ListingStatus
  submittedAt: string
  reviewedAt: string | null
  reviewNote: string | null
  featured: boolean
  viewCount: number
  likeCount: number
  likedByMe: boolean
  mine: boolean
  // ---- türe göre alanlar
  startsAt: string | null
  endsAt: string | null
  locationLabel: string | null
  capacity: number | null
  price: number | null
  currency: string | null
  conditionCode: string | null
  contactPhone: string | null
  galleryUrls: string[]
  customFields: Record<string, string>
  marketplaceKind: MarketplaceKind | null
}

export interface ListingInput {
  /**
   * 🔴 15 Ağu 2026 — artık ZORUNLU DEĞİL. Yeni başvuru formu mağaza adını
   * sormuyor; sunucu onu kullanıcının görünen adından türetiyor ve sahibi
   * stüdyodan değiştiriyor. Tip hâlâ duruyor çünkü türe göre çalışan eski
   * ekranlar (STARTUP/EVENT/LISTING) başlığı göndermeye devam ediyor.
   */
  title?: string | null
  /** 🔴 Yeni formun TEK zorunlu alanı (sunucuda da `@NotBlank`). */
  tagline?: string | null
  description?: string | null
  category?: string | null
  stage?: string | null
  website?: string | null
  contactEmail?: string | null
  logoMediaId?: string | null
  coverMediaId?: string | null
  foundedYear?: number | null
  teamSize?: number | null
  lookingFor?: string | null
  startsAt?: string | null
  endsAt?: string | null
  locationLabel?: string | null
  capacity?: number | null
  price?: number | null
  currency?: string | null
  conditionCode?: string | null
  contactPhone?: string | null
  galleryMediaIds?: string[] | null
  customFields?: Record<string, string>
}

export interface OptionView {
  code: string
  label: string
}

/** Haritadaki pazar alanı poligonunun özellikleri. */
export interface MarketplaceAreaProperties {
  id: string
  slug: string
  name: string
  tagline: string | null
  accentColor: string
  status: MarketplaceStatus
  listingCount: number
  centerLng: number
  centerLat: number
  areaKm2: number
  accepting: boolean
  coverUrl?: string
}

/** Haritadaki stant noktasının özellikleri. */
export interface StallProperties {
  id: string
  marketplaceId: string
  marketplaceName: string
  marketplaceSlug: string
  accentColor: string
  title: string
  tagline: string | null
  category: string
  categoryLabel: string
  featured: boolean
  likeCount: number
  ownerUsername: string
  ownerDisplayName: string
  logoUrl?: string
  ownerAvatarUrl?: string
}

// ---------------------------------------------------------------- okuma

export const listMarketplaces = () =>
  api.get<MarketplaceResponse[]>('/marketplaces').then((r) => r.data)

export const getMarketplace = (slug: string) =>
  api.get<MarketplaceResponse>(`/marketplaces/${slug}`).then((r) => r.data)

export const listListings = (marketplaceId: string) =>
  api.get<ListingResponse[]>(`/marketplaces/${marketplaceId}/listings`).then((r) => r.data)

export const getListing = (id: string) =>
  api.get<ListingResponse>(`/listings/${id}`).then((r) => r.data)

export const myListings = () => api.get<ListingResponse[]>('/listings/my').then((r) => r.data)

/** Bu pazarın başvuru formu — istemci formu bundan çizer. */
export const getMarketplaceForm = (marketplaceId: string) =>
  api.get<ResolvedForm>(`/marketplaces/${marketplaceId}/form`).then((r) => r.data)

export const KIND_LABELS: Record<MarketplaceKind, string> = {
  GENERAL: 'Genel',
  STARTUP: 'Girişim vitrini',
  LISTING: 'İlan / alım-satım',
  EVENT: 'Etkinlik',
  TOUR: 'Gezi / ziyaret',
  WALK: 'Yürüyüş',
  FOOD: 'Yeme-içme',
  ART: 'Sanat & tasarım',
}

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Sıfır',
  LIKE_NEW: 'Sıfır gibi',
  GOOD: 'İyi',
  USED: 'Kullanılmış',
  FOR_PARTS: 'Parça için',
}

export const marketplaceOptions = () =>
  api
    .get<{ categories: OptionView[]; stages: OptionView[] }>('/marketplaces/options')
    .then((r) => r.data)

export const marketplaceAreas = () =>
  api
    .get<FeatureCollection<MarketplaceAreaProperties>>('/marketplaces/map/areas')
    .then((r) => r.data)

export const marketplaceStalls = () =>
  api.get<FeatureCollection<StallProperties>>('/marketplaces/map/stalls').then((r) => r.data)

// ---------------------------------------------------------------- yazma

export const applyToMarketplace = (marketplaceId: string, input: ListingInput) =>
  api.post<ListingResponse>(`/marketplaces/${marketplaceId}/listings`, input).then((r) => r.data)

export const updateListing = (id: string, input: ListingInput) =>
  api.put<ListingResponse>(`/listings/${id}`, input).then((r) => r.data)

export const withdrawListing = (id: string) => api.delete(`/listings/${id}`).then(() => undefined)

export const likeListing = (id: string, liked: boolean) =>
  (liked ? api.post<ListingResponse>(`/listings/${id}/like`) : api.delete<ListingResponse>(`/listings/${id}/like`)).then(
    (r) => r.data,
  )

/**
 * Kart rozet tonları — durum kodundan tek yerde çözülür.
 *
 * 🔴 16 Ağu 2026 — `label` alanı KALDIRILDI, yerine `labelKey` geldi.
 * Eskiden burada sabit Türkçe metin duruyordu ve İngilizce açan kullanıcı
 * kartın üstünde "Değerlendirmede" görüyordu. Vault kuralı: sunucudan ya da
 * sabitlerden gelen `*Label` alanları çok dilli arayüzde BASILMAZ — çeviri
 * istemcide, **kod** alanına göre yapılır.
 */
export const LISTING_STATUS_META: Record<
  ListingStatus,
  { labelKey: TranslationKey; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }
> = {
  DRAFT: { labelKey: 'market.statusDRAFT', tone: 'neutral' },
  PENDING: { labelKey: 'market.statusPENDING', tone: 'warning' },
  APPROVED: { labelKey: 'market.statusAPPROVED', tone: 'success' },
  REJECTED: { labelKey: 'market.statusREJECTED', tone: 'danger' },
  WITHDRAWN: { labelKey: 'market.statusWITHDRAWN', tone: 'neutral' },
}

/* --- 3B evren (11 Ağu 2026) ------------------------------------------------
   ⚠️ `x` / `z` METREdir ve sahnenin merkezine göredir — enlem/boylam DEĞİL.
   Aynı stantların gerçek dünya koordinatı ayrı uçtan gelir (`/map/stalls`). */

export interface WorldShelfItem {
  /** ⚠️ Mağazaya özel (CUSTOM) üründe **null** — gönderiye bağlı değil. */
  postId: string | null
  imageUrl: string
  caption: string | null
  likeCount: number
}

/**
 * Mağaza sahibinin stüdyodan yaptığı 3B özelleştirmeler.
 *
 * ⚠️ `videoUrl` / `musicUrl` **kapalıyken null gelir**. Sahne yalnız adres
 * varlığına bakıp eleman kurar; kapalı bir televizyon için 60 MB indirmek
 * anlamsız olurdu.
 */
export interface WorldStudio {
  videoUrl: string | null
  tvOn: boolean
  tvMuted: boolean
  musicUrl: string | null
  musicOn: boolean
  musicVolume: number
  lightColor: string
  lightIntensity: number
  accentColor: string
  facadeColor: string
}

export interface WorldStore {
  id: string
  slot: number
  row: number
  side: 'LEFT' | 'RIGHT'
  x: number
  z: number
  title: string
  tagline: string | null
  /** ⚠️ Kategori kaldırılabilir oldu (başvuru dört alana indi) → null olabilir. */
  category: string | null
  categoryLabel: string | null
  ownerUsername: string
  logoUrl: string | null
  coverUrl: string | null
  featured: boolean
  likeCount: number
  /**
   * 🔴 97. tur — bakan kişi bu mağazayı beğenmiş mi.
   * ⚠️ Alan olmadan kalp her sahne açılışında BOŞ çizilir ve kullanıcı zaten
   * beğendiği mağazayı yeniden beğenmeye çalışır; sunucu ikinciyi yutar,
   * ekranda hiçbir şey olmaz ve düğme "bozuk" görünürdü.
   */
  likedByMe: boolean
  shelf: WorldShelfItem[]
  /** Sahibinin stüdyo ayarları; hiç açmadıysa sunucu varsayılanları döner. */
  studio: WorldStudio
}

export interface WorldView {
  id: string
  slug: string
  name: string
  tagline: string | null
  accentColor: string
  /** Caddenin yarı genişliği (metre). */
  streetHalfWidth: number
  /** İki sıra arası mesafe (metre). */
  rowSpacing: number
  stores: WorldStore[]
}

export const getWorld = (slug: string) =>
  api.get<WorldView>(`/marketplaces/${slug}/world`).then((r) => r.data)
