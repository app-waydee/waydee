package com.waydee.outreach.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * <b>Toplu gönderim sınırları</b> (V60, 107. tur).
 *
 * <p>Kullanıcının sorusu doğrudandı: *"günlük kaç mail atabiliriz spama
 * düşmemek için?"* Cevap bir kod sabiti olamaz çünkü <b>sağlayıcıya bağlıdır</b>:
 *
 * <ul>
 *   <li><b>Google Workspace</b> — günde 2.000 dış alıcı (SMTP röle ile 10.000).</li>
 *   <li><b>Microsoft 365</b> — günde 10.000 alıcı, dakikada 30 ileti.</li>
 *   <li><b>Amazon SES</b> — kum havuzunda günde 200; çıkınca kota istenerek artar.</li>
 *   <li><b>Resend / Postmark / SendGrid</b> — pakete göre; başlangıç paketleri
 *       tipik olarak günde 100–3.000 arası.</li>
 * </ul>
 *
 * <p>🔴 <b>Asıl sınır sağlayıcının değil, İTİBARIN sınırıdır.</b> Yeni bir alan
 * adından ilk gün 2.000 ileti çıkarsa sağlayıcı bunu kabul eder ama alıcı
 * tarafındaki süzgeçler <b>etmez</b>: geçmişi olmayan bir alan adının ani
 * hacmi, spam sınıflandırıcılarının aradığı birinci sinyaldir. Bu yüzden
 * varsayılan <b>300</b> — sağlayıcı tavanının çok altında, bilinçli olarak.
 *
 * <p>⚠️ Sayı <b>ortam değişkenidir</b> ({@code MAIL_DAILY_LIMIT}): ısınma
 * ilerledikçe kod değiştirip dağıtım yapmak gerekmesin.
 *
 * @param dailyLimit    kayan 24 saatte gönderilebilecek en çok ileti
 * @param perMinute     dakikada en çok ileti — ani hacim de bir spam sinyalidir
 * @param maxPerCampaign tek turda kabul edilen en çok alıcı
 */
@ConfigurationProperties(prefix = "waydee.mail.outreach")
public record OutreachProperties(
        int dailyLimit,
        int perMinute,
        int maxPerCampaign
) {
    public OutreachProperties {
        if (dailyLimit <= 0) {
            dailyLimit = 300;
        }
        if (perMinute <= 0) {
            perMinute = 20;
        }
        if (maxPerCampaign <= 0) {
            maxPerCampaign = 500;
        }
    }

    /**
     * İki ileti arasındaki bekleme (ms).
     *
     * <p>🔴 Bekleme <b>gerçek bir teslim aracıdır</b>, kibarlık değil: aynı
     * saniyede yüz bağlantı açmak sağlayıcının hız sınırlayıcısını tetikler ve
     * o noktadan sonra iletiler kabul edilmez. Ayrıca yavaş akış, insan
     * gönderimine benzediği için sınıflandırıcıda daha az ceza alır.
     */
    public long delayMillis() {
        return Math.max(1L, 60_000L / perMinute);
    }
}
