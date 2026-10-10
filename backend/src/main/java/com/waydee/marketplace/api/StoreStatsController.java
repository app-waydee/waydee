package com.waydee.marketplace.api;

import com.waydee.common.security.AuthenticatedUser;
import com.waydee.marketplace.api.dto.StoreStatsDtos.StoreStatsResponse;
import com.waydee.marketplace.api.dto.StoreStatsDtos.VisitRequest;
import com.waydee.marketplace.application.StoreStatsService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * <b>Mağaza istatistikleri</b> — ziyaret bildirimi ve stant sahibinin raporu.
 *
 * <p>⚠️ Yol {@code /studio} altında <b>değil</b>: ziyareti bildiren kişi mağaza
 * sahibi değil <b>ziyaretçidir</b> ve stüdyo uçlarının hepsi sahiplik ister.
 * İkisini aynı önek altında toplamak, o kapıyı ilk gelen isteğe açmak olurdu.
 */
@RestController
@RequestMapping("/api/v1/marketplace/listings/{listingId}")
@RequiredArgsConstructor
public class StoreStatsController {

    private final StoreStatsService statsService;

    /**
     * 3B mağazaya giriş / çıkış.
     *
     * <p>⚠️ Cevap <b>204</b>: istemcinin bu istekten alacağı bir şey yok ve
     * sahne bunu beklemez. Gövde döndürmek, kapıdan geçen her ziyaretçide
     * gereksiz bir tur daha demekti.
     */
    @Operation(summary = "3B mağazaya giriş/çıkış bildirimi")
    @PostMapping("/visits")
    public ResponseEntity<Void> visit(@PathVariable UUID listingId,
                                      @Valid @RequestBody VisitRequest request,
                                      @AuthenticationPrincipal AuthenticatedUser principal) {
        statsService.visit(listingId, principal != null ? principal.id() : null, request);
        return ResponseEntity.noContent().build();
    }

    /** Stant sahibinin raporu — sahiplik serviste doğrulanır. */
    @Operation(summary = "Stant istatistikleri (yalnız sahibi)")
    @GetMapping("/stats")
    public StoreStatsResponse stats(@PathVariable UUID listingId,
                                    @RequestParam(required = false) Integer days,
                                    @AuthenticationPrincipal AuthenticatedUser principal) {
        return statsService.stats(listingId, principal != null ? principal.id() : null, days);
    }
}
