import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useQuery } from '@tanstack/react-query'
import { Check, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import type { TerritoryResponse } from '@/types/api'
import { createCameraMemory } from './mapCamera'
import { MapScrim } from './MapScrim'

/* Anahtar `lib/clientConfig.ts` tarafından çalışma zamanında atanır. */

const DEFAULT_VIEW = { center: [32.5, 39.0] as [number, number], zoom: 3.6 }

/** Seçici kapanıp yeniden açılınca en son bakılan yerden devam eder. */
const camera = createCameraMemory('waydee-picker-map-view')

interface Picked {
  lng: number
  lat: number
  label: string
}

interface MapLocationPickerProps {
  onPick: (label: string) => void
  onClose: () => void
}

/** Etkinlik konumu seçici: kendi bölgelerinden birini (efektli uçuşla) ya da haritada
 *  herhangi bir noktayı (koordinat) seçtirir. Seçim, etkinlik konum metnini doldurur. */
export function MapLocationPicker({ onPick, onClose }: MapLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [picked, setPicked] = useState<Picked | null>(null)

  const territoriesQuery = useQuery({
    queryKey: ['my-territories'],
    queryFn: async () => (await api.get<TerritoryResponse[]>('/territories/my')).data,
  })
  const territories = territoriesQuery.data ?? []

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      ...camera.initialView(DEFAULT_VIEW),
    })
    mapRef.current = map
    if (import.meta.env.DEV) {
      ;(window as unknown as { __waydeePickerMap?: mapboxgl.Map }).__waydeePickerMap = map
    }
    map.on('click', (e) => {
      select(e.lngLat.lng, e.lngLat.lat, `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`, false)
    })
    const detachCamera = camera.attach(map)
    const t = window.setTimeout(() => map.resize(), 150)
    return () => {
      window.clearTimeout(t)
      detachCamera()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function select(lng: number, lat: number, label: string, fly: boolean) {
    const map = mapRef.current
    if (!map) return
    setPicked({ lng, lat, label })
    if (!markerRef.current) markerRef.current = new mapboxgl.Marker({ color: '#2a85ff' })
    markerRef.current.setLngLat([lng, lat]).addTo(map)
    if (fly) map.flyTo({ center: [lng, lat], zoom: 11, duration: 1400, essential: true })
  }

  return (
    <Dialog open onClose={onClose} title="Etkinlik konumu seç">
      <div className="space-y-3">
        <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-subtle">
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
          <MapScrim size="sm" />
        </div>

        {territories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {territories.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => select(t.lng, t.lat, t.name, true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
              >
                <MapPin className="h-3.5 w-3.5" /> {t.name}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs font-medium text-faint">Bölgelerinden birini seç ya da haritaya tıklayarak nokta bırak.</p>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="min-w-0 truncate text-sm font-semibold">{picked ? picked.label : 'Konum seçilmedi'}</span>
          <Button
            disabled={!picked}
            onClick={() => {
              if (picked) {
                onPick(picked.label)
                onClose()
              }
            }}
          >
            <Check className="h-4 w-4" /> Seç
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
