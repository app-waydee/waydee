import { api } from './api'

export interface TrendingItem {
  type: 'TERRITORY' | 'USER'
  id: string
  /** 🔴 17 Ağu 2026 — profil adı (yalnız USER). */
  username?: string | null
  title: string
  subtitle: string
  avatarUrl: string | null
  rank: number
  /** Kaç basamak yükseldi (negatif = düştü, null = listeye yeni girdi). */
  climb: number | null
  score: number
  views7d: number
  likes7d: number
  saves7d: number
  posts7d: number
  followers7d: number
  /** "12 kez kaydedildi" gibi tek cümlelik gerekçe. */
  reason: string
  lng: number | null
  lat: number | null
}

export interface TrendingResponse {
  territories: TrendingItem[]
  users: TrendingItem[]
}

export interface SearchHit {
  type: 'USER' | 'TERRITORY'
  id: string
  /**
   * 🔴 17 Ağu 2026 — profil adı; sonuç tıklanınca DOĞRUDAN `/{username}`.
   * ⚠️ Yalnız USER için dolu. ⚠️ `localStorage`'daki ESKİ son arama
   * kayıtlarında bu alan YOKTUR — `profilePath` o durumda köprüye düşer.
   */
  username?: string | null
  title: string
  subtitle: string
  avatarUrl: string | null
  note: string | null
  lng: number | null
  lat: number | null
}

export interface SearchResponse {
  query: string
  users: SearchHit[]
  territories: SearchHit[]
}

export interface EngagementState {
  likeCount: number
  saveCount: number
  liked: boolean
  saved: boolean
}

export const getTrending = (limit = 8) =>
  api.get<TrendingResponse>('/trending', { params: { limit } }).then((r) => r.data)

export const search = (q: string) =>
  api.get<SearchResponse>('/search', { params: { q } }).then((r) => r.data)

export const likeTerritory = (id: string, liked: boolean) =>
  (liked
    ? api.post<EngagementState>(`/territories/${id}/like`)
    : api.delete<EngagementState>(`/territories/${id}/like`)
  ).then((r) => r.data)

export const saveTerritory = (id: string, saved: boolean) =>
  (saved
    ? api.post<EngagementState>(`/territories/${id}/save`)
    : api.delete<EngagementState>(`/territories/${id}/save`)
  ).then((r) => r.data)
