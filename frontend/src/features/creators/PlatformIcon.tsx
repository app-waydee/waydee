import {
  InstagramLogo,
  LinkedinLogo,
  TiktokLogo,
  TwitchLogo,
  XLogo,
  YoutubeLogo,
  type Icon,
} from '@phosphor-icons/react'
import type { Platform } from '@/lib/creators'

/**
 * Platform logosu (108. tur).
 *
 * ⚠️ Lucide marka ikonlarını kaldırdı; projede zaten bulunan Phosphor
 * kullanılıyor (mağaza kategorileri de oradan) — yeni bir ikon paketi eklenmedi.
 */
const ICONS: Record<Platform, Icon> = {
  INSTAGRAM: InstagramLogo,
  TIKTOK: TiktokLogo,
  YOUTUBE: YoutubeLogo,
  X: XLogo,
  TWITCH: TwitchLogo,
  LINKEDIN: LinkedinLogo,
}

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const IconComponent = ICONS[platform]
  return <IconComponent className={className} weight="bold" aria-hidden />
}
