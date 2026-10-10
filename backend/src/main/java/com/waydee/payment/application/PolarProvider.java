package com.waydee.payment.application;

import com.waydee.common.error.ApiException;
import com.waydee.common.error.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Polar barındırılan ödeme sayfası (12 Ağustos 2026).
 *
 * <p><b>Farkı LemonSqueezy'den:</b> tutar burada gönderilmez. Polar'da abonelik
 * ürününün fiyatı ürünün kendisine bağlıdır ve istekten ezilemez; bu yüzden
 * oturum, plan+döneme karşılık gelen <b>ürün kimliğiyle</b> açılır
 * ({@link PolarProperties#productId}).
 *
 * <p><b>Rezervasyonun geri dönüşü:</b> {@code metadata.reservation} anahtarı
 * ödeme tamamlanınca {@code order.paid} olayında aynen geri gelir; ödemeyi
 * doğru kullanıcı ve planla bu sayede eşleştiririz. Polar bu metadata'yı
 * aboneliğe de kopyalar, dolayısıyla <b>yenileme siparişlerinde de</b> taşınır.
 *
 * <p>⚠️ <b>Dönüş adresine rezervasyon kimliğini BİZ yazarız</b>
 * ({@code ?checkout=…}): dönüş ekranı sunucudaki kaydı bu kimlikle yoklar.
 * Polar'ın kendi {@code checkout_id}'si bizim kaydımızın kimliği değildir.
 */
@Slf4j
@Component
public class PolarProvider implements PaymentProvider {

    private final PolarProperties properties;
    private final RestClient restClient;

    public PolarProvider(PolarProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) properties.timeout().toMillis());
        factory.setReadTimeout((int) properties.timeout().toMillis());
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .baseUrl(properties.baseUrl())
                .build();
    }

    @Override
    public String name() {
        return "POLAR";
    }

    @Override
    @SuppressWarnings("unchecked")
    public HostedCheckout createCheckout(CheckoutRequest request) {
        if (!properties.isConfigured()) {
            // Yapılandırma eksikken sessizce mock'a düşmek, üretimde "ödeme
            // alınmadan plan verildi" demek olurdu — açıkça reddedilir.
            throw new ApiException(ErrorCode.PAYMENT_FAILED,
                    "Ödeme sağlayıcısı yapılandırılmamış (POLAR_API_KEY ya da ürün kimlikleri eksik)");
        }
        String productId = properties.productId(request.plan(), request.period());
        if (productId == null || productId.isBlank()) {
            throw new ApiException(ErrorCode.PAYMENT_FAILED, request.plan() == null
                    ? "Serbest tutarlı Polar ürünü tanımlı değil (POLAR_PRODUCT_BID)"
                    : "Bu plan/dönem için Polar ürünü tanımlı değil: "
                            + request.plan() + " · " + request.period());
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("products", List.of(productId));
        // Webhook'ta geri gelecek tek gerçek bağ: rezervasyon kimliği.
        body.put("metadata", Map.of("reservation", request.reference().toString()));
        body.put("success_url", withCheckoutParam(request.successUrl(), request.reference().toString()));
        /* 🔴 Adres GEÇERLİ DEĞİLSE gönderilmez. Polar `customer_email`'i doğrular
           ve geçersizse tüm isteği 422 ile reddeder — yani tek bir kozmetik
           alan bütün ödemeyi düşürür. (12 Ağu 2026: uçlar kullanıcı ADINI
           gönderiyordu, her yükseltme 402 oluyordu.) Alan yokken Polar
           e-postayı kendi sayfasında sorar; akış durmaz. */
        if (isEmail(request.email())) {
            body.put("customer_email", request.email());
        }
        /* İndirim kodları KAPALI: Waydee'nin kuponu indirim değil "paket
           hediyesi"dir ve ödeme akışına hiç uğramaz. Polar'ın kendi indirim
           kutusunu açık bırakmak, bizim bilmediğimiz bir tutarın tahsil
           edilmesi demekti. */
        body.put("allow_discount_codes", false);
        /*
         * 🔴 SERBEST TUTAR (98. tur) — "mağazanı öne taşı" teklifleri.
         *
         * Üyelikte tutar ÜRÜNDEN gelir ve buraya hiçbir şey yazılmaz. Teklifte
         * ise fiyat kullanıcının yazdığı rakamdır; Polar'ın <i>pay what you
         * want</i> ürününde tahsil edilecek tutar oturumda gönderilir.
         *
         * ⚠️ Polar tutarı <b>en küçük para birimi biriminde</b> (kuruş/cent)
         * bekler: 250 TL → 25000. Lirayı doğrudan göndermek tahsilatı 100 kat
         * eksik yapardı — para söz konusuyken bu satırın yorumu kalmalı.
         *
         * ⚠️ Yalnız plansız (teklif) oturumlarda gönderilir: üyelik ürününe
         * `amount` yazmak, üründeki fiyatı sessizce ezme riski taşır.
         */
        if (request.plan() == null && request.amount() != null) {
            body.put("amount", request.amount()
                    .multiply(java.math.BigDecimal.valueOf(100))
                    .setScale(0, java.math.RoundingMode.HALF_UP)
                    .longValueExact());
        }

        Map<String, Object> response;
        try {
            response = restClient.post()
                    /* 🔴 SONDAKİ EĞİK ÇİZGİ ŞART (12 Ağu 2026'da ölçüldü):
                       `POST /v1/checkouts` → **307**, `/v1/checkouts/` → 201.
                       Java'nın varsayılan istemcisi POST'ta yönlendirmeyi
                       izlemez; eğik çizgi olmadan her ödeme sessizce
                       "Ödeme sayfası açılamadı" ile düşerdi. */
                    .uri("/v1/checkouts/")
                    .header("Authorization", "Bearer " + properties.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });
        } catch (Exception ex) {
            /* ⚠️ Gövde LOG'a yazılır ama kullanıcıya DÖNMEZ: Polar'ın doğrulama
               çıktısı ürün kimliklerini ve istek gövdesini içeriyor. Sebebi
               görmek için sunucu log'una bakılır — 12 Ağu'da bu satır olmasaydı
               "e-posta yerine kullanıcı adı" hatası tahminle aranacaktı. */
            log.error("Polar ödeme oturumu açılamadı ({}): {}", properties.baseUrl(), ex.getMessage());
            throw new ApiException(ErrorCode.PAYMENT_FAILED,
                    "Ödeme sayfası açılamadı, lütfen tekrar deneyin");
        }

        if (response == null) {
            throw new ApiException(ErrorCode.PAYMENT_FAILED, "Ödeme sağlayıcısı beklenmeyen yanıt döndü");
        }
        String url = (String) response.get("url");
        if (url == null || url.isBlank()) {
            throw new ApiException(ErrorCode.PAYMENT_FAILED, "Ödeme bağlantısı alınamadı");
        }
        return new HostedCheckout(url, String.valueOf(response.get("id")));
    }

    /** En az bir karakter + '@' + en az bir karakter. Polar'ın kabul ettiği asgari. */
    static boolean isEmail(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        int at = value.indexOf('@');
        return at > 0 && at < value.length() - 1;
    }

    /**
     * Dönüş adresine {@code ?checkout=<rezervasyon>} ekler.
     *
     * <p>Adreste zaten sorgu varsa {@code &} ile eklenir — kör bir {@code ?}
     * eklemek {@code PAYMENT_RETURN_URL} özelleştirilmiş kurulumlarda adresi
     * bozardı.
     */
    static String withCheckoutParam(String successUrl, String reservationId) {
        if (successUrl == null || successUrl.isBlank()) {
            return successUrl;
        }
        return successUrl + (successUrl.contains("?") ? "&" : "?") + "checkout=" + reservationId;
    }
}
