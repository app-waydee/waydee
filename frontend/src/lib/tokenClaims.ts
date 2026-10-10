import type { UserResponse } from '@/types/api'

/**
 * <b>Kimliği JWT'den oku — localStorage'daki nesneden DEĞİL</b> (19 Ağu 2026).
 *
 * <h3>🔴 Kapatılan açık</h3>
 * <p>Oturum {@code localStorage['waydee-auth']} altında saklanıyor ve içinde
 * hem token hem de <b>kullanıcı nesnesi</b> var. Arayüz "yönetici mi" sorusunu
 * o nesneden okuyordu ({@code user.role === 'ADMIN'}). Yani DevTools →
 * Application → Local Storage'da {@code role}'ü elle <b>ADMIN</b> yapan biri,
 * uygulamanın <b>yönetici yüzeylerini açtırabiliyordu</b>.
 *
 * <p>⚠️ <b>Bu bir yetki yükseltmesi DEĞİLDİ</b> ve öyle anlatılmamalı: sunucu
 * yetkiyi <b>imzalı token</b>dan okuyor ({@code JwtService.parse} →
 * {@code parseSignedClaims}, HS512) ve {@code /api/v1/admin/**} yolu
 * {@code hasRole("ADMIN")} ile korunuyor. Elle "admin" olan biri her admin
 * çağrısından <b>403</b> alırdı. Ama ekranların açılması bile kabul edilemez:
 * yönetim arayüzünün yapısını, uç adlarını ve alan adlarını sızdırır ve
 * kullanıcıya "sistem delindi" hissi verir.
 *
 * <h3>Neden bu dosya sorunu ÇÖZÜYOR</h3>
 * <p>Rol artık <b>token'ın içinden</b> okunuyor. Token'ı elle değiştiren biri
 * <b>imzayı bozar</b>; imzayı düzeltmek sunucunun gizli anahtarını gerektirir.
 * Bozuk token'la yapılan her istek <b>401</b> döner ve oturum kapanır. Yani
 * saldırganın elinde kalan tek şey, kendi tarayıcısında birkaç saniye açılıp
 * sonra kendini dışarı atan bir ekran olur.
 *
 * <h3>⚠️ Buradaki çözümleme DOĞRULAMA DEĞİLDİR</h3>
 * <p>İmza istemcide <b>kontrol edilmez ve edilemez</b> — gizli anahtar
 * sunucudadır ve orada kalmalıdır. Bu dosya yalnız "kullanıcının elle
 * düzenlediği bir nesneye güvenme, hiç değilse token'ın kendisine bak" der.
 * <b>Tek gerçek kapı sunucudur</b> ve öyle kalmalıdır; buradaki hiçbir kontrol
 * sunucudaki bir kontrolün yerine geçemez.
 */
export interface TokenClaims {
  /** Kullanıcı kimliği (JWT {@code sub}). */
  userId: string
  role: string
  /** Bitiş anı — saniye cinsinden (JWT {@code exp}). */
  exp: number
}

/**
 * JWT gövdesini çözer. Bozuk/eksik token'da {@code null}.
 *
 * <p>⚠️ {@code atob} <b>base64url</b> bilmez: JWT'de {@code +} yerine {@code -},
 * {@code /} yerine {@code _} kullanılır ve dolgu ({@code =}) atılır. Doğrudan
 * {@code atob}'a vermek bazı token'larda sessizce patlar — bu yüzden çeviri
 * elle yapılıyor.
 *
 * <p>⚠️ Türkçe/UTF-8 karakter taşıyan claim'ler için {@code decodeURIComponent}
 * geçişi şart; {@code atob} tek başına latin-1 döndürür ve {@code username}
 * bozulurdu.
 */
export function decodeToken(token: string | null | undefined): TokenClaims | null {
  if (!token) return null
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    const claims = JSON.parse(json) as { sub?: string; role?: string; exp?: number }
    if (!claims.sub || !claims.role || !claims.exp) return null
    return { userId: claims.sub, role: claims.role, exp: claims.exp }
  } catch {
    return null
  }
}

/** Token'ın süresi dolmuş mu? (Saat kayması için 10 sn pay.) */
export function isExpired(claims: TokenClaims | null): boolean {
  if (!claims) return true
  return claims.exp * 1000 <= Date.now() - 10_000
}

/**
 * <b>Kalıcı oturum, token ile TUTARLI mı?</b>
 *
 * <p>🔴 Bu, elle düzenlemeye karşı asıl savunma. {@code localStorage}'daki
 * kullanıcı nesnesinin {@code id} ve {@code role} alanları token'ın
 * söylediğiyle <b>birebir</b> tutmalı. Tutmuyorsa oturum <b>kurcalanmış</b>
 * sayılır ve temizlenir.
 *
 * <p>⚠️ Yalnız rol değil <b>kimlik</b> de karşılaştırılır: kullanıcı nesnesini
 * başka birinin kimliğiyle değiştirmek, arayüzü "başkası" gibi çizdirmenin
 * ikinci yoluydu.
 *
 * <p>🔴🔴 <b>SÜRESİ DOLMUŞLUK TUTARSIZLIK SAYILMAZ — bu bir regresyon olurdu.</b>
 * İlk yazımda {@code isExpired} de burada kontrol ediliyordu. Erişim token'ı
 * <b>30 dakikada</b> doluyor, yenileme token'ı ise <b>30 gün</b> yaşıyor;
 * yani 30 dakika sonra sekmeye dönen <b>her kullanıcı</b> "kurcalanmış oturum"
 * sayılıp <b>çıkışa atılacaktı</b>. Süre dolması normal bir durumdur ve
 * {@code api.ts} içindeki 401 → {@code /auth/refresh} akışı onu zaten
 * sessizce çözüyor. Burada aranan tek şey <b>kurcalama</b>dır.
 *
 * <p>⚠️ Token yoksa {@code true} döner — oturumsuz durum tutarsızlık değildir.
 * <p>⚠️ Token <b>çözülemiyorsa</b> (bozuk/uydurma) tutarsızdır: gerçek bir
 * token her zaman çözülebilir bir gövde taşır.
 */
export function sessionIsConsistent(
  user: UserResponse | null,
  token: string | null,
): boolean {
  if (!user && !token) return true
  if (!user || !token) return false
  const claims = decodeToken(token)
  if (!claims) return false
  return claims.userId === user.id && claims.role === user.role
}
