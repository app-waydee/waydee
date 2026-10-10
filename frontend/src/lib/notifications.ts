import { api } from './api'
import type { NotificationResponse } from '@/types/api'

export async function getNotifications(): Promise<NotificationResponse[]> {
  return (await api.get<NotificationResponse[]>('/notifications')).data
}

export async function getUnreadCount(): Promise<number> {
  return (await api.get<{ unread: number }>('/notifications/unread-count')).data.unread
}

export async function markAllRead(): Promise<void> {
  await api.post('/notifications/read')
}

/**
 * Tek bildirimi siler.
 *
 * ⚠️ Sunucu bulunamayan bildirim için de <b>204</b> döner: kullanıcı aynı X'e
 * iki kez basmış olabilir ve bu bir arıza değil, aynı sonucun tekrarıdır.
 */
export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`)
}

/** Tüm bildirimleri siler. Geri alınamaz. */
export async function deleteAllNotifications(): Promise<void> {
  await api.delete('/notifications')
}
