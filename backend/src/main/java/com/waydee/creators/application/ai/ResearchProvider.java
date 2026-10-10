package com.waydee.creators.application.ai;

import com.waydee.common.ai.AiProvider;
import com.waydee.common.ai.AiProviderSettings.ProviderAccess;

import java.util.List;
import java.util.Map;

/**
 * <b>Bir dil modeli sağlayıcısının araştırma yüzü</b> (108. tur).
 *
 * <p>İki çağrı türü var ve bilerek <b>ayrı</b>:
 * <ol>
 *   <li>{@link #research} — <b>web aramalı</b>, serbest metin. Model gerçek
 *       sayfaları okur, bulgularını kaynaklarıyla yazar.</li>
 *   <li>{@link #structured} — <b>araçsız</b>, şemaya zorlanmış JSON.</li>
 * </ol>
 *
 * <h3>🔴 Neden tek çağrıda birleştirilmedi</h3>
 * Claude'da yapılandırılmış çıktı <b>citations ile birlikte kullanılamaz</b>
 * (400 döner) ve web araması citation üretir; OpenAI dokümanı ise ikisinin
 * birlikte çalıştığını hiç taahhüt etmiyor. "Bir sağlayıcıda çalışıyor"
 * garantisiyle kurulan bir boru hattı, diğerinde ilk istekte kırılırdı. İki
 * fazlı akış her iki sağlayıcıda da belgelenmiş yollardan geçer.
 *
 * <h3>🔴 Web araması olmadan neden olmaz</h3>
 * Web erişimi olmayan bir dil modeli, var olmayan hesaplar ve uydurma takipçi
 * sayıları üretir — tam olarak bu özelliğin değerini sıfırlayan şey. Bu
 * yüzden çıkarım adımındaki her aday, araştırma adımında <b>gerçekten okunan</b>
 * bir kaynağa bağlanmak zorundadır (bkz. {@code CandidateValidator}).
 */
public interface ResearchProvider {

    AiProvider id();

    /**
     * Web aramalı araştırma.
     *
     * @param maxSearches bu çağrıda en çok kaç web sorgusu (fatura buna bağlı)
     */
    ResearchResult research(ProviderAccess access, String system, String prompt, int maxSearches);

    /**
     * Şemaya zorlanmış JSON üretir.
     *
     * @param schema {@code CreatorSchemas}'tan gelen JSON şeması — iki
     *               sağlayıcının da ortak desteklediği alt kümede yazılmış
     */
    StructuredResult structured(ProviderAccess access, String system, String prompt,
                                String schemaName, Map<String, Object> schema);

    /** Bağlantı testi — en ucuz gerçek istek. Başarısızsa {@link ProviderException}. */
    void ping(ProviderAccess access);

    /** Tüketim. ⚠️ Bilinmiyorsa 0 — tahmin yazılmaz. */
    record Usage(long inputTokens, long outputTokens, int webSearches) {

        public static final Usage NONE = new Usage(0, 0, 0);

        public Usage plus(Usage other) {
            return new Usage(inputTokens + other.inputTokens, outputTokens + other.outputTokens,
                    webSearches + other.webSearches);
        }
    }

    /** Modelin web aramasında GERÇEKTEN gördüğü bir sayfa. */
    record Source(String url, String title) {
    }

    /**
     * @param text    modelin bulgu notları
     * @param sources aramada dönen ve atıf yapılan sayfaların birleşimi —
     *                aday doğrulamasının "gerçekten okundu" kümesi
     */
    record ResearchResult(String text, List<Source> sources, Usage usage, String model) {
    }

    record StructuredResult(String json, Usage usage, String model) {
    }
}
