import { useEffect, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useI18nStore } from '@/stores/i18n'
import type { UserResponse } from '@/types/api'

/**
 * Kalıcı oturumdaki kullanıcı görüntüsü zamanla eskir: medya bağlantıları imzalıdır
 * ve süresi dolar, profil başka bir cihazdan güncellenmiş olabilir.
 * Bu yüzden token varsa açılışta kullanıcı sunucudan tazelenir.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    api
      .get<UserResponse>('/users/me')
      .then(({ data }) => {
        if (cancelled) return
        setUser(data)
        // Tercihler DB'de saklı → cihazlar arası kaynak burasıdır.
        if (data.themeMode) useThemeStore.getState().setMode(data.themeMode)
        if (data.mapStyle) useThemeStore.getState().setMapStyle(data.mapStyle)
        // Hesaba bağlı dil her cihazda geçerlidir; yoksa tarayıcı dili kalır.
        useI18nStore.getState().hydrateFromUser(data.locale)
      })
      .catch(() => {
        // 401 ise axios interceptor zaten oturumu düşürür.
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, setUser])

  return <>{children}</>
}
