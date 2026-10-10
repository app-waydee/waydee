package com.waydee.outreach.infrastructure;

import com.waydee.outreach.domain.EmailRecipient;
import com.waydee.outreach.domain.RecipientStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface EmailRecipientRepository extends JpaRepository<EmailRecipient, UUID> {

    /**
     * <b>Günlük kotanın tek kaynağı.</b>
     *
     * <p>🔴 Ayrı bir sayaç kolonu tutulmadı: sayaç ile gerçek satırlar bir gün
     * ayrışır ve hangisinin doğru olduğu bilinmez. Burada sayılan şey, gerçekten
     * gönderilmiş iletilerin ta kendisidir.
     *
     * <p>⚠️ Pencere <b>kayan 24 saattir</b>, "bugün" değil. Takvim gününe
     * bakılsaydı gece 23:50'de 300, 00:10'da 300 daha göndermek mümkün olurdu —
     * yani sağlayıcının gördüğü 20 dakikada 600 ileti. Kotayı koyma sebebi tam
     * olarak bunu engellemek.
     */
    @Query("select count(r) from EmailRecipient r where r.status = com.waydee.outreach.domain.RecipientStatus.SENT and r.sentAt >= :since")
    long countSentSince(@Param("since") Instant since);

    List<EmailRecipient> findByCampaignIdAndStatus(UUID campaignId, RecipientStatus status);

    Page<EmailRecipient> findByCampaignIdOrderByCreatedAtAsc(UUID campaignId, Pageable pageable);

    long countByCampaignIdAndStatus(UUID campaignId, RecipientStatus status);

    /**
     * Kampanya durdurulunca kuyrukta kalanlar kapatılır.
     *
     * <p>⚠️ Satırlar <b>silinmez</b>: "bu kişiye gönderilmedi" de bir kayıttır ve
     * silinseydi liste, gönderilenlerden ibaret görünüp yöneticiye herkesin
     * ulaşıldığını sandırırdı.
     */
    @Modifying
    @Query("""
            update EmailRecipient r
               set r.status = com.waydee.outreach.domain.RecipientStatus.FAILED,
                   r.error = 'Kampanya durduruldu'
             where r.campaignId = :campaignId
               and r.status = com.waydee.outreach.domain.RecipientStatus.QUEUED
            """)
    int cancelQueued(@Param("campaignId") UUID campaignId);
}
