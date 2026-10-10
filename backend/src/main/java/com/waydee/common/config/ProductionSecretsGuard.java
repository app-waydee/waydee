package com.waydee.common.config;

import com.waydee.common.security.JwtProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Üretim profilinde geliştirme sırlarıyla açılışı engeller.
 * Sızmış varsayılan bir JWT anahtarıyla üretime çıkmak, tüm oturumların taklit edilebilmesi demektir.
 */
@Slf4j
@Configuration
@Profile("prod")
@RequiredArgsConstructor
public class ProductionSecretsGuard {

    private static final String DEV_SECRET_MARKER = "change-in-prod";
    /** Repo'daki tüm dev şifreleri bu imzayı taşır — üretimde asla görünmemeli. */
    private static final String DEV_PASSWORD_MARKER = "waydee_local_dev";
    private static final int MIN_SECRET_BYTES = 64;

    private final JwtProperties jwtProperties;

    @org.springframework.beans.factory.annotation.Value("${spring.datasource.password:}")
    private String dbPassword;

    @org.springframework.beans.factory.annotation.Value("${spring.data.redis.password:}")
    private String redisPassword;

    @org.springframework.beans.factory.annotation.Value("${waydee.storage.secret-key:}")
    private String storageSecret;

    @org.springframework.beans.factory.annotation.Value("${waydee.security.swagger-enabled:false}")
    private boolean swaggerEnabled;

    @org.springframework.beans.factory.annotation.Value("${waydee.mail.enabled:false}")
    private boolean mailEnabled;

    @org.springframework.beans.factory.annotation.Value("${spring.mail.password:}")
    private String mailPassword;

    @org.springframework.beans.factory.annotation.Value("${waydee.mail.base-url:}")
    private String mailBaseUrl;

    /* 🔴 Ödeme alanları GERİ KONDU (12 Ağu 2026): Polar'a geçildi ve gerçek
       tahsilat açıldı. 9-12 Ağu arasında akış her ortamda sahteydi ve bu
       kontroller kaldırılmıştı; artık eksik bir ürün kimliği ya da imzasız bir
       webhook, "ödendi" diyen herkese bedava üyelik demektir. */

    /* 🔴 17 Ağu 2026 — Google girişi açılırken yarım yapılandırma yakalanır. */
    @org.springframework.beans.factory.annotation.Value("${waydee.oauth.google.enabled:false}")
    private boolean googleEnabled;

    @org.springframework.beans.factory.annotation.Value("${waydee.oauth.google.client-id:}")
    private String googleClientId;

    @org.springframework.beans.factory.annotation.Value("${waydee.oauth.google.client-secret:}")
    private String googleClientSecret;

    @org.springframework.beans.factory.annotation.Value("${waydee.oauth.google.redirect-uri:}")
    private String googleRedirectUri;

    @org.springframework.beans.factory.annotation.Value("${waydee.payment.provider:mock}")
    private String paymentProvider;

    @org.springframework.beans.factory.annotation.Value("${waydee.payment.allow-mock:false}")
    private boolean paymentAllowMock;

    /* ⚠️ Polar ayarları tip yerine tek tek @Value ile okunuyor: `common`
       modülünün `payment` modülüne bağımlı olmaması gerekiyor (modüler
       monolith kuralı, [[02-mimari]]). Tersi olsaydı guard'ı yazmak için
       katmanlar arası bir bağımlılık icat etmiş olurduk. */
    @org.springframework.beans.factory.annotation.Value("${waydee.payment.polar.api-key:}")
    private String polarApiKey;

    @org.springframework.beans.factory.annotation.Value("${waydee.payment.polar.webhook-secret:}")
    private String polarWebhookSecret;

    @org.springframework.beans.factory.annotation.Value("${waydee.payment.polar.product-pro-monthly:}")
    private String polarProMonthly;

    @org.springframework.beans.factory.annotation.Value("${waydee.payment.polar.product-pro-yearly:}")
    private String polarProYearly;

    @org.springframework.beans.factory.annotation.Value("${waydee.payment.polar.product-premium-monthly:}")
    private String polarPremiumMonthly;

    @org.springframework.beans.factory.annotation.Value("${waydee.payment.polar.product-premium-yearly:}")
    private String polarPremiumYearly;

