package com.waydee.creators.application;

import com.waydee.common.storage.StorageService;
import com.waydee.creators.domain.Platform;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * <b>Profil zenginleştirme</b> (108. tur ek, 8 Eki 2026 — kullanıcı: "neden
 * takipçileri yok, neden gerçek logosu yok").
 *
 * <p>Doğrulanan her adayın <b>kendi profil sayfası</b> okunur ve iki şey
 * alınır: profil fotoğrafı ({@code og:image}) ve sayfanın kendisinin
 * yazdığı takipçi sayısı. InfluSense'in yaptığı da budur — sayı modelden değil
 * platformdan gelir; model "bilinmiyor" dediğinde boş kalmaz.
 *
 * <p>⚠️ Ölçülen davranış (8 Eki 2026): platformlar sıradan tarayıcı
 * kimliğine giriş duvarı / 429 döndürüyor, bağlantı önizleme tarayıcısına
 * ({@code facebookexternalhit}) ise OpenGraph etiketlerini veriyor.
 * Instagram/TikTok takipçiyi {@code og:description}'da ("6M Followers"),
 * YouTube {@code subscriberCountText}'te yazar.
 *
 * <p>⚠️ Fotoğraf CDN adresi günler içinde geçersizleşir ve başka sitenin
 * görselini sıcak bağlamak yasak — görsel <b>indirilip kendi depomuza</b>
 * yazılır ve {@code /api/v1/public/creator-avatars/…} üzerinden sunulur.
 *
 * <p>Güvenlik: istek yalnız {@link Platform#profileUrl} ile <b>doğrulanmış
 * kullanıcı adından</b> kurulan adrese gider; görsel yalnız https, en çok
 * 2 MB ve {@code image/*}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProfileEnricher {

    private static final String CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
    private static final Duration TIMEOUT = Duration.ofSeconds(8);
    private static final int MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    private static final long TOTAL_BUDGET_SECONDS = 25;

    private static final Pattern OG_IMAGE = Pattern.compile(
            "<meta[^>]+(?:property|name)=\"og:image\"[^>]+content=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_IMAGE_REVERSED = Pattern.compile(
            "<meta[^>]+content=\"([^\"]+)\"[^>]+(?:property|name)=\"og:image\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_DESCRIPTION = Pattern.compile(
            "<meta[^>]+(?:property|name)=\"og:description\"[^>]+content=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_DESCRIPTION_REVERSED = Pattern.compile(
            "<meta[^>]+content=\"([^\"]+)\"[^>]+(?:property|name)=\"og:description\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern FOLLOWERS = Pattern.compile(
            "([0-9][0-9.,]*)\\s*([KkMmBb])?\\s+Followers");
    private static final Pattern YT_SUBSCRIBERS = Pattern.compile(
            "\"subscriberCountText\".{0,300}?\"simpleText\":\"([0-9][0-9.,]*)\\s*([KkMmBb])?\\s+subscribers\"");

    private final StorageService storage;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /** Profilden okunan gerçek veri; alanlar bulunamazsa {@code null}. */
    public record Profile(Long followers, String avatarUrl) {
        static final Profile EMPTY = new Profile(null, null);
    }

    /** Bir aday kimliği: platform + doğrulanmış kullanıcı adı. */
    public record Target(Platform platform, String handle) {
        String key() {
            return platform.name() + ":" + handle.toLowerCase(Locale.ROOT);
        }
    }

    /**
     * Adayları <b>paralel</b> zenginleştirir; toplam süre en çok
     * {@value #TOTAL_BUDGET_SECONDS} sn. Yetişmeyen ya da düşen aday boş döner —
     * araştırmanın tamamı bir profil sayfası yüzünden düşmez.
     */
    public Map<String, Profile> enrich(List<Target> targets) {
        Map<String, Profile> out = new ConcurrentHashMap<>();
        if (targets.isEmpty()) {
            return out;
        }
        try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<?>> futures = new ArrayList<>();
            for (Target target : targets) {
                futures.add(pool.submit(() -> out.put(target.key(), fetch(target))));
            }
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(TOTAL_BUDGET_SECONDS);
            for (Future<?> f : futures) {
                try {
                    f.get(Math.max(1, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
                } catch (Exception e) {
                    f.cancel(true);
                }
            }
        }
        return out;
    }

    private Profile fetch(Target target) {
        if (target.platform() == Platform.LINKEDIN) {
            return Profile.EMPTY; // LinkedIn önizlemeye de giriş duvarı koyuyor.
        }
        try {
            String html = get(target.platform().profileUrl(target.handle()));
            if (html == null) {
                return Profile.EMPTY;
            }
            Long followers = followersOf(target.platform(), html);
            String avatar = match(OG_IMAGE, html).or(() -> match(OG_IMAGE_REVERSED, html))
                    .map(ProfileEnricher::unescape)
                    .flatMap(url -> storeAvatar(target, url))
                    .orElse(null);
            return new Profile(followers, avatar);
        } catch (Exception e) {
            log.debug("Profil okunamadı: {} ({})", target.key(), e.toString());
            return Profile.EMPTY;
        }
    }

    private String get(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(TIMEOUT)
                .header("User-Agent", CRAWLER_UA)
                .header("Accept-Language", "en-US,en;q=0.9")
                .GET().build();
        HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            return null;
        }
        byte[] body = response.body();
        return new String(body, 0, Math.min(body.length, 3 * 1024 * 1024), StandardCharsets.UTF_8);
    }

    public static Long followersOf(Platform platform, String html) {
        if (platform == Platform.YOUTUBE) {
            Matcher m = YT_SUBSCRIBERS.matcher(html);
            return m.find() ? parseCount(m.group(1), m.group(2)) : null;
        }
        return match(OG_DESCRIPTION, html).or(() -> match(OG_DESCRIPTION_REVERSED, html)).map(ProfileEnricher::unescape).map(desc -> {
            Matcher m = FOLLOWERS.matcher(desc);
            return m.find() ? parseCount(m.group(1), m.group(2)) : null;
        }).orElse(null);
    }

    /** "6M" → 6.000.000, "163.0m" → 163.000.000, "12,345" → 12.345. */
    static Long parseCount(String number, String suffix) {
        try {
            long multiplier = suffix == null ? 1 : switch (suffix.toLowerCase(Locale.ROOT)) {
                case "k" -> 1_000L;
                case "m" -> 1_000_000L;
                case "b" -> 1_000_000_000L;
                default -> 1L;
            };
            String n = multiplier == 1 ? number.replace(",", "").replace(".", "") : number.replace(",", "");
            double value = Double.parseDouble(n) * multiplier;
            return value < 0 ? null : Math.round(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Optional<String> storeAvatar(Target target, String imageUrl) {
        try {
            URI uri = URI.create(imageUrl);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                return Optional.empty();
            }
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(TIMEOUT)
                    .header("User-Agent", CRAWLER_UA).GET().build();
            HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
            String type = response.headers().firstValue("Content-Type").orElse("");
            byte[] bytes = response.body();
            if (response.statusCode() != 200 || !type.startsWith("image/")
                    || bytes.length == 0 || bytes.length > MAX_IMAGE_BYTES) {
                return Optional.empty();
            }
            storage.put(objectKey(target.platform(), target.handle()), new ByteArrayInputStream(bytes),
                    bytes.length, type.split(";")[0].trim());
            return Optional.of(publicUrl(target.platform(), target.handle()));
        } catch (Exception e) {
            log.debug("Profil görseli alınamadı: {} ({})", target.key(), e.toString());
            return Optional.empty();
        }
    }

    public static String objectKey(Platform platform, String handle) {
        return "creator-avatars/" + platform.name() + "/" + handle.toLowerCase(Locale.ROOT);
    }

    public static String publicUrl(Platform platform, String handle) {
        return "/api/v1/public/creator-avatars/" + platform.name() + "/" + handle.toLowerCase(Locale.ROOT);
    }

    private static Optional<String> match(Pattern pattern, String html) {
        Matcher m = pattern.matcher(html);
        return m.find() ? Optional.of(m.group(1)) : Optional.empty();
    }

    private static String unescape(String s) {
        return s.replace("&amp;", "&").replace("&#064;", "@").replace("&quot;", "\"")
                .replace("&#039;", "'").replace("&#x27;", "'");
    }
}
