package com.waydee.creators.domain;

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
 * <b>Bir influencer keşfi araması</b> (V61, 108. tur).
 *
 * <p>Satır, arama süresince <b>canlı</b> güncellenir: istemci saniyede bir
 * okuyup boru hattı adımlarını ({@code stepsJson}) çizer. Sonuç geldiğinde
 * {@code resultsJson} bir <b>anlık görüntü</b> olarak donar.
 *
 * <p>⚠️ Durum geçişleri yalnız {@code CreatorSearchStore} üzerinden, kısa
 * transaction'larda yapılır; koşucu dakikalarca süren ağ çağrıları sırasında
 * bir transaction tutmaz.
 */
@Entity
@Table(name = "creator_searches")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CreatorSearch extends AuditableEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private CreatorSearchStatus status;

    @Column(name = "brief", nullable = false, columnDefinition = "text", updatable = false)
    private String brief;

    @Column(name = "filters_json", nullable = false, columnDefinition = "text", updatable = false)
    private String filtersJson;

    @Column(name = "weights_json", nullable = false, columnDefinition = "text")
    private String weightsJson;

    @Column(name = "criteria_json", columnDefinition = "text")
    private String criteriaJson;

    @Column(name = "steps_json", nullable = false, columnDefinition = "text")
    private String stepsJson;

    @Column(name = "results_json", columnDefinition = "text")
    private String resultsJson;

    @Column(name = "result_count", nullable = false)
    private int resultCount;

    @Column(name = "dropped_json", columnDefinition = "text")
    private String droppedJson;

    @Column(name = "requested_count", nullable = false, updatable = false)
    private int requestedCount;

    @Column(name = "cost", nullable = false, updatable = false)
    private int cost;

    @Column(name = "locale", nullable = false, length = 8, updatable = false)
    private String locale;

    @Column(name = "provider", length = 16)
    private String provider;

    @Column(name = "model", length = 80)
    private String model;

    @Column(name = "input_tokens", nullable = false)
    private long inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private long outputTokens;

    @Column(name = "web_searches", nullable = false)
    private int webSearches;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    public CreatorSearch(UUID userId, String brief, String filtersJson, String weightsJson, String stepsJson,
                         int requestedCount, int cost, String locale) {
        this.userId = userId;
        this.status = CreatorSearchStatus.QUEUED;
        this.brief = brief;
        this.filtersJson = filtersJson;
        this.weightsJson = weightsJson;
        this.stepsJson = stepsJson;
        this.requestedCount = requestedCount;
        this.cost = cost;
        this.locale = locale;
    }

    public void markRunning(String stepsJson) {
        this.status = CreatorSearchStatus.RUNNING;
        this.startedAt = Instant.now();
        this.stepsJson = stepsJson;
    }

    public void updateSteps(String stepsJson) {
        this.stepsJson = stepsJson;
    }

    public void recordCriteria(String criteriaJson) {
        this.criteriaJson = criteriaJson;
    }

    /**
     * Tüketimi biriktirir. ⚠️ Toplanır, üzerine yazılmaz: bir arama birden çok
     * adım (ve yedeklemede birden çok sağlayıcı) çağırır.
     */
    public void addUsage(long input, long output, int searches, String providerLabel, String modelName) {
        this.inputTokens += input;
        this.outputTokens += output;
        this.webSearches += searches;
        if (providerLabel != null) {
            this.provider = providerLabel;
            this.model = modelName;
        }
    }

    public void succeed(String resultsJson, int resultCount, String droppedJson, String stepsJson) {
        this.status = CreatorSearchStatus.SUCCEEDED;
        this.resultsJson = resultsJson;
        this.resultCount = resultCount;
        this.droppedJson = droppedJson;
        this.stepsJson = stepsJson;
        this.finishedAt = Instant.now();
        this.errorMessage = null;
    }

    /**
     * Başarısız. ⚠️ Mesaj kırpılır — kolon 500 karakter ve sağlayıcı hataları
     * uzun olabilir; kırpılmasaydı hatayı <b>kaydederken</b> ikinci bir hata doğardı.
     */
    public void fail(String message, String stepsJson) {
        this.status = CreatorSearchStatus.FAILED;
        this.errorMessage = message == null ? null : message.substring(0, Math.min(message.length(), 480));
        if (stepsJson != null) {
            this.stepsJson = stepsJson;
        }
        this.finishedAt = Instant.now();
    }

    /** Kullanıcı ağırlıkları değiştirdi — sıralama istemcide, kalıcılık burada. */
    public void updateWeights(String weightsJson) {
        this.weightsJson = weightsJson;
    }
}
