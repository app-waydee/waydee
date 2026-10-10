package com.waydee.identity.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.common.error.ApiException;
import com.waydee.common.error.ErrorCode;
import com.waydee.common.security.GoogleOAuthProperties;
import com.waydee.identity.domain.GoogleProfile;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Set;

/**
 * Google OAuth 2.0 ile konuşan tek yer.
 *
 * <p><b>Akış (yetkilendirme kodu):</b> tarayıcı Google'a gider → kullanıcı onay
 * verir → Google bizim {@code redirectUri}'mize bir <b>kod</b> ile döner →
 * sunucu bu kodu {@code client_secret} ile jetona çevirir. Kod tek kullanımlık
 * ve kısa ömürlüdür; jeton hiçbir zaman tarayıcıdan geçmez.
 *
 * <p>⚠️ <b>Neden istemci tarafı (GIS/One Tap) değil:</b> tasarım referansı
 * düz bir "Continue with Google" düğmesidir. Google'ın hazır düğmesi kendi
 * görünümünü dayatır ve birebir yerleşimi bozar; yönlendirme akışı düğmenin
 * görünümünü tamamen bize bırakır.
 */
@Slf4j
@Component
@EnableConfigurationProperties(GoogleOAuthProperties.class)
public class GoogleOAuthClient {

    private static final String AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
    /** Google'ın {@code id_token} içinde kullandığı iki geçerli yayıncı değeri. */
    private static final Set<String> VALID_ISSUERS =
            Set.of("accounts.google.com", "https://accounts.google.com");

    private final GoogleOAuthProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public GoogleOAuthClient(GoogleOAuthProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8_000);
        factory.setReadTimeout(8_000);
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public boolean isConfigured() {
        return properties.isConfigured();
    }

    /** Kullanıcının yönlendirileceği Google onay adresi. */
    public String authorizationUrl(String state, String loginHint) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(AUTH_ENDPOINT)
                .queryParam("client_id", properties.clientId())
                .queryParam("redirect_uri", properties.redirectUri())
                .queryParam("response_type", "code")
                // Kimlik için gereken en az kapsam. Ek izin istemiyoruz: kullanıcı
                // onay ekranında ne kadar az şey görürse dönüşüm o kadar yüksek.
                .queryParam("scope", "openid email profile")
                .queryParam("state", state)
                // Yenileme jetonuna ihtiyacımız yok — Google'ı yalnız kimlik
                // doğrulamak için kullanıyoruz, adına API çağırmıyoruz.
                .queryParam("access_type", "online")
                .queryParam("prompt", "select_account");
        if (loginHint != null && !loginHint.isBlank()) {
            builder.queryParam("login_hint", loginHint);
        }
        // ⚠️ `build(true)` DEĞİL: o, değerlerin ZATEN kodlanmış olduğunu varsayar
        // ve `scope` içindeki boşlukta IllegalArgumentException atar (ölçüldü: 500).
        // Değerleri ham veriyoruz → kodlamayı builder yapsın.
        return builder.build().encode().toUriString();
    }

    /**
     * Yetkilendirme kodunu {@code id_token}'a çevirir ve profili döner.
     *
     * <p>⚠️ <b>İmza neden ayrıca doğrulanmıyor:</b> {@code id_token}'ı Google'ın
     * jeton ucundan, <b>kendi sunucumuzdan</b>, TLS üzerinden ve
     * {@code client_secret} ile kimliklenmiş bir istekle alıyoruz. Google'ın
     * kendi dokümanı bu durumda imza doğrulamasının gereksiz olduğunu söyler
     * (araya girecek bir taraf yok). Yine de <b>aud / iss / exp</b> kontrol
     * edilir: bunlar imzadan bağımsız olarak "bu jeton gerçekten BİZİM
     * uygulamamız için mi üretildi" sorusunu cevaplar ve jeton karıştırma
     * saldırılarını kapatır.
     */
    public GoogleProfile exchangeCode(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("redirect_uri", properties.redirectUri());
        form.add("grant_type", "authorization_code");

        JsonNode response;
        try {
            response = restClient.post()
                    .uri(TOKEN_ENDPOINT)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (Exception ex) {
            log.warn("Google jeton takası başarısız: {}", ex.getMessage());
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google ile giriş tamamlanamadı");
        }
        if (response == null || !response.hasNonNull("id_token")) {
            log.warn("Google jeton yanıtında id_token yok");
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google ile giriş tamamlanamadı");
        }
        return parseIdToken(response.get("id_token").asText());
    }

    private GoogleProfile parseIdToken(String idToken) {
        String[] parts = idToken.split("\\.");
        if (parts.length < 2) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google ile giriş tamamlanamadı");
        }
        JsonNode claims;
        try {
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            claims = objectMapper.readTree(new String(payload, StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google ile giriş tamamlanamadı");
        }

        // --- imzadan bağımsız, ZORUNLU kontroller -------------------------
        String issuer = claims.path("iss").asText("");
        if (!VALID_ISSUERS.contains(issuer)) {
            log.warn("Google id_token yayıncısı beklenmedik: {}", issuer);
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google ile giriş tamamlanamadı");
        }
        // `aud` bizim istemcimiz olmalı; başka bir uygulama için üretilmiş
        // jeton buraya getirilirse reddedilir.
        List<String> audiences = claims.path("aud").isArray()
                ? objectMapper.convertValue(claims.get("aud"), List.class)
                : List.of(claims.path("aud").asText(""));
        if (!audiences.contains(properties.clientId())) {
            log.warn("Google id_token başka bir istemci için üretilmiş");
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google ile giriş tamamlanamadı");
        }
        long exp = claims.path("exp").asLong(0);
        if (exp <= Instant.now().getEpochSecond()) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google ile giriş tamamlanamadı");
        }

        String sub = claims.path("sub").asText("");
        String email = claims.path("email").asText("");
        if (sub.isBlank() || email.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google hesabında e-posta bulunamadı");
        }
        return new GoogleProfile(
                sub,
                email.toLowerCase(java.util.Locale.ROOT).trim(),
                claims.path("email_verified").asBoolean(false),
                claims.path("name").asText(""),
                claims.path("picture").asText(""));
    }
}
