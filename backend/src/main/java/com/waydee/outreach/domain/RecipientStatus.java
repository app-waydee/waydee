package com.waydee.outreach.domain;

/** Kampanyadaki tek bir alıcının durumu (V60). */
public enum RecipientStatus {
    /** Sıraya alındı, henüz gönderilmedi. */
    QUEUED,
    /** SMTP sunucusu iletiyi <b>kabul etti</b>. ⚠️ "Posta kutusuna düştü" demek değildir. */
    SENT,
    /** Gönderilemedi; gerekçe {@code error} alanında. */
    FAILED,
    /** Bastırma listesinde olduğu için hiç denenmedi. */
    SKIPPED
}
