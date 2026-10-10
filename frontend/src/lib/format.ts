import { useI18nStore } from '@/stores/i18n'

export function fmtMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null || !currency) return '—'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function fmtArea(km2: number | null | undefined) {
  if (km2 == null) return '—'
  if (km2 < 1) return `${Math.round(km2 * 1_000_000).toLocaleString('tr-TR')} m²`
  return `${km2.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} km²`
}

export function fmtRadius(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * "3 dk önce" / "3 min ago" / "منذ ٣ دقائق".
 *
 * <p>🔴 16 Ağustos 2026 — <b>ARTIK ÇOK DİLLİ.</b> Fonksiyon beş dilde de
 * Türkçe dönüyordu (`az önce`, `dk önce`, `gün önce`) ve <b>dokuz ekranda</b>
 * kullanılıyor: bildirimler, sohbet listesi, aktivite akışı, raporlar, hikaye
 * başlığı ve yeni açılan <b>"kimler gördü"</b> listesi. İngilizce açan
 * kullanıcı `@storyviewer2 · 1 dk önce` görüyordu.
 *
 * <p>⚠️ Sözlüğe anahtar EKLENMEDİ, {@link Intl.RelativeTimeFormat} kullanıldı.
 * Beş dil × beş birim = 25 çeviri satırı yazmak, tarayıcının zaten doğru
 * bildiği (ve Arapçanın ikili/çoğul kurallarını bizden iyi çözdüğü) bir şeyi
 * elle tekrarlamak olurdu.
 *
 * <p>⚠️ Dil <b>i18n deposundan</b> okunur, `navigator.language`'dan değil:
 * kullanıcı uygulamada dil seçebiliyor ve tarayıcısı başka dilde olabilir.
 * Bu, React dışından çeviri okumanın projedeki yerleşik deseni
 * (`i18n/index.ts`'teki `t()` de aynısını yapar).
 *
 * <p>⚠️ `numeric: 'auto'` — 30 saniyelik bir fark "0 dakika önce" değil
 * <b>"şimdi"</b> olur; eski davranışın ("az önce") karşılığı budur.
 */
export function timeAgo(iso: string) {
  const locale = useI18nStore.getState().locale
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (seconds < 60) return rtf.format(-seconds, 'second')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 30) return rtf.format(-days, 'day')
  // 30 günden eskisi göreli değil MUTLAK tarihtir — "42 gün önce" okunmaz.
  return new Date(iso).toLocaleDateString(locale)
}
