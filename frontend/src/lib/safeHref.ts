/**
 * <b>Kullanıcı verisinden gelen bağlantılar için güvenli `href`.</b>
 *
 * <p>🔴 8 Ağustos 2026 (güvenlik denetimi turu) — <b>derinlemesine savunma</b>.
 * Sunucu zaten `HtmlSanitizer.normalizeWebsite` ile yalnız `http/https`
 * kabul ediyor (sosyal bağlantı · profil bağlantısı · ürün etiketi · gömülü
 * site). Peki neden ikinci bir kat?
 *
 * <ol>
 *   <li>🔴 <b>Kural sonradan sıkılaştı.</b> `normalizeWebsite` 5 Ağu 2026'ya
 *       kadar şemayı kontrol etmeden başa <code>https://</code> ekliyordu;
 *       <code>javascript:alert(1)</code> → <code>https://javascript:alert(1)</code>
 *       olarak <b>kabul ediliyordu (201)</b>. Yani veritabanında düzeltmeden
 *       ÖNCE yazılmış satırlar olabilir — sunucu artık yenilerini engelliyor,
 *       eskileri temizlemiyor.</li>
 *   <li>Yarın eklenecek bir uç doğrulamayı atlarsa tek katman yeterli olmaz.
 *       <code>href</code>'e giden her kullanıcı verisi buradan geçer.</li>
 * </ol>
 *
 * <p>⚠️ <code>javascript:</code> bir <code>href</code>'te <b>tıklandığı anda
 * kod çalıştırır</b> — bu bir XSS'tir; başkasının profilindeki bağlantıya
 * dokunan kullanıcı saldırganın kodunu kendi oturumunda koşturur.
 *
 * <p>⚠️ Kaçamaklara karşı: değer <b>trim</b> edilir, <b>küçük harfe</b>
 * çevrilir ve <b>görünmez karakterler</b> (sekme, yeni satır, sıfır genişlikli
 * boşluk, BOM) atılır. Tarayıcı <code>java&#92;nscript:</code> ve
 * <code>&amp;nbsp;javascript:</code> biçimlerini de çalıştırır; ham dizeyle
 * karşılaştırmak bu yüzden yetmez.
 *
 * @returns Güvenliyse adresin kendisi, değilse <code>undefined</code> —
 *   `undefined` verilen bir `href` React tarafından hiç yazılmaz, yani
 *   bağlantı tıklanamaz hâle gelir (boş dize verseydik sayfayı yenilerdi).
 */
export function safeHref(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined

  const value = raw.trim()
  if (!value) return undefined

  /*
   * Şema tespiti için normalize kopya: kontrol karakterleri, NBSP, sıfır
   * genişlikli boşluklar ve BOM temizlenir. ⚠️ Yalnız KONTROL amaçlıdır —
   * döndürülen değer her zaman kullanıcının yazdığı orijinaldir.
   */
  const probe = value.replace(/[^\x21-\x7e]/g, '').toLowerCase()

  // Göreli adresler (uygulama içi) güvenlidir; şema taşımazlar.
  if (probe.startsWith('/') || probe.startsWith('#') || probe.startsWith('?')) {
    return value
  }

  /*
   * ⚠️ Beyaz liste, kara liste DEĞİL. `javascript:` ve `data:`'yı yasaklamak
   * yetmez — `vbscript:`, `filesystem:`, `blob:` ve gelecekte çıkacak şemalar
   * açıkta kalırdı. Yalnız bildiğimiz güvenli şemalar geçer.
   */
  if (/^https?:\/\//.test(probe)) return value
  if (/^mailto:/.test(probe) || /^tel:/.test(probe)) return value

  return undefined
}
