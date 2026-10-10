import { api } from './api'
import type {
  PostResponse,
  ProfileResponse,
  StoryGroupResponse,
  StoryResponse,
  StoryTargetResponse,
  StoryViewerResponse,
} from '@/types/api'

// -------- territory profile
export async function getTerritoryProfile(territoryId: string): Promise<ProfileResponse> {
  return (await api.get<ProfileResponse>(`/territories/${territoryId}/profile`)).data
}

// -------- stories
export async function createStory(
  mediaId: string,
  caption?: string,
  /** Yayınlanacak bölgeler; her biri için ayrı hikaye oluşur. Boş → yalnız profil. */
  territoryIds: string[] = [],
): Promise<StoryResponse> {
  return (
    await api.post<StoryResponse>('/stories', {
      mediaId,
      caption: caption || undefined,
      territoryIds: territoryIds.length ? territoryIds : undefined,
    })
  ).data
}

/** Hikaye paylaşılabilecek bölgelerim — profil türü akış (STANDARD) olanlar. */
export async function storyTargets(): Promise<StoryTargetResponse[]> {
  return (await api.get<StoryTargetResponse[]>('/stories/targets')).data
}

/** Bir bölgede yayınlanmış aktif hikayeler (bölge profilindeki şerit). */
export async function territoryStories(territoryId: string): Promise<StoryResponse[]> {
  return (await api.get<StoryResponse[]>(`/stories/territory/${territoryId}`)).data
}

/**
 * @param scope `following` → yalnız takip ettiklerim (ana sayfa şeridi).
 *              Boş → tüm açık hesaplar (keşif şeridi, `/me`).
 */
export async function storyFeed(scope?: 'following'): Promise<StoryGroupResponse[]> {
  return (await api.get<StoryGroupResponse[]>('/stories/feed', { params: scope ? { scope } : undefined }))
    .data
}

export async function userStories(userId: string): Promise<StoryResponse[]> {
  return (await api.get<StoryResponse[]>(`/stories/user/${userId}`)).data
}

export async function viewStory(id: string): Promise<void> {
  await api.post(`/stories/${id}/view`)
}

/**
 * Hikayeyi kimler gordu — goz simgesinin arkasindaki liste.
 *
 * ⚠️ Sunucu bunu YALNIZ sahibine verir (403). Istemci dugmeyi zaten
 * `mine` bayragina gore ciziyor ama bu bir GORUNURLUK karari; kapi sunucuda.
 */
export async function storyViewers(id: string): Promise<StoryViewerResponse[]> {
  return (await api.get<StoryViewerResponse[]>(`/stories/${id}/viewers`)).data
}

export async function deleteStory(id: string): Promise<void> {
  await api.delete(`/stories/${id}`)
}

// -------- rich posts
export interface CreatePostPayload {
  caption?: string
  mediaIds?: string[]
  kind?: 'STANDARD' | 'POLL' | 'EVENT'
  pollOptions?: string[]
  eventTitle?: string
  eventLocation?: string
  eventStartsAt?: string
}

export async function createPost(territoryId: string, payload: CreatePostPayload): Promise<PostResponse> {
  return (await api.post<PostResponse>(`/territories/${territoryId}/posts`, payload)).data
}

/* 🔴 `votePoll` ve `rsvpEvent` KALDIRILDI (9 Ağu 2026): anket ve etkinlik
   arayüzü daire ekranıyla birlikte gitti. Sunucudaki uçlar DURUYOR — geçmiş
   anket/etkinlik gönderileri ve oyları silinmemeli; onlar artık düz gönderi
   gibi çiziliyor. Özellik geri gelirse istemci sarmalayıcıları da geri gelir. */
