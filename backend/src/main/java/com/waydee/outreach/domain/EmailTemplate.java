package com.waydee.outreach.domain;

import com.waydee.common.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.UUID;

/**
 * <b>Giden e-posta şablonu</b> (V60, 107. tur).
 *
 * <p>Yöneticinin yazdığı içerik. Alanlar bilinçli olarak <b>ayrıştırılmıştır</b>
 * — tek bir "HTML gövde" kutusu olsaydı ①&nbsp;her şablon farklı görünür ve
 * ürünün posta dili dağılırdı, ②&nbsp;yapıştırılan HTML e-posta istemcilerinde
 * bozulurdu (Gmail {@code <style>} bloğunu eler, Outlook flexbox bilmez),
 * ③&nbsp;yönetim paneline yapıştırılan ham HTML doğrudan bir enjeksiyon yolu
 * olurdu.
 *
 * <p>Gövde bu yüzden <b>sınırlı bir biçimlendirme</b> tanır: boş satır
 * paragraf ayırır, {@code [metin](https://adres)} bağlantı, {@code **metin**}
 * kalın olur. Bunun dışındaki her şey kaçırılır ve düz metin olarak basılır
 * (bkz. {@code CampaignRenderer}).
 *
 * <p>⚠️ Şablon <b>silinebilir</b> ama gönderilmiş kampanya silinmez: kampanya
 * içeriğin bir <b>anlık görüntüsünü</b> taşır ve şablona yalnız gevşek bağlıdır.
 */
@Entity
@Table(name = "email_templates")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailTemplate extends AuditableEntity {

    @Id
    @UuidGenerator
    private UUID id;

    /** Yönetimde görünen iç ad. Alıcı bunu hiç görmez. */
    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "subject", nullable = false, length = 200)
    private String subject;

    /**
     * Gelen kutusunda konunun yanında beliren ön izleme satırı.
     *
     * <p>⚠️ Boş bırakılırsa istemci gövdenin ilk kelimelerini basar; davet
     * metninde bu "Hi," olurdu — yani gelen kutusundaki en değerli ikinci satır
     * boşa giderdi.
     */
    @Column(name = "preheader", length = 200)
    private String preheader;

    /** İletinin içindeki büyük başlık — konudan ayrıdır. */
    @Column(name = "heading", nullable = false, length = 200)
    private String heading;

    @Column(name = "body", nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "cta_label", length = 80)
    private String ctaLabel;

    @Column(name = "cta_url", length = 500)
    private String ctaUrl;

    @Column(name = "footer_note", columnDefinition = "text")
    private String footerNote;

    @Column(name = "locale", nullable = false, length = 8)
    private String locale;

    @Column(name = "active", nullable = false)
    private boolean active;

    public static EmailTemplate create(String name, String subject, String preheader, String heading,
                                       String body, String ctaLabel, String ctaUrl, String footerNote,
                                       String locale, boolean active) {
        EmailTemplate t = new EmailTemplate();
        t.apply(name, subject, preheader, heading, body, ctaLabel, ctaUrl, footerNote, locale, active);
        return t;
    }

    /**
     * Alanları yazar.
     *
     * <p>🔴 Çağrı düğmesi <b>ikisi birden</b> ya da <b>hiçbiri</b>: etiketi olup
     * adresi olmayan bir düğme, iletide tıklanamaz bir kutu olarak çizilirdi.
     * Aynı kural veritabanında da var ({@code chk_email_templates_cta}) —
     * uygulama katmanı atlanabilir, kısıt atlanamaz.
     */
    public void apply(String name, String subject, String preheader, String heading, String body,
                      String ctaLabel, String ctaUrl, String footerNote, String locale, boolean active) {
        this.name = name.trim();
        this.subject = subject.trim();
        this.preheader = blankToNull(preheader);
        this.heading = heading.trim();
        this.body = body.strip();
        String label = blankToNull(ctaLabel);
        String url = blankToNull(ctaUrl);
        boolean complete = label != null && url != null;
        this.ctaLabel = complete ? label : null;
        this.ctaUrl = complete ? url : null;
        this.footerNote = blankToNull(footerNote);
        this.locale = (locale == null || locale.isBlank()) ? "en" : locale.trim().toLowerCase();
        this.active = active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
