package com.waydee.creators.application;

import com.waydee.creators.application.InsightModels.Audience;
import com.waydee.creators.application.InsightModels.Basis;
import com.waydee.creators.application.InsightModels.Collab;
import com.waydee.creators.application.InsightModels.RawAudience;
import com.waydee.creators.application.InsightModels.RawInsight;
import com.waydee.creators.application.InsightModels.RawWindow;
import com.waydee.creators.application.InsightModels.Report;
import com.waydee.creators.application.InsightModels.Source;
import com.waydee.creators.application.InsightModels.Window;
import com.waydee.creators.domain.Platform;
import com.waydee.creators.domain.SizeTier;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import org.springframework.stereotype.Component;

/**
 * Modelin ham çıktısını <b>boşluksuz ve kaynağı belli</b> bir rapora çevirir
 * (109. tur). Saf fonksiyon — ağ yok, test edilebilir.
 *
 * <p>Öncelik sırası her sayı için aynı: <b>bizim ölçtüğümüz</b> (TRACKED) →
 * <b>sayfada yazan</b> (REPORTED) → <b>platform/kademe ortalaması</b>
 * (ESTIMATED). Kullanıcı: "gerçek rakamlar olsun, olmazsa ortalama gelsin".
 *
 * <p>⚠️ Ortalama katsayıları sektör kıyaslarının kaba ortalamasıdır
 * (görüntülenme/takipçi, platforma göre etkileşim çarpanı, haftalık paylaşım).
 * Ekranda "ortalama" etiketiyle gösterilir; gerçek sayı gibi sunulmaz.
 */
@Component
public class InsightAssembler {

    static final int[] WINDOWS = {7, 14, 30};
    private static final Set<String> COUNTRIES = Set.of(Locale.getISOCountries());
    private static final Set<String> CURRENCIES = Set.of("TRY", "USD", "EUR", "GBP");

    /** Takip anlık görüntüsü. */
    public record Point(long followers, Instant at) {
    }

