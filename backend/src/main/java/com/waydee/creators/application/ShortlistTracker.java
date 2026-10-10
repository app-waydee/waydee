package com.waydee.creators.application;

import com.waydee.creators.domain.CreatorShortlistEntry;
import com.waydee.creators.infrastructure.CreatorShortlistRepository;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * <b>Günlük takipçi ölçümü</b> (109. tur) — kısa listedeki her üreticinin
 * profil sayfası günde bir kez okunur; "listedeyken ne kadar büyüdü" grafiği
 * bu ölçümlerden çizilir. Yapay zekâ çağrısı ve kredi YOK.
 *
 * <p>⚠️ ECS'de birden çok örnek aynı anda koşabilir: günlük tekil indeks
 * ({@code uq_creator_snapshots_day}) ikinci yazmayı üstüne yazmaya çevirir,
 * çift satır oluşmaz. Aynı profil iki kez okunur — kabul edilen bedel.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ShortlistTracker {

    private static final int BATCH = 20;
    private static final int MAX_ENTRIES = 5_000;

    private final CreatorShortlistRepository shortlist;
    private final ProfileEnricher enricher;
    private final InsightStore store;

    @Scheduled(cron = "0 30 4 * * *", zone = "UTC")
    public void daily() {
        int measured = 0;
        int page = 0;
        Page<CreatorShortlistEntry> batch;
        do {
            batch = shortlist.findAll(PageRequest.of(page++, BATCH, Sort.by("createdAt")));
            List<ProfileEnricher.Target> targets = batch.stream()
                    .map(e -> new ProfileEnricher.Target(e.getPlatform(), e.getHandle())).distinct().toList();
            Map<String, ProfileEnricher.Profile> profiles = enricher.enrich(targets);
            for (CreatorShortlistEntry e : batch) {
                ProfileEnricher.Profile p = profiles.get(new ProfileEnricher.Target(e.getPlatform(), e.getHandle()).key());
                if (p != null && p.followers() != null) {
                    store.snapshot(e.getId(), p.followers());
                    measured++;
                }
            }
        } while (batch.hasNext() && page * BATCH < MAX_ENTRIES);
        log.info("Kısa liste takibi: {} profil ölçüldü", measured);
    }
}
