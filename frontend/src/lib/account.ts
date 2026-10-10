import type { QueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { SocialLinkView, SocialPlatform, UserResponse } from '@/types/api'

export interface UpdateMePayload {
  displayName?: string
  bio?: string
  avatarMediaId?: string
  privateAccount?: boolean
  themeMode?: 'light' | 'dark'
  mapStyle?: string
  /** 'tr' | 'en' | 'ar' | 'de' | 'es' */
  locale?: string
}

export async function updateMe(payload: UpdateMePayload): Promise<UserResponse> {
  return (await api.patch<UserResponse>('/users/me', payload)).data
}

/**
 * Avatar (profil fotoğrafı) değişince onu gömen tüm önbelleğe alınmış görünümleri
 * tazeler → foto haritada, profillerde, gönderilerde, listelerde anında güncellenir.
 */
export function invalidateAvatarQueries(qc: QueryClient) {
  const keys = [
    ['map', 'territories'],
    ['territory'],
    ['territory-profile'],
    ['territory-posts'],
    ['my-territories'],
    ['public-user'],
    ['user-territories'],
    ['comments'],
    ['story-feed'],
    ['follow-list'],
  ]
  for (const queryKey of keys) {
    void qc.invalidateQueries({ queryKey })
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/users/me/password', { currentPassword, newPassword })
}

export interface EmailChangeResponse {
  /** Her zaman true — adres ancak doğrulama bağlantısına tıklanınca işlenir. */
  pendingVerification: boolean
  pendingEmail: string
}

/**
 * E-posta değişimi başlatır. Adres **anında değişmez**: yeni adrese doğrulama
 * bağlantısı gider ve tıklanana kadar hesap eski adresle çalışır.
 */
export async function changeEmail(
  newEmail: string,
  currentPassword: string,
): Promise<EmailChangeResponse> {
  return (await api.post<EmailChangeResponse>('/users/me/email', { newEmail, currentPassword })).data
}

// ------------------------------------------------------- sosyal medya bağlantıları

export async function getMySocialLinks(): Promise<SocialLinkView[]> {
  return (await api.get<SocialLinkView[]>('/users/me/social-links')).data
}

export async function getUserSocialLinks(userId: string): Promise<SocialLinkView[]> {
  return (await api.get<SocialLinkView[]>(`/users/${userId}/social-links`)).data
}

/**
 * Bağlantıları **tam değiştirir**: listede olmayan platform silinir, sıra
 * gönderilen sıradır. Boş değerli kayıtlar sunucuda elenir.
 */
export async function saveSocialLinks(
  links: { platform: SocialPlatform; value: string }[],
): Promise<SocialLinkView[]> {
  return (await api.put<SocialLinkView[]>('/users/me/social-links', { links })).data
}