    public Report assemble(RawInsight raw, Platform platform, Long profileFollowers, long fallbackFollowers,
                           List<Point> series, List<com.waydee.creators.application.ai.ResearchProvider.Source> seenSources, Instant now) {
        RawInsight r = raw == null ? new RawInsight(null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null) : raw;

        // ------------------------------------------------------------ takipçi
        long followers;
        Basis followersBasis;
        if (profileFollowers != null && profileFollowers > 0) {
            followers = profileFollowers;
            followersBasis = Basis.REPORTED;
        } else if (r.followers() != null && r.followers() > 0) {
            followers = r.followers();
            followersBasis = basis(r.followersBasis());
        } else if (!series.isEmpty()) {
            followers = series.get(series.size() - 1).followers();
            followersBasis = Basis.TRACKED;
        } else {
            followers = Math.max(0, fallbackFollowers);
            followersBasis = Basis.REPORTED;
        }
        SizeTier tier = SizeTier.of(Math.max(1, followers));

        // ------------------------------------------------- paylaşım sıklığı
        double postsPerWeek;
        Basis postsBasis;
        if (r.postsPerWeek() != null && r.postsPerWeek() > 0 && r.postsPerWeek() <= 200) {
            postsPerWeek = round1(r.postsPerWeek());
            postsBasis = Basis.REPORTED;
        } else {
            postsPerWeek = defaultPostsPerWeek(platform);
            postsBasis = Basis.ESTIMATED;
        }

        double typicalEngagement = round2(tier.typicalEngagementPct() * engagementFactor(platform));
        Double reported30Growth = r.followers30dAgo() != null && r.followers30dAgo() > 0 && followers > 0
                ? round2((followers - r.followers30dAgo()) * 100.0 / r.followers30dAgo()) : null;

        List<Window> windows = new ArrayList<>();
        for (int days : WINDOWS) {
            RawWindow w = pick(r.windows(), days);
            boolean estimated = w == null || basis(w.basis()) == Basis.ESTIMATED;

            Double eng = w == null ? null : within(w.engagementRatePct(), 0, 100);
            if (eng == null) {
                eng = typicalEngagement;
                estimated = true;
            }
            Long views = w == null ? null : nonNegative(w.avgViews());
            if (views == null) {
                views = Math.round(followers * viewRatio(platform));
                estimated = true;
            }
            Long likes = w == null ? null : nonNegative(w.avgLikes());
            if (likes == null) {
                likes = Math.round(followers * eng / 100 * 0.92);
                estimated = true;
            }
            Long comments = w == null ? null : nonNegative(w.avgComments());
            if (comments == null) {
                comments = Math.round(followers * eng / 100 * 0.08);
                estimated = true;
            }
            Integer posts = w == null || w.posts() == null || w.posts() < 0 || w.posts() > 2000 ? null : w.posts();
            if (posts == null) {
                posts = (int) Math.max(1, Math.round(postsPerWeek * days / 7));
                estimated = true;
            }

            // Büyüme: önce bizim ölçümümüz, sonra sayfa, sonra ortalama.
            Double growthPct;
            Long change = null;
            Basis growthBasis;
            Point past = pastPoint(series, now, days);
            if (past != null && past.followers() > 0) {
                change = followers - past.followers();
                growthPct = round2(change * 100.0 / past.followers());
                growthBasis = Basis.TRACKED;
            } else if (w != null && within(w.followerGrowthPct(), -100, 1000) != null) {
                growthPct = round2(w.followerGrowthPct());
                growthBasis = basis(w.basis());
            } else if (reported30Growth != null) {
                growthPct = round2(reported30Growth * days / 30.0);
                growthBasis = days == 30 ? Basis.REPORTED : Basis.ESTIMATED;
            } else {
                growthPct = round2(typicalMonthlyGrowth(tier) * days / 30.0);
                growthBasis = Basis.ESTIMATED;
            }

            windows.add(new Window(days, round2(eng), views, likes, comments, posts, growthPct, change,
                    estimated ? Basis.ESTIMATED : Basis.REPORTED, growthBasis));
        }

        Set<String> seen = new HashSet<>();
        seenSources.forEach(s -> seen.add(normalize(s.url())));

        List<Collab> collabs = safe(r.collaborations()).stream()
                .filter(Objects::nonNull)
                .filter(c -> c.brand() != null && !c.brand().isBlank())
                .map(c -> new Collab(text(c.brand(), 80), text(c.date(), 20), text(c.kind(), 60), http(c.url())))
                .distinct()
                .limit(12)
                .toList();

        RawAudience a = r.audience();
        Audience audience = a == null ? null : new Audience(
                safe(a.topCountries()).stream().filter(Objects::nonNull)
                        .map(c -> c.strip().toUpperCase(Locale.ROOT)).filter(COUNTRIES::contains).distinct().limit(3).toList(),
                within(a.femalePct(), 0, 100), text(a.mainAgeRange(), 20), basis(a.basis()));

        Double costMin = positive(r.estCostMin());
        Double costMax = positive(r.estCostMax());
        if (costMin != null && costMax != null && costMin > costMax) {
            Double t = costMin;
            costMin = costMax;
            costMax = t;
        }
        String currency = r.costCurrency() != null && CURRENCIES.contains(r.costCurrency().strip().toUpperCase(Locale.ROOT))
                ? r.costCurrency().strip().toUpperCase(Locale.ROOT) : null;
        if (currency == null) {
            costMin = null;
            costMax = null;
        }

        List<Source> sources = safe(r.sources()).stream()
                .filter(Objects::nonNull)
                .map(s -> {
                    String url = http(s.url());
                    return url == null ? null : new Source(url, text(s.claim(), 200), seen.contains(normalize(url)));
                })
                .filter(Objects::nonNull)
                .distinct()
                .sorted(Comparator.comparing((Source s) -> !s.verified()))
                .limit(12)
                .toList();

        return new Report(now, followers, followersBasis, windows, collabs, audience,
                texts(r.contentThemes(), 5, 40, Function.identity()), postsPerWeek, postsBasis,
                text(r.bestFormat(), 120), costMin, costMax, currency, text(r.summary(), 600),
                texts(r.strengths(), 4, 200, Function.identity()), texts(r.risks(), 3, 200, Function.identity()),
                sources);
    }

