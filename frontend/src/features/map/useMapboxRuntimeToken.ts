import { useEffect, useState } from 'react'
import { mapboxToken, refreshMapboxToken } from '@/lib/clientConfig'
import { subscribeConfig } from '@/lib/ws'

export interface MapboxTokenState {
  /** Anahtar **değiştiğinde** artar — harita kurulum efektinin bağımlılığı. */
  mapKey: number
  /**
   * Elimizde kullanılabilir bir anahtar var mı?
   *
   * ⚠️ `false` iken **harita YARATILMAMALIDIR**: boş `accessToken` ile
   * `new mapboxgl.Map(...)` çağrılırsa Mapbox anında *"An API access token is
   * required to use Mapbox GL"* fırlatır ve sayfa hata ekranına düşer.
   */
  ready: boolean
  /** İlk sunucu denemesi bitti mi — "yükleniyor" ile "anahtar yok"u ayırır. */
  resolved: boolean
}

/**
 * Mapbox anahtarını çalışma zamanında izler.
 *
 * Anahtar derleme zamanında gömülmez; `GET /config` ile gelir ve admin panelden
 * değiştirilebilir. Değişince `mapKey` artar → harita mevcut örneği yıkıp
 * **yeni anahtarla** yeniden kurar (Mapbox `accessToken`'ı yalnız yaratılışta
 * okur, var olan örneğe uygulanamaz).
 *
 * Kaynaklar: açılışta bir kez `GET /config`, sonrasında `/topic/config` yayını.
 */
export function useMapboxRuntimeToken(): MapboxTokenState {
  const [state, setState] = useState<MapboxTokenState>(() => ({
    mapKey: 0,
    // Derleme zamanı yedeği doluysa haritayı beklemeden kurabiliriz.
    ready: Boolean(mapboxToken()),
    resolved: false,
  }))

  useEffect(() => {
    let alive = true
    const settle = (changed: boolean) => {
      if (!alive) return
      setState((s) => ({
        mapKey: changed ? s.mapKey + 1 : s.mapKey,
        ready: Boolean(mapboxToken()),
        resolved: true,
      }))
    }

    // Açılışta anahtarı tazele (env yedeğiyle ya da bomboş mount olmuş olabiliriz).
    void refreshMapboxToken().then(settle)

    // Admin anahtarı değiştirirse anında haber gelir.
    const unsubscribe = subscribeConfig((message) => {
      if (message?.key !== 'mapbox.access_token') return
      void refreshMapboxToken().then(settle)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  return state
}
