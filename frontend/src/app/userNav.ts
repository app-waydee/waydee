import { BarChart3, LayoutGrid, Receipt, Settings, Sparkles, Store } from 'lucide-react'
import type { DashNavItem } from '@/components/dash'

/**
 * Kullanıcı panelinin sol menüsü (tek kaynak).
 *
 * ⚠️ Etiketler ÇEVİRİ ANAHTARI olarak durur: modül sabiti olduğu için hazır
 * metin yazmak, dili değiştiren kullanıcıda menüyü Türkçe bırakırdı.
 */
export const USER_NAV: DashNavItem[] = [
  { to: '/me', end: true, icon: LayoutGrid, labelKey: 'nav.dashboard' },
  { to: '/market', icon: Store, labelKey: 'nav.marketplaces' },
  /* 🔴 Üyelik ekranı menüye eklendi: plan yalnız rozet ve kota kartında
     görünüyordu, kullanıcı Pro'nun ne getirdiğini bir arada göremiyordu. */
  { to: '/plan', icon: Sparkles, labelKey: 'nav.plan' },
  { to: '/invoices', icon: Receipt, labelKey: 'nav.invoices' },
  { to: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
]
