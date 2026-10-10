package com.waydee.creators.domain;

/**
 * Takipçi kademesi (108. tur) — sektörün yerleşik sınırları.
 *
 * <p>InfluSense yalnız Nano/Mikro'yu öne çıkarıyor ("1K–10K"); burada beşi de
 * var çünkü kullanıcının cümlesi *"kaç takipçisi olsun"* idi — bir marka
 * makro bir isim de arayabilir.
 *
 * <p>⚠️ Üst sınır <b>dahil değil</b>: 10.000 takipçili biri Mikro'dur, Nano değil.
 * İki kademe aynı sayıyı sahiplenseydi aynı kişi iki filtrede birden çıkardı.
 */
public enum SizeTier {
    NANO(1_000L, 10_000L),
    MICRO(10_000L, 100_000L),
    MID(100_000L, 500_000L),
    MACRO(500_000L, 1_000_000L),
    MEGA(1_000_000L, Long.MAX_VALUE);

    private final long min;
    private final long maxExclusive;

    SizeTier(long min, long maxExclusive) {
        this.min = min;
        this.maxExclusive = maxExclusive;
    }

    public long min() {
        return min;
    }

    public long maxExclusive() {
        return maxExclusive;
    }

    public boolean contains(long followers) {
        return followers >= min && followers < maxExclusive;
    }

    /**
     * Kademenin tipik etkileşim oranı (%) — etkileşim sinyalinin ölçütü.
     *
     * <p>⚠️ Kitle büyüdükçe oran düşer; tek bir eşik kullanmak nano
     * hesapları her zaman "harika", mega hesapları her zaman "zayıf" gösterirdi.
     * Değerler sektör raporlarının (HypeAuditor, Influencer Marketing Hub)
     * ortalamalarına yakın, yuvarlak sayılardır — kesin bir gerçek değil, adil
     * bir karşılaştırma tabanı.
     */
    public double typicalEngagementPct() {
        return switch (this) {
            case NANO -> 5.0;
            case MICRO -> 3.5;
            case MID -> 2.5;
            case MACRO -> 1.8;
            case MEGA -> 1.2;
        };
    }

    public static SizeTier of(long followers) {
        for (SizeTier tier : values()) {
            if (tier.contains(followers)) {
                return tier;
            }
        }
        // 1.000'in altı: kademesi yok ama en yakın tabana göre değerlendirilir.
        return NANO;
    }
}
