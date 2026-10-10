import { Client, type StompSubscription } from '@stomp/stompjs'
import { useAuthStore } from '@/stores/auth'
import type { GeoFeature, TerritoryProperties } from '@/types/api'

export interface TerritoryLiveMessage {
  /**
   * PURCHASED → yeni bölge, UPDATED → görünüm/ad değişti,
   * REMOVED → pasife alındı ya da admin gizledi (feature gelmez).
   */
  type: 'TERRITORY_PURCHASED' | 'TERRITORY_UPDATED' | 'TERRITORY_REMOVED'
  territoryId: string
  buyerUsername?: string
  feature?: GeoFeature<TerritoryProperties>
}

export interface RegionLiveMessage {
  type: string // PRICING_ZONE_CREATED | PRICING_ZONE_UPDATED | PRICING_ZONE_DELETED | PRICING_ZONE_DEACTIVATED
  zoneId: string
  feature?: unknown
}

export interface ActivityLiveMessage {
  id: string
  type: string
  actorId: string
  actorUsername: string
  actorDisplayName: string
  actorAvatarUrl: string | null
  territoryId: string | null
  territoryName: string | null
  createdAt: string
}

export interface ChatLiveMessage {
  type: 'MESSAGE'
  id: string
  conversationId: string
  senderId: string
  body: string
  clientMessageId: string | null
  createdAt: string
}

type Handler = (body: unknown) => void

interface SubEntry {
  handlers: Set<Handler>
  sub?: StompSubscription
}

/**
 * TEK paylaşımlı STOMP istemcisi. CONNECT'te JWT gönderilir (backend doğrular);
 * kopunca yeniden bağlanır ve tüm kayıtlı hedeflere yeniden abone olur.
 * Aynı hedefe birden çok bileşen abone olabilir — tek soket, çoklanmış dağıtım.
 */
let client: Client | null = null
const registry = new Map<string, SubEntry>()

function dispatch(destination: string, raw: string) {
  const entry = registry.get(destination)
  if (!entry) return
  try {
    const body = JSON.parse(raw) as unknown
    entry.handlers.forEach((h) => h(body))
  } catch {
    // bozuk frame yok sayılır
  }
}

function subscribeOnBroker(destination: string, entry: SubEntry) {
  if (!client || !client.connected || entry.sub) return
  entry.sub = client.subscribe(destination, (frame) => dispatch(destination, frame.body))
}

function ensureClient(): Client {
  if (client) return client
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  client = new Client({
    brokerURL: `${protocol}://${window.location.host}/ws`,
    reconnectDelay: 3000,
    beforeConnect: () => {
      // Her (yeniden) bağlanmada güncel access token kullanılır.
      const token = useAuthStore.getState().accessToken
      if (client) client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    },
    onConnect: () => {
      // Yeniden bağlanışta eski abonelikler geçersizdir — hepsi tazelenir.
      registry.forEach((entry, destination) => {
        entry.sub = undefined
        subscribeOnBroker(destination, entry)
      })
    },
  })
  client.activate()
  return client
}

/** Bir STOMP hedefine abone ol; dönen fonksiyon aboneliği bırakır. */
function subscribeDestination(destination: string, handler: Handler): () => void {
  let entry = registry.get(destination)
  if (!entry) {
    entry = { handlers: new Set() }
    registry.set(destination, entry)
  }
  entry.handlers.add(handler)
  ensureClient()
  subscribeOnBroker(destination, entry)

  return () => {
    const current = registry.get(destination)
    if (!current) return
    current.handlers.delete(handler)
    if (current.handlers.size === 0) {
      try {
        current.sub?.unsubscribe()
      } catch {
        // bağlantı zaten kapanmış olabilir
      }
      registry.delete(destination)
    }
    if (registry.size === 0 && client) {
      void client.deactivate()
      client = null
    }
  }
}

export function subscribeTerritories(onMessage: (message: TerritoryLiveMessage) => void): () => void {
  return subscribeDestination('/topic/territories', onMessage as Handler)
}

/** Admin fiyat bölgesi değişiklikleri — harita regions kaynağını tazelemek için. */
export function subscribeRegions(onMessage: (message: RegionLiveMessage) => void): () => void {
  return subscribeDestination('/topic/regions', onMessage as Handler)
}

/** Son hareketler akışı (satın alma / paylaşım / etkinlik). */
export function subscribeActivity(onMessage: (message: ActivityLiveMessage) => void): () => void {
  return subscribeDestination('/topic/activity', onMessage as Handler)
}

/** Bana gelen DM'ler (kullanıcıya özel kuyruk — sunucu kimliğe göre yönlendirir). */
export function subscribeMyMessages(onMessage: (message: ChatLiveMessage) => void): () => void {
  return subscribeDestination('/user/queue/messages', onMessage as Handler)
}

/**
 * <b>Canlı bildirim</b> (18 Ağu 2026).
 *
 * <p>🔴 Bildirimler o güne kadar yalnız <b>yoklamayla</b> geliyordu: zil 30
 * saniyede bir sayacı soruyordu, liste ise ancak sayfa yenilenince
 * tazeleniyordu. Kullanıcının şikâyeti buydu — canlı taşıma projede zaten
 * vardı (mesaj/bölge/aktivite), yalnız bildirimler ona bağlanmamıştı.
 *
 * <p>⚠️ Yük yalnız <b>haberdir</b> ({@code type}), bildirimin kendisi değil.
 * Gövdeyi sokete koymak; aktör adı, avatarı ve metni iki ayrı yerde üretmek ve
 * ikisinin sessizce ayrışması demekti. Haberi alan istemci kendi ucundan okur.
 */
export function subscribeMyNotifications(onNotify: (message: { type: string }) => void): () => void {
  return subscribeDestination('/user/queue/notifications', onNotify as Handler)
}

/**
 * Çalışma zamanı yapılandırma değişiklikleri (ör. admin Mapbox anahtarını değiştirdi).
 * Harita bileşenleri bunu dinleyip anahtarı yenileyerek kendini yeniden kurar.
 */
export function subscribeConfig(onMessage: (message: { type: string; key: string }) => void): () => void {
  return subscribeDestination('/topic/config', onMessage as Handler)
}
