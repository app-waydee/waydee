package com.waydee.creators.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.common.ai.AiProviderSettings;
import com.waydee.common.error.ApiException;
import com.waydee.common.error.ErrorCode;
import com.waydee.creators.api.dto.CreatorDtos.CreatorConfig;
import com.waydee.creators.api.dto.CreatorDtos.SearchDetail;
import com.waydee.creators.api.dto.CreatorDtos.SearchRequest;
import com.waydee.creators.api.dto.CreatorDtos.SearchSummary;
import com.waydee.creators.api.dto.CreatorDtos.ShortlistItem;
import com.waydee.creators.application.CreatorModels.Creator;
import com.waydee.creators.application.CreatorModels.Criteria;
import com.waydee.creators.application.CreatorModels.Dropped;
import com.waydee.creators.application.CreatorModels.Filters;
import com.waydee.creators.application.CreatorModels.Step;
import com.waydee.creators.application.CreatorModels.StepKey;
import com.waydee.creators.application.ai.ResearchGateway;
import com.waydee.creators.domain.CreatorSearch;
import com.waydee.creators.domain.CreatorSearchStatus;
import com.waydee.creators.domain.CreatorShortlistEntry;
import com.waydee.creators.domain.Platform;
import com.waydee.creators.domain.Signal;
import com.waydee.creators.infrastructure.CreatorSearchRepository;
import com.waydee.creators.infrastructure.CreatorShortlistRepository;
import com.waydee.identity.application.CreditService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * <b>Influencer keşfi</b> — istek tarafı (108. tur).
 *
 * <h3>Kapı sırası (para almadan önce her şey)</h3>
 * <ol>
 *   <li>Filtreler normalleştirilir — geçersizse 400, kredi dokunulmaz.</li>
 *   <li>Yapılandırılmış sağlayıcı yoksa reddedilir — <b>kullanıcıdan bizim
 *       yapılandırma eksiğimiz için para almak</b> olmazdı.</li>
 *   <li>Yapay zekâ kapısı ({@code assertCanUseAi}) — stüdyoyla aynı: ücretli
 *       üyelik ya da ücretsiz deneme hakkı.</li>
 *   <li>Hız kapıları — aynı anda {@value #MAX_ACTIVE} arama, saatte
 *       {@value #MAX_PER_HOUR}.</li>
 *   <li>Satır yazılır, kredi atomik düşülür, olay yayınlanır (koşucu commit
 *       sonrası başlar).</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class CreatorSearchService {

    public static final int MAX_ACTIVE = 2;
    public static final int MAX_PER_HOUR = 15;
    public static final int MAX_SHORTLIST = 500;

    private static final Set<String> LOCALES = Set.of("tr", "en", "ar", "de", "es");
    private static final Set<String> COUNTRIES = Set.of(Locale.getISOCountries());
    private static final Set<String> LANGUAGES = Set.of(Locale.getISOLanguages());
    private static final Set<String> CURRENCIES = Set.of("TRY", "USD", "EUR", "GBP");
    private static final Set<String> GENDERS = Set.of("ANY", "FEMALE", "MALE");

    private final CreatorSearchRepository searches;
    private final CreatorShortlistRepository shortlist;
    private final com.waydee.creators.infrastructure.CreatorSnapshotRepository snapshots;
    private final CreditService creditService;
    private final ResearchGateway gateway;
    private final AiProviderSettings providerSettings;
    private final CreatorScorer scorer;
    private final ApplicationEventPublisher events;
    private final ObjectMapper objectMapper;

    // ------------------------------------------------------------------ arama

    @Transactional(readOnly = true)
    public CreatorConfig config() {
        AiProviderSettings.Config config = providerSettings.config();
        return new CreatorConfig(gateway.isAvailable(), config.costSmall(), config.costLarge());
    }

    @Transactional
    public SearchDetail start(UUID userId, SearchRequest request) {
        long gateStart = System.currentTimeMillis();
        Filters filters = normalize(request);
        String locale = request.locale() != null && LOCALES.contains(request.locale()) ? request.locale() : "tr";

        if (!gateway.isAvailable()) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR,
                    "Influencer keşfi şu anda kullanılamıyor. Lütfen daha sonra tekrar dene.");
        }
        creditService.assertCanUseAi(userId);
        assertWithinRateLimits(userId);

        AiProviderSettings.Config config = providerSettings.config();
        int cost = filters.resultCount() > 5 ? config.costLarge() : config.costSmall();
        Map<Signal, Integer> weights = scorer.sanitizeWeights(request.weights(), filters.emergingOnly());

        List<Step> steps = new ArrayList<>();
        for (StepKey key : StepKey.values()) {
            steps.add(Step.queued(key));
        }
        // ACCESS adımı burada, gerçek süresiyle tamamlanır: kapıların ve kredi
        // düşümünün süresi — InfluSense'in "Checking tokens · 338ms" satırı.
        CreatorSearch search = searches.save(new CreatorSearch(userId, request.brief().strip(), write(filters),
                write(weights), write(steps), filters.resultCount(), cost, locale));
        creditService.spend(userId, cost, "creator:" + search.getId(), "Influencer keşfi");

        steps.set(0, steps.get(0).done(null, null, System.currentTimeMillis() - gateStart, List.of(),
                Map.of("credits", cost)));
        search.updateSteps(write(steps));

        events.publishEvent(new CreatorSearchQueuedEvent(search.getId()));
        return detail(search);
    }

    @Transactional(readOnly = true)
    public SearchDetail get(UUID userId, UUID searchId) {
        return detail(owned(userId, searchId));
    }

    @Transactional(readOnly = true)
    public List<SearchSummary> history(UUID userId, int limit) {
        return searches.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, Math.max(1, Math.min(limit, 100))))
                .map(this::summary)
                .getContent();
    }

    /**
     * Raporun ağırlıklarını kaydeder.
     *
     * <p>⚠️ Sıralama zaten istemcide yeniden hesaplanıyor; bu uç yalnız
     * <b>kalıcılık</b> içindir — raporu yeniden açan kullanıcı en son
     * bıraktığı sıralamayı görsün. Yeni bir yapay zekâ çağrısı ya da kredi YOK.
     */
    @Transactional
    public Map<Signal, Integer> updateWeights(UUID userId, UUID searchId, Map<Signal, Integer> raw) {
        CreatorSearch search = owned(userId, searchId);
        Filters filters = read(search.getFiltersJson(), Filters.class);
        Map<Signal, Integer> weights = scorer.sanitizeWeights(raw, filters.emergingOnly());
        search.updateWeights(write(weights));
        return weights;
    }

    // -------------------------------------------------------------- kısa liste

    @Transactional(readOnly = true)
    public List<ShortlistItem> shortlist(UUID userId) {
        return shortlist.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::item).toList();
    }

    /**
     * Kısa listeye ekler — veri <b>aramanın anlık görüntüsünden</b> kopyalanır.
     *
     * <p>⚠️ Zaten listedeyse mevcut kayıt döner (hata değil): aynı kişiyi iki
     * ayrı aramada görüp ikisinde de "kaydet"e basmak meşru bir davranış.
     */
    @Transactional
    public ShortlistItem addToShortlist(UUID userId, UUID searchId, String creatorId) {
        CreatorSearch search = owned(userId, searchId);
        List<Creator> results = search.getResultsJson() == null ? List.of()
                : read(search.getResultsJson(), new TypeReference<List<Creator>>() { });
        Creator creator = results.stream().filter(c -> c.id().equals(creatorId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Bu üretici aramanın sonuçlarında yok"));

        String handle = CreatorShortlistEntry.normalizeHandle(creator.handle());
        var existing = shortlist.findByUserIdAndPlatformAndHandle(userId, creator.platform(), handle);
        if (existing.isPresent()) {
            return item(existing.get());
        }
        if (shortlist.countByUserId(userId) >= MAX_SHORTLIST) {
            throw ApiException.badRequest("Kısa liste en çok " + MAX_SHORTLIST + " kişi alabilir");
        }
        try {
            CreatorShortlistEntry saved = shortlist.saveAndFlush(new CreatorShortlistEntry(userId, creator.platform(),
                    handle, write(creator), searchId));
            // Takibin ilk noktası: eklendiği andaki takipçi (109. tur).
            if (creator.followers() != null && creator.followers() > 0) {
                snapshots.upsert(saved.getId(), creator.followers(), Instant.now(),
                        java.time.LocalDate.now(java.time.ZoneOffset.UTC));
            }
            return item(saved);
        } catch (DataIntegrityViolationException e) {
            // Aynı anda iki tıklama: tekil indeks ikincisini durdurdu — mevcut kaydı döndür.
            return shortlist.findByUserIdAndPlatformAndHandle(userId, creator.platform(), handle)
                    .map(this::item)
                    .orElseThrow(() -> e);
        }
    }

    @Transactional
    public ShortlistItem updateNote(UUID userId, UUID entryId, String note) {
        CreatorShortlistEntry entry = shortlist.findByIdAndUserId(entryId, userId)
                .orElseThrow(() -> ApiException.notFound("Kayıt bulunamadı"));
        entry.updateNote(note);
        return item(entry);
    }

    @Transactional
    public void removeFromShortlist(UUID userId, UUID entryId) {
        CreatorShortlistEntry entry = shortlist.findByIdAndUserId(entryId, userId)
                .orElseThrow(() -> ApiException.notFound("Kayıt bulunamadı"));
        shortlist.delete(entry);
    }

    // ------------------------------------------------------------ normalleştirme

    /**
     * İsteği doğrular ve normalleştirir.
     *
     * <p>⚠️ Her hata <b>kullanıcıya okunur bir cümle</b> döndürür ve hiçbiri
     * kredi düşümünden sonra değildir.
     */
    Filters normalize(SearchRequest r) {
        if (r.brief() == null || r.brief().strip().length() < 10) {
            throw ApiException.badRequest("Ne aradığını en az 10 karakterle anlat");
        }
        List<Platform> platforms = distinct(r.platforms());
        if (platforms.isEmpty()) {
            throw ApiException.badRequest("En az bir platform seç");
        }
        String country = null;
        if (r.country() != null && !r.country().isBlank()) {
            country = r.country().trim().toUpperCase(Locale.ROOT);
            if (!COUNTRIES.contains(country)) {
                throw ApiException.badRequest("Ülke kodu geçersiz");
            }
        }
        String language = null;
        if (r.language() != null && !r.language().isBlank()) {
            language = r.language().trim().toLowerCase(Locale.ROOT);
            if (language.length() != 2 || !LANGUAGES.contains(language)) {
                throw ApiException.badRequest("Dil kodu geçersiz");
            }
        }
        String gender = r.gender() == null ? "ANY" : r.gender().trim().toUpperCase(Locale.ROOT);
        if (!GENDERS.contains(gender)) {
            throw ApiException.badRequest("Cinsiyet seçeneği geçersiz");
        }
        Double minEngagement = r.minEngagementPct();
        if (minEngagement != null && (minEngagement.isNaN() || minEngagement < 0 || minEngagement > 20)) {
            throw ApiException.badRequest("En düşük etkileşim %0 ile %20 arasında olmalı");
        }
        if (minEngagement != null && minEngagement == 0) {
            minEngagement = null;
        }
        Integer budget = r.budgetMax();
        String currency = null;
        if (budget != null) {
            if (budget < 1 || budget > 10_000_000) {
                throw ApiException.badRequest("Bütçe 1 ile 10.000.000 arasında olmalı");
            }
            currency = r.currency() == null ? "TRY" : r.currency().trim().toUpperCase(Locale.ROOT);
            if (!CURRENCIES.contains(currency)) {
                throw ApiException.badRequest("Para birimi geçersiz");
            }
        }
        // 8 Eki 2026, kullanıcı: 10/20 yerine 5/10 — araştırma kısa sürsün.
        int count = r.resultCount() == null ? 5 : r.resultCount();
        if (count != 5 && count != 10) {
            throw ApiException.badRequest("Sonuç sayısı 5 ya da 10 olabilir");
        }
        // Kademeler sıralı saklanır: aynı seçim her zaman aynı JSON'u üretsin.
        List<com.waydee.creators.domain.SizeTier> tiers = distinct(r.tiers());
        tiers = tiers.stream().sorted().toList();
        return new Filters(platforms, distinct(r.categories()), distinct(r.formats()), tiers, country, language,
                gender, minEngagement, Boolean.TRUE.equals(r.emergingOnly()), budget, currency,
                Boolean.TRUE.equals(r.brandSafe()), count);
    }

    private void assertWithinRateLimits(UUID userId) {
        long active = searches.countByUserIdAndStatusIn(userId,
                EnumSet.of(CreatorSearchStatus.QUEUED, CreatorSearchStatus.RUNNING));
        if (active >= MAX_ACTIVE) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "Aynı anda en fazla " + MAX_ACTIVE + " arama yapabilirsin. Süren aramaların bitsin.");
        }
        long lastHour = searches.countByUserIdAndCreatedAtAfter(userId, Instant.now().minus(Duration.ofHours(1)));
        if (lastHour >= MAX_PER_HOUR) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "Saatlik arama sınırına ulaştın. Bir süre sonra tekrar dene.");
        }
    }

    // ---------------------------------------------------------------- dönüşüm

    private CreatorSearch owned(UUID userId, UUID searchId) {
        return searches.findByIdAndUserId(searchId, userId)
                .orElseThrow(() -> ApiException.notFound("Arama bulunamadı"));
    }

    private SearchDetail detail(CreatorSearch s) {
        boolean failed = s.getStatus() == CreatorSearchStatus.FAILED;
        return new SearchDetail(s.getId(), s.getStatus().name(), s.getBrief(),
                read(s.getFiltersJson(), Filters.class),
                read(s.getWeightsJson(), new TypeReference<Map<Signal, Integer>>() { }),
                s.getCriteriaJson() == null ? null : read(s.getCriteriaJson(), Criteria.class),
                read(s.getStepsJson(), new TypeReference<List<Step>>() { }).stream().map(CreatorSearchService::publicStep).toList(),
                s.getResultsJson() == null ? null : read(s.getResultsJson(), new TypeReference<List<Creator>>() { }),
                s.getDroppedJson() == null ? null : read(s.getDroppedJson(), new TypeReference<List<Dropped>>() { }),
                s.getResultCount(), s.getRequestedCount(), s.getCost(),
                failed ? s.getErrorMessage() : null,
                s.getCreatedAt(), s.getStartedAt(), s.getFinishedAt());
    }

    /**
     * Adımın <b>kullanıcıya giden</b> hâli — 7 Eki 2026, kullanıcı talimatı:
     * <i>"Waydee kendisi bir agentmiş gibi hissettirsin; arka planda yapay zekâya
     * istek attığımızı hissettirmememiz lazım. Web araması yaptığını gösterme,
     * çoklu kaynak yazarsın."</i>
     *
     * <p>🔒 Sağlayıcı adı, model, "yedeğe geçildi" bilgisi ve web araması sayısı
     * yanıttan <b>tamamen çıkarılır</b>. Yalnız ekranda gizlemek yetmezdi:
     * tarayıcının ağ sekmesini açan herkes JSON'da "Claude"/"gpt-6-astra" görürdü.
     * Veritabanında duruyorlar — yönetim tüketim ekranı onları kullanıyor.
     */
    private static Step publicStep(Step step) {
        Map<String, Integer> metrics = new java.util.LinkedHashMap<>(step.metrics());
        metrics.remove("searches");
        return new Step(step.key(), step.state(), null, null, step.durationMs(), List.of(), metrics);
    }

    private SearchSummary summary(CreatorSearch s) {
        Filters filters = read(s.getFiltersJson(), Filters.class);
        return new SearchSummary(s.getId(), s.getStatus().name(), s.getBrief(), filters.platforms(),
                s.getResultCount(), s.getRequestedCount(), s.getCost(),
                s.getStatus() == CreatorSearchStatus.FAILED ? s.getErrorMessage() : null,
                s.getCreatedAt(), s.getFinishedAt());
    }

    private ShortlistItem item(CreatorShortlistEntry e) {
        return new ShortlistItem(e.getId(), e.getPlatform(), e.getHandle(), read(e.getDataJson(), Creator.class),
                e.getNote(), e.getSourceSearchId(), e.getCreatedAt());
    }

    private static <T> List<T> distinct(List<T> list) {
        return list == null ? List.of() : list.stream().filter(v -> v != null).distinct().toList();
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("JSON yazılamadı", e);
        }
    }

    private <T> T read(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Kayıt okunamadı", e);
        }
    }

    private <T> T read(String json, TypeReference<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Kayıt okunamadı", e);
        }
    }
}
