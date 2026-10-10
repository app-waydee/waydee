package com.waydee.creators.application;

import java.time.Instant;
import java.util.List;

/**
 * <b>Detaylı veriler</b> raporunun sözleşmeleri (109. tur).
 *
 * <p>🔴 Her sayı kaynağını taşır ({@link Basis}): kullanıcı "gerçek rakam olsun,
 * olmazsa ortalama gelsin" dedi — ikisini ayırt edemeyen bir ekran, tahmini
 * gerçek gibi satardı.
 */
public final class InsightModels {

    private InsightModels() {
    }

    /**
     * Sayının kaynağı.
     * <ul>
     *   <li>{@code TRACKED} — bizim ölçtüğümüz (profil sayfası, takip süresince).</li>
     *   <li>{@code REPORTED} — okunan bir sayfada yazıyor.</li>
     *   <li>{@code ESTIMATED} — platform + takipçi kademesi ortalaması.</li>
     * </ul>
     */
    public enum Basis { TRACKED, REPORTED, ESTIMATED }

    // ------------------------------------------------------- modelin ham çıktısı

    public record RawInsight(Long followers, Long followers30dAgo, String followersBasis, List<RawWindow> windows,
                             List<RawCollab> collaborations, RawAudience audience, List<String> contentThemes,
                             Double postsPerWeek, String bestFormat, Double estCostMin, Double estCostMax,
                             String costCurrency, String summary, List<String> strengths, List<String> risks,
                             List<CreatorModels.RawEvidence> sources) {
    }

    public record RawWindow(Integer days, Double engagementRatePct, Long avgViews, Long avgLikes, Long avgComments,
                            Integer posts, Double followerGrowthPct, String basis) {
    }

    public record RawCollab(String brand, String date, String kind, String url) {
    }

    public record RawAudience(List<String> topCountries, Double femalePct, String mainAgeRange, String basis) {
    }

    // ------------------------------------------------------------ nihai rapor

    /**
     * @param followerGrowthPct dönemdeki takipçi değişimi (%), {@code growthBasis} ile
     * @param followerChange    yalnız TRACKED iken mutlak değişim (kişi)
     */
    public record Window(int days, double engagementRatePct, long avgViews, long avgLikes, long avgComments,
                         int posts, Double followerGrowthPct, Long followerChange, Basis basis,
                         Basis growthBasis) {
    }

    public record Collab(String brand, String date, String kind, String url) {
    }

    public record Audience(List<String> topCountries, Double femalePct, String mainAgeRange, Basis basis) {
    }

    public record Source(String url, String claim, boolean verified) {
    }

    public record Report(Instant generatedAt, long followers, Basis followersBasis, List<Window> windows,
                         List<Collab> collaborations, Audience audience, List<String> contentThemes,
                         double postsPerWeek, Basis postsBasis, String bestFormat, Double estCostMin,
                         Double estCostMax, String costCurrency, String summary, List<String> strengths,
                         List<String> risks, List<Source> sources) {
    }
}
