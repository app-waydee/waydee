package com.waydee.payment.domain;

/** Ödemenin neyin karşılığı olduğu. */
public enum CheckoutKind {
    /** Yeni daire kiralama (12 aylık ilk dönem). */
    TERRITORY_PURCHASE,
    /** Mevcut bölgenin kirasını uzatma. */
    TERRITORY_RENEWAL,

    /**
     * <b>PRO üyeliğe geçiş</b> (V34).
     *
     * <p>⚠️ Daire alımından farkı: <b>geometrisi yoktur</b>. Plan yükseltmesi de
     * bir ödemedir; ayrı bir mekanizma icat etmek yerine bu durum makinesi
     * (PENDING → PAID/FAILED, imzalı webhook, idempotent tamamlama) yeniden
     * kullanılır.
     */
    PLAN_PRO,

    /** <b>PREMIUM üyeliğe geçiş</b> (V37) — mağaza dairesi hakkını açar. */
    PLAN_PREMIUM,

    /**
     * <b>Mağazayı öne taşıma teklifi</b> (V57, 98. tur — bidkick modeli).
     *
     * <p>🔴 Diğer hepsinden farkı: <b>tutarı kullanıcı belirler</b>. Fiyat
     * listesi yoktur; bu ürünün fiyatı, listede olmak isteyenin ödemeye razı
     * olduğu tutardır. Sunucu yalnız alt/üst sınırı uygular.
     *
     * <p>⚠️ Aynı durum makinesi (PENDING → PAID/FAILED, imzalı webhook,
     * idempotent tamamlama) yeniden kullanılır — ödeme güvenliğini ikinci kez
     * yazmak, ikinci kez hata yapmak demekti.
     */
    STORE_BID;

    /** Üyelik ödemesi mi (geometrisiz)? */
    public boolean isPlan() {
        return this == PLAN_PRO || this == PLAN_PREMIUM;
    }

    /** Öne çıkarma teklifi mi? */
    public boolean isBid() {
        return this == STORE_BID;
    }

    /** Bu ödemenin karşılık geldiği plan; bölge ödemelerinde {@code null}. */
    public com.waydee.identity.domain.UserPlan plan() {
        return switch (this) {
            case PLAN_PRO -> com.waydee.identity.domain.UserPlan.PRO;
            case PLAN_PREMIUM -> com.waydee.identity.domain.UserPlan.PREMIUM;
            default -> null;
        };
    }

    /** Plandan ödeme türüne — oturum açarken kullanılır. */
    public static CheckoutKind of(com.waydee.identity.domain.UserPlan plan) {
        return plan == com.waydee.identity.domain.UserPlan.PREMIUM ? PLAN_PREMIUM : PLAN_PRO;
    }
}
