package com.waydee.creators.application;

import com.waydee.creators.application.CreatorModels.Creator;
import com.waydee.creators.application.CreatorModels.DropReason;
import com.waydee.creators.application.CreatorModels.Dropped;
import com.waydee.creators.application.CreatorModels.Evidence;
import com.waydee.creators.application.CreatorModels.Filters;
import com.waydee.creators.application.CreatorModels.RawCandidate;
import com.waydee.creators.application.CreatorModels.RawEvidence;
import com.waydee.creators.application.ai.ResearchProvider.Source;
import com.waydee.creators.domain.CreatorCategory;
import com.waydee.creators.domain.Platform;
import com.waydee.creators.domain.Signal;
import com.waydee.creators.domain.SizeTier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * <b>Uydurmaya karşı kalkan</b> (108. tur).
 *
 * <p>Dil modelleri, olmayan bir hesabı gerçek gibi yazabilir. Bu sınıf modelin
 * çıkarım adımında verdiği her adayı, <b>araştırma adımında gerçekten okunan
 * sayfalara</b> karşı denetler:
 * <ul>
 *   <li>Adayın en az bir kanıt adresi, web aramasının döndürdüğü ya da atıf
 *       yaptığı sayfalardan biri olmalı — <b>ya da</b> adayın kendi profil
 *       sayfası o sayfalar arasında olmalı.</li>
 *   <li>Kullanıcı adı platformun kendi kurallarına uymalı.</li>
 *   <li>Sayılar makul aralıkta olmalı; değilse <b>boş</b> bırakılır
 *       (sıfır değil — InfluSense'in dediği gibi "missing data does not mean zero").</li>
 * </ul>
 *
 * <p>🔴 <b>Sessiz eleme yok.</b> Elenen her aday gerekçesiyle döner ve ekranda
 * sayılır. "20 istedim, 14 geldi" sorusunun cevabı kullanıcının önündedir.
 */
@Component
@RequiredArgsConstructor
public class CandidateValidator {

    private static final int MAX_EVIDENCE = 5;
    private static final int MAX_REASONS = 3;
    private static final Set<String> COUNTRIES = Set.of(Locale.getISOCountries());
    private static final Set<String> LANGUAGES = Set.of(Locale.getISOLanguages());
    private static final Set<String> CURRENCIES = Set.of("TRY", "USD", "EUR", "GBP");

    private final CreatorScorer scorer;

    public record Outcome(List<Creator> creators, List<Dropped> dropped) {
    }

    public Outcome validate(List<RawCandidate> raw, List<Source> seenSources, Filters filters,
                            Map<Signal, Integer> weights) {
        return validate(raw, seenSources, filters, weights, Map.of(), false);
    }

    /**
     * Profil sayfasından okunan veri ({@link ProfileEnricher}) modelin
     * yazdığından <b>önce gelir</b>: sayı platformun kendisinden.
     *
     * @param requireFollowers 8 Eki 2026, kullanıcı: "boş veri olmasın" —
     *                         takipçisi hiçbir yerden bulunamayan aday elenir
     */
    public Outcome validate(List<RawCandidate> raw, List<Source> seenSources, Filters filters,
                            Map<Signal, Integer> weights, Map<String, ProfileEnricher.Profile> profiles,
                            boolean requireFollowers) {
        Map<String, Source> seen = new HashMap<>();
        for (Source s : seenSources) {
            String key = normalizeUrl(s.url());
            if (key != null) {
                seen.putIfAbsent(key, s);
            }
        }

        List<Creator> kept = new ArrayList<>();
        List<Dropped> dropped = new ArrayList<>();
        Set<String> identities = new HashSet<>();

        for (RawCandidate candidate : raw == null ? List.<RawCandidate>of() : raw) {
            if (candidate == null) {
                continue;
            }
            Platform platform = parsePlatform(candidate.platform());
            String rawHandle = cleanHandle(candidate.handle());
            if (platform == null) {
                dropped.add(new Dropped(candidate.platform(), rawHandle, DropReason.PLATFORM_NOT_REQUESTED));
                continue;
            }
            if (!filters.platforms().contains(platform)) {
                dropped.add(new Dropped(platform.name(), rawHandle, DropReason.PLATFORM_NOT_REQUESTED));
                continue;
            }

            // Kullanıcı adı: önce modelin yazdığı; uymuyorsa profil adresinden çıkarılır.
            String handle = platform.isValidHandle(rawHandle) ? rawHandle
                    : platform.handleFromUrl(candidate.profileUrl()).orElse(null);
            if (handle == null) {
                dropped.add(new Dropped(platform.name(), rawHandle, DropReason.INVALID_HANDLE));
                continue;
            }
            String identity = platform.name() + ":" + handle.toLowerCase(Locale.ROOT);
            if (!identities.add(identity)) {
                dropped.add(new Dropped(platform.name(), handle, DropReason.DUPLICATE));
                continue;
            }

            List<Evidence> evidence = evidence(candidate.evidence(), seen);
            boolean profileSeen = seen.values().stream()
                    .anyMatch(s -> platform.handleFromUrl(s.url())
                            .map(h -> h.equalsIgnoreCase(handle)).orElse(false));
            if (evidence.stream().noneMatch(Evidence::verified) && !profileSeen) {
                identities.remove(identity);
                dropped.add(new Dropped(platform.name(), handle, DropReason.UNVERIFIED_SOURCE));
                continue;
            }

            ProfileEnricher.Profile profile = profiles.getOrDefault(identity, ProfileEnricher.Profile.EMPTY);
            Long followers = profile.followers() != null ? profile.followers() : nonNegative(candidate.followers());
            if (requireFollowers && followers == null) {
                identities.remove(identity);
                dropped.add(new Dropped(platform.name(), handle, DropReason.MISSING_DATA));
                continue;
            }
            Double engagement = within(candidate.engagementRatePct(), 0, 100);
            Long avgViews = nonNegative(candidate.avgViews());
            Double growth = within(candidate.growth30dPct(), -100, 1_000);
            String country = normalizeCountry(candidate.country());
            String language = normalizeLanguage(candidate.language());

            DropReason filterMiss = filterMiss(filters, followers, engagement, country, language);
            if (filterMiss != null) {
                identities.remove(identity);
                dropped.add(new Dropped(platform.name(), handle, filterMiss));
                continue;
            }

            Double costMin = positive(candidate.estCostMin());
            Double costMax = positive(candidate.estCostMax());
            if (costMin != null && costMax != null && costMin > costMax) {
                Double t = costMin;
                costMin = costMax;
                costMax = t;
            }
            String currency = normalizeCurrency(candidate.costCurrency());
            if (currency == null) {
                // Para birimi bilinmeyen bir tutar anlamsızdır — gösterilmez.
                costMin = null;
                costMax = null;
            }
            int fit = candidate.contentFit() == null ? 50 : Math.max(0, Math.min(100, candidate.contentFit()));

            Map<Signal, Double> signals = scorer.signals(filters, followers, engagement, avgViews, growth,
                    costMin, costMax, currency, country, language, fit);

            kept.add(new Creator(identity, platform, handle, text(candidate.displayName(), 120, handle),
                    platform.profileUrl(handle), profile.avatarUrl(), country, language, categories(candidate.categories()),
                    followers, followers == null ? null : SizeTier.of(followers), engagement, avgViews, growth,
                    costMin, costMax, currency, fit, scorer.momentum(growth, avgViews, followers),
                    text(candidate.summary(), 400, ""), reasons(candidate.fitReasons()),
                    reasons(candidate.watchouts()), evidence, signals,
                    scorer.score(signals, weights), scorer.coverage(signals)));
        }

        // En iyi önce; eşitlikte verisi daha kapsamlı olan.
        kept.sort(Comparator.comparingDouble(Creator::score).reversed()
                .thenComparing(Comparator.comparingDouble(Creator::coverage).reversed()));
        if (kept.size() > filters.resultCount()) {
            for (Creator extra : kept.subList(filters.resultCount(), kept.size())) {
                dropped.add(new Dropped(extra.platform().name(), extra.handle(), DropReason.OVER_LIMIT));
            }
            kept = new ArrayList<>(kept.subList(0, filters.resultCount()));
        }
        return new Outcome(List.copyOf(kept), List.copyOf(dropped));
    }

    /**
     * Zenginleştirilecek profiller: istenen platformda, kuralına uyan kullanıcı
     * adı olan adaylar — doğrulamanın ilk adımlarıyla aynı mantık, tekrarsız.
     */
    public List<ProfileEnricher.Target> targets(List<RawCandidate> raw, Filters filters) {
        List<ProfileEnricher.Target> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (RawCandidate candidate : raw == null ? List.<RawCandidate>of() : raw) {
            if (candidate == null) {
                continue;
            }
            Platform platform = parsePlatform(candidate.platform());
            if (platform == null || !filters.platforms().contains(platform)) {
                continue;
            }
            String rawHandle = cleanHandle(candidate.handle());
            String handle = platform.isValidHandle(rawHandle) ? rawHandle
                    : platform.handleFromUrl(candidate.profileUrl()).orElse(null);
            if (handle != null && seen.add(platform.name() + ":" + handle.toLowerCase(Locale.ROOT))) {
                out.add(new ProfileEnricher.Target(platform, handle));
            }
        }
        return out;
    }

    // ---------------------------------------------------------------- kurallar

    /**
     * Açık filtreye <b>kesin</b> uymayan aday.
     *
     * <p>⚠️ Yalnız değer <b>biliniyorsa</b> elenir. Ülkesi bulunamayan bir hesap
     * elenmez — puanda nötr sayılır ve ekranda "bilinmiyor" yazar. Bilinmeyeni
     * elemek, sonuçları yalnız popüler (verisi kolay bulunan) hesaplara
     * daraltırdı; bu da "yükselen üreticileri erken bul" vaadinin tam tersi.
     */
    private static DropReason filterMiss(Filters filters, Long followers, Double engagement,
                                         String country, String language) {
        if (!filters.tiers().isEmpty() && followers != null
                && filters.tiers().stream().noneMatch(t -> t.contains(followers))) {
            return DropReason.OUT_OF_TIER;
        }
        if (filters.minEngagementPct() != null && engagement != null && engagement < filters.minEngagementPct()) {
            return DropReason.BELOW_ENGAGEMENT;
        }
        if (filters.country() != null && country != null && !filters.country().equalsIgnoreCase(country)) {
            return DropReason.COUNTRY_MISMATCH;
        }
        if (filters.language() != null && language != null && !filters.language().equalsIgnoreCase(language)) {
            return DropReason.LANGUAGE_MISMATCH;
        }
        return null;
    }

    private static List<Evidence> evidence(List<RawEvidence> raw, Map<String, Source> seen) {
        Map<String, Evidence> out = new LinkedHashMap<>();
        if (raw == null) {
            return List.of();
        }
        for (RawEvidence e : raw) {
            if (e == null || out.size() >= MAX_EVIDENCE) {
                continue;
            }
            String key = normalizeUrl(e.url());
            if (key == null || out.containsKey(key)) {
                continue;
            }
            Source source = seen.get(key);
            out.put(key, new Evidence(e.url().trim(), source == null ? null : text(source.title(), 160, null),
                    text(e.claim(), 200, null), source != null));
        }
        // Doğrulanmış kanıt önce — ekranda ilk görünen bağlantı okunmuş bir sayfa olsun.
        List<Evidence> list = new ArrayList<>(out.values());
        list.sort(Comparator.comparing(Evidence::verified).reversed());
        return List.copyOf(list);
    }

    /**
     * Adres karşılaştırma anahtarı: küçük harf ana makine ({@code www.}'suz) +
     * sondaki eğik çizgisiz yol. Sorgu ve parça <b>atılır</b> — arama sonuçları
     * aynı sayfaya izleme parametreleriyle bağlanabiliyor ve bu, gerçek bir
     * kaynağın "okunmadı" sayılmasına yol açardı.
     */
    static String normalizeUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(url.trim());
            String scheme = uri.getScheme();
            if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                    || uri.getHost() == null) {
                return null;
            }
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            if (host.startsWith("www.")) {
                host = host.substring(4);
            }
            String path = uri.getPath() == null ? "" : uri.getPath();
            while (path.endsWith("/")) {
                path = path.substring(0, path.length() - 1);
            }
            return host + path.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static Platform parsePlatform(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim().toUpperCase(Locale.ROOT);
        if (value.equals("TWITTER")) {
            value = "X";
        }
        try {
            return Platform.valueOf(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String cleanHandle(String raw) {
        if (raw == null) {
            return "";
        }
        String h = raw.strip();
        while (h.startsWith("@")) {
            h = h.substring(1);
        }
        return h;
    }

    private static List<CreatorCategory> categories(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        List<CreatorCategory> out = new ArrayList<>();
        for (String r : raw) {
            if (r == null) {
                continue;
            }
            try {
                CreatorCategory c = CreatorCategory.valueOf(r.trim().toUpperCase(Locale.ROOT));
                if (!out.contains(c)) {
                    out.add(c);
                }
            } catch (IllegalArgumentException ignored) {
                // Listede olmayan kategori sessizce atlanır — bir etiket, aday değil.
            }
        }
        return List.copyOf(out);
    }

    private static List<String> reasons(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        return raw.stream().filter(r -> r != null && !r.isBlank())
                .map(r -> text(r, 200, ""))
                .limit(MAX_REASONS)
                .toList();
    }

    private static String normalizeCountry(String raw) {
        if (raw == null) {
            return null;
        }
        String c = raw.trim().toUpperCase(Locale.ROOT);
        return COUNTRIES.contains(c) ? c : null;
    }

    private static String normalizeLanguage(String raw) {
        if (raw == null) {
            return null;
        }
        String l = raw.trim().toLowerCase(Locale.ROOT);
        return l.length() == 2 && LANGUAGES.contains(l) ? l : null;
    }

    private static String normalizeCurrency(String raw) {
        if (raw == null) {
            return null;
        }
        String c = raw.trim().toUpperCase(Locale.ROOT);
        return CURRENCIES.contains(c) ? c : null;
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

    private static String text(String raw, int max, String fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String t = raw.strip();
        return t.length() > max ? t.substring(0, max - 1) + "…" : t;
    }
}
