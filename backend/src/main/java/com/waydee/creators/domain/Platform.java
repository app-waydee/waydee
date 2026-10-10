package com.waydee.creators.domain;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * İçerik üreticisinin platformu (108. tur).
 *
 * <p>Her platform üç şeyi bilir: ① <b>alan adları</b> (bir kaynak adresinin
 * bu platforma ait olup olmadığı), ② <b>kullanıcı adı kuralı</b> (platformun
 * kendi sınırları — uydurulmuş "kullanıcı adlarını" yakalar), ③ <b>kanonik
 * profil adresi</b>.
 *
 * <p>🔴 Profil adresi modelin yazdığından değil, <b>kullanıcı adından</b>
 * kurulur. Modelin verdiği adres yanlış bir alt yola ({@code /p/…} gönderi
 * bağlantısı, {@code /shorts/…}) işaret edebilir; kanonik biçim her zaman
 * profile gider.
 */
public enum Platform {

    INSTAGRAM(List.of("instagram.com"), "^[A-Za-z0-9._]{1,30}$",
            "https://www.instagram.com/%s/", "^/([A-Za-z0-9._]{1,30})/?$"),
    TIKTOK(List.of("tiktok.com"), "^[A-Za-z0-9._]{2,24}$",
            "https://www.tiktok.com/@%s", "^/@([A-Za-z0-9._]{2,24})/?$"),
    YOUTUBE(List.of("youtube.com", "youtu.be"), "^[A-Za-z0-9._-]{3,30}$",
            "https://www.youtube.com/@%s", "^/@([A-Za-z0-9._-]{3,30})/?.*$"),
    X(List.of("x.com", "twitter.com"), "^[A-Za-z0-9_]{1,15}$",
            "https://x.com/%s", "^/([A-Za-z0-9_]{1,15})/?$"),
    TWITCH(List.of("twitch.tv"), "^[A-Za-z0-9_]{4,25}$",
            "https://www.twitch.tv/%s", "^/([A-Za-z0-9_]{4,25})/?$"),
    LINKEDIN(List.of("linkedin.com"), "^[A-Za-z0-9-]{3,100}$",
            "https://www.linkedin.com/in/%s", "^/in/([A-Za-z0-9-]{3,100})/?$");

    private final List<String> domains;
    private final Pattern handle;
    private final String profileFormat;
    private final Pattern profilePath;

    Platform(List<String> domains, String handle, String profileFormat, String profilePath) {
        this.domains = domains;
        this.handle = Pattern.compile(handle);
        this.profileFormat = profileFormat;
        this.profilePath = Pattern.compile(profilePath);
    }

    /** Adres bu platformun bir alan adında mı ({@code www.} ve alt alan adları dahil). */
    public boolean owns(String url) {
        String host = host(url);
        if (host == null) {
            return false;
        }
        return domains.stream().anyMatch(d -> host.equals(d) || host.endsWith("." + d));
    }

    public boolean isValidHandle(String value) {
        return value != null && handle.matcher(value).matches();
    }

    public String profileUrl(String validHandle) {
        return profileFormat.formatted(validHandle);
    }

    /**
     * Bir profil adresinden kullanıcı adını çıkarır.
     *
     * <p>⚠️ Yalnız <b>profil</b> yolları tanınır; gönderi / video bağlantısı
     * ({@code instagram.com/p/…}) bir kullanıcı adı DEĞİLDİR ve boş döner.
     * Aksi halde "p" adında bir influencer üretilirdi.
     */
    public Optional<String> handleFromUrl(String url) {
        if (!owns(url)) {
            return Optional.empty();
        }
        try {
            String path = URI.create(url.trim()).getPath();
            if (path == null) {
                return Optional.empty();
            }
            Matcher m = profilePath.matcher(path);
            if (!m.matches()) {
                return Optional.empty();
            }
            String candidate = m.group(1);
            // Instagram'ın ayrılmış yolları kullanıcı adı gibi görünür.
            if (this == INSTAGRAM && List.of("p", "reel", "reels", "explore", "stories", "tv", "accounts")
                    .contains(candidate.toLowerCase(Locale.ROOT))) {
                return Optional.empty();
            }
            if (this == X && List.of("home", "search", "explore", "i", "intent", "hashtag", "share")
                    .contains(candidate.toLowerCase(Locale.ROOT))) {
                return Optional.empty();
            }
            return isValidHandle(candidate) ? Optional.of(candidate) : Optional.empty();
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    static String host(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(url.trim());
            String scheme = uri.getScheme();
            if (scheme == null || !(scheme.equalsIgnoreCase("https") || scheme.equalsIgnoreCase("http"))) {
                return null;
            }
            String host = uri.getHost();
            return host == null ? null : host.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
