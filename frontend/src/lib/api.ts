import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import type { ApiError, TokenResponse } from '@/types/api'

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 20_000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Aynı anda tek refresh isteği çalışır; diğer 401'ler onu bekler. */
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setSession, clear } = useAuthStore.getState()
  if (!refreshToken) return null
  try {
    const { data } = await axios.post<TokenResponse>('/api/v1/auth/refresh', { refreshToken })
    setSession(data)
    return data.accessToken
  } catch {
    clear()
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const isAuthCall = original?.url?.includes('/auth/')

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const newToken = await refreshPromise
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(error: unknown, fallback = 'Bir şeyler ters gitti') {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined
    if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
      return Object.values(data.fieldErrors)[0]
    }
    if (data?.message) return data.message
  }
  return fallback
}
