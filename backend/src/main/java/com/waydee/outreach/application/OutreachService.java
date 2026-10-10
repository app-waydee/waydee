package com.waydee.outreach.application;

import com.waydee.common.mail.EmailMessage;
import com.waydee.common.mail.MailService;
import com.waydee.outreach.domain.EmailCampaign;
import com.waydee.outreach.domain.EmailRecipient;
import com.waydee.outreach.domain.EmailSuppression;
import com.waydee.outreach.domain.EmailTemplate;
import com.waydee.outreach.domain.RecipientStatus;
import com.waydee.outreach.infrastructure.EmailCampaignRepository;
import com.waydee.outreach.infrastructure.EmailRecipientRepository;
import com.waydee.outreach.infrastructure.EmailSuppressionRepository;
import com.waydee.outreach.infrastructure.EmailTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * <b>Yönetimden toplu e-posta</b> (V60, 107. tur).
 *
 * <p>Kullanıcının kuralları aynen uygulandı: iletiler {@code noreply@waydee.com}
 * üzerinden çıkar (mevcut {@code waydee.mail.from} ayarı), şablonlar yönetimde
 * yazılır, alıcılar kopyala-yapıştır verilir ve <b>CC/BCC kullanılmaz</b>.
 *
 * <p>🔴 <b>Kota bir ayar değil, bir kapıdır.</b> Kayan 24 saatte gönderilen
 * ileti sayısı sınırı aşıyorsa kampanya <b>hiç başlamaz</b>. Yarısını gönderip
 * durmak daha kötü olurdu: yönetici listenin gittiğini sanır, kimin alıp
 * kimin almadığı ancak satır satır bakılarak anlaşılırdı.
 */
@Service
@RequiredArgsConstructor
@EnableConfigurationProperties(OutreachProperties.class)
public class OutreachService {

    private final EmailTemplateRepository templates;
    private final EmailCampaignRepository campaigns;
    private final EmailRecipientRepository recipients;
    private final EmailSuppressionRepository suppressions;
    private final RecipientParser parser;
    private final CampaignRenderer renderer;
    private final CampaignRunner runner;
    private final MailService mailService;
    private final OutreachProperties properties;

    // -------------------------------------------------------------- şablonlar

    @Transactional(readOnly = true)
    public Page<EmailTemplate> listTemplates(String query, int page, int size) {
        return templates.search(searchTerm(query), PageRequest.of(page, Math.min(size, 100)));
    }

    @Transactional(readOnly = true)
    public EmailTemplate template(UUID id) {
        return templates.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Şablon bulunamadı"));
    }

