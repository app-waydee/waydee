import { useCallback, useEffect, useRef, useState } from 'react'

export interface UserPosition {
  lng: number
  lat: number
  /** Konum doğruluğu (metre) — halkanın yarıçapı bununla çizilir. */
  accuracy: number
}

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable'

const STORAGE_KEY = 'waydee-location-on'

/** İki okuma arasındaki kabaca mesafe (metre) — eşik karşılaştırması için yeterli. */
function metresBetween(a: UserPosition, b: UserPosition) {
  const latRad = (a.lat * Math.PI) / 180
  const dx = (b.lng - a.lng) * 111_320 * Math.cos(latRad)
  const dy = (b.lat - a.lat) * 110_540
  return Math.hypot(dx, dy)
}

/**
 * Kullanıcının konumu.
 *
 * ⚠️ <b>İzin kendiliğinden istenmez.</b> Harita açılır açılmaz konum sormak
 * hem tarayıcıda kaba bir uyarı çıkarır hem de reddedilme oranını artırır;
 * kullanıcı düğmeye bastığında sorulur. Tercih `localStorage`'da tutulur:
 * bir kez açan kişi her girişte yeniden basmak zorunda kalmaz.
 *
 * ⚠️ <b>`watchPosition`</b> kullanılır, tek seferlik `getCurrentPosition` değil:
 * kullanıcı yürürken işaretçi yerinde donmamalı. Bileşen kaldırılınca izleme
 * bırakılır (aksi halde arka planda pil tüketir).
 */
export function useUserLocation() {
  const [position, setPosition] = useState<UserPosition | null>(null)
  const [status, setStatus] = useState<LocationStatus>('idle')
  const [enabled, setEnabled] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1',
  )
  const watchRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchRef.current != null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stop()
      setPosition(null)
      setStatus('idle')
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable')
      return
    }

    setStatus('locating')
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        /*
         * ⚠️ Yerinde duran bir cihazda bile `watchPosition` saniyede bir yeni
         * okuma verir ve GPS gürültüsü koordinatı santimetrelerle oynatır.
         * Her okumayı state'e yazmak, kullanıcı hiç kımıldamasa bile MapPage'i
         * saniyede bir yeniden render ediyordu. Anlamlı bir hareket (≥ 2 m)
         * yoksa state'e dokunulmaz — işaretçi zaten doğru yerde.
         */
        setPosition((prev) => {
          const next = {
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
            accuracy: pos.coords.accuracy,
          }
          if (prev && metresBetween(prev, next) < 2) return prev
          return next
        })
        setStatus('granted')
      },
      (error) => {
        // 1 = PERMISSION_DENIED — kullanıcı reddetti, tekrar tekrar sorma.
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
        setEnabled(false)
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    )

    return stop
  }, [enabled, stop])

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on
      if (typeof localStorage !== 'undefined') {
        if (next) localStorage.setItem(STORAGE_KEY, '1')
        else localStorage.removeItem(STORAGE_KEY)
      }
      return next
    })
  }, [])

  return { position, status, enabled, toggle }
}
