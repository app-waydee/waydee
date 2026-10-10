package com.waydee.creators.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

/**
 * <b>Kısa listedeki bir üreticinin detaylı veri raporu</b> (V62, 109. tur).
 *
 * <p>Her "Detaylı veriler" / "Yenile" tıklaması yeni bir satırdır; eski rapor
 * silinmez — ekran en sonuncuyu gösterir.
 */
@Entity
@Table(name = "creator_insights")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CreatorInsight {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "shortlist_id", nullable = false, updatable = false)
    private UUID shortlistId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private CreatorSearchStatus status;

    @Column(name = "locale", nullable = false, length = 8, updatable = false)
    private String locale;

    @Column(name = "cost", nullable = false, updatable = false)
    private int cost;

    @Column(name = "report_json", columnDefinition = "text")
    private String reportJson;

    @Column(name = "phase", length = 16)
    private String phase;

    @Column(name = "error_code", length = 40)
    private String errorCode;

    @Column(name = "input_tokens", nullable = false)
    private long inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private long outputTokens;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    public CreatorInsight(UUID shortlistId, UUID userId, String locale, int cost) {
        this.shortlistId = shortlistId;
        this.userId = userId;
        this.locale = locale;
        this.cost = cost;
        this.status = CreatorSearchStatus.QUEUED;
        this.createdAt = Instant.now();
    }

    public void markRunning() {
        this.status = CreatorSearchStatus.RUNNING;
        this.phase = "PROFILE";
    }

    public void phase(String phase) {
        this.phase = phase;
    }

    public void addUsage(long input, long output) {
        this.inputTokens += Math.max(0, input);
        this.outputTokens += Math.max(0, output);
    }

    public void succeed(String reportJson) {
        this.status = CreatorSearchStatus.SUCCEEDED;
        this.reportJson = reportJson;
        this.finishedAt = Instant.now();
    }

    public void fail(String errorCode) {
        this.status = CreatorSearchStatus.FAILED;
        this.errorCode = errorCode;
        this.finishedAt = Instant.now();
    }
}
