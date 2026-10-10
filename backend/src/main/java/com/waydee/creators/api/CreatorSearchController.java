package com.waydee.creators.api;

import com.waydee.common.security.AuthenticatedUser;
import com.waydee.creators.api.dto.CreatorDtos.CreatorConfig;
import com.waydee.creators.api.dto.CreatorDtos.NoteRequest;
import com.waydee.creators.api.dto.CreatorDtos.SearchDetail;
import com.waydee.creators.api.dto.CreatorDtos.SearchRequest;
import com.waydee.creators.api.dto.CreatorDtos.SearchSummary;
import com.waydee.creators.api.dto.CreatorDtos.ShortlistItem;
import com.waydee.creators.api.dto.CreatorDtos.ShortlistRequest;
import com.waydee.creators.api.dto.CreatorDtos.WeightsRequest;
import com.waydee.creators.application.CreatorSearchService;
import com.waydee.creators.application.InsightService;
import com.waydee.creators.domain.Signal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * <b>Influencer keşfi</b> (108. tur).
 *
 * <p>🔒 Kimlik her uçta <b>oturumdan</b> alınır; istekte kullanıcı kimliği
 * kabul edilmez. Arama ve kısa liste kayıtları sahiplik koşuluyla okunur
 * ({@code findByIdAndUserId}) — başkasının raporu kimliği tahmin edilerek
 * açılamaz.
 */
@Tag(name = "Creators", description = "Yapay zekâ destekli influencer keşfi")
@RestController
@RequestMapping("/api/v1/creators")
@RequiredArgsConstructor
public class CreatorSearchController {

    private final CreatorSearchService service;
    private final InsightService insights;

    @Operation(summary = "Kullanılabilirlik ve arama ücretleri")
    @GetMapping("/config")
    public CreatorConfig config() {
        return service.config();
    }

    @Operation(summary = "Aramayı başlat — kredi düşer, araştırma arka planda koşar")
    @PostMapping("/searches")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public SearchDetail start(@AuthenticationPrincipal AuthenticatedUser principal,
                              @Valid @RequestBody SearchRequest request) {
        return service.start(principal.id(), request);
    }

    @Operation(summary = "Geçmiş aramalar (kayıtlı raporlar)")
    @GetMapping("/searches")
    public List<SearchSummary> history(@AuthenticationPrincipal AuthenticatedUser principal,
                                       @RequestParam(defaultValue = "30") int limit) {
        return service.history(principal.id(), limit);
    }

    @Operation(summary = "Arama ayrıntısı — süren aramada adımlar canlı")
    @GetMapping("/searches/{id}")
    public SearchDetail get(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable UUID id) {
        return service.get(principal.id(), id);
    }

    @Operation(summary = "Raporun sıralama ağırlıklarını kaydet (yapay zekâ çağrısı yok)")
    @PutMapping("/searches/{id}/weights")
    public Map<Signal, Integer> weights(@AuthenticationPrincipal AuthenticatedUser principal,
                                        @PathVariable UUID id, @RequestBody WeightsRequest request) {
        return service.updateWeights(principal.id(), id, request.weights());
    }

    @Operation(summary = "Kısa liste")
    @GetMapping("/shortlist")
    public List<ShortlistItem> shortlist(@AuthenticationPrincipal AuthenticatedUser principal) {
        return service.shortlist(principal.id());
    }

    @Operation(summary = "Kısa listeye ekle — veri aramanın anlık görüntüsünden kopyalanır")
    @PostMapping("/shortlist")
    public ShortlistItem add(@AuthenticationPrincipal AuthenticatedUser principal,
                             @Valid @RequestBody ShortlistRequest request) {
        return service.addToShortlist(principal.id(), request.searchId(), request.creatorId());
    }

    @Operation(summary = "Kısa liste notunu güncelle")
    @PatchMapping("/shortlist/{id}")
    public ShortlistItem note(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable UUID id,
                              @Valid @RequestBody NoteRequest request) {
        return service.updateNote(principal.id(), id, request.note());
    }

    @Operation(summary = "Detaylı veriler + takip serisi (yapay zekâ çağrısı yok)")
    @GetMapping("/shortlist/{id}/insights")
    public InsightService.InsightView insights(@AuthenticationPrincipal AuthenticatedUser principal,
                                               @PathVariable UUID id) {
        return insights.view(principal.id(), id);
    }

    @Operation(summary = "Detaylı veri araştırmasını başlat — kredi düşer, arka planda koşar")
    @PostMapping("/shortlist/{id}/insights")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public InsightService.InsightView refreshInsights(@AuthenticationPrincipal AuthenticatedUser principal,
                                                      @PathVariable UUID id,
                                                      @RequestParam(defaultValue = "tr") String locale) {
        return insights.start(principal.id(), id, locale);
    }

    @Operation(summary = "Kısa listeden çıkar")
    @DeleteMapping("/shortlist/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable UUID id) {
        service.removeFromShortlist(principal.id(), id);
    }
}
