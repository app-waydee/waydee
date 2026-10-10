import { api } from './api'

/**
 * Etiket istatistikleri istemcisi.
 *
 * ⚠️ Gösterim/tıklama bildirimi <b>oturum istemez</b> (ziyaretçi paylaşılan
 * fotoğrafı açıyor); rapor okuma yalnız gönderinin sahibine açıktır.
 */

export interface TagStatRow {
  tagId: string
  productName: string | null
  productUrl: string | null
  price: number | null
  currency: string | null
  impressions: number
  clicks: number
  /** Tıklama oranı, yüzde. */
  ctr: number
}

export interface TagDaily {
  day: string
  impressions: number
  clicks: number
}

export interface TagStatsView {
  postId: string
  days: number
  totalImpressions: number
  totalClicks: number
  ctr: number
  tags: TagStatRow[]
  daily: TagDaily[]
}

export async function getTagStats(postId: string, days = 30): Promise<TagStatsView> {
  return (await api.get<TagStatsView>(`/posts/${postId}/tag-stats?days=${days}`)).data
}

/**
 * Etiketler ekranda çizildi.
 *
 * 🔴 Hatalar SESSİZCE yutulur ve bu bilinçli: ölçüm, ölçtüğü deneyimi
 * bozmamalı. Ziyaretçiye "istatistik gönderilemedi" demek anlamsız.
 *
 * ⚠️ `api` yerine ham `fetch` KULLANILMAZ: `api` aynı origin'e gider ve
 * ziyaretçi geçişi (`X-Waydee-Pass`) gibi başlıkları zaten taşır.
 */
export async function reportTagImpressions(postId: string, tagIds: string[]): Promise<void> {
  if (!tagIds.length) return
  try {
    await api.post(`/posts/${postId}/tag-impressions`, { tagIds })
  } catch {
    /* yut */
  }
}

/** Etikete tıklandı. Hata yutulur — kullanıcı ürüne gitmeye devam etmeli. */
export async function reportTagClick(postId: string, tagId: string): Promise<void> {
  try {
    await api.post(`/posts/${postId}/tags/${tagId}/click`)
  } catch {
    /* yut */
  }
}