    @Transactional
    public EmailTemplate createTemplate(String name, String subject, String preheader, String heading,
                                        String body, String ctaLabel, String ctaUrl, String footerNote,
                                        String locale, boolean active) {
        templates.findByNameIgnoreCase(name.trim()).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu adla bir şablon zaten var");
        });
        return templates.save(EmailTemplate.create(name, subject, preheader, heading, body,
                ctaLabel, ctaUrl, footerNote, locale, active));
    }

    @Transactional
    public EmailTemplate updateTemplate(UUID id, String name, String subject, String preheader, String heading,
                                        String body, String ctaLabel, String ctaUrl, String footerNote,
                                        String locale, boolean active) {
        EmailTemplate template = template(id);
        templates.findByNameIgnoreCase(name.trim()).ifPresent(other -> {
            if (!other.getId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu adla bir şablon zaten var");
            }
        });
        template.apply(name, subject, preheader, heading, body, ctaLabel, ctaUrl, footerNote, locale, active);
        return templates.save(template);
    }

    /**
     * Şablonu siler.
     *
     * <p>⚠️ Geçmiş kampanyalar <b>etkilenmez</b>: içeriği anlık görüntü olarak
     * taşıyorlar ve yabancı anahtar {@code SET NULL}. "Bu kişiye ne gönderdik"
     * sorusunun cevabı, şablonun silinmesiyle kaybolmaz.
     */
    @Transactional
    public void deleteTemplate(UUID id) {
        templates.delete(template(id));
    }

    /** Önizleme — yönetim ekranı bunu bir {@code iframe} içinde çizer. */
    @Transactional(readOnly = true)
    public EmailMessage preview(UUID id, String sampleName) {
        EmailTemplate template = template(id);
        return renderer.render(template, blankToNull(sampleName), "ornek@waydee.com");
    }

    /**
     * <b>Deneme gönderimi</b> — tek adrese.
     *
     * <p>🔴 Bu adım atlanamaz olmalı ve ekranda öyle konumlandırıldı: yapıştırılan
     * 300 kişiye gönderdikten sonra fark edilen bir yazım hatasının geri dönüşü
     * yoktur. Deneme de kotadan düşer — SMTP açısından gerçek bir iletidir.
     */
    @Transactional
    public boolean sendTest(UUID templateId, String to, String sampleName) {
        EmailTemplate template = template(templateId);
        RecipientParser.Parsed parsed = parser.parse(to);
        if (parsed.recipients().size() != 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli tek bir adres yazın");
        }
        String address = parsed.recipients().getFirst().email();
        EmailMessage message = renderer.render(template, blankToNull(sampleName), address);
        return mailService.sendBlocking(address, message,
                java.util.Map.of("List-Unsubscribe", "<mailto:info@waydee.com?subject=unsubscribe>"));
    }

    // ------------------------------------------------------------------- kota

    /**
     * Kalan günlük hak.
     *
     * @param dailyLimit tavan
     * @param sentLast24h kayan 24 saatte gönderilen
     * @param remaining kalan
     * @param perMinute dakikalık hız
     * @param maxPerCampaign tek turda kabul edilen en çok alıcı
     * @param mailEnabled SMTP açık mı — kapalıyken hiçbir şey gönderilmez
     */
    public record Quota(int dailyLimit, long sentLast24h, long remaining, int perMinute,
                        int maxPerCampaign, boolean mailEnabled, String disabledReason) {
    }

    @Transactional(readOnly = true)
    public Quota quota() {
        long sent = recipients.countSentSince(windowStart());
        String disabled = mailService.disabledReason();
        return new Quota(properties.dailyLimit(), sent, Math.max(0, properties.dailyLimit() - sent),
                properties.perMinute(), properties.maxPerCampaign(), disabled == null, disabled);
    }

    /**
     * Kotanın <b>kayan</b> penceresi.
     *
     * <p>🔴 Takvim günü kullanılmadı: 23:50'de 300, 00:10'da 300 daha göndermek
     * mümkün olurdu — sağlayıcının gördüğü, 20 dakikada 600 iletidir. Kotayı
     * koyma sebebi tam olarak bunu engellemek.
     */
    private Instant windowStart() {
        return Instant.now().minus(24, ChronoUnit.HOURS);
    }

    // -------------------------------------------------------------- ön kontrol

    /**
     * Yapıştırılan listenin <b>gönderilmeden önceki</b> özeti.
     *
     * @param valid      gönderilecek adresler
     * @param invalid    okunamayan parçalar
     * @param duplicates elenen kopya sayısı
     * @param suppressed bastırma listesinde olduğu için elenenler
     * @param overQuota  kotayı aşıyor mu
     */
    public record Preflight(List<RecipientParser.Recipient> valid, List<String> invalid,
                            int duplicates, List<String> suppressed, boolean overQuota, Quota quota) {
    }

    @Transactional(readOnly = true)
    public Preflight preflight(String raw) {
        RecipientParser.Parsed parsed = parser.parse(raw);
        List<String> emails = parsed.recipients().stream().map(RecipientParser.Recipient::email).toList();
        Set<String> blocked = emails.isEmpty()
                ? Set.of()
                : new HashSet<>(suppressions.findSuppressed(emails));

        List<RecipientParser.Recipient> valid = new ArrayList<>();
        List<String> suppressed = new ArrayList<>();
        for (RecipientParser.Recipient r : parsed.recipients()) {
            if (blocked.contains(r.email())) {
                suppressed.add(r.email());
            } else {
                valid.add(r);
            }
        }
        Quota quota = quota();
        return new Preflight(valid, parsed.invalid(), parsed.duplicates(), suppressed,
                valid.size() > quota.remaining(), quota);
    }

    // -------------------------------------------------------------- kampanyalar

    /**
     * Kampanyayı kurar ve arka planda başlatır.
     *
     * <p>🔴 Kota <b>burada</b> kapatır. Koşucunun içinde kontrol edilseydi
     * kampanya "gönderiliyor" diye açılır, sonra sessizce yarıda kalırdı.
     */
    @Transactional
    public EmailCampaign send(UUID templateId, String rawRecipients) {
        EmailTemplate template = template(templateId);
        if (!template.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pasif şablonla gönderim yapılamaz");
        }
        Preflight pre = preflight(rawRecipients);
        if (pre.valid().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Gönderilecek geçerli adres yok" + (pre.suppressed().isEmpty() ? ""
                            : " (" + pre.suppressed().size() + " adres bastırma listesinde)"));
        }
        if (pre.valid().size() > properties.maxPerCampaign()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Tek turda en çok " + properties.maxPerCampaign() + " alıcı gönderilebilir; listeyi bölün");
        }
        if (pre.overQuota()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Günlük kota aşılıyor: son 24 saatte " + pre.quota().sentLast24h() + " ileti gönderildi, "
                            + "kalan hak " + pre.quota().remaining() + ", listede " + pre.valid().size() + " kişi var");
        }

        // 🔴 Aynı anda ikinci bir tur açılmaz: iki koşu birlikte akarsa dakikalık
        // hız iki katına çıkar ve kota kontrolü ikisinde de "geçmiş" görünür.
        if (!campaigns.findByStatus(com.waydee.outreach.domain.CampaignStatus.SENDING).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Halihazırda süren bir gönderim var; bitmesini bekleyin");
        }

        EmailMessage snapshot = renderer.renderWithPlaceholders(template);
        EmailCampaign campaign = campaigns.save(EmailCampaign.start(
                template.getId(), template.getName(), snapshot.subject(), snapshot.html(), snapshot.text(),
                pre.valid().size(), pre.suppressed().size()));

        List<EmailRecipient> rows = new ArrayList<>();
        for (RecipientParser.Recipient r : pre.valid()) {
            rows.add(EmailRecipient.queued(campaign.getId(), r.email(), r.name()));
        }
        // Bastırılan adresler de YAZILIR: "gönderilmedi ve neden" bir kayıttır.
        for (String blocked : pre.suppressed()) {
            rows.add(EmailRecipient.skipped(campaign.getId(), blocked, null, "Bastırma listesinde"));
        }
        recipients.saveAll(rows);

        // ⚠️ Koşucu işlem BİTTİKTEN sonra çalışmalı. @Async ayrı bir thread'e
        // geçtiği için commit edilmemiş satırları göremez ve kuyruğu BOŞ bulurdu.
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        runner.run(campaign.getId());
                    }
                });
        return campaign;
    }

    @Transactional(readOnly = true)
    public Page<EmailCampaign> listCampaigns(int page, int size) {
        return campaigns.findAllByOrderByCreatedAtDesc(PageRequest.of(page, Math.min(size, 100)));
    }

    @Transactional(readOnly = true)
    public EmailCampaign campaign(UUID id) {
        return campaigns.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Kampanya bulunamadı"));
    }

    @Transactional(readOnly = true)
    public Page<EmailRecipient> campaignRecipients(UUID id, int page, int size) {
        campaign(id);
        return recipients.findByCampaignIdOrderByCreatedAtAsc(id, PageRequest.of(page, Math.min(size, 200)));
    }

    /**
     * Süren bir turu durdurur.
     *
     * <p>⚠️ Gönderilmiş iletiler <b>geri alınamaz</b>; durdurmak yalnız kuyruğu
     * kapatır. Ekranda da böyle yazıyor — "iptal" kelimesi gönderilenlerin de
     * iptal olduğunu düşündürürdü.
     */
    @Transactional
    public EmailCampaign cancel(UUID id) {
        EmailCampaign campaign = campaign(id);
        if (!campaign.isRunning()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu gönderim zaten bitmiş");
        }
        recipients.cancelQueued(id);
        campaign.cancel();
        return campaigns.save(campaign);
    }

    // ---------------------------------------------------------- bastırma listesi

    @Transactional(readOnly = true)
    public Page<EmailSuppression> listSuppressions(String query, int page, int size) {
        return suppressions.search(searchTerm(query), PageRequest.of(page, Math.min(size, 200)));
    }

    /**
     * Adres(ler)i bastırma listesine ekler — burası da kopyala-yapıştır kabul eder.
     *
     * @return eklenen adres sayısı
     */
    @Transactional
    public int suppress(String raw, String reason, String note, UUID by) {
        RecipientParser.Parsed parsed = parser.parse(raw);
        if (parsed.recipients().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli adres bulunamadı");
        }
        int added = 0;
        for (RecipientParser.Recipient r : parsed.recipients()) {
            // Zaten listedeyse tekrar eklenmez; tekil indeks de bunu korur.
            if (!suppressions.existsByEmail(r.email())) {
                suppressions.save(EmailSuppression.of(r.email(), normalizeReason(reason), blankToNull(note), by));
                added++;
            }
        }
        return added;
    }

    @Transactional
    public void unsuppress(UUID id) {
        suppressions.deleteById(id);
    }

    private String normalizeReason(String reason) {
        if (reason == null) {
            return "MANUAL";
        }
        String value = reason.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "UNSUBSCRIBE", "BOUNCE", "COMPLAINT", "MANUAL" -> value;
            default -> "MANUAL";
        };
    }

    /** Kampanyanın alıcı durum kırılımı — liste ekranındaki sayaçlar. */
    @Transactional(readOnly = true)
    public long countByStatus(UUID campaignId, RecipientStatus status) {
        return recipients.countByCampaignIdAndStatus(campaignId, status);
    }

    /**
     * Arama terimi — boşsa <b>boş dize</b>, asla {@code null}.
     *
     * <p>🔴 Ölçümle bulundu: {@code null} bir String parametresini PostgreSQL
     * {@code bytea} olarak çıkarıyor ve sorgu
     * {@code function lower(bytea) does not exist} ile <b>500</b> dönüyor.
     * Derleme, tip denetimi ve birim testi bunu göremez — yalnız gerçek bir
     * istek yakalar.
     */
    private String searchTerm(String value) {
        return (value == null || value.isBlank()) ? "" : value.trim();
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