    // ---------------------------------------------------------------- kıyaslar

    /** Ortalama gönderi başına görüntülenme / takipçi. */
    static double viewRatio(Platform p) {
        return switch (p) {
            case INSTAGRAM -> 0.25;
            case TIKTOK -> 0.45;
            case YOUTUBE -> 0.15;
            case X -> 0.03;
            case TWITCH -> 0.02;
            case LINKEDIN -> 0.05;
        };
    }

    /** Kademe etkileşim ortalamasının platforma göre çarpanı. */
    static double engagementFactor(Platform p) {
        return switch (p) {
            case TIKTOK -> 1.3;
            case YOUTUBE -> 0.8;
            case X, TWITCH -> 0.4;
            case INSTAGRAM, LINKEDIN -> 1.0;
        };
    }

    static double defaultPostsPerWeek(Platform p) {
        return switch (p) {
            case INSTAGRAM -> 4;
            case TIKTOK -> 7;
            case YOUTUBE -> 1.5;
            case X -> 14;
            case TWITCH -> 4;
            case LINKEDIN -> 2;
        };
    }

    /** Aylık tipik takipçi büyümesi (%). */
    static double typicalMonthlyGrowth(SizeTier tier) {
        return switch (tier) {
            case NANO -> 3.0;
            case MICRO -> 2.0;
            case MID -> 1.5;
            case MACRO -> 1.0;
            case MEGA -> 0.5;
        };
    }

    /**
     * {@code days} gün önceye denk gelen ölçüm — yalnız takip o kadar eskiyse
     * (en az %85'i). Daha kısa bir takip, 30 günlük değişim diye gösterilmez.
     */
    static Point pastPoint(List<Point> series, Instant now, int days) {
        if (series.size() < 2) {
            return null;
        }
        Instant target = now.minus(Duration.ofDays(days));
        Point oldest = series.get(0);
        if (Duration.between(oldest.at(), now).toHours() < days * 24 * 0.85) {
            return null;
        }
        Point best = oldest;
        for (Point p : series) {
            if (Math.abs(Duration.between(p.at(), target).toHours())
                    < Math.abs(Duration.between(best.at(), target).toHours())) {
                best = p;
            }
        }
        return best;
    }

    // ---------------------------------------------------------------- yardımcı

    private static RawWindow pick(List<RawWindow> windows, int days) {
        return safe(windows).stream().filter(Objects::nonNull)
                .filter(w -> w.days() != null && w.days() == days).findFirst().orElse(null);
    }

    private static Basis basis(String raw) {
        return "REPORTED".equalsIgnoreCase(raw) ? Basis.REPORTED : Basis.ESTIMATED;
    }

    private static <T> List<T> safe(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static Long nonNegative(Long v) {
        return v == null || v < 0 ? null : v;
    }

    private static Double positive(Double v) {
        return v == null || v.isNaN() || v <= 0 ? null : v;
    }

    private static Double within(Double v, double min, double max) {
        return v == null || v.isNaN() || v < min || v > max ? null : v;
    }

    private static String http(String url) {
        return url != null && url.strip().matches("(?i)^https?://\\S{3,2000}$") ? url.strip() : null;
    }

    private static String normalize(String url) {
        if (url == null) {
            return "";
        }
        String u = url.strip().toLowerCase(Locale.ROOT).replaceFirst("^https?://(www\\.)?", "");
        int hash = u.indexOf('#');
        u = hash >= 0 ? u.substring(0, hash) : u;
        return u.endsWith("/") ? u.substring(0, u.length() - 1) : u;
    }

    private static String text(String v, int max) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String s = v.strip();
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static List<String> texts(List<String> list, int limit, int max, Function<String, String> f) {
        return safe(list).stream().map(s -> text(s, max)).filter(Objects::nonNull).map(f).distinct().limit(limit).toList();
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
