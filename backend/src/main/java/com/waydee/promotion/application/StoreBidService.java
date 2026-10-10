package com.waydee.promotion.application;

import com.waydee.common.error.ApiException;
import com.waydee.identity.domain.User;
import com.waydee.promotion.api.dto.StoreBidDtos.BoardResponse;
import com.waydee.promotion.api.dto.StoreBidDtos.HistoryRow;
import com.waydee.promotion.api.dto.StoreBidDtos.BoardRow;
import com.waydee.promotion.api.dto.StoreBidDtos.MoveRow;
import com.waydee.promotion.api.dto.StoreBidDtos.MyBid;
import com.waydee.promotion.domain.BidStatus;
import com.waydee.promotion.domain.StoreBid;
import com.waydee.promotion.infrastructure.StoreBidRepository;
import com.waydee.territory.domain.Territory;
import com.waydee.territory.domain.TerritoryStatus;
import com.waydee.territory.infrastructure.TerritoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * <b>Mağazanı öne taşı</b> — ödemeli sıralama (98. tur, 25 Ağu 2026).
 *
 * <p>Model {@code bidkick.me}: tek liste, <b>en çok ödeyen üstte</b>, süre yok,
 * biri geçene kadar sırada kalırsın.
 *
 * <h2>🔴 Üç kural ve gerekçeleri</h2>
 * <ol>
 *   <li><b>Teklif ödeme tamamlanınca sıraya girer</b>, oturum açılırken değil.
 *       Aksi hâlde ödeme sayfasını açıp vazgeçen herkes listenin başına
 *       geçerdi.</li>
 *   <li><b>Teklifler toplanmaz</b> (bidkick kuralı) <b>ama geriye de gitmez</b>:
 *       geçerli teklif kullanıcının ödediği <b>en yüksek</b> tutardır. Harfiyen
 *       "son ödenen" deseydik, büyük ödeme yapmış birinin küçük ikinci ödemesi
 *       onu dibe düşürürdü.</li>
 *   <li><b>Sıralama tek cümledir</b>: {@code amount DESC, activatedAt ASC}.
 *       Eşitlikte önce ödeyen üstte — ikinci anahtar olmadan eşit teklifler her
 *       sorguda yer değiştirir ve kullanıcı "zıplıyorum" der.</li>
 * </ol>
 *
 * <h2>⚠️ Mağazası olmayan teklif veremez</h2>
 * <p>Öne çıkarılan şey <b>mağazadır</b>; mağazası olmayan kullanıcının ödemesi
 * karşılığında listede gösterilecek bir şey olmazdı. Kapı sunucudadır.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StoreBidService {

    /**
     * Alt ve üst sınır.
     *
     * <p>🔴 Fiyat listesi <b>yoktur</b> — bu ürünün fiyatı, listede olmak
     * isteyenin ödemeye razı olduğu tutardır (bidkick: min $5, max $999.999).
     * Sınırlar yine de gerekli: sıfır/negatif tutar sağlayıcıda patlar, üst
     * sınırsız tutar ise yazım hatasıyla ("50000" yerine "500000") gelen bir
     * ödemeyi mümkün kılardı.
     */
    public static final BigDecimal MIN_BID = new BigDecimal("5");
    public static final BigDecimal MAX_BID = new BigDecimal("999999");

    /** Tahtada kaç satır gösterilir (bidkick ilk 10). */
    private static final int BOARD_SIZE = 10;
    /** Son hareketler kaç satır. */
    private static final int MOVES_SIZE = 6;

    private final StoreBidRepository bidRepository;
    private final TerritoryRepository territoryRepository;

    // ------------------------------------------------------------ yazma

    /**
     * Ödeme oturumu açılırken teklif satırı <b>PENDING</b> olarak yazılır.
     *
     * <p>⚠️ Satır ödemeden ÖNCE yazılır çünkü webhook geldiğinde geriye
     * dönecek bir kayıt gerekir: sağlayıcı bize yalnız oturum kimliğini
     * gönderir, "kim ne kadar teklif etmişti" bilgisi burada durur.
     */
    @Transactional
    public StoreBid createPending(UUID userId, UUID territoryId, BigDecimal amount,
                                  String currency, UUID checkoutId) {
        return bidRepository.save(new StoreBid(userId, territoryId, amount, currency, checkoutId));
    }

    /**
     * Teklif tutarını doğrular ve kullanıcının mağazasını döndürür.
     *
     * <p>🔴 Doğrulama <b>ödeme oturumu açılmadan önce</b> yapılır: geçersiz
     * tutarla açılmış bir ödeme sayfası, kullanıcının parasını alıp karşılığını
     * veremediğimiz durumu üretirdi.
     */
    @Transactional(readOnly = true)
    public Territory requireStoreFor(UUID userId, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw ApiException.badRequest("Teklif tutarı sıfırdan büyük olmalı");
        }
        BigDecimal normalized = amount.setScale(2, java.math.RoundingMode.HALF_UP);
        if (normalized.compareTo(MIN_BID) < 0) {
            throw ApiException.badRequest("En düşük teklif " + MIN_BID.toPlainString());
        }
        if (normalized.compareTo(MAX_BID) > 0) {
            throw ApiException.badRequest("En yüksek teklif " + MAX_BID.toPlainString());
        }
        return activeStoreOf(userId)
                .orElseThrow(() -> ApiException.badRequest(
                        "Önce haritada mağazanı açmalısın — öne çıkarılacak bir mağaza yok"));
    }

    /**
     * <b>Ödeme geldi</b> — teklif sıraya girer.
     *
     * <p>🔴 <b>İdempotent</b>: aynı webhook iki kez gelirse ikinci çağrı
     * hiçbir şey yapmaz (satır zaten ACTIVE). Sağlayıcılar aynı olayı tekrar
     * gönderir; korunmasız bırakmak aynı kullanıcıya iki aktif teklif
     * yazdırırdı (veritabanındaki kısmi tekil indeks de bunu reddeder).
     *
     * <p>🔴 <b>Daha düşük ödeme kullanıcıyı geriye düşürmez</b>: mevcut aktif
     * teklif daha yüksekse yeni satır doğrudan {@code REPLACED} yazılır ve
     * sıra korunur. Para yine alınmıştır ve faturası kesilir — bu bilinçli:
     * bidkick'te de *"All bids are final"*.
     */
    @Transactional
    public Optional<StoreBid> activate(UUID checkoutId) {
        Optional<StoreBid> found = bidRepository.findByCheckoutId(checkoutId);
        if (found.isEmpty()) {
            log.warn("Teklif satırı bulunamadı, ödeme yok sayıldı (checkout={})", checkoutId);
            return Optional.empty();
        }
        StoreBid bid = found.get();
        if (bid.getStatus() == BidStatus.ACTIVE || bid.getStatus() == BidStatus.REPLACED) {
            /* Tekrar eden webhook — ilk çağrı işi bitirmiş. */
            return Optional.of(bid);
        }

        Optional<StoreBid> current = bidRepository.findByUserIdAndStatus(bid.getUserId(), BidStatus.ACTIVE);
        if (current.isPresent() && current.get().getAmount().compareTo(bid.getAmount()) >= 0) {
            /* Yeni ödeme eskisinden düşük: sıra korunur, satır geçmişe yazılır. */
            bid.replace();
            bidRepository.save(bid);
            return Optional.of(bid);
        }

        /* ⚠️ Eski aktif teklif ÖNCE düşürülür ve flush edilir: kısmi tekil
           indeks aynı kullanıcıda iki ACTIVE satıra izin vermez ve sıra
           bozulursa ikinci INSERT patlardı. */
        current.ifPresent(old -> {
            old.replace();
            bidRepository.saveAndFlush(old);
        });

        bid.activate();
        return Optional.of(bidRepository.save(bid));
    }

    /** Ödeme alındı ama teklif kurulamadı — yönetim iade edebilsin diye işaretlenir. */
    @Transactional
    public void markFailed(UUID checkoutId, String reason) {
        bidRepository.findByCheckoutId(checkoutId).ifPresent(bid -> {
            bid.fail();
            bidRepository.save(bid);
            log.error("Teklif kurulamadı (checkout={}): {}", checkoutId, reason);
        });
    }

    @Transactional
    public void attachInvoice(UUID bidId, UUID invoiceId) {
        bidRepository.findById(bidId).ifPresent(bid -> {
            bid.attachInvoice(invoiceId);
            bidRepository.save(bid);
        });
    }

    /**
     * Mağaza silindi — teklifler listeden düşer.
     *
     * <p>⚠️ Satır <b>silinmez</b>, yalnız mağaza bağı kopar ve aktif teklif
     * geçmişe alınır: para ödenmiştir, muhasebe kaydı yok edilemez.
     */
    /*
     * 🔴🔴 REQUIRES_NEW — `AFTER_COMMIT` dinleyicisinden çağrılıyor.
     * Varsayılan `REQUIRED` tamamlanmış transaction'a katılır ve ilk yazma
     * "no transaction is in progress" ile patlar (25 Ağu 2026'da uçtan uca
     * testte ölçüldü; aynı ders `WelcomeCreditGranter`da da alınmıştı).
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void onStoreDeleted(UUID territoryId) {
        for (StoreBid bid : bidRepository.findByTerritoryId(territoryId)) {
            if (bid.getStatus() == BidStatus.ACTIVE) {
                bid.replace();
            }
            bid.detachTerritory();
            bidRepository.save(bid);
        }
    }

    // ------------------------------------------------------------ okuma

    /** Tahtanın tamamı — tek istekte sıralama, kendi durumum ve istatistik. */
    @Transactional(readOnly = true)
    public BoardResponse board(UUID viewerId, String currency) {
        List<BoardRow> rows = new ArrayList<>();
        int rank = 1;
        for (Object[] r : bidRepository.leaderboard(PageRequest.of(0, BOARD_SIZE))) {
            StoreBid bid = (StoreBid) r[0];
            Territory t = (Territory) r[1];
            User owner = (User) r[2];
            rows.add(new BoardRow(
                    rank++,
                    bid.getId(),
                    t.getId(),
                    t.getName(),
                    owner.getUsername(),
                    owner.getDisplayName(),
                    com.waydee.common.storage.MediaUrls.of(owner.getAvatarMediaId()),
                    t.getStrokeColor(),
                    t.getCenter() != null ? t.getCenter().getX() : null,
                    t.getCenter() != null ? t.getCenter().getY() : null,
                    bid.getAmount(),
                    bid.getCurrency(),
                    bid.getActivatedAt(),
                    viewerId != null && viewerId.equals(bid.getUserId())));
        }

        List<MoveRow> moves = bidRepository.latestMoves(PageRequest.of(0, MOVES_SIZE)).stream()
                .map(r -> {
                    StoreBid bid = (StoreBid) r[0];
                    Territory t = (Territory) r[1];
                    return new MoveRow(t.getName(), t.getOwner().getUsername(),
                            bid.getAmount(), bid.getCurrency(), bid.getActivatedAt());
                })
                .toList();

        BigDecimal allTimeHighest = BigDecimal.ZERO;
        BigDecimal allTimeTotal = BigDecimal.ZERO;
        List<Object[]> stats = bidRepository.allTime();
        if (!stats.isEmpty()) {
            allTimeHighest = (BigDecimal) stats.get(0)[0];
            allTimeTotal = (BigDecimal) stats.get(0)[1];
        }

        return new BoardResponse(rows, myBid(viewerId, currency), moves,
                allTimeHighest, allTimeTotal, bidRepository.countActive(), currency);
    }

    /**
     * Kullanıcının kendi durumu.
     *
     * <p>⚠️ "Lidere geçmek için ne kadar" <b>sunucuda</b> hesaplanır: istemcide
     * hesaplanan bir tutar, iki ekranın iki farklı sayı göstermesiyle biterdi
     * ve para söz konusuyken bu kabul edilemez.
     */
    @Transactional(readOnly = true)
    public MyBid myBid(UUID userId, String currency) {
        BigDecimal highest = bidRepository.highestActive();
        /* Lidere geçmek için: en yüksek teklifin 1 birim üstü — ama hiçbir
           zaman alt sınırın altına düşmez (liste boşken "1" istemek saçmadır). */
        BigDecimal toLead = highest.add(BigDecimal.ONE).max(MIN_BID);

        if (userId == null) {
            return new MyBid(null, null, currency, null, false, toLead, MIN_BID, MAX_BID);
        }
        boolean hasStore = activeStoreOf(userId).isPresent();
        Optional<StoreBid> mine = bidRepository.findByUserIdAndStatus(userId, BidStatus.ACTIVE);
        if (mine.isEmpty()) {
            return new MyBid(null, null, currency, null, hasStore, toLead, MIN_BID, MAX_BID);
        }
        StoreBid bid = mine.get();
        int rank = (int) bidRepository.countAbove(bid.getAmount(), bid.getActivatedAt()) + 1;
        return new MyBid(bid.getId(), bid.getAmount(), bid.getCurrency(), rank, hasStore,
                toLead, MIN_BID, MAX_BID);
    }

    /**
     * <b>Teklif geçmişim</b> — "faturalarım" ekranındaki küçük alan.
     *
     * <p>⚠️ Ödenmemiş ({@code PENDING}) satırlar da döner: kullanıcı ödeme
     * sayfasını açıp yarıda bıraktıysa bunu görmeli — listede hiç görünmemesi
     * "param gitti mi?" sorusunu doğururdu.
     *
     * <p>⚠️ Mağaza adı teklifin <b>o anki</b> mağazasından okunur; mağaza
     * silinmişse boş kalır ve satır yine görünür (para ödenmiştir).
     */
    @Transactional(readOnly = true)
    public List<HistoryRow> history(UUID userId) {
        return bidRepository.findByUserIdOrderByPlacedAtDesc(userId).stream()
                .map(b -> new HistoryRow(
                        b.getId(), b.getAmount(), b.getCurrency(), b.getStatus().name(),
                        b.getTerritoryId() == null ? null
                                : territoryRepository.findById(b.getTerritoryId())
                                        .map(com.waydee.territory.domain.Territory::getName).orElse(null),
                        b.getPlacedAt(), b.getActivatedAt(), b.getInvoiceId()))
                .toList();
    }

    /**
     * Kullanıcının haritadaki <b>yürürlükteki</b> mağazası.
     *
     * <p>⚠️ Pasif/silinmiş bölge elenir: kapanmış bir mağazayı öne çıkarmak
     * için para almak, karşılığı olmayan bir satış olurdu.
     */
    private Optional<Territory> activeStoreOf(UUID userId) {
        return territoryRepository.findByOwnerIdOrderByPurchasedAtDesc(userId).stream()
                .filter(t -> t.getStatus() == TerritoryStatus.ACTIVE)
                .findFirst();
    }
}
