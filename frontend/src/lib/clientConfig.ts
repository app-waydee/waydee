import axios from 'axios'
import mapboxgl from 'mapbox-gl'

/**
 * Çalışma zamanı istemci yapılandırması — şu an yalnız **Mapbox genel anahtarı**.
 *
 * Anahtar artık derleme zamanında gömülmez; sunucudan (`GET /config`) gelir ve
 * admin panelden değiştirilebilir. Değişince sunucu `/topic/config` üzerinden
 * haber verir, `MapPage`/`PublicMapPage` haritayı **yeni anahtarla yeniden kurar**.
 *
 * ⚠️ **Kendi axios örneği** kullanılır: `api` (JWT + 401 refresh kuyruğu) gereksiz,
 * `publicApi` ise `/api/v1/public` ön ekiyle çalışır ve bu ucu `/public/config`'e
 * çevirip **404** verirdi (anahtar sessizce env yedeğine düşüyordu). Uç kimliksiz
 * olduğu için sade bir çağrı yeterli.
 */
const configApi = axios.create({ baseURL: '/api/v1', timeout: 8000 })

/** Derleme zamanı yedeği — sunucuya ulaşılamazsa harita yine de açılsın. */
const ENV_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? ''

interface ClientConfig {
  mapboxToken: string
  googleAuthEnabled: boolean
}

let currentToken = ENV_TOKEN
let inflight: Promise<string> | null = null

/**
 * "Google ile devam et" düğmesi çizilsin mi.
 *
 * ⚠️ Sunucu karar verir, istemci **tahmin etmez**: Google istemci kimliği ve
 * gizli anahtarı yalnız arka uçta tanımlıdır. Yapılandırma eksikse düğme hiç
 * görünmez — tıklayınca hata veren bir düğme göstermek dönüşümü kırar.
 * Bilinmiyorken (`null`) de çizilmez: yanıp sönen bir düğme, geç gelen bir
 * düğmeden daha kötüdür.
 */
let googleAuthEnabled: boolean | null = null
const googleListeners = new Set<(enabled: boolean) => void>()

function setGoogleAuthEnabled(enabled: boolean) {
  if (googleAuthEnabled === enabled) return
  googleAuthEnabled = enabled
  googleListeners.forEach((fn) => fn(enabled))
}

export function isGoogleAuthEnabled(): boolean | null {
  return googleAuthEnabled
}

/**
 * Değeri dinler; henüz bilinmiyorsa çekilmesini tetikler.
 *
 * ⚠️ <b>Abone olur olmaz bilinen değer BİR KEZ iletilir.</b> Bu satır olmadan
 * şu yarış oluşuyordu (ölçüldü — düğme hiç çizilmiyordu): React 19 StrictMode
 * efektleri iki kez koşar → abone ol / çık / yeniden abone ol. Yanıt tam da
 * "çıkılmış" pencerede gelirse bildirim kimseye ulaşmaz; ikinci abonelikte
 * değer artık `null` olmadığı için yeni istek de yapılmaz ve bileşen sonsuza
 * kadar başlangıç durumunda kalır. Anlık bildirim bu boşluğu kapatır.
 */
export function subscribeGoogleAuth(listener: (enabled: boolean) => void): () => void {
  googleListeners.add(listener)
  if (googleAuthEnabled === null) {
    void refreshMapboxToken()
  } else {
    listener(googleAuthEnabled)
  }
  return () => googleListeners.delete(listener)
}

/** Mapbox'a şu an verilmiş olan anahtar. */
export function mapboxToken(): string {
  return currentToken
}

/**
 * Anahtarı sunucudan çeker ve `mapboxgl.accessToken`'a yazar.
 * Aynı anda birden çok harita açılsa bile tek istek yapılır.
 *
 * @returns anahtar DEĞİŞTİYSE true (çağıran haritayı yeniden kurar)
 */
export async function refreshMapboxToken(): Promise<boolean> {
  if (!inflight) {
    inflight = configApi
      .get<ClientConfig>('/config')
      .then((r) => {
        setGoogleAuthEnabled(!!r.data?.googleAuthEnabled)
        return r.data?.mapboxToken || ENV_TOKEN
      })
      .catch(() => {
        // Sunucuya ulaşılamadı: Google düğmesi çizilmez (bilinmiyor = kapalı).
        setGoogleAuthEnabled(false)
        return currentToken || ENV_TOKEN
      })
      .finally(() => {
        inflight = null
      })
  }
  const token = await inflight
  const changed = token !== currentToken
  currentToken = token
  mapboxgl.accessToken = token
  return changed
}

/** Uygulama açılışında bir kez — harita bileşenleri hazır anahtarla mount olur. */
export function initMapboxToken(): Promise<boolean> {
  mapboxgl.accessToken = ENV_TOKEN
  return refreshMapboxToken()
}
