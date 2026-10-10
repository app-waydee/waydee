/**
 * <b>Kurumsal iletişim ve sosyal hesaplar — TEK KAYNAK.</b>
 *
 * <p>🔴 8 Ağu 2026'da açıldı. Öncesinde sosyal adresler `LandingPage.tsx`
 * içindeki `SOCIAL` dizisine <b>gömülüydü</b> ve hepsi <b>yanlıştı</b>
 * (`@waydee` — gerçek hesaplar <code>@waydeeapp</code>), e-posta da
 * <code>hi@waydee.com</code> yazıyordu ama gerçek adres
 * <code>info@waydee.com</code>. Adres birden çok yerde (footer · Kurumsal
 * kartı · Hakkımızda) geçtiği için tek dosyaya alındı: biri değişince
 * diğerleri sessizce eskimesin.
 *
 * <p>⚠️ Burada <b>yalnız sabitler</b> durur, çeviri yok. Görünen etiketler
 * (ör. "Konum") <code>i18n</code>'den gelir — sokak adresi ve hesap adları
 * ise çevrilmez, her dilde aynıdır.
 */

/** Kurumsal e-posta. Kurumsal teklif, iletişim ve yasal bildirimler buraya. */
export const CONTACT_EMAIL = 'info@waydee.com'

/** Sosyal hesaplar. Sıra footer'da görünen sıradır. */
export const SOCIAL_LINKS = {
  tiktok: 'https://www.tiktok.com/@waydeeapp',
  instagram: 'https://www.instagram.com/waydeeapp/',
  x: 'https://x.com/waydeeapp',
} as const

/**
 * Kayıtlı adres. Satırlar ayrı ayrı durur çünkü footer'da <b>alt alta</b>
 * yazılır; tek dizeye gömülseydi mobilde satır sonlarını kontrol edemezdik.
 */
export const COMPANY_ADDRESS_LINES = [
  'Bilişim Vadisi, Muallimköy,',
  'Deniz Cd. No:143-5,',
  '41400 Gebze / Kocaeli',
] as const

/** Adresin tek satırlık hâli — harita bağlantısı ve `aria-label` için. */
export const COMPANY_ADDRESS_ONE_LINE = COMPANY_ADDRESS_LINES.join(' ')

/**
 * "Konum" bağlantısı. ⚠️ Google Maps'e <b>arama sorgusu</b> ile gidilir,
 * elle yazılmış bir koordinat/`place_id` ile değil: adres değişirse
 * bağlantı kendiliğinden doğru kalır, ölü bir pin'e düşmez.
 */
export const COMPANY_MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  COMPANY_ADDRESS_ONE_LINE,
)}`
