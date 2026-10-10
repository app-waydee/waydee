package com.waydee.outreach.domain;

import com.waydee.common.persistence.AuditableEntity;
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
 * <b>Tek bir gönderim turu</b> (V60, 107. tur).
 *
 * <p>🔴 İçerik buraya <b>kopyalanır</b> ({@code subjectSnapshot} /
 * {@code htmlSnapshot} / {@code textSnapshot}). Şablona bakılsaydı "bu kişiye
 * ne gönderdik" sorusunun cevabı şablonun <b>bugünkü</b> hâli olurdu — yani
 * geçmiş, şablon her düzenlendiğinde sessizce yeniden yazılırdı. Gönderilmiş
 * posta değiştirilemez bir kayıttır.
 *
 * <p>⚠️ Anlık görüntü <b>kişiselleştirme öncesidir</b>: {@code {{name}}} gibi
 * yer tutucular içinde durur ve alıcı başına gönderim anında doldurulur.
 * Kişiselleştirilmiş hâli alıcı sayısı kadar kopya demekti.
 */
@Entity
@Table(name = "email_campaigns")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailCampaign extends AuditableEntity {

    @Id
    @UuidGenerator
    private UUID id;

    /** ⚠️ Şablon silinirse NULL olur, kampanya durur. */
    @Column(name = "template_id")
    private UUID templateId;

    /** Şablonun o günkü adı — şablon silinse de listede okunabilir bir satır kalır. */
    @Column(name = "template_name", nullable = false, length = 120)
    private String templateName;

    @Column(name = "subject_snapshot", nullable = false, length = 200)
    private String subjectSnapshot;

    @Column(name = "html_snapshot", nullable = false, columnDefinition = "text")
    private String htmlSnapshot;

    @Column(name = "text_snapshot", nullable = false, columnDefinition = "text")
    private String textSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private CampaignStatus status;

    @Column(name = "total_count", nullable = false)
    private int totalCount;

    @Column(name = "sent_count", nullable = false)
    private int sentCount;

    @Column(name = "failed_count", nullable = false)
    private int failedCount;

    @Column(name = "skipped_count", nullable = false)
    private int skippedCount;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    public static EmailCampaign start(UUID templateId, String templateName, String subject,
                                      String html, String text, int total, int skipped) {
        EmailCampaign c = new EmailCampaign();
        c.templateId = templateId;
        c.templateName = templateName;
        c.subjectSnapshot = subject;
        c.htmlSnapshot = html;
        c.textSnapshot = text;
        c.status = CampaignStatus.SENDING;
        c.totalCount = total;
        c.skippedCount = skipped;
        c.startedAt = Instant.now();
        return c;
    }

    public void recordSent() {
        this.sentCount++;
    }

    public void recordFailed() {
        this.failedCount++;
    }

    /**
     * Koşuyu kapatır.
     *
     * <p>⚠️ Hiç gönderilmemişse durum {@code FAILED} olur. "SENT" yazıp sıfır
     * göstermek, listede yeşil bir satır bırakıp yöneticiye postanın gittiğini
     * <b>sandırırdı</b> — SMTP kapalıyken tam olarak bu olurdu.
     */
    public void finish() {
        this.status = sentCount > 0 ? CampaignStatus.SENT : CampaignStatus.FAILED;
        this.finishedAt = Instant.now();
    }

    public void cancel() {
        this.status = CampaignStatus.CANCELLED;
        this.finishedAt = Instant.now();
    }

    public boolean isRunning() {
        return status == CampaignStatus.SENDING;
    }
}
