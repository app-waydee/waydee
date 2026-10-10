package com.waydee.outreach.domain;

/**
 * Bir gönderim turunun durumu (V60).
 *
 * <p>⚠️ {@code SENT} "hepsi ulaştı" demek <b>değildir</b>; "koşu bitti"
 * demektir. Teslim edilip edilmediği alıcı satırlarında tutulur — SMTP'nin
 * kabul etmesi ile posta kutusuna düşmesi aynı şey değildir ve bunu tek bir
 * kampanya durumuyla anlatmak yanlış bir güven verirdi.
 */
public enum CampaignStatus {
    /** Koşuyor. Sunucu yeniden başlarsa burada takılı kalır (bkz. süpürme notu). */
    SENDING,
    /** Koşu bitti — en az bir ileti gönderildi. */
    SENT,
    /** Koşu bitti ve <b>hiçbiri</b> gönderilemedi (SMTP kapalı ya da arızalı). */
    FAILED,
    /** Yönetici durdurdu; kuyrukta kalan satırlar gönderilmedi. */
    CANCELLED
}
