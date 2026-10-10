package com.waydee.payment.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Sağlayıcısız geliştirme için sahte ödeme sayfası.
 *
 * <p>Gerçek bir tahsilat yapmaz; kullanıcıyı arayüzdeki <b>sahte ödeme ekranına</b>
 * yollar, oradan "Ödemeyi onayla" denince sunucudaki test ucu çağrılır ve akışın
 * geri kalanı (webhook tamamlaması) birebir aynı kodla çalışır.
 *
 * <p>⚠️ Üretimde bu sağlayıcı seçilirse {@code ProductionSecretsGuard} açılışı
 * engeller — bedava bölge dağıtan bir üretim ortamı olmamalı. Tek istisna:
 * {@code PAYMENT_ALLOW_MOCK=true} ile <b>bilinçli</b> izin verilmişse (canlı
 * ortamda uçtan uca test); o durumda açılışta büyük bir uyarı loglanır.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MockPaymentProvider implements PaymentProvider {

    private final PaymentProperties properties;

    @Override
    public String name() {
        return "MOCK";
    }

    @Override
    public HostedCheckout createCheckout(CheckoutRequest request) {
        String url = properties.returnUrl()
                + "?mock=1&reservation=" + request.reference()
                + "&amount=" + URLEncoder.encode(request.amount().toPlainString(), StandardCharsets.UTF_8)
                + "&currency=" + request.currency();
        log.info("[SAHTE ÖDEME] {} {} → {}", request.amount(), request.currency(), request.reference());
        return new HostedCheckout(url, "mock-" + request.reference());
    }
}
