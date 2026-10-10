import { useEffect, useState } from 'react'
import { Link2, Send, Share2 } from 'lucide-react'
import { toast } from '@/components/ui/toast'

interface SocialShareRowProps {
  /** Kart üretilene kadar şerit gizlidir; hazır olunca yumuşakça belirir. */
  ready: boolean
  blob: Blob | null
  shareUrl: string
  text: string
}

/**
 * Paylaşım şeridi — kart hazır olunca **yumuşakça** açılır.
 *
 * <p>⚠️ Belirme yalnız `opacity` + `max-height` ile yapılır. Bu projede
 * framer-motion'ın `y`/`scale` animasyonları başlangıç değerinde takılıyor
 * (vault'ta üç kez kayıtlı tuzak), bu yüzden konum taşıyan hiçbir öğede
 * transform animasyonu kullanılmaz.
 *
 * <p>Görsel paylaşımı: mobil tarayıcılar `navigator.share` ile **dosyayı**
 * doğrudan uygulamaya verebilir (Instagram/WhatsApp burada gerçek işi yapar).
 * Masaüstünde bu API yoksa ağ bazlı paylaşım bağlantılarına düşülür — onlar
 * dosya taşıyamadığı için kullanıcıya "önce indir" denir.
 */
export function SocialShareRow({ ready, blob, shareUrl, text }: SocialShareRowProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ready) {
      setVisible(false)
      return
    }
    // Kısa gecikme: kart görünür olduktan hemen sonra açılsın, aynı anda değil.
    const timer = window.setTimeout(() => setVisible(true), 260)
    return () => window.clearTimeout(timer)
  }, [ready])

  const canShareFile =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    blob != null &&
    navigator.canShare({ files: [new File([blob], 'waydee.png', { type: 'image/png' })] })

  const shareNative = async () => {
    if (!blob) return
    const file = new File([blob], 'waydee-karti.png', { type: 'image/png' })
    try {
      await navigator.share({ files: [file], title: 'Ben de Waydee\'deyim!', text, url: shareUrl })
    } catch {
      // Kullanıcı vazgeçti — sessiz.
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Bağlantı kopyalandı')
    } catch {
      toast.error('Bağlantı kopyalanamadı')
    }
  }

  const encoded = encodeURIComponent(`${text} ${shareUrl}`)
  const networks: { key: string; label: string; href: string; brand: string; icon: React.ReactNode }[] = [
    {
      key: 'x',
      label: 'X',
      brand: '#000000',
      href: `https://twitter.com/intent/tweet?text=${encoded}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
          <path d="M18.9 2H22l-7.1 8.1L23.3 22h-6.6l-5.2-6.8L5.6 22H2.5l7.6-8.7L1.1 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
        </svg>
      ),
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      brand: '#25D366',
      href: `https://wa.me/?text=${encoded}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1a12 12 0 0 1-5.2-3.6c-1.1-1.3-1.8-2.9-1.8-3.4 0-.5.4-1.7 1-2 .3-.1.6-.1.8-.1h.4c.2 0 .4 0 .6.5l.8 2c.1.2 0 .4-.1.6l-.4.5c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1.9 1.9 1.2 2.2 1.3.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l2 .9c.2.1.4.2.4.3.1.2.1.7-.2 1.2Z" />
        </svg>
      ),
    },
    {
      key: 'telegram',
      label: 'Telegram',
      brand: '#229ED9',
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
      icon: <Send className="h-[18px] w-[18px]" />,
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      brand: '#0A66C2',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.5 4.7 5.9V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21h-4V9Z" />
        </svg>
      ),
    },
    {
      key: 'facebook',
      label: 'Facebook',
      brand: '#1877F2',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
          <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
        </svg>
      ),
    },
  ]

  return (
    <div
      aria-hidden={!visible}
      className="w-full overflow-hidden"
      /*
       * ⚠️ Geçiş SATIR İÇİ yazılır, Tailwind yardımcı sınıflarıyla değil:
       * `transition-[opacity,max-height]` + `max-h-*`/`opacity-*` ikilisi bu
       * projede hesaplanan değeri 0'da bıraktı (ölçüldü: sınıflar doğru,
       * computed `max-height:0px`). Satır içi stil üretilen CSS'e bağlı
       * olmadığı için bu belirsizliği tamamen kaldırır.
       */
      style={{
        opacity: visible ? 1 : 0,
        maxHeight: visible ? 320 : 0,
        marginTop: visible ? 28 : 0,
        transition: 'opacity 700ms ease-out, max-height 700ms ease-out, margin-top 700ms ease-out',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Paylaş</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
        {canShareFile && (
          <button
            type="button"
            onClick={shareNative}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-on-ink transition-transform hover:scale-[1.03]"
          >
            <Share2 className="h-4 w-4" /> Görseli paylaş
          </button>
        )}

        {networks.map((n) => (
          <a
            key={n.key}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={n.label}
            title={canShareFile ? n.label : `${n.label} — görseli önce indir`}
            style={{ ['--brand' as string]: n.brand }}
            className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-muted transition-[color,transform,border-color] hover:scale-[1.06] hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            {n.icon}
          </a>
        ))}

        <button
          type="button"
          onClick={copyLink}
          aria-label="Bağlantıyı kopyala"
          title="Bağlantıyı kopyala"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-muted transition-[color,transform,border-color] hover:scale-[1.06] hover:border-accent hover:text-accent"
        >
          <Link2 className="h-[18px] w-[18px]" />
        </button>
      </div>

      {!canShareFile && (
        <p className="mt-3 text-center text-[11px] font-medium text-faint">
          Ağ bağlantıları görsel taşıyamaz — kartı önce <strong className="text-muted">indir</strong>, sonra gönderine ekle.
        </p>
      )}
    </div>
  )
}
