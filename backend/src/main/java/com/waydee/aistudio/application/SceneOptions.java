package com.waydee.aistudio.application;

import com.waydee.common.error.ApiException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * <b>Editoryal ve Poz araçlarının sözlüğü</b> (99. tur).
 *
 * <p>{@link FashionOptions} ile aynı ilke: sunucu <b>kod</b> döndürür, etiketi
 * arayüz kendi diliyle basar. Serbest metin yine <b>yok</b> — gerekçe
 * {@code FashionOptions} başında (istem enjeksiyonu · kötüye kullanım ·
 * öngörülemez maliyet).
 */
public final class SceneOptions {

    private SceneOptions() {
    }

    /**
     * Yaratıcılık seviyesi — <b>sahneye sadakat</b> ile <b>cesaret</b> arasında
     * tek bir düğme.
     *
     * <p>⚠️ Değerler modele giden İngilizce cümlelerdir; kullanıcı etiketi
     * ("Standart" / "Yaratıcı") sözlükten gelir.
     */
    public static final Map<String, String> CREATIVITY = ordered(
            "STANDARD",
            "a new pose and a slightly different camera angle, while the people, the outfits, "
                    + "the background and the lighting stay exactly as they are in the source photograph",
            "CREATIVE",
            "a noticeably different pose, body orientation and camera angle — including a step, "
                    + "a turn or a change of height — while the same people, the same outfits and the same "
                    + "location remain recognisable");

    /**
     * Kabul edilen en-boy oranları.
     *
     * <p>🔴 Liste <b>sunucuda</b>: sağlayıcı yalnız belli bir kümeyi kabul
     * ediyor ve istemcinin gönderdiği serbest bir dize doğrudan sağlayıcıya
     * gitseydi, hata kullanıcıya "üretim başarısız" olarak dönerdi.
     *
     * <p>⚠️ Sıra ekranda anlamlı: dikeyden yataya.
     */
    public static final List<String> ASPECT_RATIOS =
            List.of("3:4", "4:5", "1:1", "2:3", "9:16", "3:2", "4:3", "5:4", "16:9", "21:9");

    public static final String DEFAULT_ASPECT_RATIO = "3:4";

    public static String describeCreativity(String code) {
        return FashionOptions.describe(CREATIVITY, code, "yaratıcılık seviyesi");
    }

    /** ⚠️ Doğrulama <b>sunucuda</b>: liste dışı bir oran 400 verir, 500 değil. */
    public static String requireAspectRatio(String value) {
        if (value == null || !ASPECT_RATIOS.contains(value)) {
            throw ApiException.badRequest("Geçersiz en-boy oranı");
        }
        return value;
    }

    /** Arayüzün açılır listeleri için kod listeleri. */
    public static Map<String, List<String>> catalogue() {
        Map<String, List<String>> out = new LinkedHashMap<>();
        out.put("creativity", List.copyOf(CREATIVITY.keySet()));
        out.put("aspectRatio", ASPECT_RATIOS);
        return out;
    }

    /** ⚠️ Sıra korunur ({@code LinkedHashMap}); {@code Map.copyOf} sırayı kaybederdi. */
    private static Map<String, String> ordered(String... pairs) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            map.put(pairs[i], pairs[i + 1]);
        }
        return java.util.Collections.unmodifiableMap(map);
    }
}
