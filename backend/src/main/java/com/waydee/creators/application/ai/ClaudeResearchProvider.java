package com.waydee.creators.application.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.core.http.StreamResponse;
import com.anthropic.errors.AnthropicInvalidDataException;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.BadRequestException;
import com.anthropic.errors.NotFoundException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.errors.UnprocessableEntityException;
import com.anthropic.helpers.BetaMessageAccumulator;
import com.anthropic.models.beta.messages.BetaContentBlock;
import com.anthropic.models.beta.messages.BetaJsonOutputFormat;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.BetaOutputConfig;
import com.anthropic.models.beta.messages.BetaRawMessageStreamEvent;
import com.anthropic.models.beta.messages.BetaStopReason;
import com.anthropic.models.beta.messages.BetaTextCitation;
import com.anthropic.models.beta.messages.BetaThinkingConfigAdaptive;
import com.anthropic.models.beta.messages.BetaUsage;
import com.anthropic.models.beta.messages.BetaWebSearchResultBlock;
import com.anthropic.models.beta.messages.BetaWebSearchTool20260209;
import com.anthropic.models.beta.messages.MessageCreateParams;
import com.waydee.common.ai.AiProvider;
import com.waydee.common.ai.AiProviderSettings.ProviderAccess;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * <b>Claude ile araştırma</b> — resmî Anthropic Java SDK (108. tur).
 *
 * <h3>İstek kararları</h3>
 * <ul>
 *   <li><b>Beta uç noktası + sunucu taraflı yedek</b>
 *       ({@code fallbacks: "default"}, {@code server-side-fallback-2026-07-01}).
 *       Güvenlik sınıflandırıcısı bir isteği reddederse sunucu onu uygun bir
 *       modelle yeniden dener; reddi bizim yakalayıp OpenAI'ye geçmemizden önce
 *       Claude'un kendi içinde çözülür.</li>
 *   <li><b>Uyarlamalı düşünme</b> açık; derinlik {@code effort} ile. Araştırmada
 *       {@code HIGH} (Opus 5.5'in varsayılanı {@code medium} — derin araştırma
 *       için açıkça yükseltildi), çıkarımda {@code MEDIUM}.</li>
 *   <li><b>Akış (streaming)</b>: web araması + düşünme dakikalar sürebilir ve
 *       büyük {@code max_tokens} akışsız istekte HTTP zaman aşımına takılırdı.
 *       Akış {@link BetaMessageAccumulator} ile tek mesaja toplanır.</li>
 *   <li><b>{@code pause_turn}</b>: sunucunun araç döngüsü 10 turda durursa yanıt
 *       aynen geri gönderilerek devam edilir (en çok {@value #MAX_CONTINUATIONS}).
 *       ⚠️ "Devam et" diye yeni bir kullanıcı mesajı EKLENMEZ — API, sondaki
 *       araç bloğunu görüp kaldığı yerden sürdürür.</li>
 * </ul>
 */
@Slf4j
@Component
public class ClaudeResearchProvider implements ResearchProvider {

    private static final String FALLBACK_BETA = "server-side-fallback-2026-07-01";
    private static final String WORKSPACE_HEADER = "anthropic-workspace-id";
    private static final int MAX_CONTINUATIONS = 5;
    private static final long RESEARCH_MAX_TOKENS = 32_000L;
    private static final long STRUCTURED_MAX_TOKENS = 16_000L;

    /**
     * İstemci önbelleği — tek giriş.
     *
     * <p>⚠️ Her çağrıda yeni istemci kurmak, her seferinde yeni bir OkHttp
     * bağlantı havuzu ve iş parçacığı açmak demekti. Anahtar değişince eski
     * istemci kapatılır. Önbellek anahtarı anahtarın kendisi DEĞİL, özetidir —
     * bellek dökümünde bile ham anahtar bir harita anahtarı olarak durmasın.
     */
    private String cachedFingerprint;
    private AnthropicClient cachedClient;

    @Override
    public AiProvider id() {
        return AiProvider.ANTHROPIC;
    }

    @Override
    public ResearchResult research(ProviderAccess access, String system, String prompt, int maxSearches) {
        AnthropicClient client = client(access);

        List<BetaMessage> turns = new ArrayList<>();
        Usage usage = Usage.NONE;
        for (int attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
            /* ⚠️ Builder her turda SIFIRDAN kurulur: ortak bir taban üzerinde
               `build()` çağırmak, mesajı olmayan bir istek kurmak demekti ve SDK
               `messages` zorunlu alanı için orada patlardı. */
            MessageCreateParams.Builder params = baseParams(access, system, RESEARCH_MAX_TOKENS,
                    BetaOutputConfig.Effort.HIGH)
                    .addTool(BetaWebSearchTool20260209.builder().maxUses((long) maxSearches).build())
                    .addUserMessage(prompt);
            turns.forEach(params::addMessage);
            BetaMessage message = stream(client, params.build());
            turns.add(message);
            usage = usage.plus(usageOf(message.usage()));

            BetaStopReason stop = message.stopReason().orElse(null);
            if (BetaStopReason.PAUSE_TURN.equals(stop)) {
                continue;
            }
            assertUsableStop(message, stop, true);
            break;
        }

        StringBuilder text = new StringBuilder();
        Map<String, Source> sources = new LinkedHashMap<>();
        for (BetaMessage message : turns) {
            for (BetaContentBlock block : message.content()) {
                block.text().ifPresent(t -> {
                    text.append(t.text());
                    t.citations().ifPresent(list -> list.forEach(c -> addCitation(sources, c)));
                });
                block.webSearchToolResult().ifPresent(r -> r.content().resultBlocks()
                        .ifPresent(results -> results.forEach(res -> addResult(sources, res))));
            }
        }
        if (text.toString().isBlank()) {
            throw new ProviderException(id(), ProviderException.Kind.MALFORMED, "Araştırma metni boş döndü");
        }
        return new ResearchResult(text.toString(), List.copyOf(sources.values()), usage, access.model());
    }

    @Override
    public StructuredResult structured(ProviderAccess access, String system, String prompt,
                                       String schemaName, Map<String, Object> schema) {
        BetaJsonOutputFormat.Schema.Builder schemaBuilder = BetaJsonOutputFormat.Schema.builder();
        schema.forEach((key, value) -> schemaBuilder.putAdditionalProperty(key, JsonValue.from(value)));

        // ⚠️ `outputConfig` tabandakini BÜTÜNÜYLE değiştirir — çaba burada yeniden yazılır.
        MessageCreateParams params = baseParams(access, system, STRUCTURED_MAX_TOKENS, BetaOutputConfig.Effort.MEDIUM)
                .outputConfig(BetaOutputConfig.builder()
                        .effort(BetaOutputConfig.Effort.MEDIUM)
                        .format(BetaJsonOutputFormat.builder().schema(schemaBuilder.build()).build())
                        .build())
                .addUserMessage(prompt)
                .build();

        BetaMessage message = stream(client(access), params);
        assertUsableStop(message, message.stopReason().orElse(null), false);

        StringBuilder json = new StringBuilder();
        for (BetaContentBlock block : message.content()) {
            block.text().ifPresent(t -> json.append(t.text()));
        }
        if (json.toString().isBlank()) {
            throw new ProviderException(id(), ProviderException.Kind.MALFORMED, "Yapılandırılmış çıktı boş döndü");
        }
        return new StructuredResult(json.toString(), usageOf(message.usage()), access.model());
    }

    @Override
    public void ping(ProviderAccess access) {
        // En ucuz gerçek istek: tek kelimelik yanıt, düşük çaba.
        MessageCreateParams params = baseParams(access, "Reply with the single word: ok", 1_024L,
                BetaOutputConfig.Effort.LOW)
                .addUserMessage("ping")
                .build();
        stream(client(access), params);
    }

    // ------------------------------------------------------------------ çekirdek

    private MessageCreateParams.Builder baseParams(ProviderAccess access, String system, long maxTokens,
                                                   BetaOutputConfig.Effort effort) {
        return MessageCreateParams.builder()
                .model(access.model())
                .maxTokens(maxTokens)
                .system(system)
                .thinking(BetaThinkingConfigAdaptive.builder().build())
                .outputConfig(BetaOutputConfig.builder().effort(effort).build())
                .addBeta(FALLBACK_BETA)
                .fallbacksDefault();
    }

    /**
     * Akışı tek mesaja toplar ve SDK istisnalarını sınıflandırır.
     *
     * <p>⚠️ Sıra <b>en özelden en genele</b>: tek bir geniş {@code catch},
     * yeniden denenebilir (429, 5xx, ağ) ile denenemez (400, 401) hatalar
     * arasındaki farkı kaybettirirdi.
     */
    private BetaMessage stream(AnthropicClient client, MessageCreateParams params) {
        try {
            try (StreamResponse<BetaRawMessageStreamEvent> response = client.beta().messages().createStreaming(params)) {
                BetaMessageAccumulator accumulator = BetaMessageAccumulator.create();
                response.stream().forEach(accumulator::accumulate);
                return accumulator.message();
            } catch (AnthropicInvalidDataException e) {
                /* 🔴 8 Eki 2026, üretimde ölçüldü: web aramalı turda SDK birikimcisi
                   "Missing input JSON for index N" ile patlıyor (girdisi
                   content_block_start'ta tam gelen sunucu aracı bloğu, ardından
                   hiç input_json_delta yok). Aynı istek akışsız tekrarlanır —
                   yanıt tek parça geldiği için birikimciye hiç uğramaz. */
                log.warn("Claude akışı çözülemedi ({}), akışsız tekrar deneniyor", e.getMessage());
                return client.beta().messages().create(params);
            }
        } catch (UnauthorizedException | PermissionDeniedException e) {
            throw new ProviderException(id(), ProviderException.Kind.AUTH, "Claude anahtarı reddedildi", e);
        } catch (RateLimitException e) {
            throw new ProviderException(id(), ProviderException.Kind.RATE_LIMIT, "Claude hız/kota sınırı", e);
        } catch (BadRequestException | NotFoundException | UnprocessableEntityException e) {
            // Çalışma alanı eksikliği ayrı tanınır: yöneticinin yapacağı şey farklı
            // (model adı değil, Workspace ID girmek) ve ham mesaj bunu gizliyordu.
            if (String.valueOf(e.getMessage()).contains(WORKSPACE_HEADER)) {
                /* İki durum ölçüldü (7 Eki 2026): başlık YOKKEN "This API key is not
                   scoped to a workspace…", YANLIŞ kimlikte "…header must be a valid
                   workspace ID". Yöneticinin yapacağı farklı olduğu için ayrı cümle. */
                boolean invalid = String.valueOf(e.getMessage()).contains("valid workspace");
                throw new ProviderException(id(), ProviderException.Kind.WORKSPACE_REQUIRED, invalid
                        ? "Workspace ID geçersiz — Console → Settings → Workspaces'ten doğru kimliği kopyalayın"
                        : "Bu anahtar bir çalışma alanına bağlı değil — Workspace ID girin", e);
            }
            // Çoğunlukla model adı yanlış ya da parametre desteklenmiyor.
            throw new ProviderException(id(), ProviderException.Kind.BAD_REQUEST,
                    "Claude isteği reddetti: " + safeMessage(e), e);
        } catch (AnthropicServiceException e) {
            throw new ProviderException(id(), ProviderException.Kind.UNAVAILABLE,
                    "Claude hizmet hatası (" + e.statusCode() + ")", e);
        } catch (AnthropicIoException e) {
            throw new ProviderException(id(), ProviderException.Kind.NETWORK, "Claude'a bağlanılamadı", e);
        }
    }

    /**
     * Durma sebebini değerlendirir.
     *
     * <p>⚠️ Araştırmada {@code max_tokens} <b>kabul edilir</b>: notlar yarıda
     * kesilse de içlerindeki adaylar kaynaklarıyla geçerlidir ve çıkarım adımı
     * eksik bir cümleyi tolere eder. Yapılandırılmış çıktıda ise kesik bir JSON
     * çözülemez — orada hata sayılır.
     */
    private void assertUsableStop(BetaMessage message, BetaStopReason stop, boolean tolerateTruncation) {
        if (BetaStopReason.REFUSAL.equals(stop)) {
            String category = message.stopDetails().flatMap(d -> d.category()).map(Object::toString).orElse("?");
            throw new ProviderException(id(), ProviderException.Kind.REFUSAL, "Claude isteği reddetti (" + category + ")");
        }
        if (BetaStopReason.PAUSE_TURN.equals(stop)) {
            throw new ProviderException(id(), ProviderException.Kind.MALFORMED, "Araştırma devam turu sınırına ulaştı");
        }
        if (!tolerateTruncation && BetaStopReason.MAX_TOKENS.equals(stop)) {
            throw new ProviderException(id(), ProviderException.Kind.MALFORMED, "Yapılandırılmış çıktı yarıda kesildi");
        }
        if (BetaStopReason.MODEL_CONTEXT_WINDOW_EXCEEDED.equals(stop)) {
            throw new ProviderException(id(), ProviderException.Kind.MALFORMED, "Bağlam penceresi aşıldı");
        }
    }

    private static void addCitation(Map<String, Source> sources, BetaTextCitation citation) {
        if (citation.isWebSearchResultLocation()) {
            var location = citation.asWebSearchResultLocation();
            sources.putIfAbsent(location.url(), new Source(location.url(), location.title().orElse(null)));
        }
    }

    private static void addResult(Map<String, Source> sources, BetaWebSearchResultBlock result) {
        sources.putIfAbsent(result.url(), new Source(result.url(), result.title()));
    }

    private static Usage usageOf(BetaUsage usage) {
        int searches = usage.serverToolUse().map(s -> (int) s.webSearchRequests()).orElse(0);
        return new Usage(usage.inputTokens(), usage.outputTokens(), searches);
    }

    /** SDK mesajı içinde istek kimliği olabilir; ilk 200 karakter yeter. */
    private static String safeMessage(Exception e) {
        String m = e.getMessage() == null ? "" : e.getMessage();
        return m.length() > 200 ? m.substring(0, 200) : m;
    }

    private synchronized AnthropicClient client(ProviderAccess access) {
        // Çalışma alanı da istemcinin parçası: değişince istemci yeniden kurulmalı.
        String fingerprint = fingerprint(access.apiKey() + "|" + (access.workspaceId() == null ? "" : access.workspaceId()));
        if (cachedClient == null || !fingerprint.equals(cachedFingerprint)) {
            if (cachedClient != null) {
                try {
                    cachedClient.close();
                } catch (RuntimeException e) {
                    log.debug("Eski Claude istemcisi kapatılamadı: {}", e.toString());
                }
            }
            /* ⚠️ `fromEnv()` DEĞİL: ortamdaki ANTHROPIC_API_KEY / BASE_URL bu
               makinede başka bir araç için tanımlı olabilir. Anahtar yalnız
               yönetim panelinden gelir. */
            AnthropicOkHttpClient.Builder builder = AnthropicOkHttpClient.builder()
                    .apiKey(access.apiKey())
                    .timeout(Duration.ofMinutes(10))
                    .maxRetries(2);
            /* 🔴 7 Eki 2026 — ilk gerçek anahtarla bulundu: çalışma alanına bağlı
               OLMAYAN anahtarlarda Anthropic her isteği 400 ile reddediyor ve bu
               başlığı istiyor. SDK'da ayrı bir ayarı yok; başlık istemci düzeyinde
               her isteğe eklenir. */
            if (access.workspaceId() != null) {
                builder.putHeader(WORKSPACE_HEADER, access.workspaceId());
            }
            cachedClient = builder.build();
            cachedFingerprint = fingerprint;
        }
        return cachedClient;
    }

    private static String fingerprint(String key) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
