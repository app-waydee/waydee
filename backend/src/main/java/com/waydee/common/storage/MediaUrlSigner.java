package com.waydee.common.storage;

import com.waydee.common.security.JwtProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Görseller <img> etiketiyle yüklendiği için Authorization başlığı taşıyamaz.
 * Bu yüzden medya bağlantıları kısa ömürlü HMAC imzasıyla yayınlanır:
 * bağlantının kendisi yetkidir, tahmin edilemez ve süresi dolar.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MediaUrlSigner {

    private static final Duration TTL = Duration.ofDays(7);
    private static final String ALGORITHM = "HmacSHA256";

    private final JwtProperties jwtProperties;
    private SecretKeySpec key;

    @PostConstruct
    void init() {
        // JWT sırrından türetilmiş ayrı bir amaç etiketiyle anahtar üretilir.
        byte[] secret = ("media-url:" + jwtProperties.secret()).getBytes(StandardCharsets.UTF_8);
        this.key = new SecretKeySpec(secret, ALGORITHM);
        MediaUrls.register(this);
    }

    public String sign(UUID mediaId) {
        long expiresAt = Instant.now().plus(TTL).getEpochSecond();
        return "/api/v1/media/%s?e=%d&s=%s".formatted(mediaId, expiresAt, hmac(mediaId, expiresAt));
    }

    public boolean verify(UUID mediaId, long expiresAt, String signature) {
        if (signature == null || Instant.now().getEpochSecond() > expiresAt) {
            return false;
        }
        // Zamanlama saldırılarına kapalı karşılaştırma.
        return MessageDigest.isEqual(
                hmac(mediaId, expiresAt).getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }

    private String hmac(UUID mediaId, long expiresAt) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            byte[] digest = mac.doFinal((mediaId + ":" + expiresAt).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Medya bağlantısı imzalanamadı", ex);
        }
    }
}
