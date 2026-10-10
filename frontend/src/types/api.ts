export interface UserResponse {
  id: string
  username: string
  /**
   * 🔴 V47 — kullanıcı adı SİSTEM tarafından üretildi (Google ile kayıt) ve
   * kullanıcı henüz kendi adını seçmedi. Arayüz bunu görünce yumuşak seçim
   * ekranını açar. Sunucuda KALICI bir kolondur: atlanırsa bir sonraki
   * girişte yeniden sorulur.
   */
  usernamePending: boolean
  email: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  role: 'USER' | 'ADMIN'
  privateAccount: boolean
  /** E-posta adresi doğrulandı mı — uyarı şeridi ve satın alma kapısı buna bakar. */
  emailVerified: boolean
  /** Kullanıcıya özel görünüm tercihi; null → sistem tercihi. */
  themeMode: 'light' | 'dark' | null
  /** Kullanıcıya özel harita stili; null → tema takip edilir. */
  mapStyle: string | null
  /** Arayüz dili; null ise tarayıcının dili kullanılır. */
  locale: string | null
  /** Üyelik planı — arayüz limitleri ve yükseltme kartı buna bakar. */
  plan: 'FREE' | 'PRO'
  /**
   * Mavi tik. ⚠️ Sunucu türetir (`plan === 'PRO'`); istemci **planı okuyup
   * kendi karar vermez** — rozetin kuralı tek yerde kalsın.
   */
  verified: boolean
  /** PRO üyeliğin bitiş anı — üyelik **aylıktır** (V35); FREE hesapta null. */
  planExpiresAt: string | null
  /**
   * **Kayıt sonrası kategori popup'ı çıkmalı mı** (V52).
   *
   * 🔴 Bu bayrak `storeCategoryId === null` diye **türetilemez**: "geç" diyen
   * kullanıcıda o alan da boştur ve popup her açılışta yeniden çıkardı.
   * Sorulmuş olmak ile cevaplanmış olmak farklı iki olaydır; ayrımı sunucu tutar.
   */
  needsStoreCategory: boolean
  /** Kullanıcının seçtiği mağaza alanı (V52); ayarlar ekranı bunu işaretli gösterir. */
  storeCategoryId: string | null
  createdAt: string
}

