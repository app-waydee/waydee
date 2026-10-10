import { api } from './api'
import type { BlockedUserRow } from '@/types/api'

/**
 * Hesap engelleme.
 *
 * Engel tek yönlü kurulur, **çift yönlü uygulanır**: engelleyen de engellenen de
 * birbirini takip edemez, mesaj atamaz, içeriğini göremez. Kurallar sunucuda
 * uygulanır — buradaki düğmeler yalnız arayüzdür.
 */

export async function getMyBlocks(): Promise<BlockedUserRow[]> {
  return (await api.get<BlockedUserRow[]>('/users/me/blocks')).data
}

export async function blockUser(userId: string, reason?: string): Promise<void> {
  await api.post(`/users/${userId}/block`, { reason: reason || undefined })
}

export async function unblockUser(userId: string): Promise<void> {
  await api.delete(`/users/${userId}/block`)
}
