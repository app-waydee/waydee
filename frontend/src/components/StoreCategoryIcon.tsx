import {
  AirplaneTilt, Baby, Barbell, BookOpen, Briefcase, Camera, Car, ChartLineUp, Coffee,
  Confetti, DeviceMobile, Dog, DotsThreeCircle, FilmSlate, Flower, ForkKnife,
  GameController, GraduationCap, HandHeart, Heartbeat, House, Leaf, MapPin, MusicNotes,
  PaintBrush, Palette, PawPrint, Scissors, ShoppingBag, SoccerBall, Sparkle, Storefront,
  Stethoscope, TShirt, Wine, Wrench,
  type Icon,
} from '@phosphor-icons/react'

/**
 * <b>Kategori ikonu</b> (V52).
 *
 * <h3>🔴 Neden BEYAZ LİSTE, dinamik import değil</h3>
 * <p>İkon adı veritabanından gelen serbest bir metindir ve yönetici oraya
 * ne isterse yazabilir. Adı doğrudan bir modül yoluna çevirmek
 * (<code>import(`.../${icon}`)</code>) iki şeyi birden bozardı: paketleyici
 * hangi ikonların gerektiğini <b>derleme anında bilemez</b> — ya 9.000 ikonun
 * tamamı pakete girer ya da hiçbiri; ve veritabanındaki bir yazım hatası
 * <b>çalışma anında</b> patlayan bir istek olurdu.
 *
 * <p>Burada ad yalnız bir <b>anahtardır</b>: listede varsa o ikon, yoksa
 * {@link Storefront} çizilir. Yönetici yanlış bir ad yazarsa şerit bozulmaz,
 * yalnız genel bir dükkân ikonu görünür.
 *
 * <p>⚠️ Yeni bir ikon eklemek <b>iki adımdır</b>: buraya import + haritaya
 * satır. Yalnız veritabanına yazmak yetmez ve bu bilinçli bir maliyettir —
 * alternatifi yukarıdaki paket şişmesiydi.
 */
const ICONS: Record<string, Icon> = {
  /* 🔴 25 Ağu 2026 — V56'nın dört yeni kategorisi için `ChartLineUp`
     (Borsa), `GameController` (Oyun), `GraduationCap` (Eğitim) ve
     `Heartbeat` (Sağlık) gerekiyor. İlki listede YOKTU: beyaz listede
     olmayan ad sessizce `Storefront`a düşer, yani şerit bozulmaz ama
     kategori genel bir dükkân ikonuyla çizilirdi. `Palette` ve
     `Stethoscope` yöneticinin seçebileceği alternatifler olarak eklendi. */
  AirplaneTilt, Baby, Barbell, BookOpen, Briefcase, Camera, Car, ChartLineUp, Coffee,
  Confetti, DeviceMobile, Dog, DotsThreeCircle, FilmSlate, Flower, ForkKnife,
  GameController, GraduationCap, HandHeart, Heartbeat, House, Leaf, MapPin, MusicNotes,
  PaintBrush, Palette, PawPrint, Scissors, ShoppingBag, SoccerBall, Sparkle, Storefront,
  Stethoscope, TShirt, Wine, Wrench,
}

/** Yöneticinin seçim listesine çizeceği adlar — {@link ICONS} ile tek kaynak. */
export const STORE_CATEGORY_ICON_NAMES = Object.keys(ICONS).sort()

interface Props {
  /** Veritabanındaki ikon adı. Beyaz listede yoksa yedek çizilir. */
  name: string | null | undefined
  className?: string
  /**
   * Phosphor kalınlığı. Şeritte <b>duotone</b> kullanılır: ekran görüntüsündeki
   * çipler tek renkli düz ikonlardan daha yumuşak duruyor ve renk taşıyor.
   */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
  color?: string
}

export function StoreCategoryIcon({ name, className, weight = 'duotone', color }: Props) {
  const Component = (name && ICONS[name]) || Storefront
  return <Component className={className} weight={weight} color={color} />
}
