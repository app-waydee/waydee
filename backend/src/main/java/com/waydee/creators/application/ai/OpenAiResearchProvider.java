package com.waydee.creators.application.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.common.ai.AiProvider;
import com.waydee.common.ai.AiProviderSettings.ProviderAccess;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * <b>OpenAI ile araştırma</b> — Responses API (108. tur).
 *
 * <p>⚠️ SDK'sız: kod tabanındaki diğer OpenAI-uyumlu çağrılar
 * ({@code VisionProductDetector}) gibi {@code java.net.http} + Jackson.
 *
 * <h3>Gönderilen parametreler — yalnız belgelenmiş olanlar</h3>
 * {@code model}, {@code instructions}, {@code input}, {@code tools:[{type:"web_search"}]},
 * {@code text.format} (json_schema, strict) ve {@code max_output_tokens}.
 * {@code reasoning.effort} ve {@code max_tool_calls} <b>bilerek gönderilmiyor</b>:
 * yönetim panelinden seçilen model onları desteklemiyorsa istek 400 ile
 * dönerdi ve kullanıcı "OpenAI çalışmıyor" sonucunu görürdü. Web sorgusu sınırı
 * istemle iletilir.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiResearchProvider implements ResearchProvider {

    private static final String BASE = "https://api.openai.com/v1";
    private static final Duration RESEARCH_TIMEOUT = Duration.ofMinutes(8);
    private static final Duration STRUCTURED_TIMEOUT = Duration.ofMinutes(3);

    private final ObjectMapper objectMapper;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Override
    public AiProvider id() {
        return AiProvider.OPENAI;
    }

    @Override
    public ResearchResult research(ProviderAccess access, String system, String prompt, int maxSearches) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", access.model());
        body.put("instructions", system);
        body.put("input", prompt);
        body.put("tools", List.of(Map.of("type", "web_search", "search_context_size", "high")));
        body.put("max_output_tokens", 32_000);

        JsonNode response = post(access, "/responses", body, RESEARCH_TIMEOUT);
        assertComplete(response, true);

        StringBuilder text = new StringBuilder();
        Map<String, Source> sources = new LinkedHashMap<>();
        int searches = 0;
        for (JsonNode item : response.path("output")) {
            String type = item.path("type").asText();
            if ("web_search_call".equals(type)) {
                searches++;
                // `sources` yalnız istenince dolu gelir; varsa "görüldü" kümesine katılır.
                for (JsonNode s : item.path("action").path("sources")) {
                    addSource(sources, s.path("url").asText(null), s.path("title").asText(null));
                }
            } else if ("message".equals(type)) {
                for (JsonNode part : item.path("content")) {
                    if ("refusal".equals(part.path("type").asText())) {
                        throw new ProviderException(id(), ProviderException.Kind.REFUSAL, "OpenAI isteği reddetti");
                    }
                    if ("output_text".equals(part.path("type").asText())) {
                        text.append(part.path("text").asText(""));
                        for (JsonNode a : part.path("annotations")) {
                            if ("url_citation".equals(a.path("type").asText())) {
                                addSource(sources, a.path("url").asText(null), a.path("title").asText(null));
                            }
                        }
                    }
                }
            }
        }
        if (text.toString().isBlank()) {
            throw new ProviderException(id(), ProviderException.Kind.MALFORMED, "Araştırma metni boş döndü");
        }
        return new ResearchResult(text.toString(), List.copyOf(sources.values()),
                usageOf(response, searches), access.model());
    }

    @Override
    public StructuredResult structured(ProviderAccess access, String system, String prompt,
                                       String schemaName, Map<String, Object> schema) {
        Map<String, Object> format = new LinkedHashMap<>();
        format.put("type", "json_schema");
        format.put("name", schemaName);
        format.put("schema", schema);
        format.put("strict", true);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", access.model());
        body.put("instructions", system);
        body.put("input", prompt);
        body.put("text", Map.of("format", format));
        body.put("max_output_tokens", 16_000);

        JsonNode response = post(access, "/responses", body, STRUCTURED_TIMEOUT);
        assertComplete(response, false);

        StringBuilder json = new StringBuilder();
        for (JsonNode item : response.path("output")) {
            if (!"message".equals(item.path("type").asText())) {
                continue;
            }
            for (JsonNode part : item.path("content")) {
                if ("refusal".equals(part.path("type").asText())) {
                    throw new ProviderException(id(), ProviderException.Kind.REFUSAL, "OpenAI isteği reddetti");
                }
                if ("output_text".equals(part.path("type").asText())) {
                    json.append(part.path("text").asText(""));
                }
            }
        }
        if (json.toString().isBlank()) {
            throw new ProviderException(id(), ProviderException.Kind.MALFORMED, "Yapılandırılmış çıktı boş döndü");
        }
        return new StructuredResult(json.toString(), usageOf(response, 0), access.model());
    }

    /**
     * Bağlantı testi: modelin kaydını okur.
     *
     * <p>Hem anahtarı hem <b>model adını</b> doğrular (yanlış modelde 404) ve
     * hiç token harcamaz.
     */
    @Override
    public void ping(ProviderAccess access) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE + "/models/" + URLEncoder.encode(access.model(), StandardCharsets.UTF_8)))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + access.apiKey())
                .GET()
                .build();
        send(request);
    }

    // ------------------------------------------------------------------ çekirdek

    private JsonNode post(ProviderAccess access, String path, Map<String, Object> body, Duration timeout) {
        String json;
        try {
            json = objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("İstek gövdesi yazılamadı", e);
        }
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE + path))
                .timeout(timeout)
                .header("Authorization", "Bearer " + access.apiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();

        /* Bir kez yeniden dene: yalnız geçici hatalarda (5xx, ağ). Daha fazlası
           kullanıcıyı dakikalarca bekletirdi; kalıcı arızada zaten diğer
           sağlayıcıya geçiliyor. */
        try {
            return send(request);
        } catch (ProviderException e) {
            if (e.kind() != ProviderException.Kind.UNAVAILABLE && e.kind() != ProviderException.Kind.NETWORK) {
                throw e;
            }
            log.info("OpenAI geçici hata ({}), 2 sn sonra bir kez yeniden deneniyor", e.kind());
            sleep(2_000);
            return send(request);
        }
    }

    private JsonNode send(HttpRequest request) {
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new ProviderException(id(), ProviderException.Kind.NETWORK, "OpenAI'ye bağlanılamadı", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ProviderException(id(), ProviderException.Kind.NETWORK, "OpenAI isteği kesildi", e);
        }
        int status = response.statusCode();
        if (status >= 200 && status < 300) {
            try {
                return objectMapper.readTree(response.body());
            } catch (JsonProcessingException e) {
                throw new ProviderException(id(), ProviderException.Kind.MALFORMED, "OpenAI yanıtı çözülemedi", e);
            }
        }
        String detail = errorMessage(response.body());
        ProviderException.Kind kind = switch (status) {
            case 401, 403 -> ProviderException.Kind.AUTH;
            case 429 -> ProviderException.Kind.RATE_LIMIT;
            case 400, 404, 409, 422 -> ProviderException.Kind.BAD_REQUEST;
            default -> status >= 500 ? ProviderException.Kind.UNAVAILABLE : ProviderException.Kind.BAD_REQUEST;
        };
        throw new ProviderException(id(), kind, "OpenAI " + status + (detail.isEmpty() ? "" : ": " + detail));
    }

    /**
     * Yanıtın tamamlanıp tamamlanmadığı.
     *
     * <p>⚠️ Araştırmada {@code max_output_tokens} ile kesilme <b>tolere edilir</b>
     * (notlar kısmen de kullanılabilir); yapılandırılmış çıktıda kesik JSON
     * çözülemez — hata.
     */
    private void assertComplete(JsonNode response, boolean tolerateTruncation) {
        String status = response.path("status").asText("completed");
        if ("completed".equals(status)) {
            return;
        }
        String reason = response.path("incomplete_details").path("reason").asText("");
        if ("incomplete".equals(status) && "content_filter".equals(reason)) {
            throw new ProviderException(id(), ProviderException.Kind.REFUSAL, "OpenAI içerik filtresi");
        }
        if ("incomplete".equals(status) && tolerateTruncation) {
            log.info("OpenAI araştırması yarıda kesildi ({}), eldeki notlarla devam ediliyor", reason);
            return;
        }
        throw new ProviderException(id(), ProviderException.Kind.MALFORMED,
                "OpenAI yanıtı tamamlanmadı (" + status + (reason.isEmpty() ? "" : ", " + reason) + ")");
    }

    private static void addSource(Map<String, Source> sources, String url, String title) {
        if (url != null && !url.isBlank()) {
            sources.putIfAbsent(url, new Source(url, title));
        }
    }

    private static Usage usageOf(JsonNode response, int searches) {
        JsonNode usage = response.path("usage");
        return new Usage(usage.path("input_tokens").asLong(0), usage.path("output_tokens").asLong(0), searches);
    }

    /** Sağlayıcının hata mesajı — kısaltılmış; anahtar içermez (OpenAI anahtarı mesajda yalnız maskeli verir). */
    private String errorMessage(String body) {
        try {
            String message = objectMapper.readTree(body).path("error").path("message").asText("");
            return message.length() > 200 ? message.substring(0, 200) : message;
        } catch (JsonProcessingException | IllegalArgumentException e) {
            return "";
        }
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
