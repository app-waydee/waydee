package com.waydee.aistudio.api;

import com.waydee.aistudio.api.dto.AiStudioDtos.EditorialRequest;
import com.waydee.aistudio.api.dto.AiStudioDtos.FashionModelRequest;
import com.waydee.aistudio.api.dto.AiStudioDtos.GenerationResponse;
import com.waydee.aistudio.api.dto.AiStudioDtos.PoseRequest;
import com.waydee.aistudio.api.dto.AiStudioDtos.QuoteResponse;
import com.waydee.aistudio.application.AiStudioService;
import com.waydee.aistudio.application.CreditCost;
import com.waydee.aistudio.application.FashionOptions;
import com.waydee.aistudio.application.SceneOptions;
import com.waydee.aistudio.domain.AiGenerationKind;
import com.waydee.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * <b>Yapay zekâ stüdyosu</b> (V45 · 99. tur: üç araç).
 *
 * <p>🔒 Her uç oturum ister ve kimlik <b>oturumdan</b> alınır; istekte kullanıcı
 * kimliği kabul edilmez. Plan kapısı ve kredi düşümü servistedir — istemcinin
 * düğmeyi gizlemesi güvenlik sayılmaz (projenin diğer kapılarıyla aynı ilke).
 */
@Tag(name = "AI Studio", description = "Yapay zekâ görsel üretimi")
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiStudioController {

    private final AiStudioService aiStudioService;

    /**
     * Açılır listelerin <b>kodları</b>.
     *
     * <p>🔴 Etiket <b>döndürülmez</b>, yalnız kod. Vault kuralı (83. tur):
     * <i>"sunucudan gelen {@code *Label} alanlarını çok dilli arayüzde basma"</i>
     * — çeviri istemcide, koda göre yapılır. Böylece beş dil de aynı listeyi
     * kendi dilinde gösterir ve sunucu tek bir dile mahkûm olmaz.
     *
     * <p>⚠️ Kodların <b>kaynağı</b> sunucudur: istemci listeyi kopyalasaydı
     * ikisi zamanla ayrışır ve kullanıcı sunucunun reddedeceği bir seçenek
     * görebilirdi.
     *
     * <p>⚠️ Sahne sözlüğü ({@code scene}) manken kataloğundan <b>ayrı</b> bir
     * anahtarda (99. tur): aynı torbaya konsaydı manken ekranındaki "Karıştır"
     * düğmesi en-boy oranını da rastgele seçerdi — oran bir kimlik özelliği
     * değil, çıktı biçimidir.
     */
    @Operation(summary = "Stüdyo ayar seçenekleri (kod listesi)")
    @GetMapping("/options")
    public Map<String, Object> options() {
        /* ⚠️ `Map.of` DEĞİL: on çift üstünde okunaksızlaşıyor ve fazladan bir
           çift eklemek sessiz bir derleme hatasına dönüşüyor. */
        Map<String, Object> out = new HashMap<>();
        out.put("catalogue", FashionOptions.catalogue());
        out.put("scene", SceneOptions.catalogue());
        out.put("maxProducts", CreditCost.MAX_PRODUCTS);
        out.put("maxPoseImages", CreditCost.MAX_POSE_IMAGES);
        out.put("costStandard", CreditCost.BASE_STANDARD);
        out.put("costHigh", CreditCost.BASE_HIGH);
        out.put("costExtraProduct", CreditCost.EXTRA_PRODUCT);
        out.put("costEditorial", CreditCost.EDITORIAL_STANDARD);
        out.put("costEditorialHigh", CreditCost.EDITORIAL_HIGH);
        out.put("costPosePerImage", CreditCost.POSE_PER_IMAGE);
        return out;
    }

    /**
     * Maliyet önizlemesi — "Oluştur"un altındaki <b>… kredi</b> yazısı.
     *
     * <p>🔴 Ayrı bir uç olması bilinçli: istemci formülü kopyalamaz, <b>sorar</b>.
     * İki formül olsaydı biri diğerinden sapar ve ekranda yazan rakam ile düşen
     * rakam farklı olurdu.
     *
     * <p>⚠️ {@code kind} varsayılanlıdır: üç aracın da aynı ucu kullanması
     * bilinçli, ama parametreyi zorunlu yapmak eski bir istemciye 400 döndürürdü.
     */
    @Operation(summary = "Bu ayarlar kaç krediye mal olur")
    @GetMapping("/quote")
    public QuoteResponse quote(@AuthenticationPrincipal AuthenticatedUser user,
                               @RequestParam(defaultValue = "FASHION_MODEL") AiGenerationKind kind,
                               @RequestParam(defaultValue = "false") boolean highQuality,
                               @RequestParam(defaultValue = "1") int productCount) {
        return aiStudioService.quote(user.id(), kind, highQuality, productCount);
    }

    /**
     * Üretimi başlatır ve <b>hemen</b> {@code QUEUED} durumuyla döner.
     *
     * <p>⚠️ Senkron beklemek 6–40 saniye boyunca bir istek thread'ini bloke
     * ederdi. İstemci sonucu {@code GET /ai/generations/{id}} ile yoklar.
     */
    @Operation(summary = "Manken / Deneme üretimi başlat")
    @PostMapping("/fashion-model")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public GenerationResponse createFashionModel(@AuthenticationPrincipal AuthenticatedUser user,
                                                 @Valid @RequestBody FashionModelRequest request) {
        return aiStudioService.createFashionModel(user.id(), request);
    }

    /**
     * "Editoryal / Değişim" üretimi (99. tur).
     *
     * <p>⚠️ Mod (<i>editoryal</i> / <i>değişim</i>) istekte <b>yok</b>: farkı
     * yüklenen görsel belirler ve kararı model verir. Gerekçe
     * {@code ScenePromptBuilder} başında.
     */
    @Operation(summary = "Editoryal / Değişim üretimi başlat")
    @PostMapping("/editorial")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public GenerationResponse createEditorial(@AuthenticationPrincipal AuthenticatedUser user,
                                              @Valid @RequestBody EditorialRequest request) {
        return aiStudioService.createEditorial(user.id(), request);
    }

    /**
     * "Poz" üretimi (99. tur).
     *
     * <p>🔴 Yanıt bir <b>listedir</b>: istenen her görsel için ayrı bir satır
     * açılır ve istemci üçünü de ayrı ayrı yoklar. Tek kimlik dönseydi, kalan
     * iki görselin durumu ve iadesi arayüzden hiç görünmezdi.
     */
    @Operation(summary = "Poz varyasyonları üretimi başlat")
    @PostMapping("/pose")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public List<GenerationResponse> createPose(@AuthenticationPrincipal AuthenticatedUser user,
                                               @Valid @RequestBody PoseRequest request) {
        return aiStudioService.createPose(user.id(), request);
    }

    @Operation(summary = "Üretimlerim (galeri)")
    @GetMapping("/generations")
    public List<GenerationResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                         @RequestParam(defaultValue = "30") int limit) {
        return aiStudioService.list(user.id(), limit);
    }

    @Operation(summary = "Tek üretim (durum yoklama)")
    @GetMapping("/generations/{id}")
    public GenerationResponse get(@AuthenticationPrincipal AuthenticatedUser user,
                                  @PathVariable UUID id) {
        return aiStudioService.get(user.id(), id);
    }
}
