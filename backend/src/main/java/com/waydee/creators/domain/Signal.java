package com.waydee.creators.domain;

/**
 * <b>Puanlamanın sekiz sinyali</b> (108. tur) — radar grafiğinin eksenleri.
 *
 * <p>InfluSense'in "Measure" ekranındaki sekiz eksenle aynı fikir (Subs · Desc ·
 * Geo · Lang · Budget · Engmt · Views · V2S). Burada {@code Views} ve
 * {@code V2S} tek bir <b>Erişim</b> ekseninde birleşti (ikisi de aynı soruyu
 * soruyor: "takipçisinin ne kadarına ulaşıyor") ve yerine <b>Büyüme</b> eklendi —
 * InfluSense'in kendi vaadi olan "momentum, takipçi sayısı değil" ancak ayrı bir
 * eksenle ağırlıklandırılabilir.
 *
 * <p>🔴 Sinyallerden <b>yalnız biri</b> modelin yargısıdır ({@link #CONTENT_FIT});
 * diğer yedisi kaynaklı sayılardan sunucuda hesaplanır. Ekranda bu ayrım
 * açıkça yazılı — "kara kutu yok" vaadinin dürüst hâli.
 */
public enum Signal {
    AUDIENCE(30),
    CONTENT_FIT(60),
    GEO(30),
    LANGUAGE(15),
    BUDGET(45),
    ENGAGEMENT(75),
    REACH(30),
    MOMENTUM(15);

    /**
     * Varsayılan ağırlık (0–100).
     *
     * <p>InfluSense'in belgelenmiş varsayılanı: <i>"engagement and cost fit
     * carrying the most weight by default"</i> — burada da en ağır iki eksen
     * etkileşim ve bütçe uyumu (+ içerik uyumu, çünkü yanlış nişteki bir hesap
     * etkileşimi ne olursa olsun işe yaramaz).
     *
     * <p>⚠️ Ölçek bilinçli olarak büyük (en ağırı 75). Puan <b>göreli</b>
     * (Σw·s/Σw) olduğundan tüm ağırlıkları aynı oranla büyütmek hiçbir puanı
     * değiştirmez — ama 108. turda ölçüldü: 25'lik bir tavanla radar grafiği
     * merkeze sıkışmış küçük bir şekil çiziyordu ve sürüklenecek alan yoktu.
     * ⚠️ İstemcideki {@code DEFAULT_WEIGHTS} ile birebir aynı olmalı.
     */
    private final int defaultWeight;

    Signal(int defaultWeight) {
        this.defaultWeight = defaultWeight;
    }

    public int defaultWeight() {
        return defaultWeight;
    }
}
