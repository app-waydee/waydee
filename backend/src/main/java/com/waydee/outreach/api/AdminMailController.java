package com.waydee.outreach.api;

import com.waydee.common.mail.EmailMessage;
import com.waydee.common.security.AuthenticatedUser;
import com.waydee.common.web.PageResponse;
import com.waydee.outreach.api.dto.MailDtos.CampaignResponse;
import com.waydee.outreach.api.dto.MailDtos.PreflightResponse;
import com.waydee.outreach.api.dto.MailDtos.PreviewResponse;
import com.waydee.outreach.api.dto.MailDtos.QuotaResponse;
import com.waydee.outreach.api.dto.MailDtos.RecipientResponse;
import com.waydee.outreach.api.dto.MailDtos.RecipientsRequest;
import com.waydee.outreach.api.dto.MailDtos.SendRequest;
import com.waydee.outreach.api.dto.MailDtos.SuppressionRequest;
import com.waydee.outreach.api.dto.MailDtos.SuppressionResponse;
import com.waydee.outreach.api.dto.MailDtos.TemplateRequest;
import com.waydee.outreach.api.dto.MailDtos.TemplateResponse;
import com.waydee.outreach.api.dto.MailDtos.TestRequest;
import com.waydee.outreach.application.CampaignRenderer;
import com.waydee.outreach.application.OutreachService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * <b>Yönetim · toplu e-posta</b> (V60, 107. tur).
 *
 * <p>🔒 Tüm uçlar {@code /api/v1/admin/**} altındadır, yani {@code SecurityConfig}
 * gereği <b>ADMIN rolü</b> ister. Ayrıca yöntem düzeyinde bir kontrol
 * eklenmedi: iki ayrı yerde tanımlanan yetki, biri güncellenip diğeri
 * unutulduğunda sessizce ayrışır.
 */
@Tag(name = "Admin Mail", description = "Şablonlu toplu e-posta gönderimi")
@RestController
@RequestMapping("/api/v1/admin/mail")
@RequiredArgsConstructor
public class AdminMailController {

    private final OutreachService service;

    // -------------------------------------------------------------- şablonlar

    @Operation(summary = "ADMIN · şablon listesi")
    @GetMapping("/templates")
    public PageResponse<TemplateResponse> templates(@RequestParam(required = false) String query,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "50") int size) {
        return PageResponse.from(service.listTemplates(query, page, size), TemplateResponse::from);
    }

    @Operation(summary = "ADMIN · tek şablon")
    @GetMapping("/templates/{id}")
    public TemplateResponse template(@PathVariable UUID id) {
        return TemplateResponse.from(service.template(id));
    }

    @Operation(summary = "ADMIN · şablon oluştur")
    @PostMapping("/templates")
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateResponse create(@Valid @RequestBody TemplateRequest req) {
        return TemplateResponse.from(service.createTemplate(req.name(), req.subject(), req.preheader(),
                req.heading(), req.body(), req.ctaLabel(), req.ctaUrl(), req.footerNote(),
                req.locale(), req.activeOrTrue()));
    }

    @Operation(summary = "ADMIN · şablon güncelle")
    @PutMapping("/templates/{id}")
    public TemplateResponse update(@PathVariable UUID id, @Valid @RequestBody TemplateRequest req) {
        return TemplateResponse.from(service.updateTemplate(id, req.name(), req.subject(), req.preheader(),
                req.heading(), req.body(), req.ctaLabel(), req.ctaUrl(), req.footerNote(),
                req.locale(), req.activeOrTrue()));
    }

    @Operation(summary = "ADMIN · şablon sil — geçmiş kampanyalar etkilenmez")
    @DeleteMapping("/templates/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.deleteTemplate(id);
    }

    @Operation(summary = "ADMIN · şablon önizleme (gönderim yok)")
    @GetMapping("/templates/{id}/preview")
    public PreviewResponse preview(@PathVariable UUID id,
                                   @RequestParam(required = false) String sampleName) {
        EmailMessage message = service.preview(id, sampleName);
        return new PreviewResponse(message.subject(), message.html(), message.text());
    }

    @Operation(summary = "ADMIN · deneme gönderimi — TEK adrese, kotadan düşer")
    @PostMapping("/templates/{id}/test")
    public TestResult test(@PathVariable UUID id, @Valid @RequestBody TestRequest req) {
        boolean sent = service.sendTest(id, req.to(), req.sampleName());
        return new TestResult(sent, sent ? null : service.quota().disabledReason());
    }

    public record TestResult(boolean sent, String reason) {
    }

    /** Şablonda kullanılabilen yer tutucular — yönetim ekranı bu listeyi basar. */
    @Operation(summary = "ADMIN · kullanılabilir değişkenler")
    @GetMapping("/variables")
    public List<String> variables() {
        return CampaignRenderer.VARIABLES;
    }

    // ------------------------------------------------------------------- kota

    @Operation(summary = "ADMIN · günlük gönderim kotası")
    @GetMapping("/quota")
    public QuotaResponse quota() {
        return QuotaResponse.from(service.quota());
    }

    // -------------------------------------------------------------- kampanyalar

    /**
     * <b>Gönderim öncesi kontrol.</b>
     *
     * <p>⚠️ Bu bir {@code POST}'tur ama <b>hiçbir şey değiştirmez</b>: alıcı
     * listesi 200 KB'a kadar çıkabiliyor ve bir sorgu dizesine sığmaz.
     */
    @Operation(summary = "ADMIN · alıcı listesini gönderMEden çözümle")
    @PostMapping("/preflight")
    public PreflightResponse preflight(@Valid @RequestBody RecipientsRequest req) {
        return PreflightResponse.from(service.preflight(req.recipients()));
    }

    @Operation(summary = "ADMIN · kampanyayı başlat — her alıcıya AYRI ileti, CC/BCC yok")
    @PostMapping("/campaigns")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public CampaignResponse send(@Valid @RequestBody SendRequest req) {
        return CampaignResponse.from(service.send(UUID.fromString(req.templateId()), req.recipients()));
    }

    @Operation(summary = "ADMIN · gönderim geçmişi")
    @GetMapping("/campaigns")
    public PageResponse<CampaignResponse> campaigns(@RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(service.listCampaigns(page, size), CampaignResponse::from);
    }

    @Operation(summary = "ADMIN · kampanya durumu")
    @GetMapping("/campaigns/{id}")
    public CampaignResponse campaign(@PathVariable UUID id) {
        return CampaignResponse.from(service.campaign(id));
    }

    @Operation(summary = "ADMIN · kampanyanın alıcıları")
    @GetMapping("/campaigns/{id}/recipients")
    public PageResponse<RecipientResponse> recipients(@PathVariable UUID id,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "100") int size) {
        return PageResponse.from(service.campaignRecipients(id, page, size), RecipientResponse::from);
    }

    @Operation(summary = "ADMIN · süren gönderimi durdur — gönderilenler geri alınmaz")
    @PostMapping("/campaigns/{id}/stop")
    public CampaignResponse stop(@PathVariable UUID id) {
        return CampaignResponse.from(service.cancel(id));
    }

    // ---------------------------------------------------------- bastırma listesi

    @Operation(summary = "ADMIN · bir daha gönderilmeyecek adresler")
    @GetMapping("/suppressions")
    public PageResponse<SuppressionResponse> suppressions(@RequestParam(required = false) String query,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "100") int size) {
        return PageResponse.from(service.listSuppressions(query, page, size), SuppressionResponse::from);
    }

    @Operation(summary = "ADMIN · bastırma listesine ekle")
    @PostMapping("/suppressions")
    @ResponseStatus(HttpStatus.CREATED)
    public SuppressResult suppress(@AuthenticationPrincipal AuthenticatedUser principal,
                                   @Valid @RequestBody SuppressionRequest req) {
        return new SuppressResult(service.suppress(req.emails(), req.reason(), req.note(), principal.id()));
    }

    public record SuppressResult(int added) {
    }

    @Operation(summary = "ADMIN · bastırma kaydını kaldır")
    @DeleteMapping("/suppressions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsuppress(@PathVariable UUID id) {
        service.unsuppress(id);
    }
}
