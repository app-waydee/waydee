import mapboxgl from 'mapbox-gl'
import type { UserPosition } from './useUserLocation'

/**
 * "Buradasın" işaretçisi + haritadan çıkınca <b>kenarda yön göstergesi</b>.
 *
 * <p>⚠️ İki ayrı öğe: konum ekrandaysa <b>yeşil halkalı avatar</b> (Mapbox
 * marker, koordinata bağlı), ekran dışındaysa <b>kenara yapışan bir ok</b>
 * (DOM'da sabit, koordinata bağlı değil). Tek bir marker'la çözmek mümkün
 * değildi: Mapbox marker'ı viewport dışına çıkınca görünmez olur ve kullanıcı
 * "neredeyim?" sorusunu kaybeder.
 *
 * <p>⚠️ Marker'ın `position`'ına CSS'ten dokunulmaz (vault'ta kayıtlı tuzak);
 * gösterge ayrı bir katmandır, harita kabına eklenir.
 */
export interface UserLocationLayer {
  update: (position: UserPosition | null, avatarUrl: string | null, label: string) => void
  destroy: () => void
}

export function createUserLocationLayer(map: mapboxgl.Map): UserLocationLayer {
  let marker: mapboxgl.Marker | null = null
  let inner: HTMLElement | null = null
  let edge: HTMLButtonElement | null = null
  let current: UserPosition | null = null

  /** Kenardaki yön göstergesi — harita kabında sabit durur. */
  const ensureEdge = () => {
    if (edge) return edge
    edge = document.createElement('button')
    edge.setAttribute('type', 'button')
    edge.className = 'waydee-locate-edge'
    edge.setAttribute('aria-hidden', 'false')
    edge.innerHTML = '<span class="waydee-locate-edge-dot"></span>'
    edge.addEventListener('click', () => {
      if (current) map.easeTo({ center: [current.lng, current.lat], zoom: Math.max(map.getZoom(), 14), duration: 700 })
    })
    map.getContainer().appendChild(edge)
    return edge
  }

  const ensureMarker = () => {
    if (marker) return marker
    const el = document.createElement('div')
    el.className = 'waydee-locate'
    // Dış halka (nabız) + iç avatar: Mapbox translate DIŞ öğede kalır,
    // animasyon iç öğede — ikisi karışırsa işaretçi yerinden oynar.
    el.innerHTML =
      '<span class="waydee-locate-pulse"></span><span class="waydee-locate-inner"></span>'
    inner = el.querySelector('.waydee-locate-inner')
    marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([0, 0])
    marker.addTo(map)
    return marker
  }

  /** Konum ekran dışındaysa göstergeyi kenara yapıştırır. */
  const placeEdge = () => {
    if (!current) {
      if (edge) edge.style.display = 'none'
      return
    }
    const container = map.getContainer()
    const w = container.clientWidth
    const h = container.clientHeight
    const p = map.project([current.lng, current.lat])
    const margin = 18
    const inside = p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h
    const el = ensureEdge()

    if (inside) {
      el.style.display = 'none'
      return
    }
    el.style.display = 'grid'

    // Ekran merkezinden konuma doğru bir ışın; kenarla kesiştiği yere oturur.
    const cx = w / 2
    const cy = h / 2
    const dx = p.x - cx
    const dy = p.y - cy
    const halfW = Math.max(cx - margin, 1)
    const halfH = Math.max(cy - margin, 1)
    const scale = Math.min(halfW / Math.abs(dx || 1e-6), halfH / Math.abs(dy || 1e-6))
    const x = cx + dx * scale
    const y = cy + dy * scale
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    // Ok konuma bakar (dönüş yalnız göstergede — konumu etkilemez).
    el.style.setProperty('--angle', `${(Math.atan2(dy, dx) * 180) / Math.PI + 90}deg`)
  }

  /*
   * ⚠️ `move` saniyede onlarca kez tetiklenir ve `placeEdge` her seferinde
   * `map.project` + dört ayrı stil yazımı yapıyordu. Kare başına tek geçişte
   * birleştirilir; aksi halde konum açıkken harita gezinmesi belirgin şekilde
   * ağırlaşıyordu (3 Ağu 2026 kasma düzeltmesi).
   */
  let frame = 0
  const onMove = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      placeEdge()
    })
  }
  map.on('move', onMove)
  map.on('zoom', onMove)
  map.on('resize', onMove)

  return {
    update(position, avatarUrl, label) {
      current = position
      if (!position) {
        marker?.remove()
        marker = null
        inner = null
        if (edge) edge.style.display = 'none'
        return
      }
      const m = ensureMarker()
      m.setLngLat([position.lng, position.lat])
      if (inner) {
        if (avatarUrl) {
          inner.style.backgroundImage = `url("${avatarUrl}")`
          inner.textContent = ''
        } else {
          inner.style.backgroundImage = ''
          inner.textContent = label.charAt(0).toUpperCase()
        }
        inner.title = label
      }
      placeEdge()
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      map.off('move', onMove)
      map.off('zoom', onMove)
      map.off('resize', onMove)
      marker?.remove()
      marker = null
      edge?.remove()
      edge = null
    },
  }
}
