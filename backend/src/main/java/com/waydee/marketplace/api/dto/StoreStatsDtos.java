package com.waydee.marketplace.api.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * <b>Stant istatistikleri</b> — mağaza sahibinin gördüğü sayılar (97. tur).
 *
 * <p>🔴 Burada <b>hesaplanmış tek bir "ortalama"</b> yoktur; her sayı yanında
 * <b>paydasıyla</b> gider. 91. turun dersi: gösterilen ama nereden geldiği
 * bilinmeyen bir sayı, kullanıcının güvenini bir kez kaybettirir.
 */
public final class StoreStatsDtos {

    private StoreStatsDtos() {
    }

    /** Ziyaret bildirimi — sahnedeki giriş/çıkış. */
    public record VisitRequest(
            /**
             * {@code true} kapıdan giriş, {@code false} çıkış.
             * <p>⚠️ Tek uç, iki olay: iki ayrı uç olsaydı çıkış isteği girişten
             * önce ulaştığında sunucu hangi satırı kapatacağını bilemezdi.
             */
            boolean entering,
            /** Çıkışta içeride geçirilen saniye; girişte yok sayılır. */
            Integer dwellSeconds
    ) {
    }

    /** Grafiğin tek günü. */
    public record VisitDay(
            LocalDate day,
            /** O gün kapıdan kaç geçiş oldu. */
            long visits,
            /** O günün toplam kalış süresi (saniye). */
            long dwellSeconds
    ) {
    }

    /**
     * Stant istatistikleri.
     *
     * <p>⚠️ {@code avgDwellSeconds} paydası {@code measuredVisits}'tir,
     * {@code visits} DEĞİL: sekmesini kapatan ziyaretçinin süresi hiç
     * ölçülemez ve onu 0 sayarak ortalamaya katmak, ortalamayı sistematik
     * olarak aşağı çeker.
     */
    public record StoreStatsResponse(
            UUID listingId,
            String title,
            String marketplaceSlug,
            /** Rapor penceresi (gün). */
            int days,
            /** Kapıdan geçiş — aynı kişinin ikinci girişi ikinci geçiştir. */
            long visits,
            /** Tekil ziyaretçi — "kaç kişi" sorusunun cevabı. */
            long uniqueVisitors,
            /** Süresi ölçülebilmiş ziyaret sayısı (ortalamanın paydası). */
            long measuredVisits,
            /** Toplam kalış süresi (saniye). */
            long totalDwellSeconds,
            /** Ortalama kalış (saniye) — ölçülen ziyaret yoksa 0. */
            long avgDwellSeconds,
            /** Stant beğenisi — 3B mağazadaki ve karttaki kalp. */
            int likeCount,
            /** Stant kartının görüntülenme sayısı (mevcut sayaç). */
            int viewCount,
            /** Raftaki ürün sayısı — "vitrinim dolu mu" sorusu. */
            int shelfSize,
            List<VisitDay> daily
    ) {
    }

    // ---------------------------------------------------------------- yönetim

    /**
     * 🔴 <b>GENEL rapor yönetim tarafındadır</b> (97. tur, 2. bölüm).
     *
     * <p>Kullanıcı talimatı: <i>"istatistikler o standın sahibinin mağazasının
     * istatistiği olacak; genel istatistikler admin tarafında pazar yeri
     * kısmında"</i>. Stant sahibi <b>yalnız kendi</b> dükkânını görür
     * ({@link StoreStatsResponse}); pazarın tamamı buradadır ve bu kayıtlar
     * {@code /api/v1/admin/**} altından okunur.
     */
    public record MarketRow(
            UUID marketplaceId, String name, String slug,
            long visits, long uniqueVisitors, long avgDwellSeconds
    ) {
    }

    /** Tek bir stant satırı — en çok uğranan dükkânlar. */
    public record StandRow(
            UUID listingId, String title, String ownerUsername, String marketplaceName,
            long visits, long uniqueVisitors, long avgDwellSeconds
    ) {
    }

    /** Yönetim raporu — bütün pazarların ziyaret özeti. */
    public record AdminVisitReport(
            int days,
            long visits,
            long uniqueVisitors,
            long measuredVisits,
            long totalDwellSeconds,
            long avgDwellSeconds,
            List<MarketRow> marketplaces,
            List<StandRow> topStands,
            List<VisitDay> daily
    ) {
    }
}