    @PostConstruct
    void verify() {
        String secret = jwtProperties.secret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET tanımlı değil");
        }
        byte[] decoded;
        try {
            decoded = java.util.Base64.getDecoder().decode(secret);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("JWT_SECRET geçerli Base64 olmalı", ex);
        }
        if (new String(decoded).contains(DEV_SECRET_MARKER)) {
            throw new IllegalStateException("Üretimde geliştirme JWT anahtarı kullanılamaz");
        }
        if (decoded.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("JWT_SECRET en az %d bayt olmalı".formatted(MIN_SECRET_BYTES));
        }
        // Yalnız JWT değil: DB/Redis/MinIO şifreleri de dev varsayılanıyla açılamaz.
        requireNonDevPassword("DB_PASSWORD", dbPassword);
        requireNonDevPassword("REDIS_PASSWORD", redisPassword);
        requireNonDevPassword("MINIO_SECRET_KEY", storageSecret);
        if (swaggerEnabled) {
            throw new IllegalStateException("Üretimde Swagger açık bırakılamaz (SWAGGER_ENABLED=false yapın)");
        }
        // E-posta doğrulama üretimde çalışmak ZORUNDA: kapalı kalırsa kimse
        // hesabını doğrulayamaz ve şifresini unutan kurtarılamaz.
        if (!mailEnabled) {
            throw new IllegalStateException("Üretimde e-posta gönderimi kapalı olamaz (MAIL_ENABLED=true yapın)");
        }
        if (mailPassword == null || mailPassword.isBlank()) {
            throw new IllegalStateException("MAIL_PASSWORD tanımlı değil (SMTP uygulama şifresi)");
        }
        // localhost'a giden doğrulama bağlantısı kullanıcıya ulaşmaz.
        if (mailBaseUrl == null || mailBaseUrl.contains("localhost") || mailBaseUrl.startsWith("http://")) {
            throw new IllegalStateException(
                    "APP_BASE_URL üretimde gerçek https alan adı olmalı (doğrulama bağlantıları buradan kurulur)");
        }
        /* 🔴 9 Ağu 2026 — ÖDEME AKIŞI HER ORTAMDA SAHTE (kullanıcı kararı).
           `PaymentProviderResolver.active()` artık koşulsuz mock döndürüyor:
           gerçek tahsilat yapılmıyor, kullanıcı uygulama içindeki onay
           ekranından geçiyor. Bu yüzden buradaki "üretimde sahte ödeme
           kullanılamaz" kapısı da KALDIRILDI — açılışı engelleseydi uygulama
           üretimde hiç kalkmazdı.
           ⚠️ Sessiz kalınmıyor: her açılışta uyarı loglanır. Gerçek tahsilata
           dönmek `PaymentProviderResolver` içindeki tek satırlık değişikliktir
           ve o gün bu kapı da geri konmalıdır. */
        verifyPayment();
        verifyGoogle();
    }

    /**
     * Ödeme yapılandırması üretimde <b>eksiksiz</b> olmalı.
     *
     * <p>Eksikliğin açılışta görülmesi, satın alma anında görülmesinden iyidir:
     * kullanıcı ödeme sayfası yerine hata alsaydı bunu bize kimse bildirmezdi.
     */
    private void verifyPayment() {
        boolean polar = "polar".equalsIgnoreCase(paymentProvider)
                || "lemonsqueezy".equalsIgnoreCase(paymentProvider);
        if (!polar) {
            if (!paymentAllowMock) {
                throw new IllegalStateException(
                        "Üretimde sahte ödeme kullanılamaz (PAYMENT_PROVIDER=polar yapın). "
                                + "Bilerek istiyorsanız PAYMENT_ALLOW_MOCK=true.");
            }
            log.warn("""
                    ⚠️  ÖDEME AKIŞI SAHTE — GERÇEK TAHSİLAT YAPILMIYOR (PAYMENT_ALLOW_MOCK=true).
                        Üyelikler uygulama içindeki onay ekranından yükseltiliyor.""");
            return;
        }
        requirePayment("POLAR_API_KEY", polarApiKey);
        /* İmzasız webhook = "ödendi" diyen herkese bedava üyelik. Sır yoksa
           alıcı zaten fail-closed davranır ama o durumda HİÇBİR ödeme işlenmez;
           bunu açılışta söylemek, sessizce çalışmayan bir tahsilattan iyidir. */
        requirePayment("POLAR_WEBHOOK_SECRET", polarWebhookSecret);
        // Dördü de aranır: eksik hücreyi satın almak isteyen kullanıcı hata görürdü.
        requirePayment("POLAR_PRODUCT_PRO_MONTHLY", polarProMonthly);
        requirePayment("POLAR_PRODUCT_PRO_YEARLY", polarProYearly);
        requirePayment("POLAR_PRODUCT_PREMIUM_MONTHLY", polarPremiumMonthly);
        requirePayment("POLAR_PRODUCT_PREMIUM_YEARLY", polarPremiumYearly);
        log.info("💳 Ödeme sağlayıcısı: POLAR — gerçek tahsilat açık.");
    }

    /**
     * <b>Google girişi açıksa yapılandırma eksiksiz VE tutarlı olmalı.</b>
     *
     * <p>🔴 Vault [[16-google-giris]] madde 5 — açılışta yakalanmayan bir
     * uyumsuzluk kullanıcıya <b>Google'ın hata sayfası</b> olarak görünür
     * ({@code redirect_uri_mismatch}) ve bunu bize kimse bildirmez.
     *
     * <p>⚠️ Alan adı karşılaştırması ŞART: {@code GOOGLE_REDIRECT_URI} Google
     * Console'a girilen değerle <b>birebir</b> aynı olmalı ve bizim alan
     * adımıza işaret etmeli. Alan adı taşındığında (72. turda {@code
     * app.waydee.com} → {@code waydee.com} olurken tam bu tür bir satır
     * atlanmıştı) bu kontrol açılışta uyarır.
     */
    private void verifyGoogle() {
        if (!googleEnabled) {
            log.info("Google ile giriş KAPALI (GOOGLE_OAUTH_ENABLED=false) — uçlar 404 döner.");
            return;
        }
        requireGoogle("GOOGLE_CLIENT_ID", googleClientId);
        requireGoogle("GOOGLE_CLIENT_SECRET", googleClientSecret);
        requireGoogle("GOOGLE_REDIRECT_URI", googleRedirectUri);
        if (!googleRedirectUri.startsWith("https://")) {
            throw new IllegalStateException(
                    "GOOGLE_REDIRECT_URI üretimde https olmalı: " + googleRedirectUri);
        }
        if (!googleRedirectUri.endsWith("/api/v1/auth/google/callback")) {
            throw new IllegalStateException(
                    "GOOGLE_REDIRECT_URI '/api/v1/auth/google/callback' ile bitmeli — "
                            + "Google Console'daki değerle BİREBİR aynı olmalı: " + googleRedirectUri);
        }
        // Yönlendirme adresi ile arayüz kökü aynı kayıtlı alan adında olmalı.
        String redirectHost = hostOf(googleRedirectUri);
        String appHost = hostOf(mailBaseUrl);
        if (redirectHost != null && appHost != null && !sameSite(redirectHost, appHost)) {
            throw new IllegalStateException(
                    "GOOGLE_REDIRECT_URI (%s) ile APP_BASE_URL (%s) farklı alan adlarında — akış geri dönemez"
                            .formatted(redirectHost, appHost));
        }
        log.info("🔑 Google ile giriş AÇIK — yönlendirme: {}", googleRedirectUri);
    }

    private static String hostOf(String url) {
        try {
            return java.net.URI.create(url).getHost();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    /** {@code api.waydee.com} ile {@code waydee.com} aynı siteyi sayılır. */
    private static boolean sameSite(String a, String b) {
        return registrable(a).equals(registrable(b));
    }

    private static String registrable(String host) {
        String[] parts = host.split("\\.");
        return parts.length <= 2 ? host
                : parts[parts.length - 2] + "." + parts[parts.length - 1];
    }

    private static void requireGoogle(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    name + " tanımlı değil — GOOGLE_OAUTH_ENABLED=true iken zorunludur");
        }
    }

    private static void requirePayment(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    name + " tanımlı değil — Polar ile gerçek tahsilat yapılamaz");
        }
    }

    private void requireNonDevPassword(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " tanımlı değil");
        }
        if (value.contains(DEV_PASSWORD_MARKER)) {
            throw new IllegalStateException("Üretimde geliştirme şifresi kullanılamaz: " + name);
        }
    }
}
