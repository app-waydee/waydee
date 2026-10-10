package com.waydee.outreach.infrastructure;

import com.waydee.outreach.domain.CampaignStatus;
import com.waydee.outreach.domain.EmailCampaign;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EmailCampaignRepository extends JpaRepository<EmailCampaign, UUID> {

    Page<EmailCampaign> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Açılışta temizlenecek koşular.
     *
     * <p>🔴 Havuz <b>bellektedir</b>: sunucu dağıtım sırasında yeniden başlarsa
     * kuyruktaki iş kaybolur ama satır {@code SENDING} kalır. Temizlenmeseydi
     * yönetim ekranında sonsuza kadar "gönderiliyor" yazan bir kampanya
     * dururdu ve o satır bir daha hiç ilerlemezdi.
     */
    List<EmailCampaign> findByStatus(CampaignStatus status);
}
