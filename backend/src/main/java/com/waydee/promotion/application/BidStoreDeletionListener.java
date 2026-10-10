package com.waydee.promotion.application;

import com.waydee.territory.application.event.OwnStoreDeletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * <b>Mağaza silindi → teklifi listeden düşer</b> (98. tur).
 *
 * <p>🔴 Listeleme sorgusu zaten mağazasız teklifi göstermiyor; yine de satır
 * <b>açıkça</b> düşürülüyor. Sebep: "aktif teklif" sayısı, kullanıcının kendi
 * sırası ve tekil indeks bu duruma bakıyor. Yalnız sorguya güvenmek,
 * kullanıcıya listede olmadığı hâlde "1. sıradasın" dedirtirdi.
 *
 * <p>⚠️ Satır <b>silinmez</b>: para ödenmiştir, muhasebe kaydı ve faturası
 * durur.
 *
 * <p>⚠️ {@code AFTER_COMMIT}: silme gerçekten yazılmadan teklif düşürülmez.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BidStoreDeletionListener {

    private final StoreBidService bidService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOwnStoreDeleted(OwnStoreDeletedEvent event) {
        try {
            bidService.onStoreDeleted(event.territoryId());
        } catch (RuntimeException e) {
            log.error("Mağaza silindikten sonra teklifler düşürülemedi ({})", event.territoryId(), e);
        }
    }
}
