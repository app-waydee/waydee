import { api } from './api'

/**
 * <b>Mağaza stüdyosu</b> istemcisi — kabul edilen stant sahibinin 3B dükkânını
 * yönettiği uçlar.
 *
 * ⚠️ Tipler sunucudaki {@code StoreStudioDtos} ile birebir. Sunucunun
 * gönderdiği bir alanı burada bildirmemek, veriyi <b>sessizce</b> düşürür
 * (vault tuzağı: `PostEditPage.TagView` üç alanı böyle kaybetmişti).
 */

export type StoreProductSource = 'POST' | 'CUSTOM'

export interface StudioSettings {
  listingId: string
  displayName: string | null
  /** Stantın logosu — stüdyodan değiştirilir, 3B tabelada görünür. */
  logoUrl: string | null
  logoMediaId: string | null
  videoUrl: string | null
  videoMediaId: string | null
  tvEnabled: boolean
  tvMuted: boolean
  musicUrl: string | null
  musicMediaId: string | null
  musicEnabled: boolean
  musicVolume: number
  lightColor: string
  lightIntensity: number
  accentColor: string
  facadeColor: string
}

export interface StoreProduct {
  id: string
  source: StoreProductSource
  sourceLabel: string
  postId: string | null
  title: string
  description: string | null
  price: number | null
  currency: string | null
  productUrl: string | null
  imageUrl: string | null
  position: number
  visible: boolean
}

export interface CandidatePost {
  postId: string
  imageUrl: string
  caption: string | null
}

export interface StudioView {
  listingId: string
  marketplaceSlug: string | null
  marketplaceName: string | null
  listingTitle: string
  status: string
  settings: StudioSettings
  products: StoreProduct[]
  candidates: CandidatePost[]
  shelfCapacity: number
}

export interface StudioSettingsInput {
  displayName?: string | null
  logoMediaId?: string | null
  videoMediaId?: string | null
  tvEnabled?: boolean
  tvMuted?: boolean
  musicMediaId?: string | null
  musicEnabled?: boolean
  musicVolume?: number
  lightColor?: string
  lightIntensity?: number
  accentColor?: string
  facadeColor?: string
}

export interface StoreProductInput {
  source: StoreProductSource
  postId?: string | null
  title: string
  description?: string | null
  price?: number | null
  currency?: string | null
  productUrl?: string | null
  imageMediaId?: string | null
  visible?: boolean
}

const base = (listingId: string) => `/marketplace/listings/${listingId}/studio`

export async function getStudio(listingId: string): Promise<StudioView> {
  return (await api.get<StudioView>(base(listingId))).data
}

export async function updateStudioSettings(
  listingId: string,
  input: StudioSettingsInput,
): Promise<StudioSettings> {
  return (await api.patch<StudioSettings>(`${base(listingId)}/settings`, input)).data
}

export async function clearStudioVideo(listingId: string): Promise<StudioSettings> {
  return (await api.delete<StudioSettings>(`${base(listingId)}/settings/video`)).data
}

export async function clearStudioMusic(listingId: string): Promise<StudioSettings> {
  return (await api.delete<StudioSettings>(`${base(listingId)}/settings/music`)).data
}

export async function addStoreProduct(
  listingId: string,
  input: StoreProductInput,
): Promise<StoreProduct> {
  return (await api.post<StoreProduct>(`${base(listingId)}/products`, input)).data
}

export async function updateStoreProduct(
  listingId: string,
  productId: string,
  input: StoreProductInput,
): Promise<StoreProduct> {
  return (await api.put<StoreProduct>(`${base(listingId)}/products/${productId}`, input)).data
}

export async function removeStoreProduct(listingId: string, productId: string): Promise<void> {
  await api.delete(`${base(listingId)}/products/${productId}`)
}

export async function reorderStoreProducts(
  listingId: string,
  productIds: string[],
): Promise<StoreProduct[]> {
  return (await api.put<StoreProduct[]>(`${base(listingId)}/products/order`, { productIds })).data
}

// ---------------------------------------------------------------- yükleme

/**
 * Video/ses yükleme.
 *
 * 🔴 Tavanlar SUNUCUYLA AYNI olmak zorunda (video 60 MB, ses 15 MB).
 * İstemcide erken kontrol etmek, kullanıcıyı 60 MB'lık bir yüklemenin
 * sonunda hata görmekten kurtarır — ama gerçek kapı sunucudadır.
 */
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024

export interface UploadedMedia {
  id: string
  url: string
  contentType: string
  sizeBytes: number
}

async function uploadTo(path: string, file: File): Promise<UploadedMedia> {
  const body = new FormData()
  body.append('file', file)
  return (
    await api.post<UploadedMedia>(path, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ).data
}

export const uploadVideo = (file: File) => uploadTo('/media/video', file)
export const uploadAudio = (file: File) => uploadTo('/media/audio', file)
export const uploadStudioImage = (file: File) => uploadTo('/media', file)
