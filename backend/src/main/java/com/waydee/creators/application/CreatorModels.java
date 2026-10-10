package com.waydee.creators.application;

import com.waydee.creators.domain.ContentFormat;
import com.waydee.creators.domain.CreatorCategory;
import com.waydee.creators.domain.Platform;
import com.waydee.creators.domain.Signal;
import com.waydee.creators.domain.SizeTier;

import java.util.List;
import java.util.Map;

/**
 * Influencer keşfinin veri sözleşmeleri (108. tur).
 *
 * <p>⚠️ Bunlar <b>JSON olarak saklanır</b> ({@code filters_json},
 * {@code results_json}, {@code steps_json}) ve istemciye aynen iner. Bir alanın
 * adını değiştirmek eski aramaların çözümlenmesini bozar; yeni alanlar
 * <b>eklenir</b>, var olanlar yeniden adlandırılmaz.
 */
public final class CreatorModels {

    private CreatorModels() {
    }

    /** Sunucuda doğrulanmış, normalleştirilmiş filtreler. */
    public record Filters(List<Platform> platforms, List<CreatorCategory> categories, List<ContentFormat> formats,
                          List<SizeTier> tiers, String country, String language, String gender,
                          Double minEngagementPct, boolean emergingOnly, Integer budgetMax, String currency,
                          boolean brandSafe, int resultCount) {
    }

    /** Modelin brief'ten çıkardığı yapı — REFINE adımının çıktısı. */
    public record Criteria(String summary, String niche, List<String> keywords, List<String> searchQueries,
                           String locationHint, String languageHint, List<String> exclusions) {
    }

    /** Çıkarım adımının ham çıktısı — henüz doğrulanmamış. */
    public record Extraction(List<RawCandidate> creators) {
    }

    public record RawCandidate(String platform, String handle, String displayName, String profileUrl,
                               String country, String language, List<String> categories, Long followers,
                               Double engagementRatePct, Long avgViews, Double growth30dPct,
                               Double estCostMin, Double estCostMax, String costCurrency, Integer contentFit,
                               String summary, List<String> fitReasons, List<String> watchouts,
                               List<RawEvidence> evidence) {
    }

    public record RawEvidence(String url, String claim) {
    }

    /** Büyüme durumu — InfluSense'in "EMERGING / GOING VIRAL" etiketleri. */
    public enum Momentum { EMERGING, VIRAL, STEADY, UNKNOWN }

    /**
     * Doğrulanmış ve puanlanmış içerik üreticisi — {@code results_json}'ın bir satırı.
     *
     * @param signals sinyal → 0..1. <b>Değer {@code null}</b> = veri bulunamadı
     *                (nötr sayılır); <b>anahtar yok</b> = kullanıcı bu boyutu
     *                istemedi (hesaba katılmaz). Bu ayrım "bilinmiyor" ile
     *                "önemsiz"i karıştırmamak için var.
     * @param score   varsayılan/arama ağırlıklarıyla 0..100 — istemci kullanıcı
     *                ağırlıklarıyla yeniden hesaplar (formül {@link CreatorScorer#score})
     * @param coverage uygulanabilir sinyallerin kaçı veriye dayanıyor (0..1)
     */
    public record Creator(String id, Platform platform, String handle, String displayName, String profileUrl,
                          String avatarUrl,
                          String country, String language, List<CreatorCategory> categories,
                          Long followers, SizeTier tier, Double engagementRatePct, Long avgViews,
                          Double growth30dPct, Double estCostMin, Double estCostMax, String costCurrency,
                          int contentFit, Momentum momentum, String summary, List<String> fitReasons,
                          List<String> watchouts, List<Evidence> evidence, Map<Signal, Double> signals,
                          double score, double coverage) {
    }

    /**
     * @param verified kaynak adresi araştırma adımında <b>gerçekten okunan</b>
     *                 sayfalar arasında mı
     */
    public record Evidence(String url, String title, String claim, boolean verified) {
    }

    // ------------------------------------------------------------ boru hattı

    public enum StepKey { ACCESS, REFINE, SEARCH, EXTRACT, SCORE }

    public enum StepState { QUEUED, ACTIVE, DONE, FAILED }

    /**
     * Şeffaf boru hattının bir adımı.
     *
     * @param failedOver bu adımda düşüp yerini diğerine bırakan sağlayıcılar
     *                   (ör. ["Claude"]). ⚠️ Metin değil VERİ: istemci beş
     *                   dilde kendi cümlesini kurar.
     * @param metrics    adımın sayıları (kaynak, sorgu, aday, elenen…)
     */
    public record Step(StepKey key, StepState state, String provider, String model, Long durationMs,
                       List<String> failedOver, Map<String, Integer> metrics) {

        public static Step queued(StepKey key) {
            return new Step(key, StepState.QUEUED, null, null, null, List.of(), Map.of());
        }

        public Step active() {
            return new Step(key, StepState.ACTIVE, provider, model, null, failedOver, metrics);
        }

        public Step done(String provider, String model, long durationMs, List<String> failedOver,
                         Map<String, Integer> metrics) {
            return new Step(key, StepState.DONE, provider, model, durationMs, failedOver, metrics);
        }

        public Step failed(long durationMs) {
            return new Step(key, StepState.FAILED, provider, model, durationMs, failedOver, metrics);
        }
    }

    /** Neden elendi — istemci beş dilde açıklar. */
    public enum DropReason {
        /** Kaynağı araştırmada okunan sayfalar arasında yok — uydurma olabilir. */
        UNVERIFIED_SOURCE,
        /** Profil sayfasında da takipçi sayısı bulunamadı — boş kart gösterilmez. */
        MISSING_DATA,
        /** Kullanıcı adı platformun kurallarına uymuyor. */
        INVALID_HANDLE,
        /** İstenmeyen platform. */
        PLATFORM_NOT_REQUESTED,
        /** Aynı kişi ikinci kez. */
        DUPLICATE,
        /** Takipçi sayısı biliniyor ve istenen kademelerin dışında. */
        OUT_OF_TIER,
        /** Etkileşim biliniyor ve istenen alt sınırın altında. */
        BELOW_ENGAGEMENT,
        /** Ülke biliniyor ve istenenle uyuşmuyor. */
        COUNTRY_MISMATCH,
        /** Dil biliniyor ve istenenle uyuşmuyor. */
        LANGUAGE_MISMATCH,
        /** İstenen sayının üstü — en iyiler tutuldu. */
        OVER_LIMIT
    }

    public record Dropped(String platform, String handle, DropReason reason) {
    }
}
