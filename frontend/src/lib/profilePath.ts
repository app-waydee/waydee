/**
 * <b>Bir kullanıcının profil adresi — TEK KAYNAK.</b>
 *
 * <h3>🔴 17 Ağu 2026 — neden yazıldı</h3>
 * Kullanıcı: <i>"arama yerine tıklayınca `waydee.com/u/0d66e4fa-…` bu tarz
 * eski profil geliştirmesine gidiyor; bizim `waydee.com/username` kısmı
 * açılmalı"</i>.
 *
 * <p>Uygulamanın <b>on dört ayrı yerinde</b> elle {@code `/u/${id}`} yazılıyordu
 * ve bu adres bir <b>köprüdür</b>: açılır, kimliği sunucuya sorar, sonra gerçek
 * profile yönlendirir. Bedeli üç kat:
 * <ul>
 *   <li>Adres çubuğunda bir an <b>UUID</b> beliriyor — paylaşılan bağlantı da
 *       çirkin ve anlamsız oluyordu.</li>
 *   <li><b>Fazladan bir istek</b> ve bir yükleme ekranı.</li>
 *   <li>Sorgu başarısız olursa kullanıcı <b>bambaşka bir sayfaya</b> düşüyordu.</li>
 * </ul>
 *
 * <p>Oysa bu on dört yerin neredeyse hepsinde <b>kullanıcı adı zaten elde
 * vardı</b> ({@code UserSummary.username}, {@code actorUsername}); arama ve
 * trend uçlarına da 17 Ağu'da eklendi. Yani köprü baştan beri gereksizdi.
 *
 * <p>⚠️ Köprü <b>silinmedi</b>: gerçekten yalnız kimliğin bilindiği bir çağıran
 * kalırsa (ya da eski bir bağlantı paylaşılmışsa) çalışmaya devam etmeli.
 * Ama artık <b>yedek yoldur</b>, varsayılan değil.
 *
 * @example
 * navigate(profilePath(hit))        // /yasin_karaca
 * <Link to={profilePath(n.actor)}>  // /yasin_karaca
 */
export function profilePath(
  user: { username?: string | null; id?: string | null } | null | undefined,
): string {
  const username = user?.username?.trim()
  if (username) {
    /*
     * ⚠️ `encodeURIComponent` DEĞİL: kullanıcı adları zaten dar bir alfabeden
     * gelir (sunucu doğruluyor) ve kodlamak Türkçe/Arapça adları okunmaz hâle
     * getirirdi. Yine de bir bölü işareti adresi ikiye bölerdi — o yüzden
     * güvenlik ağı olarak yalnız bölü temizlenir.
     */
    return `/${username.replace(/\//g, '')}`
  }
  // Yedek: elimizde yalnız kimlik var → köprü çözsün.
  return user?.id ? `/u/${user.id}` : '/home'
}
