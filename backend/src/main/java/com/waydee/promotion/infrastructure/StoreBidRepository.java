package com.waydee.promotion.infrastructure;

import com.waydee.promotion.domain.BidStatus;
import com.waydee.promotion.domain.StoreBid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Teklif sorguları (V57).
 *
 * <p>🔴 Sıralama <b>tek yerde</b>: {@code amount DESC, activatedAt ASC}. Bu
 * cümle üç ekranda birden kullanılıyor (harita tahtası, ana sayfa kartı, kendi
 * sıram) ve her birinde ayrı yazılsaydı biri güncellenip diğerleri unutulurdu
 * — vault'un tekrar eden hatası.
 */
public interface StoreBidRepository extends JpaRepository<StoreBid, UUID> {

    /** Kullanıcının sıradaki teklifi (varsa). */
    Optional<StoreBid> findByUserIdAndStatus(UUID userId, BidStatus status);

    Optional<StoreBid> findByCheckoutId(UUID checkoutId);

    /**
     * <b>Sıralama</b> — mağazasıyla birlikte.
     *
     * <p>⚠️ {@code join Territory t} <b>iç birleştirmedir</b>: mağazası
     * silinmiş bir teklif listede görünmez. Dış birleştirme yapsaydık listede
     * adsız, tıklanamaz bir satır kalırdı.
     *
     * <p>⚠️ Gizli ve pasif mağazalar elenir — haritada görünmeyen bir mağazayı
     * listenin başında göstermek, tıklayınca hiçbir yere gitmeyen bir satır
     * demekti.
     */
    @Query("""
            select b, t, t.owner from StoreBid b
              join com.waydee.territory.domain.Territory t on t.id = b.territoryId
            where b.status = com.waydee.promotion.domain.BidStatus.ACTIVE
              and t.status = com.waydee.territory.domain.TerritoryStatus.ACTIVE
              and t.hidden = false
            order by b.amount desc, b.activatedAt asc
            """)
    List<Object[]> leaderboard(Pageable pageable);

    /**
     * Kullanıcının sırası — kaç aktif teklif ondan yukarıda?
     *
     * <p>⚠️ Sıra <b>sayılarak</b> bulunur, listeyi çekip index aranmaz:
     * liste binlerce satıra çıktığında "sıram kaç" sorusu tüm tabloyu
     * belleğe indirirdi.
     */
    @Query("""
            select count(b) from StoreBid b
            where b.status = com.waydee.promotion.domain.BidStatus.ACTIVE
              and (b.amount > :amount or (b.amount = :amount and b.activatedAt < :activatedAt))
            """)
    long countAbove(@Param("amount") BigDecimal amount,
                    @Param("activatedAt") java.time.Instant activatedAt);

    @Query("select count(b) from StoreBid b where b.status = com.waydee.promotion.domain.BidStatus.ACTIVE")
    long countActive();

    /** En yüksek aktif teklif — "listeye girmek için ne gerekir" cümlesinin kaynağı. */
    @Query("select coalesce(max(b.amount), 0) from StoreBid b where b.status = com.waydee.promotion.domain.BidStatus.ACTIVE")
    BigDecimal highestActive();

    /** Tüm zamanların en yüksek ödemesi ve toplam hasılat (bidkick "ALL-TIME"). */
    @Query("""
            select coalesce(max(b.amount), 0), coalesce(sum(b.amount), 0), count(b) from StoreBid b
            where b.status in (com.waydee.promotion.domain.BidStatus.ACTIVE,
                               com.waydee.promotion.domain.BidStatus.REPLACED)
            """)
    List<Object[]> allTime();

    /** Son hareketler (bidkick "LATEST MOVES") — yalnız ödenmiş teklifler. */
    @Query("""
            select b, t from StoreBid b
              join com.waydee.territory.domain.Territory t on t.id = b.territoryId
            where b.status in (com.waydee.promotion.domain.BidStatus.ACTIVE,
                               com.waydee.promotion.domain.BidStatus.REPLACED)
              and b.activatedAt is not null
            order by b.activatedAt desc
            """)
    List<Object[]> latestMoves(Pageable pageable);

    /** Kullanıcının ödeme geçmişi — "tekliflerim" listesi. */
    List<StoreBid> findByUserIdOrderByPlacedAtDesc(UUID userId);

    /** Mağaza silindiğinde teklifleri bulmak için. */
    List<StoreBid> findByTerritoryId(UUID territoryId);
}