export interface UserSummary {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

// ------------------------------------------------------- sosyal medya bağlantıları

export const SOCIAL_PLATFORMS = [
  'WEBSITE',
  'INSTAGRAM',
  'X',
  'FACEBOOK',
  'YOUTUBE',
  'TIKTOK',
  'SNAPCHAT',
  'LINKEDIN',
  'TELEGRAM',
  'GITHUB',
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export interface SocialLinkView {
  platform: SocialPlatform
  /** Kullanıcının yazdığı ham değer (düzenleme alanında bu gösterilir). */
  value: string
  /** Tıklanabilir tam adres (sunucu üretir; yalnız http/https). */
  url: string
}

export interface RelationshipResponse {
  followerCount: number
  followingCount: number
  isSelf: boolean
  following: boolean
  requested: boolean
  followsYou: boolean
  isPrivate: boolean
  canViewContent: boolean
  /** Bu kullanıcıyı ben engelledim mi (düğme durumu). */
  blockedByMe: boolean
  /** İki yönden birinde engel var mı — etkileşim tamamen kapalı. */
  blocked: boolean
}

export interface PublicUserResponse {
  id: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  privateAccount: boolean
  /** Mavi tik — Pro üyelikten türer. Plan adının kendisi burada SIZDIRILMAZ. */
  verified: boolean
  createdAt: string
}

export type NotificationType =
  | 'FOLLOW'
  | 'FOLLOW_REQUEST'
  | 'FOLLOW_ACCEPTED'
  | 'PROFILE_VIEW'
  /** Gonderi olaylari (V39). */
  | 'POST_LIKE'
  | 'POST_SAVE'

export interface NotificationResponse {
  id: string
  type: NotificationType
  actor: UserSummary | null
  territoryId: string | null
  territoryName: string | null
  /** POST_LIKE / POST_SAVE bildiriminin gonderisi (V39); digerlerinde null. */
  postId: string | null
  read: boolean
  createdAt: string
}

// ---------------------------------------------------------------- analytics

export interface DayCount {
  date: string
  count: number
}

export interface ViewerRow {
  viewer: UserSummary
  viewedAt: string
}

export interface AnalyticsResponse {
  totalViews: number
  uniqueViewers: number
  viewsByDay: DayCount[]
  recentViewers: ViewerRow[]
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
  user: UserResponse
}

export interface ApiError {
  timestamp: string
  status: number
  code: string
  message: string
  path: string
  fieldErrors?: Record<string, string>
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

// ---------------------------------------------------------------- geo & map

export interface RegionProperties {
  id: string
  /** ZONE = admin'in serbest çizdiği fiyat bölgesi (fiyatta önceliklidir). */
  level: 'ZONE' | 'COUNTRY' | 'PROVINCE' | 'DISTRICT'
  name: string
  pricePerKm2: number
  currency: string
  /** Yalnızca ZONE seviyesinde döner. */
  priority?: number
}

export interface TerritoryProperties {
  id: string
  name: string
  ownerId: string
  ownerUsername: string
  ownerDisplayName: string
  ownerAvatarUrl: string | null
  /**
   * İşaretçi tuvaline çizilecek **aynı-orijin** avatar adresi.
   *
   * 🔴 `ownerAvatarUrl` BURADA KULLANILAMAZ: o adres depoya (S3) 302 ile
   * yönlendirir ve S3 CORS başlığı döndürmez. Başka orijinden gelen bir görsel
   * tuvale çizilince tuval **kirlenir** ve `getImageData` SecurityError
   * fırlatır — işaretçi hiç üretilemez. Bu, 3B mağazada üretimde yaşanmış bir
   * hatadır (yerelde MinIO her Origin'i yankıladığı için görünmüyordu).
   *
   * ⚠️ Gizli hesaplarda sunucu bu alanı **kaldırır**.
   */
  avatarStreamUrl?: string | null
  color: string
  /** Sahibinin özelleştirdiği görünüm (sunucu varsayılanla doldurur). */
  fillColor: string
  fillOpacity: number
  strokeWidth: number
  effect: TerritoryEffect
  /**
   * Harita işaretçisinin tasarımı (V51). Sunucu bunu **her zaman** doldurur —
   * hiç seçim yapmamış mevcut mağazalar dahil (varsayılan orada çözülür).
   *
   * ⚠️ **Kümelerde yoktur** (kümeleme özellik taşımaz); harita ifadeleri bu
   * yüzden yine de `coalesce` ile yazılır.
   */
  markerStyle: StoreMarkerStyle
  /** İşaretçi görselinin kimliği — **istemcide** eklenir (`territoriesToPoints`). */
  markerIcon?: string
  /**
   * Mağazanın kategorisi (V52). **Kategorisiz mağazada alanlar hiç yoktur** —
   * boş dize değil, yok. Harita ifadesinde `["has", "categoryId"]` ile
   * kategorisizler temiz biçimde elenebilsin diye böyle.
   */
  categoryId?: string
  categoryCode?: string
  /** Sunucunun Türkçe yedeği — istemci önce `storeCategory.<code>` sözlüğüne bakar. */
  categoryName?: string
  categoryIcon?: string
  categoryColor?: string
  /** Mağaza panelinin arka plan görseli (V53). Gizli hesapta sunucu kaldırır. */
  coverUrl?: string
  centerLng: number
  centerLat: number
  /** Çizim sırasında komşuya değmeden durabilmek için kullanılır. */
  radiusM: number
  purchasedAt: string
  // ---- kiralama + kart alanları (harita kartı bunlarla çizilir)
  leaseStartedAt: string
  expiresAt: string
  daysRemaining: number
  areaKm2: number
  pricePaid: number
  currency: string
}

export interface GeoFeature<P> {
  type: 'Feature'
  id: string
  geometry: { type: 'Polygon'; coordinates: number[][][] }
  properties: P
}

export interface FeatureCollection<P> {
  type: 'FeatureCollection'
  features: GeoFeature<P>[]
}

// ---------------------------------------------------------------- territory


/* 🔴 `QuoteResponse` KALDIRILDI (V38): fiyat teklifi ucu yok — mağaza ödemesiz. */

export type TerritoryEffect = 'NONE' | 'FIRE' | 'PULSE'

/**
 * Harita işaretçisinin tasarımı.
 *
 * - `PULSE` — yumuşak nabız (varsayılan; ekran görüntüsündeki tasarım)
 * - `GLOW`  — daha geniş ve güçlü parıltı
 * - `SOFT`  — nabız yok, sabit ince parıltı (hareketten rahatsız olanlar için)
 */
export type StoreMarkerStyle = 'PULSE' | 'GLOW' | 'SOFT'

export interface TerritoryStyle {
  strokeColor: string | null
  fillColor: string | null
  fillOpacity: number | null
  strokeWidth: number | null
  effect: TerritoryEffect
  /** **Her zaman dolu** — seçilmemişse sunucu varsayılanı döner. */
  markerStyle: StoreMarkerStyle
}

export interface TerritoryResponse {
  id: string
  name: string
  ownerId: string
  ownerUsername: string
  ownerDisplayName: string
  ownerAvatarUrl: string | null
  lng: number
  lat: number
  radiusM: number
  areaKm2: number
  pricePaid: number
  currency: string
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  regionLabel: string | null
  /** İlk alım anı — yenilemede değişmez. */
  purchasedAt: string
  // ---- kiralama (bölgeler 12 ay süreyle kiralanır)
  leaseStartedAt: string
  expiresAt: string
  leaseMonths: number
  renewalCount: number
  daysRemaining: number
  expired: boolean
  style: TerritoryStyle
  /** Mağazanın kategorisi (V52); henüz seçilmediyse `null`. */
  category: StoreCategory | null
  /** Mağaza panelinin arka plan görseli (V53); yoksa `null`. */
  coverUrl: string | null
}

/**
 * <b>Mağaza kategorisi</b> (V52) — veritabanında durur, yönetici ekleyip
 * çıkarabilir.
 *
 * ⚠️ `name` sunucunun **Türkçe yedeğidir**, gösterilecek ad değildir.
 * Gösterim `storeCategoryLabel()` üzerinden yapılır: önce
 * `storeCategory.<code>` sözlük anahtarı, yoksa buraya düşer. Sunucudan beş
 * dil göndermek sözlüğü ikiye bölmek olurdu.
 */
export interface StoreCategory {
  id: string
  code: string
  name: string
  /** Phosphor ikon adı; istemcideki beyaz listede yoksa yedek ikon çizilir. */
  icon: string
  color: string
  sortOrder: number
  active: boolean
}

// ---------------------------------------------------------------- social

export interface AuthorSummary {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface MediaResponse {
  id: string
  url: string
  contentType: string
  sizeBytes: number
}

export type ProfileType = 'STANDARD' | 'WEBSITE' | 'HTML'

export interface ProfileResponse {
  territoryId: string
  title: string | null
  description: string | null
  website: string | null
  postCount: number
  profileType: ProfileType
  /** Yalnız HTML türünde dolu — sunucuda temizlenmiş içerik. */
  customHtml: string | null
  /** Sahibinin sosyal bağlantıları bu bölge profilinde gösterilsin mi. */
  showSocialLinks: boolean
  /** Yalnız `showSocialLinks` açıkken dolu. */
  socialLinks: SocialLinkView[]
}

export type PostKind = 'STANDARD' | 'POLL' | 'EVENT'
export type RsvpStatus = 'GOING' | 'INTERESTED'

export interface PollOptionView {
  id: string
  text: string
  voteCount: number
}

export interface PollView {
  options: PollOptionView[]
  totalVotes: number
  myOptionId: string | null
}

export interface EventView {
  title: string
  location: string | null
  startsAt: string
  goingCount: number
  interestedCount: number
  myRsvp: RsvpStatus | null
}

export interface PostResponse {
  id: string
  territoryId: string
  author: AuthorSummary
  caption: string | null
  mediaUrls: string[]
  likeCount: number
  commentCount: number
  likedByMe: boolean
  /** Kaydetme sayisi ve "ben kaydettim mi" (V21 tablosu nihayet kullaniliyor). */
  saveCount: number
  savedByMe: boolean
  createdAt: string
  kind: PostKind
  poll: PollView | null
  event: EventView | null
}

// ---------------------------------------------------------------- stories

/**
 * Hikayeyi gören bir kisi — goz simgesine dokununca acilan liste.
 * Sunucu bu listeyi YALNIZ hikayenin sahibine dondurur.
 */
export interface StoryViewerResponse {
  viewer: AuthorSummary
  viewedAt: string
}

export interface StoryResponse {
  id: string
  mediaUrl: string
  caption: string | null
  createdAt: string
  expiresAt: string
  seen: boolean
  mine: boolean
  viewCount: number
  /** Bir bölgede (harita profilinde) yayınlandıysa dolu. */
  territoryId: string | null
  territoryName: string | null
}

/** Hikaye paylaşılabilecek bölge (yalnız profil türü akış olanlar). */
export interface StoryTargetResponse {
  territoryId: string
  name: string
  regionLabel: string | null
}

export interface StoryGroupResponse {
  author: AuthorSummary
  stories: StoryResponse[]
  hasUnseen: boolean
}

export interface CommentResponse {
  id: string
  author: AuthorSummary
  body: string
  createdAt: string
  /**
   * Bakan kişi bu yorumu silebilir mi (yorumu yazan · gönderi sahibi · admin).
   *
   * ⚠️ Karar SUNUCUDA verilir; istemci "benim mi?" diye tahmin etmez.
   * Silme ucu ayrıca kendi kontrolünü yapar — bu bayrak yalnız düğmeyi
   * göstermek içindir.
   */
  canDelete: boolean
}

// ---------------------------------------------------------------- chat

export interface ConversationResponse {
  id: string
  other: UserSummary
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unreadCount: number
  /** true → benim için bekleyen mesaj isteği. */
  pendingRequest: boolean
}

export interface ChatMessageResponse {
  id: string
  conversationId: string
  senderId: string
  body: string
  clientMessageId: string | null
  createdAt: string
}

// ---------------------------------------------------------------- activity

export type ActivityType =
  | 'TERRITORY_PURCHASED'
  | 'PHOTO_SHARED'
  | 'POST_SHARED'
  | 'POLL_CREATED'
  | 'EVENT_STARTED'

export interface ActivityResponse {
  id: string
  type: ActivityType | string
  actorId: string
  actorUsername: string
  actorDisplayName: string
  actorAvatarUrl: string | null
  territoryId: string | null
  territoryName: string | null
  createdAt: string
}

// ---------------------------------------------------------------- moderasyon

export interface ReportReasonOption {
  value: string
  label: string
}

export interface CreateReportPayload {
  reportedUserId: string
  reason: string
  description?: string
  evidenceMediaId?: string
}

// ---------------------------------------------------------------- admin

export interface CountryResponse {
  id: string
  code: string
  name: string
  lng: number
  lat: number
  radiusKm: number
  defaultPricePerKm2: number
  currency: string
  active: boolean
}

export interface ProvinceResponse {
  id: string
  countryId: string
  countryName: string
  name: string
  lng: number
  lat: number
  radiusKm: number
  pricePerKm2: number | null
  effectivePricePerKm2: number
  currency: string
  active: boolean
}

export interface DistrictResponse {
  id: string
  provinceId: string
  provinceName: string
  countryName: string
  name: string
  lng: number
  lat: number
  radiusKm: number
  pricePerKm2: number | null
  effectivePricePerKm2: number
  currency: string
  active: boolean
}

export interface AdminUserResponse {
  id: string
  username: string
  email: string
  displayName: string
  role: string
  status: string
  lastLoginAt: string | null
  createdAt: string
}

export interface AuditLogResponse {
  id: number
  actorUsername: string | null
  action: string
  entityType: string | null
  entityId: string | null
  detail: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export interface RecentPurchase {
  territoryId: string
  buyerUsername: string
  amount: number
  currency: string
  createdAt: string
}

export interface DashboardResponse {
  totalUsers: number
  totalTerritories: number
  totalPosts: number
  purchasesToday: number
  revenueToday: number
  revenueByCurrency: Record<string, number>
  recentPurchases: RecentPurchase[]
}

// ---------------------------------------------------------------- faturalar

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED'

export interface InvoiceSummary {
  id: string
  invoiceNo: string
  issuedAt: string
  status: InvoiceStatus
  description: string
  currency: string
  total: number
  territoryId: string | null
}

export interface InvoiceDetail extends InvoiceSummary {
  buyerUsername: string
  buyerName: string
  buyerEmail: string
  regionLabel: string | null
  areaKm2: number
  radiusM: number
  pricePerKm2: number | null
  subtotal: number
  taxRate: number
  taxAmount: number
  paymentMethod: string | null
  paymentReference: string | null
  /**
   * Fatura türü: PURCHASE | RENEWAL | STORE_BID (98. tur).
   * ⚠️ Alan/yarıçap satırları YALNIZ bölge faturalarında çizilir; teklif
   * faturasında o alanlar sıfırdır ve "0 km² · 0 m" okunurdu.
   */
  kind: string
}

export interface BillingSummary {
  invoiceCount: number
  currency: string
  totalSpent: number
}

// ------------------------------------------------------- zengin rapor (29 Tem 2026)

export interface TerritoryStat {
  territoryId: string
  name: string
  regionLabel: string | null
  areaKm2: number
  views: number
  uniqueViewers: number
}

export interface TopViewer {
  viewer: UserSummary
  views: number
  lastViewedAt: string
}

export interface LabelCount {
  label: string
  count: number
}

export interface ReportResponse {
  days: number
  totalViews: number
  uniqueViewers: number
  viewsInPeriod: number
  viewsPrevPeriod: number
  /** Önceki dönem 0 ise null (oran tanımsız). */
  changePercent: number | null
  viewsByDay: DayCount[]
  viewsByWeekday: LabelCount[]
  busiestHour: number | null

  territoryCount: number
  totalAreaKm2: number
  portfolioValue: number
  currency: string
  territories: TerritoryStat[]

  followers: number
  following: number
  pendingRequests: number

  postCount: number
  postsInPeriod: number
  likesReceived: number
  commentsReceived: number
  /** Analytics üst kartları (5 Ağu 2026). */
  tagCount: number
  saveCount: number
  collectionCount: number
  linkCount: number
  activeStories: number

  topViewers: TopViewer[]
  recentViewers: ViewerRow[]
}

// ---------------------------------------------------------------- engelleme

export interface BlockedUserRow {
  user: UserSummary
  reason: string | null
  blockedAt: string
}
