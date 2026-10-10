package com.waydee.marketplace.application;

import com.waydee.territory.application.event.OwnStoreDeletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * <b>Mağaza silindi → pazardaki stant da kalkar</b> (25 Ağu 2026).
 *
 * <p>Kullanıcı: *"mağazayı sil kısmında eksik işlemler yaptık; mağazası
 * pazardaysa o anlık orada da silinsin"*.
 *
 * <p>🔴 {@code AFTER_COMMIT}: stant, mağazanın silinmesi <b>gerçekten
 * yazıldıktan sonra</b> geri çekilir. Erken çalışsaydı, silme işlemi bir
 * sonraki adımda geri alındığında (rollback) kullanıcı mağazasını hâlâ
 * görürken pazardaki dükkânı çoktan kapanmış olurdu.
 *
 * <p>⚠️ Dinleyici <b>pazar modülünde</b> durur, bölge modülünde değil: "mağaza
 * silinince stanta ne olur" sorusunun cevabı pazarın kuralıdır. Ters kurulum,
 * bölge modülünü stant tablosuna bağımlı yapardı.
 *
 * <p>⚠️ Hata <b>yutulur ve loglanır</b>: bu iş kullanıcının silme isteğinin
 * ardından koşan bir temizliktir; burada fırlatılan bir istisna kullanıcıya
 * "mağaza silinemedi" dedirtirdi — oysa silinmiştir.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StoreDeletionListener {

    private final ListingService listingService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOwnStoreDeleted(OwnStoreDeletedEvent event) {
        try {
            int withdrawn = listingService.withdrawAllOf(event.ownerId());
            if (withdrawn > 0) {
                log.info("Mağaza silindi, {} stant geri çekildi (owner={})", withdrawn, event.ownerId());
            }
        } catch (RuntimeException e) {
            log.error("Mağaza silindikten sonra stantlar geri çekilemedi (owner={})", event.ownerId(), e);
        }
    }
}
