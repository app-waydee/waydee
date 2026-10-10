package com.waydee.marketplace.application;

import com.waydee.common.error.ApiException;
import com.waydee.marketplace.api.dto.StoreStatsDtos.AdminVisitReport;
import com.waydee.marketplace.api.dto.StoreStatsDtos.MarketRow;
import com.waydee.marketplace.api.dto.StoreStatsDtos.StandRow;
import com.waydee.marketplace.api.dto.StoreStatsDtos.StoreStatsResponse;
import com.waydee.marketplace.api.dto.StoreStatsDtos.VisitDay;
import com.waydee.marketplace.api.dto.StoreStatsDtos.VisitRequest;
import com.waydee.marketplace.domain.ListingStatus;
import com.waydee.marketplace.domain.Marketplace;
import com.waydee.marketplace.domain.MarketplaceListing;
import com.waydee.marketplace.domain.StoreVisit;
import com.waydee.marketplace.infrastructure.MarketplaceListingRepository;
import com.waydee.marketplace.infrastructure.MarketplaceRepository;
import com.waydee.marketplace.infrastructure.StoreProductRepository;
import com.waydee.marketplace.infrastructure.StoreVisitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * <b>Mağaza istatistikleri</b> (97. tur, 24 Ağu 2026).
 *
 * <p>Kullanıcı talimatı: <i>"kaç kişinin kapıdan geçip kaç kişinin mağazada ne
 * kadar kaldığını ... stant sahibi görebilsin"</i>.
 *
 * <h2>🔴 Ölçüm ÖNCE, gösterim SONRA</h2>
 * <p>Vault'un 91. tur dersi: <i>gösterilen ama artmayan sayaç</i>. Bu yüzden bu
 * turda önce <b>yazan</b> uç ({@link #visit}) kuruldu, ekran ondan sonra geldi.
 * Ekranda görünen her sayının karşılığında {@code store_visits} tablosunda
 * gerçek bir satır var.
 *
 * <h2>Kim yazar</h2>
 * <p>Ziyareti <b>ziyaretçi</b> bildirir (3B sahnede kapıdan girip çıkarken).
 * Sahibinin kendi mağazasına girmesi <b>sayılmaz</b>: kendi dükkânını düzenleyen
 * kişi günde on kez girer ve rapor bir anda sahibinin kendi gölgesini ölçmeye
 * başlar.
 */
@Service
@RequiredArgsConstructor
public class StoreStatsService {

    /** Rapor penceresinin varsayılanı ve tavanı (gün). */
    private static final int DEFAULT_DAYS = 30;
    private static final int MAX_DAYS = 365;

    private final MarketplaceListingRepository listingRepository;
    private final MarketplaceRepository marketplaceRepository;
    private final StoreVisitRepository visitRepository;
    private final StoreProductRepository productRepository;

    // ----------------------------------------------------------------- yazma

    /**
     * Kapıdan giriş / çıkış bildirimi.
     *
     * <p>🔴 <b>Giriş satırı yazar, çıkış onu kapatır.</b> Tek bir "çıkışta yaz"
     * modeli daha az satır üretirdi ama sekmesini içeride kapatan ziyaretçi hiç
     * sayılmazdı — oysa kapıdan geçtiği doğrudur ve ürünün ilk sorusu odur.
     *
     * <p>⚠️ Açık ziyaret bulunamazsa çıkış <b>sessizce yutulur</b>. Sahne
     * yeniden yüklendiğinde ya da giriş isteği düştüğünde çıkış tek başına
     * gelebilir; bunu hataya çevirmek istemcide görünür bir uyarı üretirdi ve
     * kullanıcının yapabileceği hiçbir şey yok.
     */
    @Transactional
    public void visit(UUID listingId, UUID visitorId, VisitRequest request) {
        if (visitorId == null) {
            return;
        }
        MarketplaceListing listing = listingRepository.findWithOwnerById(listingId)
                .orElseThrow(() -> ApiException.notFound("Stant bulunamadı"));
        if (listing.getStatus() != ListingStatus.APPROVED) {
            return;
        }
        /* Sahibinin kendi dükkânı sayılmaz — gerekçe sınıf açıklamasında. */
        if (listing.getOwner().getId().equals(visitorId)) {
            return;
        }

        if (request.entering()) {
            visitRepository.save(new StoreVisit(listingId, visitorId));
            return;
        }

        int seconds = request.dwellSeconds() != null ? request.dwellSeconds() : 0;
        visitRepository.findOpenVisit(listingId, visitorId).ifPresent(v -> {
            v.closeWith(seconds);
            visitRepository.save(v);
        });
    }

    // ----------------------------------------------------------------- okuma

    /**
     * Stant sahibinin raporu.
     *
     * <p>⚠️ Yalnız <b>sahibi</b> okur. Ziyaret sayıları ve kalış süreleri
     * rakip bir stant sahibinin işine yarayacak veridir; herkese açık olsaydı
     * pazar yerindeki her dükkân komşusunun cirosunu tahmin edebilirdi.
     */
    @Transactional(readOnly = true)
    public StoreStatsResponse stats(UUID listingId, UUID userId, Integer daysParam) {
        MarketplaceListing listing = listingRepository.findWithOwnerById(listingId)
                .orElseThrow(() -> ApiException.notFound("Stant bulunamadı"));
        if (userId == null || !listing.getOwner().getId().equals(userId)) {
            throw ApiException.forbidden("Bu mağaza size ait değil");
        }

        int days = daysParam == null ? DEFAULT_DAYS : Math.max(1, Math.min(MAX_DAYS, daysParam));
        LocalDate from = LocalDate.now(ZoneOffset.UTC).minusDays(days - 1L);

        long visits = visitRepository.countVisits(listingId, from);
        long unique = visitRepository.countUniqueVisitors(listingId, from);

        long totalDwell = 0;
        long measured = 0;
        List<Object[]> totals = visitRepository.dwellTotals(listingId, from);
        if (!totals.isEmpty()) {
            Object[] row = totals.get(0);
            totalDwell = ((Number) row[0]).longValue();
            measured = ((Number) row[1]).longValue();
        }

        List<VisitDay> daily = visitRepository.daily(listingId, from).stream()
                .map(r -> new VisitDay(
                        (LocalDate) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue()))
                .toList();

        Marketplace market = marketplaceRepository.findById(listing.getMarketplaceId()).orElse(null);

        return new StoreStatsResponse(
                listingId,
                listing.getTitle(),
                market != null ? market.getSlug() : null,
                days,
                visits,
                unique,
                measured,
                totalDwell,
                /* Payda ölçülen ziyaret — gerekçe DTO'da. */
                measured == 0 ? 0 : Math.round((double) totalDwell / measured),
                listing.getLikeCount(),
                listing.getViewCount(),
                productRepository.countByListingId(listingId),
                daily);
    }

    // --------------------------------------------------------------- yönetim

    /**
     * <b>Genel ziyaret raporu</b> — bütün pazarlar (97. tur, 2. bölüm).
     *
     * <p>🔴 Bu uç <b>yalnız yönetim</b> tarafındadır. Stant sahibinin ekranı
     * ({@link #stats}) yalnız kendi dükkânını gösterir: bir stant sahibinin
     * komşusunun ziyaret sayısını görmesi, pazar yerindeki herkesin birbirinin
     * cirosunu tahmin etmesi demekti.
     *
     * <p>⚠️ Ortalamalar burada da <b>ölçülebilmiş</b> ziyaretlere bölünür —
     * sahip ekranıyla aynı kural, yoksa iki ekran aynı dükkân için farklı bir
     * "ortalama" gösterirdi.
     */
    @Transactional(readOnly = true)
    public AdminVisitReport adminReport(Integer daysParam) {
        int days = daysParam == null ? DEFAULT_DAYS : Math.max(1, Math.min(MAX_DAYS, daysParam));
        LocalDate from = LocalDate.now(ZoneOffset.UTC).minusDays(days - 1L);

        long visits = 0;
        long unique = 0;
        long totalDwell = 0;
        long measured = 0;
        List<Object[]> totals = visitRepository.adminTotals(from);
        if (!totals.isEmpty()) {
            Object[] r = totals.get(0);
            visits = num(r[0]);
            unique = num(r[1]);
            totalDwell = num(r[2]);
            measured = num(r[3]);
        }

        List<MarketRow> markets = visitRepository.adminByMarketplace(from).stream()
                .map(r -> new MarketRow((UUID) r[0], (String) r[1], (String) r[2],
                        num(r[3]), num(r[4]), avg(num(r[5]), num(r[6]))))
                .toList();

        List<StandRow> stands = visitRepository.adminByStand(from).stream()
                .map(r -> new StandRow((UUID) r[0], (String) r[1], (String) r[2], (String) r[3],
                        num(r[4]), num(r[5]), avg(num(r[6]), num(r[7]))))
                .toList();

        List<VisitDay> daily = visitRepository.adminDaily(from).stream()
                .map(r -> new VisitDay((LocalDate) r[0], num(r[1]), num(r[2])))
                .toList();

        return new AdminVisitReport(days, visits, unique, measured, totalDwell,
                avg(totalDwell, measured), markets, stands, daily);
    }

    /** ⚠️ Toplam sorguları JPA'da `null` dönebilir (hiç satır yoksa). */
    private static long num(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }

    /** Ortalama — payda ÖLÇÜLEBİLMİŞ ziyaret; gerekçe {@link #stats}. */
    private static long avg(long total, long measured) {
        return measured == 0 ? 0 : Math.round((double) total / measured);
    }
}
