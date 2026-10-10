import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  /** Kullanıcının elle seçtiği harita stili; null → varsayılan taban. */
  mapStyle: string | null
  /**
   * Harita stili Ayarlar'dan **elle** seçildi mi (25 Ağu 2026).
   * ⚠️ Eski varsayılan izlerini (`light`/`streets`) gerçek bir tercihten
   * ayırmak için var — gerekçe `resolveInitialMapStyle`.
   */
  mapStyleChosen?: boolean
  /**
   * Kullanıcı temayı ELLE seçti mi?
   *
   * ⚠️ Bu bayrak olmadan sistem tercihi takip edilemez: store `persist` ile
   * yazıldığı için ilk açılışta çözülen mod anında localStorage'a düşüyor ve
   * "kayıtlı tercih" gibi görünüyordu. Sonuç: ziyaretçi tarayıcısını koyuya
   * alsa bile vitrin açık temada kalıyordu. false olduğu sürece işletim
   * sisteminin tercihi **canlı** izlenir.
   */
  explicit: boolean
  toggle: () => void
  setMode: (mode: ThemeMode) => void
  setMapStyle: (style: string | null) => void
  /** Sistem tercihi değişince çağrılır — elle seçim varsa yok sayar. */
  syncSystem: (mode: ThemeMode) => void
  /**
   * Bulunulan alanın varsayılan temasını uygular — <b>elle seçim yoksa</b>.
   * `app` → koyu (uygulamanın içi), `site` → sistem tercihi (tanıtım/vitrin).
   */
  applyAreaDefault: (area: 'app' | 'site') => void
}

/** Seçilen tema `<html data-theme>` üzerine yazılır; CSS değişkenleri oradan çözülür. */
function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
  // Tarayıcı kendi kontrollerini (kaydırma çubuğu, form öğeleri) da doğru boyasın.
  document.documentElement.style.colorScheme = mode
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Kayıtlı tercih yoksa sistem tercihi başlangıç değeridir; aksi halde
      // DOM koyu açılırken store "light" kalır ve ilk tıklama etkisiz görünür.
      mode: resolveInitialMode(),
      mapStyle: resolveInitialMapStyle(),
      mapStyleChosen: readStored()?.mapStyleChosen === true,
      explicit: resolveExplicit(),
      toggle: () => {
        const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ mode: next, explicit: true })
      },
      setMode: (mode) => {
        applyTheme(mode)
        set({ mode, explicit: true })
      },
      /* ⚠️ `mapStyleChosen` ile birlikte yazılır: bu bayrak olmadan kullanıcı
         Ayarlar'dan bilerek "Açık" seçse bile bir sonraki açılışta eski
         varsayılan izi sanılıp silinirdi (gerekçe `resolveInitialMapStyle`). */
      setMapStyle: (mapStyle) => set({ mapStyle, mapStyleChosen: true }),
      syncSystem: (mode) => {
        if (get().explicit || get().mode === mode) return
        applyTheme(mode)
        set({ mode })
      },
      /*
       * 🔴 9 Ağu 2026 — UYGULAMANIN İÇİ VARSAYILAN OLARAK KOYU (kullanıcı
       * isteği: "ilk açılışta dark mod açılacak, site değil uygulama içerisi").
       *
       * ⚠️ Karar **alana** göredir, global değil: tanıtım sayfası, vitrin
       * profili ve giriş ekranları (`site`) sistem tercihini izlemeye devam
       * eder — oralar ürünün dış yüzü ve açık temada tasarlandı.
       * ⚠️ `explicit` varsa hiçbir şey yapılmaz: kullanıcı bir kez tema düğmesine
       * bastıysa tercihi her alanda geçerlidir; alan değiştirmek onu ezerse
       * düğme "çalışmıyor" gibi görünürdü.
       */
      applyAreaDefault: (area) => {
        if (get().explicit) return
        const next: ThemeMode = area === 'app' ? 'dark' : preferredMode()
        if (get().mode === next) return
        applyTheme(next)
        set({ mode: next })
      },
    }),
    {
      name: 'waydee-theme',
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.mode ?? preferredMode())
      },
    },
  ),
)

