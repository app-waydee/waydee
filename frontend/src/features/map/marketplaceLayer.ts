import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl'
import type { FeatureCollection } from '@/types/api'
import type { MarketplaceAreaProperties, StallProperties } from '@/lib/marketplace'

export const MARKETPLACE_SOURCES = {
  areas: 'marketplace-areas',
  stalls: 'marketplace-stalls',
} as const

const EMPTY = { type: 'FeatureCollection', features: [] } as const

/**
 * Pazar yeri katmanları.
 *
 * <b>Kümeleme neden şart:</b> bir pazarda onlarca stant var ve hepsi aynı
 * poligonun içinde duruyor. Uzaklaşınca tek tek noktalar üst üste binip
 * okunmaz bir leke oluşturuyordu. Mapbox'ın yerel `cluster` desteğiyle
 * uzaktan tek bir "N stant" rozeti görünür, yaklaşınca stantlar ayrışır —
 * bölge avatarlarındaki desenin aynısı.
 *
 * ⚠️ `setStyle` (tema değişimi) TÜM kaynak ve katmanları siler. Bu fonksiyon
 * her `style.load`'da yeniden çağrılmalıdır (bkz. `addSourcesAndLayers`).
 */
export function addMarketplaceLayers(map: MapboxMap) {
  if (!map.getSource(MARKETPLACE_SOURCES.areas)) {
    map.addSource(MARKETPLACE_SOURCES.areas, { type: 'geojson', data: EMPTY as never })
  }
  if (!map.getSource(MARKETPLACE_SOURCES.stalls)) {
    map.addSource(MARKETPLACE_SOURCES.stalls, {
      type: 'geojson',
      data: EMPTY as never,
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 15,
    })
  }

  // ---- pazar alanı (poligon): dolgu + kesikli kenar + ad
  if (!map.getLayer('marketplace-fill')) {
    map.addLayer({
      id: 'marketplace-fill',
      type: 'fill',
      source: MARKETPLACE_SOURCES.areas,
      paint: {
        /* ⚠️ `coalesce` şart: alan boşsa Mapbox boya VARSAYILANINA düşer ve
           `fill-color` varsayılanı SİYAH'tır — haritada sebebi görünmeyen siyah
           bir leke/çizgi üretir (bkz. vault 12, 96. tur). */
        'fill-color': ['coalesce', ['get', 'accentColor'], '#8e59ff'],
        // Kapalı pazarlar soluk: haritada "burası artık başvuru almıyor" okunur.
        'fill-opacity': ['case', ['get', 'accepting'], 0.14, 0.07],
      },
    })
  }
  if (!map.getLayer('marketplace-line')) {
    map.addLayer({
      id: 'marketplace-line',
      type: 'line',
      source: MARKETPLACE_SOURCES.areas,
      /* ⚠️ `round` birleşim/uç ŞART (104. tur): pazar alanları artık
         yumuşatılmış halkalar ve keskin birleşim her eğri noktasında minik bir
         çentik bırakıyor — uzaktan tırtıklı bir kenar olarak okunuyordu. */
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'accentColor'], '#8e59ff'],
        'line-width': 2,
        'line-opacity': 0.85,
        'line-dasharray': [2, 1.4],
      },
    })
  }
  /*
   * 🔴 105. tur — `marketplace-label` KATMANI KALDIRILDI.
   *
   * Pazarın adı artık alanın ortasındaki HTML rozetinde yazıyor
   * ({@link ../map/marketplaceBadges}). İkisi birden açıkken ad haritada
   * **iki kez** görünüyordu: biri rozetin içinde, biri onun hemen altında
   * Mapbox'ın kendi etiketiyle.
   *
   * ⚠️ Görünürlük listesinden de çıkarıldı; olmayan bir katmanda
   * `setLayoutProperty` çağırmak Mapbox'ta hata fırlatır.
   */

  // ---- stant kümeleri
  if (!map.getLayer('stall-cluster')) {
    map.addLayer({
      id: 'stall-cluster',
      type: 'circle',
      source: MARKETPLACE_SOURCES.stalls,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#8e59ff',
        'circle-opacity': 0.92,
        // Küme büyüdükçe balon büyür.
        'circle-radius': ['step', ['get', 'point_count'], 16, 5, 21, 15, 27, 40, 34],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })
  }
  if (!map.getLayer('stall-cluster-count')) {
    map.addLayer({
      id: 'stall-cluster-count',
      type: 'symbol',
      source: MARKETPLACE_SOURCES.stalls,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#ffffff' },
    })
  }

  // ---- tekil stantlar
  if (!map.getLayer('stall-point')) {
    map.addLayer({
      id: 'stall-point',
      type: 'circle',
      source: MARKETPLACE_SOURCES.stalls,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'accentColor'],
        // Öne çıkan stantlar biraz daha iri.
        'circle-radius': ['case', ['get', 'featured'], 9, 7],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    })
  }
  if (!map.getLayer('stall-label')) {
    map.addLayer({
      id: 'stall-label',
      type: 'symbol',
      source: MARKETPLACE_SOURCES.stalls,
      filter: ['!', ['has', 'point_count']],
      // Etiket yalnız yakınlaşınca; uzakta kalabalık yapıyordu.
      minzoom: 12,
      layout: {
        'text-field': ['get', 'title'],
        'text-size': 11,
        'text-offset': [0, 1.3],
        'text-anchor': 'top',
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': ['get', 'accentColor'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    })
  }
}

/** Veri bas — kaynaklar yoksa sessizce atlar (stil yüklenirken çağrılabilir). */
export function setMarketplaceData(
  map: MapboxMap,
  areas?: FeatureCollection<MarketplaceAreaProperties>,
  stalls?: FeatureCollection<StallProperties>,
) {
  if (areas) {
    ;(map.getSource(MARKETPLACE_SOURCES.areas) as GeoJSONSource | undefined)?.setData(areas as never)
  }
  if (stalls) {
    ;(map.getSource(MARKETPLACE_SOURCES.stalls) as GeoJSONSource | undefined)?.setData(stalls as never)
  }
}

/** Katman görünürlüğü — kullanıcı pazar katmanını kapatabilir. */
export function setMarketplaceVisible(map: MapboxMap, visible: boolean) {
  const value = visible ? 'visible' : 'none'
  for (const id of [
    'marketplace-fill',
    'marketplace-line',
    'stall-cluster',
    'stall-cluster-count',
    'stall-point',
    'stall-label',
  ]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', value)
    }
  }
}

/**
 * Kümeye tıklayınca içine yakınlaş; tekil stanta tıklayınca kartı aç.
 * Dönen fonksiyon dinleyicileri söker.
 */
export function attachMarketplaceInteractions(
  map: MapboxMap,
  onStall: (stall: StallProperties) => void,
  onArea: (area: MarketplaceAreaProperties) => void,
): () => void {
  const onClusterClick = (e: MapMouseEvent) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['stall-cluster'] })
    const clusterId = features[0]?.properties?.cluster_id
    if (clusterId == null) return
    const source = map.getSource(MARKETPLACE_SOURCES.stalls) as GeoJSONSource
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || zoom == null) return
      map.easeTo({
        center: (features[0].geometry as unknown as { coordinates: [number, number] }).coordinates,
        zoom,
        duration: 600,
      })
    })
  }
  const onStallClick = (e: MapMouseEvent) => {
    const f = e.features?.[0]
    if (f) onStall(f.properties as unknown as StallProperties)
  }
  const onAreaClick = (e: MapMouseEvent) => {
    // Stant tıklaması alanın da altına düşmesin — üstteki katman kazanır.
    const stalls = map.queryRenderedFeatures(e.point, { layers: ['stall-point', 'stall-cluster'] })
    if (stalls.length) return
    const f = e.features?.[0]
    if (f) onArea(f.properties as unknown as MarketplaceAreaProperties)
  }
  const pointer = () => {
    map.getCanvas().style.cursor = 'pointer'
  }
  const reset = () => {
    map.getCanvas().style.cursor = ''
  }

  map.on('click', 'stall-cluster', onClusterClick)
  map.on('click', 'stall-point', onStallClick)
  map.on('click', 'marketplace-fill', onAreaClick)
  for (const id of ['stall-cluster', 'stall-point', 'marketplace-fill']) {
    map.on('mouseenter', id, pointer)
    map.on('mouseleave', id, reset)
  }

  return () => {
    map.off('click', 'stall-cluster', onClusterClick)
    map.off('click', 'stall-point', onStallClick)
    map.off('click', 'marketplace-fill', onAreaClick)
    for (const id of ['stall-cluster', 'stall-point', 'marketplace-fill']) {
      map.off('mouseenter', id, pointer)
      map.off('mouseleave', id, reset)
    }
  }
}
