package com.waydee.creators;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.creators.application.CreatorModels.Filters;
import com.waydee.creators.application.CreatorPrompts;
import com.waydee.creators.domain.Platform;
import com.waydee.creators.domain.SizeTier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * <b>İki sağlayıcının ortak şema kuralının bekçisi</b> (108. tur).
 *
 * <p>🔴 Şemalar hem Claude'a hem OpenAI'ye aynen gidiyor. Claude'un
 * yapılandırılmış çıktısı {@code minimum}/{@code maxLength}/{@code minItems}
 * gibi sınırları <b>desteklemiyor</b> ve Java SDK bunları ayıklamıyor (400);
 * OpenAI strict modu ise her nesnede {@code additionalProperties:false} ve
 * <b>tüm</b> alanların {@code required} olmasını istiyor. İkisinden biri
 * bozulursa o sağlayıcı ilk istekte reddeder — bu test bunu derleme anında yakalar.
 */
class CreatorPromptsTest {

    private static final Set<String> FORBIDDEN = Set.of("minimum", "maximum", "exclusiveMinimum",
            "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "minItems", "maxItems", "pattern");

    private final CreatorPrompts prompts = new CreatorPrompts();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("🔴 Şemalarda iki sağlayıcının desteklemediği anahtar YOK; her nesne kapalı ve tüm alanlar zorunlu")
    void semalarOrtakAltKumede() {
        for (Object schema : List.of(prompts.criteriaSchema(), prompts.extractionSchema())) {
            check(mapper.valueToTree(schema), "$");
        }
    }

    private void check(JsonNode node, String path) {
        if (node.isObject()) {
            Iterator<String> names = node.fieldNames();
            while (names.hasNext()) {
                String name = names.next();
                assertFalse(FORBIDDEN.contains(name), path + " içinde desteklenmeyen anahtar: " + name);
            }
            if ("object".equals(node.path("type").asText())) {
                assertEquals(false, node.path("additionalProperties").asBoolean(true),
                        path + ": additionalProperties false olmalı");
                Set<String> props = new HashSet<>();
                node.path("properties").fieldNames().forEachRemaining(props::add);
                Set<String> required = new HashSet<>();
                node.path("required").forEach(r -> required.add(r.asText()));
                assertEquals(props, required, path + ": tüm alanlar required olmalı");
            }
            node.fields().forEachRemaining(e -> check(e.getValue(), path + "." + e.getKey()));
        } else if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                check(node.get(i), path + "[" + i + "]");
            }
        }
    }

    @Test
    @DisplayName("İstemlerde biçimlenmemiş yer tutucu kalmaz (%s / %d)")
    void yerTutucuKalmaz() {
        for (String text : List.of(prompts.refineSystem("de"), prompts.researchSystem(12), prompts.extractSystem("ar"))) {
            assertFalse(text.contains("%s") || text.contains("%d"), "biçimlenmemiş yer tutucu: " + text);
        }
        assertTrue(prompts.refineSystem("de").contains("German"));
        assertTrue(prompts.extractSystem("ar").contains("Arabic"));
        assertTrue(prompts.researchSystem(12).contains("up to 12 searches"));
        assertTrue(prompts.extractSystem("tr").contains("3.2 means 3.2%"), "%% kaçışı tek % olmalı");
    }

    @Test
    @DisplayName("Filtre özeti kodları ve aralıkları açık yazar")
    void filtreOzeti() {
        Filters f = new Filters(List.of(Platform.TIKTOK), List.of(), List.of(), List.of(SizeTier.NANO, SizeTier.MICRO),
                "TR", "tr", "FEMALE", 3.0, true, 5000, "TRY", true, 10);
        String prompt = prompts.researchPrompt("Vegan yemek yapan kadın içerik üreticileri", f,
                new com.waydee.creators.application.CreatorModels.Criteria("özet", "vegan food", List.of("vegan"),
                        List.of("vegan tiktok türkiye"), null, null, List.of()));
        /* ⚠️ Ülke ADI JDK'nın CLDR verisinden gelir ve sürümle değişir: JDK 21
           "Türkiye" diyor, eskileri "Turkey" derdi. Belirleyici olan ISO kodu —
           test ada değil koda bakar (ölçülerek bulundu, 108. tur). */
        assertTrue(prompt.contains("Creator country: TR ("));
        assertTrue(prompt.contains("1000-9999 followers or 10000-99999 followers"));
        assertTrue(prompt.contains("Find about 20 matching creators"));
        assertTrue(prompt.contains("Budget per sponsored post: up to 5000 TRY"));
    }
}