function preferredMode(): ThemeMode {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStored(): {
  mode?: ThemeMode
  mapStyle?: string
  explicit?: boolean
  /** Harita stili Ayarlar'dan ELLE seçildi mi — eski varsayılan izinden ayırır. */
  mapStyleChosen?: boolean
} | null {
  try {
    const stored = localStorage.getItem('waydee-theme')
    return stored ? (JSON.parse(stored)?.state ?? null) : null
  } catch {
    return null
  }
}

/**
 * Kayıtlı **elle** tercih → sistem tercihi sırasıyla başlangıç modunu çözer.
 * Elle seçim yoksa kayıtlı değer yok sayılır; sistem ne diyorsa o.
 */
function resolveInitialMode(): ThemeMode {
  const state = readStored()
  if (state?.explicit && state.mode) return state.mode
  return preferredMode()
}

function resolveExplicit(): boolean {
  return readStored()?.explicit === true
}

/**
 * Kayıtlı harita stili tercihi (yoksa null → varsayılan taban).
 *
 * <h3>🔴 25 Ağu 2026 — ESKİ VARSAYILANLAR TERCİH SAYILMAZ</h3>
 * <p>Bildirilen fark: *"mobilde yeşilimsi bir katman var, PC'de beyazlığın
 * hâkim olduğu bir harita"*. Kodda cihaz ayrımı **yoktu**; fark
 * <b>localStorage</b>'daydı. `mapStyle` tarayıcı başına saklanıyor ve PC'nin
 * kaydında eski varsayılan (`light` / `streets`) duruyordu; telefonda hiç
 * kayıt olmadığı için bugünkü taban (`navigation-day-v1` — parklar yeşil,
 * sokaklar okunur) açılıyordu. `light-v11` ise gerçekten "beyazlığın hâkim
 * olduğu" haritadır.
 *
 * <p>Bu değerler bir <b>tercih değil</b>, o gün varsayılan oldukları için
 * yazılmış izlerdir — 95. turdaki *"kayıtlı `pitch: 0` varsayılana bırakılır"*
 * kararının birebir aynısı. Bu yüzden bir kez **temizlenirler**.
 *
 * <p>⚠️ `dark` ve `satellite` <b>korunur</b>: onlar hiçbir zaman varsayılan
 * olmadı, yazıldılarsa kullanıcı bilerek seçmiştir.
 *
 * <p>⚠️ Temizlik yalnız okuma anında yapılır; kullanıcı Ayarlar'dan yeniden
 * `light` seçerse o tercih yaşar — bir sonraki açılışta yine silinmesin diye
 * `mapStyleChosen` bayrağı yazılır.
 */
function resolveInitialMapStyle(): string | null {
  const state = readStored()
  const saved = state?.mapStyle ?? null
  if (!saved) return null
  /* ⚠️ 25 Ağu 2026 (2. tur): `streets` artık BUGÜNKÜ varsayılan. Listede
     kalmasının sebebi, o değerin geçmişte de varsayılan olması — sonuç iki
     durumda da aynı taban olduğu için zararsız, ama kural açık kalsın. */
  const legacyDefault = saved === 'light' || saved === 'streets'
  if (legacyDefault && state?.mapStyleChosen !== true) return null
  return saved
}

/** Uygulama açılışında, React ağacı kurulmadan doğru temayı uygular (flash önleme). */
export function initTheme() {
  applyTheme(resolveInitialMode())

  // Elle seçim yapılmadıysa işletim sistemi teması CANLI takip edilir:
  // kullanıcı sistemini koyuya alınca sayfa yenilenmeden döner.
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  mq?.addEventListener?.('change', (e) => {
    useThemeStore.getState().syncSystem(e.matches ? 'dark' : 'light')
  })

  // ⚠️ `matchMedia()` HER çağrıda yeni bir nesne döndürür; testte yeni bir
  // nesneye `dispatchEvent` yapmak buradaki dinleyiciye ULAŞMAZ. Doğrulama
  // yapabilmek için dinlenen nesnenin kendisi DEV'de dışa açılır.
  if (import.meta.env.DEV && mq) {
    ;(window as unknown as { __waydeeThemeMq?: MediaQueryList }).__waydeeThemeMq = mq
  }
}
