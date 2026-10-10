package com.waydee.outreach.application;

import com.waydee.common.mail.EmailMessage;
import com.waydee.common.mail.MailService;
import com.waydee.outreach.domain.CampaignStatus;
import com.waydee.outreach.domain.EmailCampaign;
import com.waydee.outreach.domain.EmailRecipient;
import com.waydee.outreach.domain.RecipientStatus;
import com.waydee.outreach.infrastructure.EmailCampaignRepository;
import com.waydee.outreach.infrastructure.EmailRecipientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * <b>Kampanyayı gönderen koşucu</b> (V60, 107. tur).
 *
 * <p>🔴 <b>Kendi havuzunda</b> koşar ({@code outreachExecutor}, tek thread).
 * Varsayılan {@code taskExecutor} kullanılsaydı 300 kişilik bir davet turu,
 * <b>kayıt doğrulama postalarının önüne</b> geçerdi: kuyruk dolar,
 * {@code CallerRunsPolicy} devreye girer ve yeni üye olan birinin doğrulama
 * postası dakikalarca beklerdi. Toplu posta bekleyebilir; hesabını açmaya
 * çalışan kullanıcı bekleyemez.
 *
 * <p>🔴 <b>Her ileti ayrı gönderilir.</b> CC/BCC yok — bkz. {@code V60}.
 *
 * <p>⚠️ Her alıcı <b>kendi işlemine</b> yazılır. Tüm turu tek işleme koymak,
 * 300. alıcıda düşen bir bağlantının önceki 299 kaydı geri alması demekti:
 * postalar gitmiş, kayıt yok.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CampaignRunner {

    private final EmailCampaignRepository campaigns;
    private final EmailRecipientRepository recipients;
    /** İşlem sınırı olan yazmalar ayrı bean'dedir — bkz. {@link CampaignWriter}. */
    private final CampaignWriter writer;
    private final CampaignRenderer renderer;
    private final MailService mailService;
    private final OutreachProperties properties;

    /**
     * Kuyruktaki alıcılara gönderir.
     *
     * <p>⚠️ Bu metot <b>asla istisna fırlatmaz</b>: koşucu bir arka plan işidir
     * ve fırlatılan istisnayı yakalayacak kimse yoktur — kampanya sonsuza kadar
     * {@code SENDING} kalırdı.
     */
    @Async("outreachExecutor")
    public void run(UUID campaignId) {
        EmailCampaign campaign = campaigns.findById(campaignId).orElse(null);
        if (campaign == null || !campaign.isRunning()) {
            return;
        }
        String disabled = mailService.disabledReason();
        List<EmailRecipient> queue = recipients.findByCampaignIdAndStatus(campaignId, RecipientStatus.QUEUED);
        log.info("Kampanya başlıyor: {} alıcı ({})", queue.size(), campaign.getSubjectSnapshot());

        int sent = 0;
        int failed = 0;
        for (EmailRecipient recipient : queue) {
            // Yönetici durdurmuş olabilir — her ileti öncesi durum yeniden okunur.
            // Tek seferlik okunsaydı "durdur" düğmesi ancak tur bittikten sonra
            // etkili olurdu, yani hiç.
            if (!writer.isRunning(campaignId)) {
                log.info("Kampanya durduruldu, kalan {} alıcı gönderilmedi", queue.size() - sent - failed);
                return;
            }

            boolean ok = false;
            String error = disabled;
            if (disabled == null) {
                EmailMessage message = renderer.personalize(
                        campaign.getSubjectSnapshot(), campaign.getHtmlSnapshot(), campaign.getTextSnapshot(),
                        recipient.getName(), recipient.getEmail());
                ok = mailService.sendBlocking(recipient.getEmail(), message, unsubscribeHeaders());
                if (!ok) {
                    error = "SMTP iletiyi kabul etmedi";
                }
            }

            writer.recordOne(recipient.getId(), campaignId, ok, error);
            if (ok) {
                sent++;
            } else {
                failed++;
            }

            // 🔴 Beklemeden gönderilirse sağlayıcının hız sınırı tetiklenir ve o
            // noktadan sonrası kabul edilmez. SMTP kapalıyken beklemek anlamsız
            // (hiç bağlantı açılmıyor) — o durumda tur hızla kapanır.
            if (disabled == null) {
                pause(properties.delayMillis());
            }
        }
        writer.finish(campaignId);
        log.info("Kampanya bitti: {} gönderildi, {} düştü", sent, failed);
    }

    /**
     * <b>Açılışta takılı kalan koşuları kapatır.</b>
     *
     * <p>🔴 Kuyruk <b>bellektedir</b>. Sunucu dağıtım sırasında yeniden başlarsa
     * iş kaybolur ama satır {@code SENDING} kalır ve yönetim ekranında sonsuza
     * kadar "gönderiliyor" yazar — hiç ilerlemeyecek bir satır.
     *
     * <p>⚠️ Kalan alıcılar <b>kendiliğinden gönderilmez</b>: yeniden başlatma
     * anında hangi iletinin SMTP'ye ulaştığı kesin bilinemez ve otomatik devam
     * bazı kişilere postayı <b>iki kez</b> yollardı. Satırlar açıkça
     * işaretlenir, karar yöneticinindir.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void recoverStuckCampaigns() {
        for (EmailCampaign campaign : campaigns.findByStatus(CampaignStatus.SENDING)) {
            int cancelled = recipients.cancelQueued(campaign.getId());
            campaign.cancel();
            campaigns.save(campaign);
            log.warn("Yeniden başlatma nedeniyle yarım kalan kampanya kapatıldı: {} ({} alıcı gönderilmedi)",
                    campaign.getSubjectSnapshot(), cancelled);
        }
    }

    /**
     * <b>{@code List-Unsubscribe}</b> — teslim edilebilirliğin en ucuz kazancı.
     *
     * <p>Gmail ve Outlook bu başlığı görünce gelen kutusunun üstünde kendi
     * "abonelikten çık" düğmesini çizer. Başlık yoksa aynı kullanıcı çıkmak için
     * <b>spam düğmesine</b> basar ve o şikâyet, tek kişiyi değil alan adının
     * itibarını vurur.
     *
     * <p>⚠️ Yalnız {@code mailto} verilir, tek tıklık HTTP ucu <b>bilinçli
     * olarak yok</b>: {@code One-Click} sözleşmesi herkese açık bir POST ucu
     * ister ve o uç, kötü niyetli birinin listedeki herkesi tek tek düşürmesine
     * açık olurdu. Gelen çıkış postaları bastırma listesine elle işlenir.
     */
    private Map<String, String> unsubscribeHeaders() {
        return Map.of("List-Unsubscribe", "<mailto:info@waydee.com?subject=unsubscribe>");
    }

    private void pause(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            // Kapanış sinyali: bayrağı geri koy ve turu bırak.
            Thread.currentThread().interrupt();
        }
    }
}
