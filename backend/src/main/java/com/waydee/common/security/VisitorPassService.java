package com.waydee.common.security;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * <b>Ziyaretçi geçiş anahtarı</b> — vitrin (landing) uçlarını bot trafiğinden korur.
 *
 * <p>Akış: ziyaretçi siteye girer → ortada Cloudflare Turnstile doğrulaması →
 * sunucu jetonu Cloudflare'e doğrular → bu servis kısa ömürlü, HMAC imzalı bir
 * "geçiş" üretir. İstemci geçişi {@code X-Waydee-Pass} başlığında taşır ve
 * {@code /api/v1/public/**} okuma uçları bunu ister.
 *
 * <p>Oturum yok, DB yok: geçiş kendi kendini doğrular (imza + son kullanma).
 * Anahtar JWT sırrından ayrı bir amaç etiketiyle türetilir — aynı desen
 * {@link com.waydee.common.storage.MediaUrlSigner}'da da kullanılır.
 */
@Component
@RequiredArgsConstructor
public class VisitorPassService {

    /** Ziyaretçi bir oturum boyunca tekrar doğrulama görmesin diye makul bir süre. */
    public static final Duration TTL = Duration.ofHours(2);
    private static final String ALGORITHM = "HmacSHA256";

    private final JwtProperties jwtProperties;
    private SecretKeySpec key;

    @PostConstruct
    void init() {
        byte[] secret = ("visitor-pass:" + jwtProperties.secret()).getBytes(StandardCharsets.UTF_8);
        this.key = new SecretKeySpec(secret, ALGORITHM);
    }

    /** {@code <sonKullanmaEpoch>.<imza>} biçiminde geçiş üretir. */
    public String issue() {
        long expiresAt = Instant.now().plus(TTL).getEpochSecond();
        return expiresAt + "." + hmac(expiresAt);
    }

    public boolean isValid(String pass) {
        if (pass == null || pass.isBlank()) {
            return false;
        }
        int dot = pass.indexOf('.');
        if (dot <= 0 || dot == pass.length() - 1) {
            return false;
        }
        long expiresAt;
        try {
            expiresAt = Long.parseLong(pass.substring(0, dot));
        } catch (NumberFormatException ex) {
            return false;
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            return false;
        }
        // Zamanlama saldırılarına kapalı karşılaştırma.
        return MessageDigest.isEqual(
                hmac(expiresAt).getBytes(StandardCharsets.UTF_8),
                pass.substring(dot + 1).getBytes(StandardCharsets.UTF_8));
    }

    private String hmac(long expiresAt) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            byte[] digest = mac.doFinal(("visitor:" + expiresAt).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Ziyaretçi geçişi imzalanamadı", ex);
        }
    }
}
