package com.waydee.outreach.application;

import com.waydee.outreach.domain.EmailCampaign;
import com.waydee.outreach.infrastructure.EmailCampaignRepository;
import com.waydee.outreach.infrastructure.EmailRecipientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Koşucunun tek alıcılık yazmaları (V60).
 *
 * <p>🔴 <b>Neden ayrı bir bean.</b> Bu metotlar {@code CampaignRunner} içinde
 * dursaydı çağrı <b>kendi kendine çağrı</b> olurdu: Spring'in işlem proxy'si
 * devreye girmez ve {@code @Transactional} <b>hiçbir şey yapmazdı</b>. Derleme
 * yeşil geçer, ekranda sayaçlar ilerler, yalnız işlem sınırı yoktur — vault'un
 * defalarca ısırdığı sessiz hata sınıfı (bkz. {@code WelcomeCreditGranter}).
 *
 * <p>⚠️ Her çağrı <b>kendi işlemini</b> açar ({@code REQUIRES_NEW}). Turun
 * tamamı tek işlemde olsaydı 300. alıcıda düşen bir bağlantı önceki 299 kaydı
 * geri alırdı: postalar gitmiş olur, kaydı kalmazdı.
 */
@Component
@RequiredArgsConstructor
public class CampaignWriter {

    private final EmailCampaignRepository campaigns;
    private final EmailRecipientRepository recipients;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordOne(UUID recipientId, UUID campaignId, boolean ok, String error) {
        recipients.findById(recipientId).ifPresent(r -> {
            if (ok) {
                r.markSent();
            } else {
                r.markFailed(error);
            }
            recipients.save(r);
        });
        campaigns.findById(campaignId).ifPresent(c -> {
            if (ok) {
                c.recordSent();
            } else {
                c.recordFailed();
            }
            campaigns.save(c);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(UUID campaignId) {
        campaigns.findById(campaignId).ifPresent(c -> {
            if (c.isRunning()) {
                c.finish();
                campaigns.save(c);
            }
        });
    }

    /** Koşu hâlâ sürüyor mu — "durdur" düğmesi ancak bu okumayla etkili olur. */
    @Transactional(readOnly = true)
    public boolean isRunning(UUID campaignId) {
        return campaigns.findById(campaignId).map(EmailCampaign::isRunning).orElse(false);
    }
}
