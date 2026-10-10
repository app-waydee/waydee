package com.waydee.creators.application;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.creators.application.CreatorModels.Creator;
import com.waydee.creators.application.InsightModels.RawInsight;
import com.waydee.creators.application.InsightModels.Report;
import com.waydee.creators.application.ai.ResearchGateway;
import com.waydee.creators.application.ai.ResearchGateway.Parsed;
import com.waydee.creators.application.ai.ResearchGateway.Served;
import com.waydee.creators.application.ai.ResearchProvider.ResearchResult;
import com.waydee.creators.domain.CreatorInsight;
import com.waydee.creators.domain.CreatorShortlistEntry;
import com.waydee.creators.infrastructure.CreatorInsightRepository;
import com.waydee.creators.infrastructure.CreatorShortlistRepository;
import com.waydee.creators.infrastructure.CreatorSnapshotRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * <b>"Detaylı veriler" araştırmasını koşturur</b> (109. tur).
 *
 * <pre>
 *   PROFILE   profil sayfası → gerçek takipçi + fotoğraf, takip ölçümü yazılır
 *   RESEARCH  web aramalı kısa araştırma (en çok 5 arama)
 *   ANALYZE   notlar → şema; boşluklar ortalamayla dolar ({@link InsightAssembler})
 * </pre>
 *
 * <p>🔴 Her hata yolu krediyi iade eder ({@link InsightStore#fail}).
 */
@Slf4j
@Component
public class InsightRunner {

    static final int MAX_SEARCHES = 5;

    private final InsightStore store;
    private final CreatorInsightRepository insights;
    private final CreatorShortlistRepository shortlist;
    private final CreatorSnapshotRepository snapshots;
    private final ResearchGateway gateway;
    private final InsightPrompts prompts;
    private final InsightAssembler assembler;
    private final ProfileEnricher enricher;
    private final ObjectMapper objectMapper;

    public InsightRunner(InsightStore store, CreatorInsightRepository insights, CreatorShortlistRepository shortlist,
                         CreatorSnapshotRepository snapshots, ResearchGateway gateway, InsightPrompts prompts,
                         InsightAssembler assembler, ProfileEnricher enricher, ObjectMapper objectMapper) {
        this.store = store;
        this.insights = insights;
        this.shortlist = shortlist;
        this.snapshots = snapshots;
        this.gateway = gateway;
        this.prompts = prompts;
        this.assembler = assembler;
        this.enricher = enricher;
        this.objectMapper = objectMapper.copy().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @Async("researchExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onQueued(InsightQueuedEvent event) {
        run(event.insightId());
    }

    void run(UUID id) {
        CreatorInsight insight = insights.findById(id).orElse(null);
        if (insight == null || !store.markRunning(id)) {
            return;
        }
        try {
            CreatorShortlistEntry entry = shortlist.findById(insight.getShortlistId()).orElse(null);
            if (entry == null) {
                store.fail(id, "NOT_FOUND");
                return;
            }
            Creator creator = objectMapper.readValue(entry.getDataJson(), Creator.class);

            // --------------------------------------------------------- PROFILE
            ProfileEnricher.Target target = new ProfileEnricher.Target(entry.getPlatform(), entry.getHandle());
            ProfileEnricher.Profile profile = enricher.enrich(List.of(target))
                    .getOrDefault(target.key(), ProfileEnricher.Profile.EMPTY);
            if (profile.followers() != null) {
                store.snapshot(entry.getId(), profile.followers());
            }

            // -------------------------------------------------------- RESEARCH
            store.phase(id, "RESEARCH");
            Long known = profile.followers() != null ? profile.followers() : creator.followers();
            Served<ResearchResult> research = gateway.research(prompts.researchSystem(MAX_SEARCHES),
                    prompts.researchPrompt(entry.getPlatform(), entry.getHandle(), creator.displayName(), known),
                    MAX_SEARCHES);
            store.addUsage(id, research.value().usage().inputTokens(), research.value().usage().outputTokens());

            // --------------------------------------------------------- ANALYZE
            store.phase(id, "ANALYZE");
            Served<Parsed<RawInsight>> extract = gateway.structured(prompts.extractSystem(insight.getLocale()),
                    prompts.extractPrompt(research.value().text(), research.value().sources()),
                    InsightPrompts.SCHEMA_NAME, prompts.schema(), RawInsight.class);
            store.addUsage(id, extract.value().usage().inputTokens(), extract.value().usage().outputTokens());

            List<InsightAssembler.Point> series = snapshots.series(entry.getId()).stream()
                    .map(p -> new InsightAssembler.Point(p.getFollowers(), p.getCapturedAt())).toList();
            Report report = assembler.assemble(extract.value().value(), entry.getPlatform(), profile.followers(),
                    creator.followers() == null ? 0 : creator.followers(), series, research.value().sources(),
                    Instant.now());
            store.succeed(id, objectMapper.writeValueAsString(Map.of("report", report,
                    "avatarUrl", profile.avatarUrl() == null ? "" : profile.avatarUrl())));
        } catch (Exception e) {
            String code = CreatorSearchRunner.errorCode(e);
            log.warn("Detaylı veri raporu düştü ({}): {}", code, e.getMessage());
            store.fail(id, code);
        }
    }
}
