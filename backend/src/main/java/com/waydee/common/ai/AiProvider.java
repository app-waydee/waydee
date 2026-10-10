package com.waydee.common.ai;

/**
 * Yönetimden anahtarı girilebilen dil modeli sağlayıcıları (108. tur).
 *
 * <p>⚠️ Sıra burada <b>anlam taşımaz</b>; hangi sağlayıcının önce deneneceği
 * yönetim panelindeki öncelik listesinden gelir ({@link AiProviderSettings}).
 */
public enum AiProvider {
    ANTHROPIC("Claude"),
    OPENAI("OpenAI");

    private final String label;

    AiProvider(String label) {
        this.label = label;
    }

    /** Arayüzde ve boru hattı adımlarında görünen ad. */
    public String label() {
        return label;
    }
}
