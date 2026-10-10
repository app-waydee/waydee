import { AtSign, Facebook, Ghost, Github, Globe, Instagram, Link2, Linkedin, Mail, Music2, Send, Youtube } from 'lucide-react'
import type React from 'react'
import { safeHref } from '@/lib/safeHref'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SocialLinkView, SocialPlatform } from '@/types/api'

/**
 * Sosyal medya bağlantılarının tek görsel kaynağı — ikon, etiket, marka rengi
 * ve giriş alanı ipuçları burada tanımlanır. Hem kullanıcı profili hem bölge
 * (harita) profili aynı bileşeni kullanır; iki yerde farklı görünmesin diye.
 */

/** X'in resmî lucide ikonu yok — marka işareti inline SVG. */
function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export interface PlatformMeta {
  label: string
  Icon: LucideIcon | typeof XMark
  /** Marka rengi. */
  color: string
  /**
   * Koyu temadaki karşılığı (24 Ağu 2026).
   *
   * <p>🔴 Şart: X, TikTok, GitHub ve Threads'in marka rengi <b>neredeyse
   * siyahtır</b> (`#1a1d1f`, `#010101`). Koyu zeminde bunlar <b>görünmez</b>
   * olurdu — "ikonları renkli yapalım" isteği, bu dört ikonun kaybolması
   * pahasına karşılanamaz. Tanımlı değilse {@link color} kullanılır.
   */
  colorDark?: string
  /** Giriş alanı ipucu (kullanıcı adı ya da adres yazabilir). */
  placeholder: string
}

export const PLATFORMS: Record<SocialPlatform, PlatformMeta> = {
  WEBSITE: { label: 'Web sitesi', Icon: Globe, color: '#2a85ff', placeholder: 'site.com' },
  INSTAGRAM: { label: 'Instagram', Icon: Instagram, color: '#e1306c', placeholder: 'kullaniciadi' },
  X: { label: 'X', Icon: XMark, color: '#1a1d1f', colorDark: '#ffffff', placeholder: 'kullaniciadi' },
  FACEBOOK: { label: 'Facebook', Icon: Facebook, color: '#1877f2', placeholder: 'kullaniciadi' },
  YOUTUBE: { label: 'YouTube', Icon: Youtube, color: '#ff0000', placeholder: 'kanaladi' },
  TIKTOK: { label: 'TikTok', Icon: Music2, color: '#010101', colorDark: '#ffffff', placeholder: 'kullaniciadi' },
  SNAPCHAT: { label: 'Snapchat', Icon: Ghost, color: '#f7b500', placeholder: 'kullaniciadi' },
  LINKEDIN: { label: 'LinkedIn', Icon: Linkedin, color: '#0a66c2', placeholder: 'kullaniciadi' },
  TELEGRAM: { label: 'Telegram', Icon: Send, color: '#229ed9', placeholder: 'kullaniciadi' },
  GITHUB: { label: 'GitHub', Icon: Github, color: '#1a1d1f', colorDark: '#ffffff', placeholder: 'kullaniciadi' },
}

/**
 * <b>Gönderi</b> düzeyindeki ek platformlar.
 *
 * <p>🔴 9 Ağu 2026 — yaşanmış hata: gönderiye eklenen sosyal bağlantılar
 * düzenleme ekranında <b>platform adının ilk harfi</b> olarak çiziliyordu
 * (`waydee-social-chip`, görselin sağ altında tek harf). Kullanıcı bunu haklı
 * olarak "bozuk" diye bildirdi — çünkü profil başlığındaki aynı veri gerçek
 * marka ikonlarıyla görünüyordu; aynı şeyin iki ayrı görünümü zaten hataydı.
 *
 * <p>⚠️ Bu üç platform {@code SOCIAL_PLATFORMS} listesine <b>eklenmedi</b>:
 * o liste <b>profil</b> bağlantılarıdır ve sunucudaki identity modülü yalnız
 * oradaki adları kabul eder. Gönderi bağlantılarının kabul listesi ayrıdır
 * (`PostEditPage`'teki seçim listesi). İki listeyi birleştirmek, profil
 * ayarlarında sunucunun reddedeceği bir seçenek göstermek olurdu.
 */
const POST_PLATFORMS: Record<string, PlatformMeta> = {
  THREADS: { label: 'Threads', Icon: AtSign, color: '#1a1d1f', colorDark: '#ffffff', placeholder: 'kullaniciadi' },
  MAIL: { label: 'E-posta', Icon: Mail, color: '#2a85ff', placeholder: 'ad@site.com' },
  LINK: { label: 'Bağlantı', Icon: Link2, color: '#2a85ff', placeholder: 'site.com/sayfa' },
}

