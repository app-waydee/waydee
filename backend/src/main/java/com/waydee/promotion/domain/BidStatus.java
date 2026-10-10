package com.waydee.promotion.domain;

/**
 * Teklifin yaşam döngüsü (V57).
 *
 * <p>🔴 {@link #PENDING} ile {@link #ACTIVE} ayrı olmak zorunda: teklif ödeme
 * <b>tamamlandığında</b> sıraya girer. Oturum açılırken sıraya sokmak, ödeme
 * sayfasını açıp vazgeçen herkesi listenin başına taşırdı.
 */
public enum BidStatus {
    /** Ödeme sayfası açıldı, para henüz gelmedi. Listede görünmez. */
    PENDING,
    /** Ödendi ve sırada. Kullanıcı başına <b>yalnız bir tane</b> (kısmi tekil indeks). */
    ACTIVE,
    /** Aynı kullanıcının daha yüksek bir teklifi geldi; bu satır geçmişte kaldı. */
    REPLACED,
    /** Ödeme alındı ama teklif kurulamadı — yönetim iade edebilsin diye durur. */
    FAILED
}
