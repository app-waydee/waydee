import axios from 'axios'
import { api } from './api'

/**
 * E-posta doğrulama / şifre sıfırlama uçları.
 *
 * ⚠️ Bu uçlar **oturum istemez** ve oturum açık olmadan da çağrılabilir; bu
 * yüzden `api` örneğinin 401 → refresh kuyruğuna girmemeleri gerekir. Kendi
 * axios örneğini kullanırlar (aynı `/api/v1` kökü, Authorization başlığı yok).
 * `publicApi` KULLANILMAZ — onun kökü `/api/v1/public`'tir (vault'ta kayıtlı tuzak).
 */
const authApi = axios.create({ baseURL: '/api/v1', headers: { 'Content-Type': 'application/json' } })

export type VerificationPurpose = 'EMAIL_VERIFY' | 'EMAIL_CHANGE'

export interface VerificationResult {
  purpose: VerificationPurpose
  email: string
}

/** Doğrulama bağlantısını tüketir (kayıt doğrulaması ya da adres değişimi). */
export async function verifyEmail(token: string): Promise<VerificationResult> {
  return (await authApi.post<VerificationResult>('/auth/verify-email', { token })).data
}

/**
 * Doğrulama bağlantısını tekrar ister. Sunucu adres kayıtlı olmasa da aynı
 * yanıtı verir — istemci bu yüzden her durumda "gönderildi" der.
 */
export async function resendVerification(email: string, turnstileToken?: string): Promise<void> {
  await authApi.post('/auth/resend-verification', { email, turnstileToken })
}

/** Oturum açıkken kendi adresine tekrar gönder (Turnstile gerekmez). */
export async function resendMyVerification(): Promise<void> {
  await api.post('/users/me/resend-verification')
}

export async function forgotPassword(email: string, turnstileToken?: string): Promise<void> {
  await authApi.post('/auth/forgot-password', { email, turnstileToken })
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await authApi.post('/auth/reset-password', { token, newPassword })
}
