import { Home, LineChart, Map as MapIcon, Sparkles, Telescope, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { TranslationKey } from '@/i18n'

export interface PrimaryNavItem {
  to: string
  icon: LucideIcon
  /**
   * Etiketin ÇEVİRİ ANAHTARI — hazır metin değil.
   *
   * ⚠️ Buraya doğrudan Türkçe yazmak, modül sabiti olduğu için dili değiştiren
   * kullanıcıda etiketleri Türkçe bırakırdı; çeviri bileşende çözülür.
   */
  labelKey: TranslationKey
  /**
   * 🔴 8 Ağu 2026: `chatBadge` KALDIRILDI — mesajlaşma kapatıldı ve rozet
   * zaten hiçbir öğede `true` değildi (ölü alan, okunmamış sayısını çeken
   * bir sorguyu boşuna canlı tutuyordu).
   */
  /** Profil sekmesi ikon yerine kullanıcının avatarını gösterir. */
  avatar?: boolean
  /**
   * <b>Yapay zekâ sekmesi</b> — ikon degradeli çizilir (V45).
   *
   * <p>⚠️ Bayrak gerekiyor çünkü bu öğe diğerlerinden <b>bilerek</b> ayrışıyor:
   * yeni bir yetenek ve fark edilmesi gerekiyor. Ayrımı `PRIMARY_NAV`'a bir
   * renk yazarak yapmak, gezinme yapısını bir görünüm ayrıntısıyla kirletirdi;
   * kabuk bayrağı görüp kendi sınıfını uyguluyor.
   */
  glow?: boolean
}

/**
 * Birincil gezinme (tek kaynak): Ana sayfa · Harita · Sohbet · Keşfet · Profil.
 * Alt çubukta (mobil + masaüstü dock) aynı sırayla görünür.
 * İkincil sayfalar (Raporlar, Bildirimler, Ayarlar) hamburger menüdedir.
 */
/**
 * Sol sidebar (tek kaynak) — <b>referansın düzeni</b>.
 *
 * ⚠️ Referansta liste <b>beş öğedir ve ORTADAKİ "create" popup tetikleyicisidir</b>
 * (bağlantı değil). Burada da öyle: bu dizi <b>dört</b> gezinme öğesi taşır ve
 * kabuk ikisinin arasına <b>+ düğmesini</b> koyar → + tam ortada kalır.
 *
 * ⚠️ Sohbet ve Keşfet 8 Ağu 2026'da <b>tamamen kapatıldı</b> (arayüz + backend);
 * bu dizi zaten dört öğe olduğu için + düğmesi merkezde kaldı.
 */
export const PRIMARY_NAV: PrimaryNavItem[] = [
  { to: '/home', icon: Home, labelKey: 'nav.home' },
  { to: '/map', icon: MapIcon, labelKey: 'nav.map' },
  { to: '/analytics', icon: LineChart, labelKey: 'nav.analytics' },
  /*
   * 🔴 16 Ağu 2026 (90. tur, kullanıcı düzeltmesi) — YAPAY ZEKÂ ÜST ÇUBUKTAN
   * BURAYA TAŞINDI: <i>"ai butonunu profilin sol tarafına taşı, o navbara
   * taşıyacaksın."</i>
   *
   * <p>⚠️ Yeri <b>profilin hemen öncesi</b> ve bu, listedeki tek serbest
   * noktadır: <b>+ düğmesi kabukta tam ortada</b> duruyor (iki öğe · + · iki
   * öğe). Sekmeyi başka bir yere koymak + düğmesini merkezden kaydırırdı.
   *
   * <p>⚠️ Üst çubuktaki eski düğme <b>kaldırıldı</b>, ikiye çıkarılmadı: aynı
   * hedefe iki giriş noktası, kullanıcıya "bunlar farklı şeyler mi?" dedirtir.
   */
  /*
   * 🔴 7 Eki 2026 (108. tur) — INFLUENCER KEŞFİ (kullanıcı: "navbara
   * ekleyeceğin kısım"). Yeri + düğmesinin SAĞI, yapay zekânın solu.
   *
   * <p>⚠️ Liste altıya çıktı ve kabuk + düğmesini üçüncü öğeden sonra koyuyor
   * (`slice(0, 3)`): artık <b>üç · + · üç</b>, yani + ilk kez gerçekten tam
   * merkezde (beş öğeyle 3 · + · 2 idi). Öğeyi + düğmesinin SOLUNA koymak
   * bölme noktasını değiştirmeyi gerektirirdi.
   */
  { to: '/creators', icon: Telescope, labelKey: 'nav.creators' },
  { to: '/ai', icon: Sparkles, labelKey: 'nav.ai', glow: true },
  { to: '/me', icon: User, labelKey: 'nav.profile', avatar: true },
]
