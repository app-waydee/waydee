package com.waydee.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Map;
import java.util.Optional;

/**
 * OAuth {@code state} parametresinin imzalanması.
 *
 * <p><b>Ne işe yarar:</b> {@code state}, Google'a giderken bizim ürettiğimiz ve
 * dönüşte geri aldığımız değerdir. İmzalanmazsa saldırgan kendi hazırladığı bir
 * dönüş isteğini kurbanın tarayıcısında tetikleyebilir (<b>CSRF</b>) ya da
 * {@code callbackUrl}'i değiştirip kullanıcıyı akıştan sonra kendi sitesine
 * yönlendirebilir.
 *
 * <p><b>Neden sunucuda saklamıyoruz:</b> geçiş anahtarı deseninin aynısı —
 * değer kendi kendini doğrular ({@link VisitorPassService}). Oturum ya da DB
 * satırı gerekmez, çok örnekli çalışmada da sorunsuzdur.
 *
 * <p>Biçim: {@code <base64url(json)>.<sonKullanmaEpoch>.<hmac>}
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuthStateSigner {

    private static final String ALGORITHM = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final JwtProperties jwtProperties;
    private final ObjectMapper objectMapper;
    private SecretKeySpec key;

    @PostConstruct
    void init() {
        // Amaç etiketi şart: aynı sır başka amaçlarla da kullanılıyor, imzalar
        // birbirinin yerine geçmemeli (medya URL'i, ziyaretçi geçişi...).
        byte[] secret = ("oauth-state:" + jwtProperties.secret()).getBytes(StandardCharsets.UTF_8);
        this.key = new SecretKeySpec(secret, ALGORITHM);
    }

    /** Yetkilendirme isteğine konacak imzalı {@code state} üretir. */
    public String issue(Map<String, String> payload, Duration ttl) {
        try {
            String body = ENCODER.encodeToString(objectMapper.writeValueAsBytes(payload));
            long expiresAt = Instant.now().plus(ttl).getEpochSecond();
            return body + "." + expiresAt + "." + hmac(body, expiresAt);
        } catch (Exception ex) {
            throw new IllegalStateException("OAuth state imzalanamadı", ex);
        }
    }

    /**
     * İmzayı ve süreyi doğrular; geçerliyse taşınan veriyi döner.
     *
     * <p>Bozuk/eski/imzasız state sessizce {@link Optional#empty()} olur —
     * çağıran bunu "akış geçersiz" olarak ele alır.
     */
    @SuppressWarnings("unchecked")
    public Optional<Map<String, String>> verify(String state) {
        if (state == null || state.isBlank()) {
            return Optional.empty();
        }
        String[] parts = state.split("\\.");
        if (parts.length != 3) {
            return Optional.empty();
        }
        long expiresAt;
        try {
            expiresAt = Long.parseLong(parts[1]);
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            return Optional.empty();
        }
        // Zamanlama saldırılarına kapalı karşılaştırma (medya imzasıyla aynı desen).
        boolean signatureOk = MessageDigest.isEqual(
                hmac(parts[0], expiresAt).getBytes(StandardCharsets.UTF_8),
                parts[2].getBytes(StandardCharsets.UTF_8));
        if (!signatureOk) {
            log.warn("OAuth state imzası doğrulanamadı");
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(DECODER.decode(parts[0]), Map.class));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private String hmac(String body, long expiresAt) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            byte[] digest = mac.doFinal((body + ":" + expiresAt).getBytes(StandardCharsets.UTF_8));
            return ENCODER.encodeToString(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("OAuth state imzalanamadı", ex);
        }
    }
}
