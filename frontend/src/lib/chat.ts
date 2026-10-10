import { api } from './api'
import type { ChatMessageResponse, ConversationResponse } from '@/types/api'

export async function getConversations(): Promise<ConversationResponse[]> {
  return (await api.get<ConversationResponse[]>('/conversations')).data
}

export async function getConversation(conversationId: string): Promise<ConversationResponse> {
  return (await api.get<ConversationResponse>(`/conversations/${conversationId}`)).data
}

/** Sohbet başlat ya da mevcut olanı getir (get-or-create). */
export async function openConversation(recipientId: string): Promise<ConversationResponse> {
  return (await api.post<ConversationResponse>('/conversations', { recipientId })).data
}

/** Keyset sayfalama: en yeniden eskiye; `before` verilirse o andan öncekiler. */
export async function getMessages(
  conversationId: string,
  before?: string,
  size = 30,
): Promise<ChatMessageResponse[]> {
  return (
    await api.get<ChatMessageResponse[]>(`/conversations/${conversationId}/messages`, {
      params: { before, size },
    })
  ).data
}

export async function sendMessage(
  conversationId: string,
  body: string,
  clientMessageId: string,
): Promise<ChatMessageResponse> {
  return (
    await api.post<ChatMessageResponse>(`/conversations/${conversationId}/messages`, {
      body,
      clientMessageId,
    })
  ).data
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await api.post(`/conversations/${conversationId}/read`)
}

export async function getChatUnreadCount(): Promise<number> {
  return (await api.get<{ count: number }>('/conversations/unread-count')).data.count
}

// ---------------------------------------------------------------- mesaj istekleri

export async function getMessageRequests(): Promise<ConversationResponse[]> {
  return (await api.get<ConversationResponse[]>('/conversations/requests')).data
}

export async function getMessageRequestCount(): Promise<number> {
  return (await api.get<{ count: number }>('/conversations/requests/count')).data.count
}

export async function acceptMessageRequest(conversationId: string): Promise<void> {
  await api.post(`/conversations/${conversationId}/accept`)
}

export async function rejectMessageRequest(conversationId: string): Promise<void> {
  await api.post(`/conversations/${conversationId}/reject`)
}
