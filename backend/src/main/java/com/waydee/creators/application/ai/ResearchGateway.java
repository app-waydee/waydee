package com.waydee.creators.application.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.common.ai.AiProvider;
import com.waydee.common.ai.AiProviderSettings;
import com.waydee.common.ai.AiProviderSettings.ProviderAccess;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;

/**
 * <b>Sağlayıcı seçimi ve yedekleme</b> (108. tur).
 *
 * <p>Kullanıcının kuralı: <i>"hangisinin API'si varsa oradan derin araştırsın"</i>.
 * Uygulaması:
 * <ol>
 *   <li>Anahtarı olan ve açık sağlayıcılar, yönetimdeki <b>öncelik sırasıyla</b>
 *       denenir ({@link AiProviderSettings#usableProviders()}).</li>
 *   <li>Bir adım bir sağlayıcıda düşerse <b>aynı adım</b> sıradakiyle denenir.
 *       Adımlar durumsuzdur (metin → metin), yani araştırmayı Claude, çıkarımı
 *       OpenAI yapmış bir arama tutarlıdır; hangi adımı kimin koştuğu boru
 *       hattında görünür.</li>
 *   <li>Hepsi düşerse son hata fırlatılır; koşucu krediyi iade eder.</li>
 * </ol>
 *
 * <p>⚠️ Sağlayıcı listesi <b>her adımda yeniden okunur</b>: yönetici arama
 * sürerken anahtarı değiştirirse sonraki adım yeni anahtarla koşar. Tek seferlik
 * okunsaydı, iptal edilmiş bir anahtarla dakikalarca istek atılırdı.
 */
@Slf4j
@Component
public class ResearchGateway {

    private final AiProviderSettings settings;
    private final ObjectMapper objectMapper;
    private final Map<AiProvider, ResearchProvider> providers = new EnumMap<>(AiProvider.class);

    public ResearchGateway(AiProviderSettings settings, ObjectMapper objectMapper,
                           List<ResearchProvider> implementations) {
        this.settings = settings;
        /* ⚠️ Bilinmeyen alan HATA değil: sağlayıcı şemaya bir alan eklerse (ya da
           ileride şemaya alan eklenip eski bir yanıt okunursa) çözümleme
           düşmemeli. Eksik alan zaten null kalır ve doğrulayıcı onu ele alır. */
        this.objectMapper = objectMapper.copy()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        implementations.forEach(p -> providers.put(p.id(), p));
    }

    /** Herhangi bir sağlayıcı kullanılabilir mi — kullanıcıdan para almadan önce sorulur. */
    public boolean isAvailable() {
        return !settings.usableProviders().isEmpty();
    }

    public int maxWebSearches() {
        return settings.config().maxWebSearches();
    }

    /** Adımın sonucu ve onu kimin ürettiği. */
    public record Served<T>(T value, AiProvider provider, String model, List<String> failures) {
    }

    public Served<ResearchProvider.ResearchResult> research(String system, String prompt, int maxSearches) {
        return call((provider, access) -> provider.research(access, system, prompt, maxSearches));
    }

    /**
     * Şemaya zorlanmış çağrı + çözümleme.
     *
     * <p>🔴 Çözümleme <b>sağlayıcı denemesinin içinde</b> yapılır: bir sağlayıcı
     * şemaya uymayan bir JSON döndürürse bu {@code MALFORMED} sayılır ve aynı
     * adım sıradaki sağlayıcıyla tekrarlanır. Dışarıda çözümleseydik bozuk
     * çıktı, elde çalışan ikinci bir sağlayıcı varken bütün aramayı düşürürdü.
     */
    public <T> Served<Parsed<T>> structured(String system, String prompt, String schemaName,
                                            Map<String, Object> schema, Class<T> type) {
        return call((provider, access) -> {
            ResearchProvider.StructuredResult result = provider.structured(access, system, prompt, schemaName, schema);
            try {
                T value = objectMapper.readValue(result.json(), type);
                if (value == null) {
                    throw new ProviderException(provider.id(), ProviderException.Kind.MALFORMED, "Boş JSON");
                }
                return new Parsed<>(value, result.usage());
            } catch (JsonProcessingException e) {
                throw new ProviderException(provider.id(), ProviderException.Kind.MALFORMED,
                        "Çıktı şemaya uymadı: " + e.getOriginalMessage(), e);
            }
        });
    }

    /** Çözümlenmiş yapılandırılmış çıktı + tüketimi. */
    public record Parsed<T>(T value, ResearchProvider.Usage usage) {
    }

    private <T> Served<T> call(BiFunction<ResearchProvider, ProviderAccess, T> step) {
        List<ProviderAccess> candidates = settings.usableProviders();
        if (candidates.isEmpty()) {
            throw new ProviderException(null, ProviderException.Kind.AUTH, "Yapılandırılmış yapay zekâ sağlayıcısı yok");
        }
        List<String> failures = new ArrayList<>();
        ProviderException last = null;
        for (int i = 0; i < candidates.size(); i++) {
            ProviderAccess access = candidates.get(i);
            ResearchProvider provider = providers.get(access.provider());
            if (provider == null) {
                continue;
            }
            try {
                T value = step.apply(provider, access);
                return new Served<>(value, access.provider(), access.model(), List.copyOf(failures));
            } catch (ProviderException e) {
                last = e;
                failures.add(access.provider().label() + ": " + e.kind());
                // ⚠️ "Sıradaki deneniyor" yalnız gerçekten sıradaki varsa yazılır —
                // son sağlayıcıda bu cümle log okuyanı yanıltıyordu (108. tur ölçümü).
                log.warn("{} adımı düştü ({}): {}{}", access.provider().label(), e.kind(), e.getMessage(),
                        i < candidates.size() - 1 ? " — sıradaki sağlayıcı deneniyor" : "");
            } catch (RuntimeException e) {
                // ⚠️ Beklenmeyen bir istisna da yedeğe geçmeli; sınıflandırılmadan yakalanır.
                last = new ProviderException(access.provider(), ProviderException.Kind.UNAVAILABLE,
                        "Beklenmeyen hata: " + e.getClass().getSimpleName(), e);
                failures.add(access.provider().label() + ": " + ProviderException.Kind.UNAVAILABLE);
                log.error("{} adımında beklenmeyen hata", access.provider().label(), e);
            }
        }
        throw last != null ? last
                : new ProviderException(null, ProviderException.Kind.AUTH, "Kullanılabilir sağlayıcı bulunamadı");
    }

    /**
     * Yönetim ekranının "Bağlantıyı test et" düğmesi.
     *
     * <p>⚠️ Açık/kapalı bayrağına bakmaz: yönetici kapalı bir sağlayıcıyı
     * açmadan önce anahtarının çalıştığını görebilmeli.
     */
    public void ping(AiProvider provider) {
        ProviderAccess access = settings.access(provider)
                .orElseThrow(() -> new ProviderException(provider, ProviderException.Kind.AUTH, "Anahtar girilmemiş"));
        providers.get(provider).ping(access);
    }
}
