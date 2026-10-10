package com.waydee.creators.application;

import com.waydee.creators.domain.CreatorInsight;
import com.waydee.creators.domain.CreatorSearchStatus;
import com.waydee.creators.infrastructure.CreatorInsightRepository;
import com.waydee.creators.infrastructure.CreatorSnapshotRepository;
import com.waydee.identity.application.CreditService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Detaylı veri raporunun durum yazıları — her biri kendi kısa transaction'ında
 * (109. tur). Gerekçe {@link CreatorSearchStore} ile aynı: koşucu dakikalarca
 * ağ çağrısı yapar, transaction tutamaz; kendi kendine çağrı proxy'yi atlardı.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InsightStore {

    private final CreatorInsightRepository repository;
    private final CreatorSnapshotRepository snapshots;
    private final CreditService creditService;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean markRunning(UUID id) {
        CreatorInsight insight = repository.findById(id).orElse(null);
        if (insight == null || insight.getStatus() != CreatorSearchStatus.QUEUED) {
            return false;
        }
        insight.markRunning();
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void phase(UUID id, String phase) {
        repository.findById(id).filter(i -> i.getStatus().isOpen()).ifPresent(i -> i.phase(phase));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void addUsage(UUID id, long input, long output) {
        repository.findById(id).ifPresent(i -> i.addUsage(input, output));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void succeed(UUID id, String reportJson) {
        repository.findById(id).filter(i -> i.getStatus().isOpen()).ifPresent(i -> i.succeed(reportJson));
    }

    /** Başarısızlık + kredi iadesi. ⚠️ İade {@code refund-insight:<id>} ile tekildir. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(UUID id, String errorCode) {
        CreatorInsight insight = repository.findById(id).orElse(null);
        if (insight == null || !insight.getStatus().isOpen()) {
            return;
        }
        insight.fail(errorCode);
        creditService.refund(insight.getUserId(), insight.getCost(), "refund-insight:" + id,
                "Detaylı veri raporu tamamlanamadı");
        log.info("Detaylı veri raporu başarısız, kredi iade edildi: {} ({})", id, errorCode);
    }

    /** Günde tek takipçi ölçümü; aynı gün ikinci ölçüm öncekinin üstüne yazar. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void snapshot(UUID entryId, long followers) {
        if (followers <= 0) {
            return;
        }
        Instant now = Instant.now();
        snapshots.upsert(entryId, followers, now, LocalDate.ofInstant(now, ZoneOffset.UTC));
    }
}
