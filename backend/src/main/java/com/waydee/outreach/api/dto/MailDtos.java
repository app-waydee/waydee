package com.waydee.outreach.api.dto;

import com.waydee.outreach.application.OutreachService;
import com.waydee.outreach.domain.EmailCampaign;
import com.waydee.outreach.domain.EmailRecipient;
import com.waydee.outreach.domain.EmailSuppression;
import com.waydee.outreach.domain.EmailTemplate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Yönetim posta uçlarının sözleşmeleri (V60, 107. tur). */
public final class MailDtos {

    private MailDtos() {
    }

    /**
     * Şablon yazma isteği.
     *
     * <p>⚠️ Sınırlar veritabanı kolonlarıyla <b>aynı</b>: doğrulama olmadan
     * uzun bir konu, gönderim anında değil <b>kaydetme</b> anında patlar ve
     * yönetici hatayı anlamsız bir SQL mesajı olarak görürdü.
     */
    public record TemplateRequest(
            @NotBlank(message = "Şablon adı zorunludur") @Size(max = 120) String name,
            @NotBlank(message = "Konu zorunludur") @Size(max = 200) String subject,
            @Size(max = 200) String preheader,
            @NotBlank(message = "Başlık zorunludur") @Size(max = 200) String heading,
            @NotBlank(message = "Gövde zorunludur") @Size(max = 20_000) String body,
            @Size(max = 80) String ctaLabel,
            @Size(max = 500) String ctaUrl,
            @Size(max = 2_000) String footerNote,
            @Size(max = 8) String locale,
            Boolean active) {

        public boolean activeOrTrue() {
            return active == null || active;
        }
    }

    public record TemplateResponse(UUID id, String name, String subject, String preheader, String heading,
                                   String body, String ctaLabel, String ctaUrl, String footerNote,
                                   String locale, boolean active, Instant createdAt, Instant updatedAt) {

        public static TemplateResponse from(EmailTemplate t) {
            return new TemplateResponse(t.getId(), t.getName(), t.getSubject(), t.getPreheader(), t.getHeading(),
                    t.getBody(), t.getCtaLabel(), t.getCtaUrl(), t.getFooterNote(), t.getLocale(), t.isActive(),
                    t.getCreatedAt(), t.getUpdatedAt());
        }
    }

    /** Önizleme çıktısı — {@code html} bir {@code iframe} içine yazılır. */
    public record PreviewResponse(String subject, String html, String text) {
    }

    public record TestRequest(
            @NotBlank(message = "Adres zorunludur") @Size(max = 320) String to,
            @Size(max = 120) String sampleName) {
    }

    /** Kopyala-yapıştır alıcı listesi. */
    public record RecipientsRequest(
            @NotBlank(message = "Alıcı listesi boş") @Size(max = 200_000) String recipients) {
    }

    public record SendRequest(
            @NotBlank(message = "Şablon seçilmedi") String templateId,
            @NotBlank(message = "Alıcı listesi boş") @Size(max = 200_000) String recipients) {
    }

    public record RecipientPreview(String email, String name) {
    }

    /**
     * Gönderim öncesi özet.
     *
     * <p>🔴 Bu ekran <b>gönderim düğmesinden önce</b> gelir. Yapıştırılan listenin
     * kaçının geçerli, kaçının kopya, kaçının bastırılmış olduğunu göndermeden
     * görmek, geri dönüşü olmayan tek işlemin önündeki tek fren.
     */
    public record PreflightResponse(List<RecipientPreview> valid, List<String> invalid, int duplicates,
                                    List<String> suppressed, boolean overQuota, QuotaResponse quota) {

        public static PreflightResponse from(OutreachService.Preflight p) {
            return new PreflightResponse(
                    p.valid().stream().map(r -> new RecipientPreview(r.email(), r.name())).toList(),
                    p.invalid(), p.duplicates(), p.suppressed(), p.overQuota(), QuotaResponse.from(p.quota()));
        }
    }

    public record QuotaResponse(int dailyLimit, long sentLast24h, long remaining, int perMinute,
                                int maxPerCampaign, boolean mailEnabled, String disabledReason) {

        public static QuotaResponse from(OutreachService.Quota q) {
            return new QuotaResponse(q.dailyLimit(), q.sentLast24h(), q.remaining(), q.perMinute(),
                    q.maxPerCampaign(), q.mailEnabled(), q.disabledReason());
        }
    }

    public record CampaignResponse(UUID id, UUID templateId, String templateName, String subject, String status,
                                   int totalCount, int sentCount, int failedCount, int skippedCount,
                                   Instant startedAt, Instant finishedAt, Instant createdAt) {

        public static CampaignResponse from(EmailCampaign c) {
            return new CampaignResponse(c.getId(), c.getTemplateId(), c.getTemplateName(), c.getSubjectSnapshot(),
                    c.getStatus().name(), c.getTotalCount(), c.getSentCount(), c.getFailedCount(),
                    c.getSkippedCount(), c.getStartedAt(), c.getFinishedAt(), c.getCreatedAt());
        }
    }

    public record RecipientResponse(UUID id, String email, String name, String status, String error, Instant sentAt) {

        public static RecipientResponse from(EmailRecipient r) {
            return new RecipientResponse(r.getId(), r.getEmail(), r.getName(), r.getStatus().name(),
                    r.getError(), r.getSentAt());
        }
    }

    public record SuppressionRequest(
            @NotBlank(message = "Adres zorunludur") @Size(max = 20_000) String emails,
            @Size(max = 24) String reason,
            @Size(max = 300) String note) {
    }

    public record SuppressionResponse(UUID id, String email, String reason, String note, Instant createdAt) {

        public static SuppressionResponse from(EmailSuppression s) {
            return new SuppressionResponse(s.getId(), s.getEmail(), s.getReason(), s.getNote(), s.getCreatedAt());
        }
    }
}
