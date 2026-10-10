package com.waydee.common.security;

import com.waydee.common.error.ApiException;
import com.waydee.common.error.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Cloudflare Turnstile doğrulaması.
 *
 * <p>İstemci widget'ı bir jeton üretir; sunucu bu jetonu Cloudflare'e sorar.
 * Jeton <b>tek kullanımlıktır</b> ve kısa ömürlüdür — her giriş/kayıt denemesi
 * kendi jetonunu getirmelidir.
 *
 * <p><b>Duruş:</b> özellik kapalıyken (yerel geliştirme) doğrulama atlanır.
 * Açıkken jeton yoksa ya da Cloudflare "başarısız" derse istek <b>reddedilir</b>
 * (fail-closed) — bot koruması fail-open olursa hiç yok demektir. Cloudflare'e
 * ulaşılamazsa da reddedilir; bu bilinçli bir tercihtir ve log'a yazılır.
 */
@Slf4j
@Service
@EnableConfigurationProperties(TurnstileProperties.class)
public class TurnstileService {

    private final TurnstileProperties properties;
    private final RestClient restClient;

    public TurnstileService(TurnstileProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) properties.timeout().toMillis());
        factory.setReadTimeout((int) properties.timeout().toMillis());
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public boolean isEnabled() {
        return properties.enabled() && properties.secretKey() != null && !properties.secretKey().isBlank();
    }

    /**
     * Jetonu doğrular; geçersizse {@link ApiException} fırlatır.
     *
     * @param token istemciden gelen {@code cf-turnstile-response}
     * @param ip    isteğin geldiği IP (Cloudflare'e ipucu olarak gider)
     */
    public void verify(String token, String ip) {
        if (!isEnabled()) {
            return;
        }
        if (token == null || token.isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Bot doğrulaması gerekli");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("secret", properties.secretKey());
        form.add("response", token);
        if (ip != null && !ip.isBlank()) {
            form.add("remoteip", ip);
        }

        Map<String, Object> result;
        try {
            result = restClient.post()
                    .uri(properties.verifyUrl())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });
        } catch (Exception ex) {
            // Fail-closed: doğrulayamıyorsak geçirmeyiz.
            log.warn("Turnstile doğrulaması yapılamadı: {}", ex.getMessage());
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Bot doğrulaması şu an yapılamıyor, tekrar deneyin");
        }

        boolean success = result != null && Boolean.TRUE.equals(result.get("success"));
        if (!success) {
            Object codes = result != null ? result.get("error-codes") : List.of();
            log.info("Turnstile reddetti: {}", codes);
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Bot doğrulaması başarısız, tekrar deneyin");
        }
    }
}
