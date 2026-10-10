/** Backend GeoUtils.circle ile aynı yaklaşım: 64 adımlı yaklaşık geodezik daire. */
export function circleRing(lng: number, lat: number, radiusM: number, steps = 64): number[][] {
  const metersPerDegLat = 111_320
  const metersPerDegLng = metersPerDegLat * Math.max(Math.cos((lat * Math.PI) / 180), 0.01)
  const ring: number[][] = []
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps
    ring.push([
      lng + (radiusM * Math.sin(angle)) / metersPerDegLng,
      lat + (radiusM * Math.cos(angle)) / metersPerDegLat,
    ])
  }
  ring.push(ring[0])
  return ring
}

export function circleFeature(lng: number, lat: number, radiusM: number) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [circleRing(lng, lat, radiusM)] },
    properties: {},
  }
}

/** İki koordinat arası metre cinsinden yaklaşık mesafe (haversine). */
export function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6_371_000
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const la1 = (a[1] * Math.PI) / 180
  const la2 = (b[1] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface NeighbourCircle {
  center: [number, number]
  radiusM: number
}

/** İki daire arasında bırakılan güvenlik payı (metre) — kenarlar üst üste binmesin. */
export const NEIGHBOUR_GAP_M = 5

/**
 * Merkezden başlayan bir dairenin, mevcut alanlara **değmeden** ulaşabileceği en büyük yarıçap.
 * Merkez zaten dolu bir alanın içindeyse 0 döner (o noktada çizim yapılamaz).
 */
export function maxRadiusBefore(center: [number, number], neighbours: NeighbourCircle[]): number {
  let max = Number.POSITIVE_INFINITY
  for (const neighbour of neighbours) {
    const gap = distanceM(center, neighbour.center) - neighbour.radiusM - NEIGHBOUR_GAP_M
    if (gap < max) {
      max = gap
    }
  }
  return Math.max(0, max)
}

/**
 * Merkezin bir poligon halkasının **kenarlarına** en kısa mesafesi (metre).
 * Merkez içeride de olsa dışarıda da olsa aynı sonucu verir; böylece daire
 * hiçbir zaman sınırı kesmez — içerideyse dışarı taşmaz, dışarıdaysa içeri girmez.
 */
export function distanceToRingM(center: [number, number], ring: number[][]): number {
  const latRad = (center[1] * Math.PI) / 180
  const mPerDegLat = 111_320
  const mPerDegLng = mPerDegLat * Math.max(Math.cos(latRad), 0.01)
  // Merkez etrafında yerel düzleme izdüşüm — bu ölçekte hata ihmal edilebilir.
  const toLocal = (p: number[]): [number, number] => [
    (p[0] - center[0]) * mPerDegLng,
    (p[1] - center[1]) * mPerDegLat,
  ]

  let min = Number.POSITIVE_INFINITY
  for (let i = 0; i < ring.length - 1; i++) {
    const a = toLocal(ring[i])
    const b = toLocal(ring[i + 1])
    min = Math.min(min, distancePointToSegment(a, b))
  }
  return min
}

/** Orijin (0,0) noktasının a–b doğru parçasına uzaklığı. */
function distancePointToSegment(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) {
    return Math.hypot(a[0], a[1])
  }
  // Orijinin parça üzerindeki izdüşüm oranı, [0,1] aralığına kısıtlanır.
  let t = -(a[0] * dx + a[1] * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(a[0] + t * dx, a[1] + t * dy)
}

/** Fiyat bölgesi sınırlarına değmeden büyüyebilecek en fazla yarıçap. */
export function maxRadiusInsideZones(center: [number, number], zoneRings: number[][][]): number {
  let max = Number.POSITIVE_INFINITY
  for (const ring of zoneRings) {
    max = Math.min(max, distanceToRingM(center, ring) - NEIGHBOUR_GAP_M)
  }
  return Math.max(0, max)
}
