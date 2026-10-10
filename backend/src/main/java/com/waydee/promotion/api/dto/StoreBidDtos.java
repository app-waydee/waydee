package com.waydee.promotion.api.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * <b>Mağazanı öne taşı</b> uçlarının sözleşmesi (98. tur).
 *
 * <p>Model bidkick.me'den alındı: tek bir liste, en çok ödeyen üstte, süre yok.
 */
public final class StoreBidDtos {

    private StoreBidDtos() {
    }

    /**
     * Teklif isteği — <b>tutarı kullanıcı yazar</b>.
     *
     * <p>🔴 Fiyat listesi YOK: bu ürünün fiyatı, o an listede olmak isteyen
     * kişinin ödemeye razı olduğu tutardır. Sunucu yalnız alt ve üst sınırı
     * uygular ({@code MIN_BID} / {@code MAX_BID}) — sınırsız bırakmak,
     * sağlayıcının reddedeceği tutarlarla ödeme oturumu açardı.
     */
    public record BidRequest(@NotNull BigDecimal amount) {
    }

    /** Sıradaki tek bir mağaza. */
    public record BoardRow(
            int rank,
            UUID bidId,
            UUID territoryId,
            String storeName,
            String ownerUsername,
            String ownerDisplayName,
            String avatarUrl,
            /** Mağazanın haritadaki rengi — satırın rozeti onunla boyanır. */
            String color,
            Double lng,
            Double lat,
            BigDecimal amount,
            String currency,
            Instant since,
            /** Bu satır isteği yapan kullanıcının mı — arayüz "sen" rozetini buna göre çizer. */
            boolean mine
    ) {
    }

    /** Son hareket (bidkick "LATEST MOVES"). */
    public record MoveRow(
            String storeName,
            String ownerUsername,
            BigDecimal amount,
            String currency,
            Instant at
    ) {
    }

    /**
     * Kullanıcının kendi durumu.
     *
     * <p>⚠️ {@code amountToLead} <b>sunucuda</b> hesaplanır: "lidere geçmek için
     * ne kadar" sorusunu istemcide hesaplamak, iki ekranın iki farklı sayı
     * göstermesiyle biterdi (para söz konusu olduğunda kabul edilemez).
     */
    public record MyBid(
            UUID bidId,
            BigDecimal amount,
            String currency,
            Integer rank,
            boolean hasStore,
            /** Listenin başına geçmek için gereken en küçük tutar. */
            BigDecimal amountToLead,
            /** Listeye girmek için gereken en küçük tutar (alt sınır ya da liderin üstü). */
            BigDecimal minBid,
            BigDecimal maxBid
    ) {
    }

    /**
     * <b>Teklif geçmişinin tek satırı</b> — "faturalarım"daki küçük alan.
     *
     * <p>⚠️ Durum <b>koddur</b> (ACTIVE | REPLACED | PENDING | FAILED),
     * çevrilmiş metin değil: çok dilli arayüzde sunucudan gelen etiket
     * basılmaz (vault kuralı).
     */
    public record HistoryRow(
            UUID bidId,
            BigDecimal amount,
            String currency,
            String status,
            String storeName,
            Instant placedAt,
            Instant activatedAt,
            /** Faturası kesildi mi — kesildiyse kullanıcı listede karşılığını görür. */
            UUID invoiceId
    ) {
    }

    /** Tahtanın tamamı — tek istekte: sıralama · benim durumum · istatistik. */
    public record BoardResponse(
            List<BoardRow> rows,
            MyBid me,
            List<MoveRow> latestMoves,
            /** Tüm zamanların en yüksek teklifi. */
            BigDecimal allTimeHighest,
            /** Tüm zamanların toplamı. */
            BigDecimal allTimeTotal,
            long activeCount,
            String currency
    ) {
    }
}
