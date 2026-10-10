import type { Map as MapboxMap } from 'mapbox-gl'

/**
 * Harita kamerası kalıcılığı — "kaldığım yerden devam et".
 *
 * Başka bir sayfaya gidip haritaya dönünce harita sıfırlanıp dünyaya
 * uzaklaşmamalı; en son bakılan merkez/zoom/bearing/pitch geri gelmeli.
 *
 * İki katmanlı hafıza:
 * - **Modül değişkeni** → aynı oturumda yeniden mount'ta anında (storage kapalı olsa da).
 * - **sessionStorage** → tam sayfa yenilemesinde de korunur; sekme kapanınca unutulur
 *   (kalıcı `localStorage` istenmedi: yeni oturum temiz bir başlangıçtır).
 *
 * Her harita yüzeyi kendi anahtarını alır (`createCameraMemory('...')` modül
 * seviyesinde bir kez çağrılır), böylece vitrin haritası ile yönetim haritası
 * birbirinin kamerasını ezmez.
 */

export interface SavedView {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

/** Harita yaratılırken verilecek başlangıç kamerası. */
export interface CameraDefaults {
  center: [number, number]
  zoom: number
  bearing?: number
  pitch?: number
}

export interface CameraMemory {
  /** Kayıtlı kamera + verilen varsayılan → `new MapboxMap({...})`'e yayılabilir. */
  initialView(defaults: CameraDefaults): SavedView
  /**
   * Kullanıcının <b>kendi</b> bıraktığı bir kamera var mı?
   *
   * 🔴 10 Ağu 2026'da eklendi: harita ilk açılışta mağaza yoğunluğuna uçuyor
   * (bkz. `densestCluster`), ama bunu <b>yalnız hafıza boşken</b> yapmalı.
   * Aksi halde başka bir sayfaya gidip haritaya dönen kullanıcı, baktığı
   * yerden koparılıp her seferinde aynı kalabalığa fırlatılırdı — bu
   * modülün var oluş sebebinin tam tersi.
   */
  hasSavedView(): boolean
  /** Kamerayı hemen yaz (örn. haritayı elle kapatırken). */
  save(map: MapboxMap): void
  /**
   * `moveend`'i dinlemeye başlar. Dönen fonksiyon effect cleanup'ında çağrılır:
   * son kamerayı yazar ve dinleyiciyi bırakır (harita `remove()` edilmeden önce).
   */
  attach(map: MapboxMap): () => void
}

export function createCameraMemory(storageKey: string): CameraMemory {
  let memory: SavedView | null = null

  function read(): SavedView | null {
    if (memory) return memory
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<SavedView>
      const center = parsed.center
      if (!Array.isArray(center) || center.length !== 2) return null
      if (!Number.isFinite(center[0]) || !Number.isFinite(center[1]) || !Number.isFinite(parsed.zoom)) {
        return null
      }
      memory = {
        center: [Number(center[0]), Number(center[1])],
        zoom: Number(parsed.zoom),
        bearing: Number(parsed.bearing ?? 0),
        pitch: Number(parsed.pitch ?? 0),
      }
      return memory
    } catch {
      return null
    }
  }

  function save(map: MapboxMap) {
    const center = map.getCenter()
    // Harita kaldırılırken bozuk değer okunabilir; geçersizse eski hafızayı koru.
    if (!Number.isFinite(center.lng) || !Number.isFinite(center.lat)) return
    memory = {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(memory))
    } catch {
      /* storage kapalı olabilir (gizli sekme) — bellek kopyası yine çalışır */
    }
  }

  return {
    initialView(defaults) {
      const saved = read()
      return {
        center: saved?.center ?? defaults.center,
        zoom: saved?.zoom ?? defaults.zoom,
        bearing: saved?.bearing ?? defaults.bearing ?? 0,
        /*
         * 🔴 18 Ağu 2026 — KAYITLI `pitch: 0` VARSAYILANA BIRAKILIR.
         *
         * Harita artık eğik açılıyor çünkü 3B mağaza ve 3B şehir yalnız eğimle
         * görünür. Ama bu makinede haritayı daha önce açmış HER kullanıcının
         * kayıtlı kamerası `pitch: 0` taşıyor (eski varsayılan) — kaydı olduğu
         * gibi geri yükleseydik, mevcut kullanıcıların hiçbiri yeni özelliği
         * göremez ve "bende çıkmıyor" derdi.
         *
         * `0` burada "kullanıcı düz istedi" değil, "hiç eğmemiş" demektir:
         * eski arayüzde eğim kontrolü yoktu, yani sıfır bir TERCİH DEĞİL,
         * eski varsayılanın izidir.
         *
         * ⚠️ Bedeli kabul edildi: haritayı bilerek düzleştiren kullanıcı da
         * bir kez eğik görür. Bir sonraki `moveend` kendi açısını yazar ve
         * tercih yeniden kalıcı olur — yani kayıp tek seferliktir.
         */
        pitch: saved?.pitch || defaults.pitch || 0,
      }
    },
    hasSavedView() {
      return read() !== null
    },
    save,
    attach(map) {
      const onMoveEnd = () => save(map)
      map.on('moveend', onMoveEnd)
      return () => {
        // Ayrılırken son kamerayı yaz: geri gelince aynı yerden devam edilir.
        save(map)
        map.off('moveend', onMoveEnd)
      }
    },
  }
}