/**
 * Platform görselini bulur — bilinmeyen adda <b>küre ikonu</b>na düşer.
 *
 * <p>⚠️ Bilinmeyeni sessizce ATLAMAK yanlıştı: kullanıcı eklediği bağlantının
 * hiç çizilmediğini görüyor ve kaydın kaybolduğunu sanıyordu. Yedek ikon,
 * bağlantıyı her hâlükârda tıklanabilir tutar.
 */
export function platformMeta(platform: string): PlatformMeta {
  const key = platform?.toUpperCase()
  return (
    PLATFORMS[key as SocialPlatform] ??
    POST_PLATFORMS[key] ?? {
      label: platform || 'Bağlantı',
      Icon: Globe,
      color: '#2a85ff',
      placeholder: 'site.com',
    }
  )
}

/**
 * Bağlantı rozetleri — profilde tıklanabilir ikon sırası.
 *
 * <p>🔴 <b>Referansla BİREBİR</b> (`taginbio.com/taag.app`, 9 Ağu 2026'da
 * tarayıcıdan ölçüldü — paket okuyarak değil):
 * <ul>
 *   <li>kutu <b>40×40</b> (küçük boy 36), <code>min-width</code> da aynı</li>
 *   <li>köşe <b>11.2px</b> — tam yuvarlak DEĞİL, hafif yumuşatılmış kare</li>
 *   <li>zemin <b>saydam</b>, kenarlık <b>yok</b></li>
 *   <li>ikon <b>23px</b>, dolgu <b>#222222</b> (tema koyuyken açık karşılığı)</li>
 *   <li>kaplar <code>flex flex-wrap justify-center</code>, <b>gap 0</b> —
 *       aralık kutunun kendi iç boşluğundan gelir (ölçülen adım tam 40px)</li>
 *   <li>hover: ikincil rengin <b>%20</b> tonu · basılı: <code>scale(0.97)</code>
 *       · geçiş <b>0.25s</b></li>
 * </ul>
 *
 * <p>⚠️ Eski hâli <b>yuvarlak, dolu zeminli, 36px</b> karolardı ve hover'da
 * marka rengine geçip <code>scale(1.1)</code> büyüyordu — referansın sakin
 * dilinden tamamen başkaydı. Marka renkleri {@link PLATFORMS} içinde
 * <b>duruyor</b>: düzenleme ekranındaki liste onları kullanmaya devam ediyor.
 *
 * <p>🔒 Adresler sunucuda üretilir (yalnız http/https) ama dış bağlantıda
 * `rel="noopener noreferrer"` yine de zorunludur: hedef sayfa `window.opener`
 * ile bizim sekmemizi yönlendirebilirdi.
 */
export function SocialLinks({
  links,
  size = 'md',
  className,
}: {
  /* ⚠️ Platform `string`: gönderi bağlantıları profil listesinde olmayan
     adlar taşıyabilir (THREADS · MAIL · LINK). Tür daraltmak, o kayıtların
     arayüzde hiç çizilmemesine yol açıyordu. */
  links: (Omit<SocialLinkView, 'platform'> & { platform: string })[]
  size?: 'sm' | 'md'
  className?: string
}) {
  if (!links.length) return null
  const box = size === 'sm' ? 'h-9 w-9 min-w-9' : 'h-10 w-10 min-w-10'
  const icon = size === 'sm' ? 'h-[21px] w-[21px]' : 'h-[23px] w-[23px]'
  return (
    /* ⚠️ `gap` YOK: referansta her ikon kendi 40px'lik sarmalayıcısında duruyor
       ve adım tam 40px ölçüldü. Buraya boşluk eklemek sırayı seyreltirdi. */
    <div className={cn('flex w-full flex-wrap items-center justify-center', className)}>
      {links.map((link) => {
        const meta = platformMeta(link.platform)
        const { Icon } = meta
        return (
          <a
            key={link.platform}
            href={safeHref(link.url)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${meta.label} · ${link.value}`}
            aria-label={meta.label}
            className={cn(
              box,
              'waydee-social-icon grid place-items-center',
            )}
            /*
             * 🔴 24 Ağu 2026 — İKONLAR ARTIK MARKA RENGİNDE (kullanıcı isteği:
             * *"siyah beyaz onları orijinal renklerinde yapalım"*).
             *
             * ⚠️ Renk `style={{ color }}` ile DOĞRUDAN yazılmaz, iki CSS
             * değişkeniyle geçirilir: koyu temanın karşılığını seçen şey
             * <b>CSS</b> olmalı. Doğrudan yazılsaydı istemcinin temayı
             * okuması gerekirdi ve tema `data-theme` ile döndüğü için bileşen
             * her tema değişiminde yeniden render olmak zorunda kalırdı —
             * 89. turun dersi: tema CSS'in işidir.
             */
            style={
              {
                '--brand': meta.color,
                '--brand-dark': meta.colorDark ?? meta.color,
              } as React.CSSProperties
            }
          >
            <Icon className={icon} />
          </a>
        )
      })}
    </div>
  )
}
