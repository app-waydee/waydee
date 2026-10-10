package com.waydee.marketplace.infrastructure;

import com.waydee.marketplace.domain.StoreVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Mağaza ziyaretleri (V55).
 *
 * <p>🔴 Rapor <b>toplu sorgularla</b> okunur, satırlar belleğe çekilip
 * Java'da toplanmaz: bir stant aylar içinde on binlerce satır biriktirir ve
 * "istatistikler" düğmesi o zaman sunucuyu düşüren düğme olurdu.
 */
public interface StoreVisitRepository extends JpaRepository<StoreVisit, UUID> {

    /**
     * Ziyaretçinin bu stanttaki <b>en son açık ziyareti</b> — çıkış onu kapatır.
     *
     * <p>⚠️ "Açık" ölçütü {@code dwellSeconds = 0}: girişte 0 yazılır, çıkışta
     * gerçek süre. Sekmesi kapanan ziyaretin satırı 0'da kalır ve bir daha
     * kapatılmaz — bu kabul edilmiş bir kayıptır, kapı geçişi yine doğrudur.
     */
    @Query("""
            select v from StoreVisit v
            where v.listingId = :listingId and v.visitorId = :visitorId and v.dwellSeconds = 0
            order by v.enteredAt desc
            limit 1
            """)
    Optional<StoreVisit> findOpenVisit(@Param("listingId") UUID listingId,
                                       @Param("visitorId") UUID visitorId);

    /** Kapıdan geçiş sayısı — aynı kişinin ikinci girişi ikinci geçiştir. */
    @Query("select count(v) from StoreVisit v where v.listingId = :listingId and v.visitDay >= :from")
    long countVisits(@Param("listingId") UUID listingId, @Param("from") LocalDate from);

    /** Tekil ziyaretçi — "kaç kişi" sorusunun cevabı; geçiş sayısından farklıdır. */
    @Query("""
            select count(distinct v.visitorId) from StoreVisit v
            where v.listingId = :listingId and v.visitDay >= :from and v.visitorId is not null
            """)
    long countUniqueVisitors(@Param("listingId") UUID listingId, @Param("from") LocalDate from);

    /**
     * Süre toplamı ve süresi ölçülebilmiş ziyaret sayısı.
     *
     * <p>🔴 Ortalama <b>burada hesaplanmaz</b> ve payda <b>tüm ziyaretler
     * değildir</b>: süresi 0 kalan (sekmesi kapanan) ziyaretler ortalamaya
     * girseydi "ortalama kalış" sistematik olarak yalan söylerdi. Payda
     * yalnız <b>kapanmış</b> ziyaretlerdir ve istemciye ikisi de gönderilir.
     */
    @Query("""
            select coalesce(sum(v.dwellSeconds), 0), count(v) from StoreVisit v
            where v.listingId = :listingId and v.visitDay >= :from and v.dwellSeconds > 0
            """)
    List<Object[]> dwellTotals(@Param("listingId") UUID listingId, @Param("from") LocalDate from);

    /** Gün bazında geçiş sayısı ve süre toplamı — grafiğin kaynağı. */
    @Query("""
            select v.visitDay, count(v), coalesce(sum(v.dwellSeconds), 0)
            from StoreVisit v
            where v.listingId = :listingId and v.visitDay >= :from
            group by v.visitDay
            order by v.visitDay
            """)
    List<Object[]> daily(@Param("listingId") UUID listingId, @Param("from") LocalDate from);

    // ------------------------------------------------- yönetim raporu (admin)

    /*
     * 🔴 97. tur, 2. bölüm — GENEL rapor yönetim tarafında.
     *
     * Kullanıcı talimatı: *"istatistikler o standın sahibinin mağazasının
     * istatistiği olacak; genel istatistikler admin tarafında pazar yeri
     * kısmında"*. Bu yüzden aşağıdaki sorgular stant sahibine ASLA açılmaz —
     * hepsi `/api/v1/admin/**` altından okunur.
     *
     * ⚠️ `StoreVisit`in `listingId`i bir ilişki değil, düz bir kimliktir
     * (tabloyu hafif tutmak için). Pazar yerine göre gruplamak bu yüzden
     * VARLIK BİRLEŞTİRME (`join MarketplaceListing l on l.id = v.listingId`)
     * ile yapılır — alternatifi her satır için ayrı sorgu olurdu.
     */

    /** Tüm pazarlar toplamı: geçiş · tekil ziyaretçi · süre · ölçülen ziyaret. */
    @Query("""
            select count(v), count(distinct v.visitorId), coalesce(sum(v.dwellSeconds), 0),
                   sum(case when v.dwellSeconds > 0 then 1 else 0 end)
            from StoreVisit v
            where v.visitDay >= :from
            """)
    List<Object[]> adminTotals(@Param("from") LocalDate from);

    /** Pazar yeri kırılımı. */
    @Query("""
            select m.id, m.name, m.slug, count(v), count(distinct v.visitorId),
                   coalesce(sum(v.dwellSeconds), 0),
                   sum(case when v.dwellSeconds > 0 then 1 else 0 end)
            from StoreVisit v
              join MarketplaceListing l on l.id = v.listingId
              join Marketplace m on m.id = l.marketplaceId
            where v.visitDay >= :from
            group by m.id, m.name, m.slug
            order by count(v) desc
            """)
    List<Object[]> adminByMarketplace(@Param("from") LocalDate from);

    /** Stant kırılımı — en çok uğranan dükkânlar. */
    @Query("""
            select l.id, l.title, l.owner.username, m.name, count(v), count(distinct v.visitorId),
                   coalesce(sum(v.dwellSeconds), 0),
                   sum(case when v.dwellSeconds > 0 then 1 else 0 end)
            from StoreVisit v
              join MarketplaceListing l on l.id = v.listingId
              join Marketplace m on m.id = l.marketplaceId
            where v.visitDay >= :from
            group by l.id, l.title, l.owner.username, m.name
            order by count(v) desc
            limit 20
            """)
    List<Object[]> adminByStand(@Param("from") LocalDate from);

    /** Gün bazında toplam — yönetim grafiğinin kaynağı. */
    @Query("""
            select v.visitDay, count(v), coalesce(sum(v.dwellSeconds), 0)
            from StoreVisit v
            where v.visitDay >= :from
            group by v.visitDay
            order by v.visitDay
            """)
    List<Object[]> adminDaily(@Param("from") LocalDate from);
}
