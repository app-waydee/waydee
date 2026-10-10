import type * as mapboxgl from 'mapbox-gl'

/**
 * <b>Harita katman denetçisi — YALNIZ GELİŞTİRMEDE.</b>
 *
 * <h3>🔴 Neden var</h3>
 * <p>24 Ağu 2026: kullanıcı haritada bir mağazanın solunda <b>siyah bir çizgi</b>
 * bildirdi. Çizginin hangi katmandan geldiği <b>koda bakarak bulunamadı</b> —
 * eleme yapıldı (DOM değil, ad levhası değil, poligon geometrisi temiz, mağaza
 * katmanlarının hiçbiri {@code line} tipinde değil) ama kaynak çıkmadı.
 *
 * <p>Bir harita hatasında <b>tek güvenilir kanıt render'ın kendisidir</b>:
 * Mapbox'ta bir pikselin hangi katmandan geldiğini yalnız
 * {@code queryRenderedFeatures} söyler. Bu araç o soruyu tek harekete indirir.
 *
 * <h3>Kullanım</h3>
 * <p><b>Alt tuşunu basılı tutup</b> şüpheli pikselin üstüne gel. Konsola o
 * noktadaki katmanlar yazılır (en üstteki ilk sırada):
 * <pre>[waydee] 620,540 → road-rail (line) · territories-line (line)</pre>
 *
 * <p>Ayrıca harita nesnesi {@code window.__waydeeMap} olarak açılır; konsoldan
 * {@code __waydeeMap.setLayoutProperty('şüpheli-katman','visibility','none')}
 * ile bir katmanı söndürüp çizginin kaybolup kaybolmadığı denenebilir.
 *
 * <h3>⚠️ Üretimde HİÇ çalışmaz</h3>
 * <p>Çağıran taraf {@code import.meta.env.DEV} ile kapılıyor. Bir hata ayıklama
 * aracının üretimde dinleyici bağlaması, ölçülmemiş bir maliyeti her kullanıcıya
 * ödetmek olurdu.
 *
 * @returns dinleyicileri kaldıran fonksiyon.
 */
export function attachMapInspector(map: mapboxgl.Map): () => void {
  const canvas = map.getCanvas()
  ;(window as unknown as { __waydeeMap?: mapboxgl.Map }).__waydeeMap = map

  let last = ''

  const onMove = (event: MouseEvent) => {
    if (!event.altKey) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    /* ⚠️ Nokta değil KUTU sorgulanır: 1 px'lik bir çizgiyi tam üstünden
       yakalamak neredeyse imkânsızdır; ±4 px tolerans onu bulur. */
    const features = map.queryRenderedFeatures([
      [x - 4, y - 4],
      [x + 4, y + 4],
    ])
    /* ⚠️ `f.layer` tipte OPSİYONEL: Mapbox bazı sorgu sonuçlarında katman
       nesnesini vermez. Çökmek yerine "?" yazmak, denetçinin tam da hata
       arandığı anda patlamasını önler. */
    const layers = [
      ...new Set(features.map((f) => `${f.layer?.id ?? '?'} (${f.layer?.type ?? '?'})`)),
    ]
    const line = layers.join(' · ') || '(katman yok)'
    /* Aynı satırı üst üste basmamak için: fare hareket ederken saniyede
       onlarca olay gelir ve konsol okunamaz hâle gelirdi. */
    if (line === last) return
    last = line
    // eslint-disable-next-line no-console
    console.log(`[waydee] ${Math.round(x)},${Math.round(y)} → ${line}`)
  }

  canvas.addEventListener('mousemove', onMove)
  // eslint-disable-next-line no-console
  console.log(
    '[waydee] Harita denetçisi açık. ALT tuşunu basılı tutup şüpheli piksele gel. ' +
      'Harita: window.__waydeeMap',
  )
  return () => canvas.removeEventListener('mousemove', onMove)
}
