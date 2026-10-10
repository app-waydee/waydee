package com.waydee.creators.application;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.common.error.ApiException;
import com.waydee.common.error.ErrorCode;
import com.waydee.creators.application.InsightModels.Report;
import com.waydee.creators.application.ai.ResearchGateway;
import com.waydee.creators.domain.CreatorInsight;
import com.waydee.creators.domain.CreatorSearchStatus;
import com.waydee.creators.domain.CreatorShortlistEntry;
import com.waydee.creators.infrastructure.CreatorInsightRepository;
import com.waydee.creators.infrastructure.CreatorShortlistRepository;
import com.waydee.creators.infrastructure.CreatorSnapshotRepository;
import com.waydee.identity.application.CreditService;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * <b>Kısa liste takibi + "Detaylı veriler"</b> — istek tarafı (109. tur).
 *
 * <p>🔒 Her uç sahiplik koşuluyla okur ({@code findByIdAndUserId}).
 * 🔴 Kredi önce düşer, araştırma commit sonrası arka planda koşar; her hata
 * yolu iade eder ({@link InsightStore#fail}).
 */
@Service
public class InsightService {

    /** Kısa araştırma (en çok 5 web araması) — tam aramanın yarısından az. */
    public static final int COST = 15;
    public static final int MAX_PER_HOUR = 20;
    private static final Set<String> LOCALES = Set.of("tr", "en", "ar", "de", "es");
    private static final EnumSet<CreatorSearchStatus> OPEN =
            EnumSet.of(CreatorSearchStatus.QUEUED, CreatorSearchStatus.RUNNING);

    private final CreatorShortlistRepository shortlist;
    private final CreatorInsightRepository insights;
    private final CreatorSnapshotRepository snapshots;
    private final CreditService creditService;
    private final ResearchGateway gateway;
    private final ApplicationEventPublisher events;
    private final ObjectMapper objectMapper;

    public InsightService(CreatorShortlistRepository shortlist, CreatorInsightRepository insights,
                          CreatorSnapshotRepository snapshots, CreditService creditService, ResearchGateway gateway,
                          ApplicationEventPublisher events, ObjectMapper objectMapper) {
        this.shortlist = shortlist;
        this.insights = insights;
        this.snapshots = snapshots;
        this.creditService = creditService;
        this.gateway = gateway;
        this.events = events;
        this.objectMapper = objectMapper.copy().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    public record TrackPoint(long followers, Instant at) {
    }

    /** Listeye eklendiğinden beri ölçülen takipçi serisi. */
    public record Tracking(Instant since, List<TrackPoint> points, Long change, Double changePct) {
    }

    /**
     * @param status NONE (hiç istenmedi) · QUEUED · RUNNING · SUCCEEDED · FAILED — en son isteğin durumu
     * @param report en son BAŞARILI rapor; yenileme sürerken eskisi gösterilir
     */
    public record InsightView(UUID entryId, String status, String phase, String errorCode, int cost,
                              Report report, Instant reportAt, String avatarUrl, Tracking tracking) {
    }

    @Transactional(readOnly = true)
    public InsightView view(UUID userId, UUID entryId) {
        CreatorShortlistEntry entry = owned(userId, entryId);
        CreatorInsight latest = insights.findFirstByShortlistIdAndUserIdOrderByCreatedAtDesc(entryId, userId)
                .orElse(null);
        CreatorInsight done = insights.findFirstByShortlistIdAndUserIdAndStatusOrderByCreatedAtDesc(
                entryId, userId, CreatorSearchStatus.SUCCEEDED).orElse(null);
        Report report = null;
        String avatar = null;
        if (done != null && done.getReportJson() != null) {
            try {
                JsonNode node = objectMapper.readTree(done.getReportJson());
                report = objectMapper.treeToValue(node.get("report"), Report.class);
                String a = node.path("avatarUrl").asText("");
                avatar = a.isBlank() ? null : a;
            } catch (Exception e) {
                report = null;
            }
        }
        return new InsightView(entry.getId(), latest == null ? "NONE" : latest.getStatus().name(),
                latest == null ? null : latest.getPhase(), latest == null ? null : latest.getErrorCode(), COST,
                report, done == null ? null : done.getFinishedAt(), avatar, tracking(entry));
    }

    @Transactional
    public InsightView start(UUID userId, UUID entryId, String locale) {
        CreatorShortlistEntry entry = owned(userId, entryId);
        if (insights.existsByShortlistIdAndStatusIn(entryId, OPEN)) {
            return view(userId, entryId); // Çift tıklama ikinci kez ücret almaz.
        }
        if (!gateway.isAvailable()) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR,
                    "Waydee Agent şu anda kullanılamıyor. Lütfen daha sonra tekrar dene.");
        }
        creditService.assertCanUseAi(userId);
        if (insights.countByUserIdAndCreatedAtAfter(userId, Instant.now().minus(Duration.ofHours(1))) >= MAX_PER_HOUR) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Saatlik detaylı veri sınırına ulaştın. Biraz sonra tekrar dene.");
        }
        String loc = locale != null && LOCALES.contains(locale) ? locale : "tr";
        CreatorInsight insight = insights.save(new CreatorInsight(entry.getId(), userId, loc, COST));
        creditService.spend(userId, COST, "insight:" + insight.getId(), "Influencer detaylı veriler");
        events.publishEvent(new InsightQueuedEvent(insight.getId()));
        return view(userId, entryId);
    }

    private Tracking tracking(CreatorShortlistEntry entry) {
        List<TrackPoint> points = snapshots.series(entry.getId()).stream()
                .map(p -> new TrackPoint(p.getFollowers(), p.getCapturedAt())).toList();
        Long change = null;
        Double pct = null;
        if (points.size() >= 2) {
            long first = points.get(0).followers();
            change = points.get(points.size() - 1).followers() - first;
            pct = first > 0 ? Math.round(change * 10000.0 / first) / 100.0 : null;
        }
        return new Tracking(entry.getCreatedAt(), points, change, pct);
    }

    private CreatorShortlistEntry owned(UUID userId, UUID entryId) {
        return shortlist.findByIdAndUserId(entryId, userId)
                .orElseThrow(() -> ApiException.notFound("Kayıt bulunamadı"));
    }
}
