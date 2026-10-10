import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { TranslationKey } from '@/i18n'

export interface DashNavItem {
  to: string
  end?: boolean
  icon: LucideIcon
  /** Çeviri anahtarı — hazır metin değil (bkz. app/userNav.ts). */
  labelKey: TranslationKey
}

interface DashShellProps {
  navItems: DashNavItem[]
  children: ReactNode
  /** @deprecated Yeni kabukta bölüm seçici tek biçimdir; bu bayrak yok sayılır. */
  mobileNav?: boolean
}

/**
 * Panel bölümleri — <b>`home.html` referansının sekme şeridi</b>.
 *
 * 🔴 <b>Eskiden kendi kabuğuydu</b> (264px beyaz sidebar + iri başlıklı üst
 * bar). Yeni kabukta (`AppShell`) sol sidebar ve üst bar zaten var; bu bileşen
 * onların içine girince <b>çift kabuk</b> oluşuyordu. Artık yalnız <b>bölüm
 * şeridi</b> çiziyor.
 *
 * Referansın sekme dili (DOM dökümünden):
 * ```
 * tabList: flex p-1 h-fit gap-2 items-center flex-nowrap overflow-x-scroll
 *          scrollbar-hide bg-transparent rounded-medium
 * tab    : w-full px-3 py-1 h-8 text-small rounded-small
 * içerik : <span class="uppercase"> + ikon
 * seçili : text-default-foreground · diğerleri text-default-500
 * ```
 * Şerit ortalanır ve dar ekranda yatayda kayar (çubuğu gizli) — mobilde ayrı
 * bir "alt sayfa seçici" gerekmez; referansta da tek desen vardır.
 */
export function DashShell({ children }: DashShellProps) {
  /*
   * 🔴 9 Ağu 2026 — SEKME ŞERİDİ KALDIRILDI (kullanıcı isteği:
   * "ayarlar kısmında üstteki sağa sola kaymayı kapat, hepsini profilime
   * taşıyacağız").
   *
   * Şerit `overflow-x-scroll` ile yatayda kayıyordu: altı bölüm dar ekrana
   * sığmadığı için kullanıcı her panel sayfasında yanlamasına kaydırmak
   * zorunda kalıyor, üstelik hangi bölümlerin var olduğunu göremiyordu.
   * Aynı bağlantılar artık `/me` profilinde dikey hap düğmeler olarak duruyor
   * — hepsi tek bakışta görünür ve kaydırma gerekmez.
   *
   * ⚠️ `navItems` prop'u BİLİNÇLİ olarak duruyor: on bir sayfa onu geçiyor ve
   * hepsinden tek tek sökmek bu turun konusu değil. Kabuk artık yalnız
   * içeriği ortalar.
   */
  return (
    <div className="flex w-full flex-col items-center">
      {/* ⚠️ `min-w-0`: içinde `overflow-x-auto` tablo/şerit olan kartlar
          bu kap olmadan içerikleri kadar büyüyüp sayfayı taşırıyordu. */}
      <div className="w-full min-w-0 max-w-screen-xl py-3">{children}</div>
    </div>
  )
}
