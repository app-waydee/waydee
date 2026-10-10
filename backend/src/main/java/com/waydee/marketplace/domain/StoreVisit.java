package com.waydee.marketplace.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * <b>Bir mağaza ziyareti</b> — 3B caddede bir kapıdan içeri girip içeride
 * geçirilen süre (V55, 24 Ağu 2026).
 *
 * <p>🔴 Bu <b>bakış</b> değil <b>uğrama</b>dır. {@code territory_views} bir
 * daireye bakmayı sayar ve süresi yoktur; buradaki olayın süresi vardır ve
 * ürünün asıl sorusu odur: <i>"içeri girenler ne kadar kaldı?"</i>
 *
 * <p>⚠️ Satır <b>girişte</b> yazılır ve süresi <b>çıkışta</b> güncellenir.
 * Tersi (çıkışta tek satır) daha temiz görünür ama sekmesini kapatan
 * ziyaretçi hiç sayılmazdı — oysa kapıdan geçtiği doğrudur.
 */
@Entity
@Table(name = "store_visits")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StoreVisit {

    /** İçeride geçirilebilecek azami süre — DB kısıtıyla birebir aynı (V55). */
    public static final int MAX_DWELL_SECONDS = 14400;

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "listing_id", nullable = false, updatable = false)
    private UUID listingId;

    /** ⚠️ Kullanıcı silinirse NULL olur; ziyaret sayısı geçmişe dönük düşmez. */
    @Column(name = "visitor_id", updatable = false)
    private UUID visitorId;

    @Column(name = "entered_at", nullable = false, updatable = false)
    private Instant enteredAt;

    @Column(name = "dwell_seconds", nullable = false)
    private int dwellSeconds;

    /** UTC gün — raporun gruplama anahtarı (V54 ile aynı hizada). */
    @Column(name = "visit_day", nullable = false, updatable = false)
    private LocalDate visitDay;

    public StoreVisit(UUID listingId, UUID visitorId) {
        this.listingId = listingId;
        this.visitorId = visitorId;
        this.enteredAt = Instant.now();
        this.visitDay = LocalDate.ofInstant(this.enteredAt, ZoneOffset.UTC);
        this.dwellSeconds = 0;
    }

    /**
     * İçeride geçirilen süreyi yazar.
     *
     * <p>🔴 Değer <b>kırpılır</b>: istemciden geliyor ve istemci her zaman
     * kullanıcının elindedir. Negatif bir süre ortalamayı aşağı, altı saatlik
     * bir süre yukarı çekerdi — ikisi de raporu tek satırla anlamsızlaştırır.
     */
    public void closeWith(int seconds) {
        this.dwellSeconds = Math.max(0, Math.min(MAX_DWELL_SECONDS, seconds));
    }
}
