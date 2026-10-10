package com.waydee.creators.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.creators.application.CandidateValidator.Outcome;
import com.waydee.creators.application.CreatorModels.Criteria;
import com.waydee.creators.application.CreatorModels.Extraction;
import com.waydee.creators.application.CreatorModels.Filters;
import com.waydee.creators.application.CreatorModels.Step;
import com.waydee.creators.application.CreatorModels.StepKey;
import com.waydee.creators.application.ai.ProviderException;
import com.waydee.creators.application.ai.ResearchGateway;
import com.waydee.creators.application.ai.ResearchGateway.Parsed;
import com.waydee.creators.application.ai.ResearchGateway.Served;
import com.waydee.creators.application.ai.ResearchProvider.ResearchResult;
import com.waydee.creators.domain.CreatorSearchStatus;
import com.waydee.creators.domain.Signal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * <b>Araştırma boru hattını koşturur</b> (108. tur).
 *
 * <pre>
 *   ACCESS   ✓ (istekte, kredi düşümüyle birlikte)
 *   REFINE   brief → arama planı          (yapılandırılmış çağrı)
 *   SEARCH   web aramalı derin araştırma   (serbest metin + kaynaklar)
 *   EXTRACT  notlar → adaylar              (yapılandırılmış çağrı) + doğrulama
 *   SCORE    sekiz sinyal, şeffaf puan     (sunucuda, modelsiz)
 * </pre>
 *
 * <p>🔴 <b>Her hata yolu krediyi iade eder.</b> Gövde tek bir
 * {@code catch (Throwable)} ile sarılı — {@code Exception} değil: bir
 * {@code Error} da iadeyi atlatmamalı (stüdyo koşucusuyla aynı kural).
 *
 * <p>⚠️ {@code @Transactional} <b>YOK</b>: ağ çağrıları dakikalar sürüyor.
 * Her yazı {@link CreatorSearchStore} üzerinden kendi kısa transaction'ında.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CreatorSearchRunner {

    private final CreatorSearchStore store;
    private final ResearchGateway gateway;
    private final CreatorPrompts prompts;
    private final CandidateValidator validator;
    private final ProfileEnricher enricher;
    private final ObjectMapper objectMapper;

    @Async("researchExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onQueued(CreatorSearchQueuedEvent event) {
        run(event.searchId());
    }

    void run(UUID id) {
        CreatorSearchStore.Snapshot snap = store.snapshot(id);
        if (snap == null || snap.status() != CreatorSearchStatus.QUEUED) {
            return;
        }
        List<Step> steps = new ArrayList<>(store.readSteps(snap.stepsJson()));
        StepKey current = StepKey.REFINE;
        long stepStart = System.currentTimeMillis();
        try {
            Filters filters = objectMapper.readValue(snap.filtersJson(), Filters.class);
            Map<Signal, Integer> weights = objectMapper.readValue(snap.weightsJson(),
                    new TypeReference<Map<Signal, Integer>>() { });

            set(steps, step(steps, StepKey.REFINE).active());
            if (!store.markRunning(id, steps)) {
                return;
            }

            // ---------------------------------------------------------- REFINE
            stepStart = System.currentTimeMillis();
            Served<Parsed<Criteria>> refine = gateway.structured(prompts.refineSystem(snap.locale()),
                    prompts.refinePrompt(snap.brief(), filters), CreatorPrompts.CRITERIA_SCHEMA,
                    prompts.criteriaSchema(), Criteria.class);
            Criteria criteria = refine.value().value();
            store.recordCriteria(id, criteria);
            store.addUsage(id, refine.value().usage(), refine.provider().name(), refine.model());
            finish(steps, StepKey.REFINE, refine, stepStart,
                    metrics("queries", CreatorPrompts.safe(criteria.searchQueries()).size()));

            // ---------------------------------------------------------- SEARCH
            current = StepKey.SEARCH;
            set(steps, step(steps, StepKey.SEARCH).active());
            store.updateSteps(id, steps);
            stepStart = System.currentTimeMillis();
            // 8 Eki 2026, kullanıcı: "çok fazla sürmesin" — arama bütçesi sonuç sayısıyla ölçeklenir.
            int maxSearches = Math.min(gateway.maxWebSearches(), filters.resultCount() <= 5 ? 8 : 12);
            Served<ResearchResult> research = gateway.research(prompts.researchSystem(maxSearches),
                    prompts.researchPrompt(snap.brief(), filters, criteria), maxSearches);
            store.addUsage(id, research.value().usage(), research.provider().name(), research.model());
            finish(steps, StepKey.SEARCH, research, stepStart,
                    metrics("searches", research.value().usage().webSearches(),
                            "sources", research.value().sources().size()));

            // --------------------------------------------------------- EXTRACT
            current = StepKey.EXTRACT;
            set(steps, step(steps, StepKey.EXTRACT).active());
            store.updateSteps(id, steps);
            stepStart = System.currentTimeMillis();
            Served<Parsed<Extraction>> extract = gateway.structured(prompts.extractSystem(snap.locale()),
                    prompts.extractPrompt(snap.brief(), filters, research.value().text(), research.value().sources()),
                    CreatorPrompts.EXTRACTION_SCHEMA, prompts.extractionSchema(), Extraction.class);
            store.addUsage(id, extract.value().usage(), extract.provider().name(), extract.model());
            int rawCount = CreatorPrompts.safe(extract.value().value().creators()).size();
            // Her adayın kendi profil sayfası: gerçek fotoğraf + platformun yazdığı takipçi.
            Map<String, ProfileEnricher.Profile> profiles =
                    enricher.enrich(validator.targets(extract.value().value().creators(), filters));
            Outcome outcome = validator.validate(extract.value().value().creators(), research.value().sources(),
                    filters, weights, profiles, true);
            finish(steps, StepKey.EXTRACT, extract, stepStart,
                    metrics("candidates", rawCount, "dropped", outcome.dropped().size()));

            // ----------------------------------------------------------- SCORE
            current = StepKey.SCORE;
            stepStart = System.currentTimeMillis();
            set(steps, step(steps, StepKey.SCORE).done(null, null, System.currentTimeMillis() - stepStart,
                    List.of(), metrics("results", outcome.creators().size())));

            store.succeed(id, outcome.creators(), outcome.creators().size(), outcome.dropped(), steps);
            log.info("Influencer araması bitti: {} — {} sonuç, {} elendi", id,
                    outcome.creators().size(), outcome.dropped().size());
        } catch (Throwable t) {
            set(steps, step(steps, current).failed(System.currentTimeMillis() - stepStart));
            String code = errorCode(t);
            if (t instanceof ProviderException) {
                log.warn("Influencer araması düştü ({} adımı, {}): {}", current, code, t.getMessage());
            } else {
                log.error("Influencer aramasında beklenmeyen hata ({} adımı)", current, t);
            }
            store.fail(id, code, steps);
            if (t instanceof Error error) {
                throw error;
            }
        }
    }

    /**
     * Kullanıcıya gösterilecek <b>kod</b> — metin değil.
     *
     * <p>⚠️ Ham sağlayıcı mesajı kullanıcıya gösterilmez: içinde model adı,
     * istek kimliği olabilir; ayrıca beş dile çevrilemez.
     */
    static String errorCode(Throwable t) {
        if (t instanceof ProviderException pe) {
            if (pe.provider() == null) {
                return "NO_PROVIDER";
            }
            return switch (pe.kind()) {
                case AUTH, WORKSPACE_REQUIRED -> "PROVIDER_AUTH";
                case RATE_LIMIT -> "PROVIDER_LIMIT";
                case UNAVAILABLE, NETWORK -> "PROVIDER_DOWN";
                case REFUSAL -> "REFUSED";
                case MALFORMED, BAD_REQUEST -> "MALFORMED";
            };
        }
        return "INTERNAL";
    }

    // ---------------------------------------------------------------- yardımcı

    private void finish(List<Step> steps, StepKey key, Served<?> served, long start, Map<String, Integer> metrics) {
        set(steps, step(steps, key).done(served.provider().label(), served.model(),
                System.currentTimeMillis() - start, served.failures(), metrics));
    }

    private static Step step(List<Step> steps, StepKey key) {
        return steps.stream().filter(s -> s.key() == key).findFirst().orElse(Step.queued(key));
    }

    private static void set(List<Step> steps, Step updated) {
        for (int i = 0; i < steps.size(); i++) {
            if (steps.get(i).key() == updated.key()) {
                steps.set(i, updated);
                return;
            }
        }
        steps.add(updated);
    }

    private static Map<String, Integer> metrics(Object... pairs) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            out.put((String) pairs[i], ((Number) pairs[i + 1]).intValue());
        }
        return out;
    }
}
