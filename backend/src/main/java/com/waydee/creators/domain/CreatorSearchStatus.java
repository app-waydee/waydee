package com.waydee.creators.domain;

/** Aramanın yaşam döngüsü (108. tur). */
public enum CreatorSearchStatus {
    /** Kredi düşüldü, koşucu sırada. */
    QUEUED,
    /** Boru hattı koşuyor — adımlar {@code steps_json}'da canlı güncellenir. */
    RUNNING,
    SUCCEEDED,
    /** Başarısız — kredi iade edildi ({@code refund-creator:<id>}). */
    FAILED;

    public boolean isOpen() {
        return this == QUEUED || this == RUNNING;
    }
}
