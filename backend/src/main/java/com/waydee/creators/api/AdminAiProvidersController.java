package com.waydee.creators.api;

import com.waydee.common.ai.AiProvider;
import com.waydee.common.ai.AiProviderSettings;
import com.waydee.creators.application.AiProviderAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * <b>Yönetim · yapay zekâ sağlayıcıları</b> (108. tur).
 *
 * <p>🔒 {@code /api/v1/admin/**} → {@code SecurityConfig} gereği ADMIN rolü.
 *
 * <p>🔒 Anahtar uçları <b>yalnız yazar</b>: hiçbir uç anahtarın açık hâlini
 * döndürmez. Ekran maskeli hâli ({@code sk-ant-…a1b2}) gösterir.
 */
@Tag(name = "Admin AI Providers", description = "Claude / OpenAI anahtarları ve ayarları")
@RestController
@RequestMapping("/api/v1/admin/ai-providers")
@RequiredArgsConstructor
public class AdminAiProvidersController {

    private final AiProviderSettings settings;
    private final AiProviderAdminService adminService;

    @Operation(summary = "ADMIN · sağlayıcı durumu ve son 30 günün tüketimi")
    @GetMapping
    public AiProviderAdminService.Overview overview() {
        return adminService.overview();
    }

    public record ConfigRequest(
            @NotNull List<AiProvider> priority,
            @NotBlank @Size(max = 80) String anthropicModel,
            @NotBlank @Size(max = 80) String openaiModel,
            boolean anthropicEnabled,
            boolean openaiEnabled,
            int costSmall,
            int costLarge,
            int maxWebSearches) {
    }

    @Operation(summary = "ADMIN · model, öncelik ve fiyat ayarları")
    @PutMapping("/config")
    public AiProviderAdminService.Overview updateConfig(@Valid @RequestBody ConfigRequest request) {
        settings.updateConfig(request.priority(), request.anthropicModel(), request.openaiModel(),
                request.anthropicEnabled(), request.openaiEnabled(), request.costSmall(), request.costLarge(),
                request.maxWebSearches());
        return adminService.overview();
    }

    public record KeyRequest(@NotBlank @Size(max = 400) String apiKey) {
    }

    @Operation(summary = "ADMIN · API anahtarını kaydet (şifreli saklanır, geri okunamaz)")
    @PutMapping("/{provider}/key")
    public AiProviderAdminService.Overview setKey(@PathVariable AiProvider provider,
                                                  @Valid @RequestBody KeyRequest request) {
        settings.setKey(provider, request.apiKey());
        return adminService.overview();
    }

    public record WorkspaceRequest(@Size(max = 100) String workspaceId) {
    }

    @Operation(summary = "ADMIN · Claude çalışma alanı kimliği (boş = kaldır)")
    @PutMapping("/{provider}/workspace")
    public AiProviderAdminService.Overview setWorkspace(@PathVariable AiProvider provider,
                                                        @Valid @RequestBody WorkspaceRequest request) {
        settings.setWorkspace(provider, request.workspaceId());
        return adminService.overview();
    }

    @Operation(summary = "ADMIN · API anahtarını kaldır")
    @DeleteMapping("/{provider}/key")
    @ResponseStatus(HttpStatus.OK)
    public AiProviderAdminService.Overview clearKey(@PathVariable AiProvider provider) {
        settings.clearKey(provider);
        return adminService.overview();
    }

    @Operation(summary = "ADMIN · bağlantıyı test et (gerçek istek)")
    @PostMapping("/{provider}/test")
    public AiProviderAdminService.TestResult test(@PathVariable AiProvider provider) {
        return adminService.test(provider);
    }
}
