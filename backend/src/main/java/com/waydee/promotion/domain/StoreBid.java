package com.waydee.promotion.domain;

import com.waydee.common.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * <b>Mağaza öne çıkarma teklifi</b> (V57, 98. tur — bidkick.me modeli).
 *
 * <p>Sıralama kuralı tek cümle: <b>en çok ödeyen üstte</b>; eşitlikte <b>önce
 * ödeyen</b> üstte. İkinci yarısı olmadan iki eşit teklifin sırası her sorguda
 * değişir ve kullanıcı "listede zıplıyorum" derdi.
 *
 * <p>🔴 <b>Teklifler toplanmaz</b> (bidkick kuralı) ama <b>geriye de gitmez</b>:
 * geçerli teklif kullanıcının <b>ödediği en yüksek</b> tutardır. Harfiyen "son
 * ödenen tutar" deseydik, 1000₺ ödemiş birinin 50₺'lik ikinci ödemesi onu
 * listenin dibine düşürürdü — para ödeyip sıra kaybetmek hiçbir kullanıcının
 * beklemediği sonuçtur.
 *
 * <p>🔴 <b>Süre yoktur.</b> Sıra, biri geçene kadar durur. Bitiş tarihi koymak
 * ödeyen kullanıcının bir sabah listeden düşmesi demekti ve ürün bunu vaat
 * etmiyor ({@code bidkick}: *"Stay up — until someone outbids you"*).
 */
@Entity
@Table(name = "store_bids")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StoreBid extends AuditableEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    /**
     * Öne çıkarılan mağaza.
     * <p>⚠️ Mağaza silinirse <b>NULL</b> olur ama satır durur: para ödenmiştir,
     * muhasebe kaydı yok edilemez. Listeleme mağazasız teklifi göstermez.
     */
    @Column(name = "territory_id")
    private UUID territoryId;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private BidStatus status = BidStatus.PENDING;

    /** Ödeme oturumu — webhook geldiğinde teklif buradan bulunur. */
    @Column(name = "checkout_id")
    private UUID checkoutId;

    @Column(name = "invoice_id")
    private UUID invoiceId;

    @Column(name = "placed_at", nullable = false, updatable = false)
    private Instant placedAt = Instant.now();

    @Column(name = "activated_at")
    private Instant activatedAt;

    public StoreBid(UUID userId, UUID territoryId, BigDecimal amount, String currency, UUID checkoutId) {
        this.userId = userId;
        this.territoryId = territoryId;
        this.amount = amount;
        this.currency = currency;
        this.checkoutId = checkoutId;
        this.status = BidStatus.PENDING;
        this.placedAt = Instant.now();
    }

    /**
     * Ödeme geldi — teklif sıraya girer.
     *
     * <p>⚠️ {@code activatedAt} sıralamanın <b>ikinci anahtarıdır</b>: eşit
     * tutarlarda önce ödeyen üstte kalır.
     */
    public void activate() {
        this.status = BidStatus.ACTIVE;
        this.activatedAt = Instant.now();
    }

    /** Aynı kullanıcının daha yüksek teklifi geldi. */
    public void replace() {
        this.status = BidStatus.REPLACED;
    }

    public void fail() {
        this.status = BidStatus.FAILED;
    }

    public void attachInvoice(UUID invoiceId) {
        this.invoiceId = invoiceId;
    }

    /** Mağaza silindi — teklif kimliği boşalır, satır muhasebe için durur. */
    public void detachTerritory() {
        this.territoryId = null;
    }
}
