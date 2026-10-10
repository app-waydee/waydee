import { api } from './api'
import type {
  AnalyticsResponse,
  PublicUserResponse,
  ReportResponse,
  TerritoryResponse,
} from '@/types/api'

export async function getMyAnalytics(): Promise<AnalyticsResponse> {
  return (await api.get<AnalyticsResponse>('/me/analytics')).data
}

/** Tam rapor — trend, bölge kırılımı, kitle ve etkileşim tek çağrıda. */
export async function getMyReport(days: number): Promise<ReportResponse> {
  return (await api.get<ReportResponse>('/me/report', { params: { days } })).data
}

export async function getTerritoryAnalytics(territoryId: string): Promise<AnalyticsResponse> {
  return (await api.get<AnalyticsResponse>(`/territories/${territoryId}/analytics`)).data
}

export async function getPublicUser(userId: string): Promise<PublicUserResponse> {
  return (await api.get<PublicUserResponse>(`/users/${userId}`)).data
}

export async function getUserTerritories(userId: string): Promise<TerritoryResponse[]> {
  return (await api.get<TerritoryResponse[]>(`/territories/user/${userId}`)).data
}
