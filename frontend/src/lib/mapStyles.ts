/** Harita stilleri — tek kaynak (Ayarlar ekranı ve harita aynı listeyi kullanır). */
export const MAP_STYLES: Record<string, string> = {
  light: 'mapbox://styles/mapbox/light-v11',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
}

export const MAP_STYLE_LABELS: Record<string, string> = {
  light: 'Açık',
  streets: 'Sokak',
  satellite: 'Uydu',
  dark: 'Koyu',
}

export const MAP_STYLE_KEYS = Object.keys(MAP_STYLES)

/**
 * Kullanıcı bir tercih belirtmediyse haritanın açılacağı stil.
 *
 * ⚠️ **Sokak** bilinçli: Waydee'de daireler gerçek yerlerin üstüne çiziliyor —
 * kullanıcı "burası neresi?" sorusunu yol/mahalle adlarından cevaplıyor.
 * Sade (light/dark) taban güzel görünüyor ama yer adları silik olduğu için
 * insanlar nereye alan aldıklarını çıkaramıyordu.
 *
 * 🔴 Bu sabit artık yalnız **yedektir** ({@link themeMapStyle} çözemezse).
 * Varsayılan taban 10 Ağu 2026'da temayı izlemeye başladı — gerekçe aşağıda.
 */
export const DEFAULT_MAP_STYLE = 'streets'

/**
 * 🔴 **10 Ağustos 2026 — TEMAYI İZLEYEN TABAN.**
 *
 * Kullanıcı: *"koyu ve açık modda harita arka planı değişmiyor"*. Doğruydu ve
 * sebebi tek satırdı: hem oturumlu hem vitrin haritası tabanı **sabit**
 * `streets`e kilitliyordu. Vitrin sayfasındaki "tema değişti" etkisi
 * `setStyle`i **aynı stille** çağırıyordu, yani hiçbir şey olmuyordu.
 *
 * ⚠️ Çözüm `light-v11 / dark-v11` DEĞİL: o çift yol ve mahalle adlarını
 * silikleştiriyor ve tam olarak yukarıda anlatılan eski sorunu geri getirirdi.
 * `navigation-day-v1 / navigation-night-v1` **sokak ayrıntısını korur** ve
 * gerçek bir açık/koyu çifttir — iki gereksinim de karşılanır.
 *
 * ⚠️ Kullanıcının Ayarlar'dan **elle seçtiği** stil bunu her zaman ezer
 * (`mapStyle` null değilse buraya hiç düşülmez); "uydu" seçmiş birinin tabanı
 * tema düğmesiyle değişmemeli.
 */
export const THEME_MAP_STYLES: Record<'light' | 'dark', string> = {
  light: 'mapbox://styles/mapbox/navigation-day-v1',
  dark: 'mapbox://styles/mapbox/navigation-night-v1',
}

/**
 * 🔴 **15 Ağustos 2026 — TABAN ARTIK TEMAYI İZLEMİYOR, HEP AÇIK SOKAK HARİTASI.**
 *
 * Kullanıcı: *"hem loginsiz haritada hem uygulama içindeki haritada sokak
 * görünümü olan haritayı kullanacağız; arka plan dark olabilir ama harita
 * BEYAZ olan harita olacak"*.
 *
 * Yani karar bilinçli olarak **tema kararından ayrıldı**: uygulamanın kabuğu
 * koyu kalabilir, harita tuvali her zaman `navigation-day-v1` (beyaz zeminli,
 * sokak adları okunur) olur. `navigation-night-v1` artık **kullanılmıyor**;
 * sabit, elle stil seçen kullanıcı için `THEME_MAP_STYLES` içinde duruyor
 * ama otomatik çözümde hiç seçilmez.
 *
 * ⚠️ Değişiklik bilerek **tek noktada**: `PublicMapPage` (loginsiz vitrin) ve
 * `MapPage` (oturumlu harita) ikisi de bu fonksiyondan besleniyor. İki yüzeyde
 * ayrı ayrı yazılsaydı biri güncellenip diğeri unutulurdu — vault'taki
 * "harita davranışı = beş yüzey" tuzağının aynısı.
 */
/**
 * 🔴 **25 Ağustos 2026 (2. tur) — TABAN `streets-v12`.**
 *
 * Kullanıcı iki ekran görüntüsü gönderdi: telefonda küre **yeşil karalar,
 * canlı mavi okyanus**; PC'de **beyazlığın hâkim olduğu**, solgun bir küre.
 * *"Bu farkın sebebi nedir? PC'de de aynısı olsun."*
 *
 * Sebep: iki cihaz farklı taban yüklüyordu. `navigation-day-v1` bir
 * **navigasyon** stilidir — sokak zoom'unda mükemmel (yol adları okunur,
 * zemin beyaz) ama **küre zoom'unda karalar bej-beyaz** kalır, yani ürünün
 * ilk açılış ekranı olan dünya görünümü cansızdır. `streets-v12` sokak
 * ayrıntısını **aynı şekilde** taşır ve arazi örtüsünü (park, orman, tarım)
 * renklendirir — telefondaki görüntü budur.
 *
 * ⚠️ 81. turun kararı **korunuyor**: taban hâlâ **temadan bağımsız ve beyaz
 * zeminli bir sokak haritası**; değişen yalnız hangi beyaz sokak haritası
 * olduğu. `navigation-night-v1` yine otomatik seçilmez.
 *
 * ⚠️ Elle seçilen stil (Ayarlar) bunu her zaman ezer.
 */
export const DEFAULT_BASE_MAP_STYLE = MAP_STYLES.streets

/**
 * Haritanın açılacağı taban stil.
 *
 * @param saved kullanıcının Ayarlar'dan **elle** seçtiği stil (`null` → varsayılan)
 * @param _mode yürürlükteki tema — 🔴 **artık kullanılmıyor** (yukarıdaki nota bak).
 *              Parametre çağrı yerlerini bozmamak ve kararın bilinçli olduğunu
 *              göstermek için duruyor.
 * @returns doğrudan bir Mapbox stil adresi (MAP_STYLES anahtarı değil)
 */
export function themeMapStyle(
  saved: string | null | undefined,
  _mode: 'light' | 'dark',
): string {
  return isMapStyle(saved) ? MAP_STYLES[saved] : DEFAULT_BASE_MAP_STYLE
}

export function isMapStyle(value: string | null | undefined): value is string {
  return !!value && value in MAP_STYLES
}

/**
 * Bir taban stilin **koyu** olup olmadığı.
 *
 * 🔴 Sis (`applyFog`) ve fiyat bölgesi kaplaması (`applyZoneTheme`) eskiden
 * **uygulama temasına** bakıyordu. Taban artık temadan bağımsız olarak hep
 * beyaz olduğu için bu yanlış: koyu temada beyaz haritanın üstüne koyu sis ve
 * koyu bölge dolgusu basılır, harita okunmaz hâle gelirdi.
 *
 * Doğru ölçüt **haritanın kendisidir** — kullanıcı Ayarlar'dan `dark` ya da
 * `satellite` seçerse kaplama yine koyu olmalı.
 */
export function isDarkMapStyle(styleUrl: string): boolean {
  return (
    styleUrl === MAP_STYLES.dark ||
    styleUrl === MAP_STYLES.satellite ||
    styleUrl === THEME_MAP_STYLES.dark
  )
}
