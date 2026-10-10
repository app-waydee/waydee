package com.waydee.promotion.api;

import com.waydee.common.security.AuthenticatedUser;
import com.waydee.promotion.api.dto.StoreBidDtos.BidRequest;
import com.waydee.promotion.api.dto.StoreBidDtos.BoardResponse;
import com.waydee.promotion.application.StoreBidService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * <b>Mağazanı öne taşı</b> uçları (98. tur).
 *
 * <p>⚠️ Tahta tek istekte döner (sıralama + kendi durumum + son hareketler +
 * tüm zamanlar): üç ayrı uç, harita açılışında üç gidiş-dönüş demekti ve
 * üçü de aynı tablodan okunuyor.
 */
@Tag(name = "Öne çıkarma", description = "Ödemeli mağaza sıralaması")
@RestController
@RequestMapping("/api/v1/store-bids")
@RequiredArgsConstructor
public class StoreBidController {

    private final StoreBidService bidService;
    private final com.waydee.payment.application.CheckoutService checkoutService;
    private final com.waydee.identity.application.PlanPricingService pricingService;
    private final com.waydee.common.net.ClientIpResolver clientIpResolver;

    @Operation(summary = "Sıralama tahtası")
    @GetMapping("/board")
    public BoardResponse board(@AuthenticationPrincipal AuthenticatedUser principal) {
        return bidService.board(principal != null ? principal.id() : null,
                pricingService.table().currency());
    }

    /**
     * <b>Teklif geçmişim</b> — faturalarım ekranındaki küçük alan (98. tur 2. bölüm).
     *
     * <p>⚠️ Faturadan ayrı bir liste: fatura "ne ödedim"i, bu liste "o ödeme
     * sıraya girdi mi"yi anlatır. İkisi aynı satırda birleştirilseydi
     * kullanıcı, sırayı düşürmeyen (daha düşük) bir ödemenin neden faturası
     * olduğunu anlayamazdı.
     */
    @Operation(summary = "Teklif geçmişim")
    @GetMapping("/my")
    public java.util.List<com.waydee.promotion.api.dto.StoreBidDtos.HistoryRow> my(
            @AuthenticationPrincipal AuthenticatedUser principal) {
        return bidService.history(principal.id());
    }

    /**
     * <b>Teklif ver</b> — ödeme sayfası döner.
     *
     * <p>🔴 Teklif burada sıraya GİRMEZ; yalnız {@code PENDING} bir satır
     * yazılır. Sıraya girmek ödeme tamamlanınca (imzalı webhook) olur — aksi
     * hâlde ödeme sayfasını açıp vazgeçen herkes listenin başına geçerdi.
     */
    @Operation(summary = "Teklif ver (ödeme oturumu açar)")
    @PostMapping("/checkout")
    public ResponseEntity<com.waydee.payment.application.CheckoutService.CheckoutView> bid(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody BidRequest request,
            HttpServletRequest http) {
        var view = checkoutService.startBidCheckout(
                principal.id(), request.amount(), principal.username(), clientIpResolver.resolve(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(view);
    }
}
