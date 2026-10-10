import { api } from './api'

/** Başvurunun durumu — sunucudaki enum'la birebir. */
export type MonetizationStatus = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED'

export interface MyMonetizationRequest {
  id: string | null
  status: MonetizationStatus | null
  audienceNote: string | null
  primaryChannel: string | null
  contactEmail: string | null
  /** Yöneticinin kararının gerekçesi — reddedildiyse kullanıcı bunu görür. */
  decisionNote: string | null
  handledAt: string | null
  createdAt: string | null
  /** Yeni başvuru gönderilebilir mi (açık başvuru yoksa true). */
  canApply: boolean
}

export interface CreateMonetizationPayload {
  audienceNote: string
  primaryChannel?: string
  contactEmail?: string
}

export async function createMonetizationRequest(
  payload: CreateMonetizationPayload,
): Promise<MyMonetizationRequest> {
  return (await api.post<MyMonetizationRequest>('/monetization/requests', payload)).data
}

export async function getMyMonetizationRequest(): Promise<MyMonetizationRequest> {
  return (await api.get<MyMonetizationRequest>('/monetization/requests/me')).data
}
