import { useState } from 'react'
import { cn } from '@/lib/utils'

const TONES = ['bg-mint', 'bg-sky', 'bg-lilac', 'bg-peach', 'bg-sand']

/**
 * <b>Fotoğrafı olmayan hesabın varsayılan avatarı</b> (25 Ağu 2026, kullanıcı
 * isteği).
 *
 * <p>🔴 Baş harfin yerini alır. Harf bir <b>yer tutucuydu</b> ve ürünün her
 * yüzeyinde farklı bir pastel renkle çıkıyordu; marka işareti hem tanıdık hem
 * tutarlı.
 *
 * <p>⚠️ Harf mantığı SİLİNMEDİ, yedeğe düştü: görsel bir sebeple yüklenmezse
 * ({@code onError}) eski davranış devreye girer. Tek bir 404, uygulamadaki
 * bütün avatarları boş kutuya çevirmemeli.
 */
const DEFAULT_AVATAR = '/default-avatar.png'

interface AvatarProps {
  src?: string | null
  name: string
  className?: string
  /** Görsel yoksa marka işareti yerine baş harf — dış hesaplar (influencer keşfi) Waydee üyesi değildir. */
  initialFallback?: boolean
}

/** Core 2.0 avatarı: tam yuvarlak, çerçevesiz; görsel yoksa pastel zemin + baş harf. */
export function Avatar({ src, name, className, initialFallback }: AvatarProps) {
  const toneClass = TONES[Math.abs(hash(name)) % TONES.length]
  /* Görsel yüklenemezse baş harfe dön — gerekçe {@link DEFAULT_AVATAR}. */
  const [failed, setFailed] = useState(false)
  const resolved = failed ? null : (src ?? (initialFallback ? null : DEFAULT_AVATAR))

  return resolved ? (
    <img
      src={resolved}
      alt={name}
      className={cn('h-10 w-10 rounded-full object-cover', className)}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full font-semibold text-ink',
        toneClass,
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

function hash(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h << 5) - h + value.charCodeAt(i)
  return h
}
