import { api } from './api'
import type { RelationshipResponse, UserSummary } from '@/types/api'

export async function getRelationship(userId: string): Promise<RelationshipResponse> {
  return (await api.get<RelationshipResponse>(`/users/${userId}/relationship`)).data
}

export async function follow(userId: string): Promise<RelationshipResponse> {
  return (await api.post<RelationshipResponse>(`/users/${userId}/follow`)).data
}

export async function unfollow(userId: string): Promise<RelationshipResponse> {
  return (await api.delete<RelationshipResponse>(`/users/${userId}/follow`)).data
}

export async function getFollowers(userId: string): Promise<UserSummary[]> {
  return (await api.get<UserSummary[]>(`/users/${userId}/followers`)).data
}

export async function getFollowing(userId: string): Promise<UserSummary[]> {
  return (await api.get<UserSummary[]>(`/users/${userId}/following`)).data
}

export async function getFollowRequests(): Promise<UserSummary[]> {
  return (await api.get<UserSummary[]>('/follow-requests')).data
}

export async function acceptRequest(requesterId: string): Promise<void> {
  await api.post(`/follow-requests/${requesterId}/accept`)
}

export async function rejectRequest(requesterId: string): Promise<void> {
  await api.post(`/follow-requests/${requesterId}/reject`)
}
