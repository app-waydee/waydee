import axios from 'axios'
import type {
  FeatureCollection,
  ProfileResponse,
  PublicUserResponse,
  RegionProperties,
  TerritoryProperties,
  TerritoryResponse,
} from '@/types/api'

/**
 * Vitrin (landing) istemcisi — **kimliksiz** okuma uçları.
 *
 * Ayrı bir axios örneği kullanılır: `lib/api.ts` her isteğe Authorization ekler
 * ve 401'de refresh kuyruğunu çalıştırır; ziyaretçide oturum yoktur.
 *
 * 🔒 **Ziyaretçi geçişi:** Turnstile açıkken sunucu bu uçlarda `X-Waydee-Pass`
 * başlığını ister. Geçiş, ortadaki doğrulama kapısından (`VisitorGate`) alınır ve
 * `sessionStorage`'da tutulur; süresi dolarsa sunucu 403 döner ve kapı yeniden açılır.
 */
export const publicApi = axios.create({
  baseURL: '/api/v1/public',
  headers: { 'Content-Type': 'application/json' },
})

const PASS_KEY = 'waydee-visitor-pass'
const PASS_HEADER = 'X-Waydee-Pass'

export function readVisitorPass(): string | null {
  try {
    return sessionStorage.getItem(PASS_KEY)
  } catch {
    return null
  }
}

export function storeVisitorPass(pass: string) {
  try {
    sessionStorage.setItem(PASS_KEY, pass)
  } catch {
    /* storage kapalı olabilir — bellekteki interceptor yine çalışır */
  }
  memoryPass = pass
}

export function clearVisitorPass() {
  try {
    sessionStorage.removeItem(PASS_KEY)
  } catch {
    /* yoksay */
  }
  memoryPass = null
}

/** sessionStorage kapalıysa (gizli sekme kısıtları) geçiş yine bellekte tutulur. */
let memoryPass: string | null = null

publicApi.interceptors.request.use((config) => {
  const pass = memoryPass ?? readVisitorPass()
  if (pass) {
    config.headers.set(PASS_HEADER, pass)
  }
  return config
})

/** Geçiş süresi dolduğunda kapının yeniden açılması için yayılan olay. */
export const VISITOR_PASS_EXPIRED = 'waydee:visitor-pass-expired'

publicApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Geçiş süresi doldu / geçersiz → temizle ve kapıyı yeniden göster.
    // (Kapı yalnız "geçiş var mı" diye baktığı için bu sinyal olmadan sayfa boş kalırdı.)
    // ⚠️ Yalnız VISITOR_PASS_REQUIRED: "gizli hesap" da 403 döner, o kapıyı açmamalı.
    if (error?.response?.data?.code === 'VISITOR_PASS_REQUIRED') {
      clearVisitorPass()
      window.dispatchEvent(new CustomEvent(VISITOR_PASS_EXPIRED))
    }
    return Promise.reject(error)
  },
)

// -------- kapı

export interface GateStatus {
  required: boolean
}

/** Sunucu doğrulama isteyecek mi? (Turnstile kapalıysa kapı hiç gösterilmez.) */
export async function getGateStatus(): Promise<GateStatus> {
  return (await publicApi.get<GateStatus>('/gate')).data
}

/** Turnstile jetonunu kısa ömürlü ziyaretçi geçişine çevirir. */
export async function verifyVisitor(turnstileToken: string | null): Promise<string> {
  const { data } = await publicApi.post<{ pass: string; expiresInSeconds: number }>('/verify', {
    turnstileToken: turnstileToken ?? undefined,
  })
  storeVisitorPass(data.pass)
  return data.pass
}

// -------- veri

export async function getPublicTerritories(): Promise<FeatureCollection<TerritoryProperties>> {
  return (await publicApi.get<FeatureCollection<TerritoryProperties>>('/map/territories')).data
}

export async function getPublicRegions(): Promise<FeatureCollection<RegionProperties>> {
  return (await publicApi.get<FeatureCollection<RegionProperties>>('/map/regions')).data
}

export async function getPublicProfile(territoryId: string): Promise<ProfileResponse> {
  return (await publicApi.get<ProfileResponse>(`/territories/${territoryId}/profile`)).data
}

export async function getPublicUser(userId: string): Promise<PublicUserResponse> {
  return (await publicApi.get<PublicUserResponse>(`/users/${userId}`)).data
}

export async function getPublicUserTerritories(userId: string): Promise<TerritoryResponse[]> {
  return (await publicApi.get<TerritoryResponse[]>(`/users/${userId}/territories`)).data
}
