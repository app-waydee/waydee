package com.waydee.outreach.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

/**
 * <b>Kampanyadaki tek bir alıcı</b> (V60) — ve tek bir ileti.
 *
 * <p>🔴 <b>CC/BCC yoktur.</b> Her satır kendi iletisini alır. Tek iletiye
 * yüzlerce kişi eklemek ① adresleri birbirine ifşa eder, ② alıcı başına durum
 * ölçülemez hale getirir, ③ sağlayıcıların çoğunda doğrudan spam işaretidir.
 *
 * <p>⚠️ Bu tablo {@code AuditableEntity} <b>değildir</b>: yüz binlerce satıra
 * çıkabilir ve satır başına dört denetim kolonu + sürüm taşımak, hiç
 * sorulmayan bir sorunun bedelidir. Kim gönderdi bilgisi kampanyada duruyor.
 */
@Entity
@Table(name = "email_recipients")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailRecipient {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "campaign_id", nullable = false, updatable = false)
    private UUID campaignId;

    /** Her zaman küçük harfli — tekilleştirme ve bastırma eşleşmesi buna dayanır. */
    @Column(name = "email", nullable = false, length = 320, updatable = false)
    private String email;

    @Column(name = "name", length = 120, updatable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private RecipientStatus status;

    @Column(name = "error", length = 500)
    private String error;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static EmailRecipient queued(UUID campaignId, String email, String name) {
        return of(campaignId, email, name, RecipientStatus.QUEUED, null);
    }

    /** Bastırma listesindeki adres: satır yazılır ama hiç denenmez. */
    public static EmailRecipient skipped(UUID campaignId, String email, String name, String reason) {
        return of(campaignId, email, name, RecipientStatus.SKIPPED, reason);
    }

    private static EmailRecipient of(UUID campaignId, String email, String name,
                                     RecipientStatus status, String error) {
        EmailRecipient r = new EmailRecipient();
        r.campaignId = campaignId;
        r.email = email;
        r.name = name;
        r.status = status;
        r.error = error;
        r.createdAt = Instant.now();
        return r;
    }

    public void markSent() {
        this.status = RecipientStatus.SENT;
        this.sentAt = Instant.now();
        this.error = null;
    }

    /**
     * Hata metni <b>kırpılır</b>: kimi SMTP sunucusu sayfalarca gerekçe döner ve
     * kolon 500 karakter. Kırpmasaydık gönderim, hatayı <b>kaydederken</b>
     * ikinci kez patlardı.
     */
    public void markFailed(String reason) {
        this.status = RecipientStatus.FAILED;
        this.error = reason == null ? "bilinmeyen hata"
                : reason.substring(0, Math.min(reason.length(), 480));
    }
}
