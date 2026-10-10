package com.waydee.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.common.error.ApiError;
import com.waydee.common.error.ErrorCode;
import com.waydee.common.ratelimit.RateLimitFilter;
import com.waydee.common.security.JwtAuthenticationFilter;
import com.waydee.common.security.JwtProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Varsayılan duruş: her şey kapalı.
 * Yalnızca kimlik uçları, WebSocket el sıkışması ve sağlık kontrolü kimliksiz erişilebilir;
 * diğer tüm /api/v1/** uçları geçerli JWT ister, /api/v1/admin/** ayrıca ADMIN rolü ister.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableJpaAuditing(auditorAwareRef = "securityAuditorAware")
@EnableConfigurationProperties(JwtProperties.class)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitFilter rateLimitFilter;
    private final ObjectMapper objectMapper;

    @Value("${waydee.security.cors.allowed-origins}")
    private List<String> allowedOrigins;

    @Value("${waydee.security.swagger-enabled:false}")
    private boolean swaggerEnabled;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless JWT API: oturum çerezi yok, dolayısıyla CSRF yüzeyi de yok.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"))
                        .frameOptions(frame -> frame.deny())
                        .referrerPolicy(rp -> rp.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000))
                        .permissionsPolicyHeader(pp -> pp.policy("geolocation=(self), camera=(), microphone=()")))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.POST,
                            "/api/v1/auth/register",
                            "/api/v1/auth/login",
                            "/api/v1/auth/admin/login",
                            "/api/v1/auth/refresh",
                            "/api/v1/auth/logout",
                            // E-posta akışları oturum İSTEMEZ: doğrulama bağlantısına
                            // farklı bir cihazdan tıklanabilir, şifresini unutan da
                            // zaten giriş yapamaz. Yetki jetonun kendisindedir.
                            "/api/v1/auth/verify-email",
                            "/api/v1/auth/resend-verification",
                            "/api/v1/auth/forgot-password",
                            "/api/v1/auth/reset-password").permitAll();
                    // Google ile giriş: akış tarayıcı yönlendirmesiyle yürür, dolayısıyla
                    // hiçbir adımında Authorization başlığı taşınamaz. Güvenlik
                    // yerine imzalı `state` (CSRF) + Google'ın kendi onayı +
                    // tek kullanımlık takas bileti ile sağlanır (GoogleAuthController).
                    auth.requestMatchers(HttpMethod.GET,
                            "/api/v1/auth/google/start",
                            "/api/v1/auth/google/callback").permitAll();
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/auth/google/exchange").permitAll();
                    // Ödeme sağlayıcısı bildirimi: JWT taşıyamaz, ama imzasız kabul
                    // EDİLMEZ — gövde HMAC-SHA256 ile doğrulanır (PaymentWebhookController).
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/webhooks/**").permitAll();
                    // STOMP el sıkışması; abonelik sonrası yayınlar yalnızca genel harita olaylarıdır.
                    auth.requestMatchers("/ws/**").permitAll();
                    // Görsel okuma: <img> başlık taşıyamadığı için yetki, bağlantıdaki
                    // kısa ömürlü HMAC imzasıyla doğrulanır (MediaController).
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/media/*").permitAll();
                    auth.requestMatchers("/actuator/health", "/actuator/health/**").permitAll();
                    // İstemci yapılandırması: yalnız Mapbox **genel** anahtarı döner.
                    // Vitrin haritası oturumsuz açıldığı için kimliksiz olmak zorunda;
                    // gizli (sk.) anahtar servis tarafından zaten reddedilir.
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/config").permitAll();
                    // Vitrin (landing): SADECE okuma. Ziyaretçi haritada gezer ve
                    // yalnız AÇIK hesapların profillerini görür; gizli hesaplar
                    // PublicViewController'da maskelenir/403 olur. Yazma ucu yoktur.
                    // Turnstile açıkken bu uçlar ayrıca ziyaretçi geçişi ister.
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/public/**").permitAll();
                    // Vitrin kapısı: Turnstile jetonunu geçişe çeviren tek POST.
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/public/verify").permitAll();
                    /*
                     * 🔴 Etiket GÖSTERİMİ ziyaretçiden gelir (vitrin herkese açık),
                     * dolayısıyla oturum istemez. Rapor OKUMA ise istemeye devam
                     * eder ve yalnız gönderinin sahibine açılır
                     * (`PostTagStatsService.forPost` → 403).
                     *
                     * ⚠️ Bu uç yalnız SAYAÇ artırır; hiçbir veri döndürmez (204).
                     * Kötüye kullanımda en fazla kendi istatistiği şişer —
                     * bu yüzden kimlik istemek, ölçümü kaybetmeye değmez.
                     * ⚠️ Etiketlerin gerçekten o gönderiye ait olduğu serviste
                     * doğrulanır; rastgele kimliklerle başkasının sayacı şişirilemez.
                     */
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/posts/*/tag-impressions").permitAll();
                    /*
                     * Etiket TIKLAMASI da ziyaretçiden gelir: paylaşılan bir
                     * fotoğrafı açan kişinin oturumu yoktur. Kimlik istemek,
                     * ölçülmek istenen tıklamaların çoğunu kaybetmek demekti.
                     * ⚠️ Bu uç da yalnız sayaç artırır ve 204 döner.
                     */
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/posts/*/tags/*/click").permitAll();
                    /*
                     * 🔴 16 Ağu 2026 (V46) — PROFİL BAĞLANTISI TIKLAMASI.
                     *
                     * <b>Ölçülerek yakalandı:</b> uç {@code /api/v1/public/**}
                     * altında olmasına rağmen anonim istek <b>401</b> alıyordu.
                     * Sebep yukarıdaki kural: {@code /api/v1/public/**} yalnız
                     * <b>GET</b> için açık. Bu satır olmadan ölçüm, ziyaretçi
                     * tıklamalarının <b>tamamını</b> kaybederdi — yani tam da
                     * ölçülmek istenen kitleyi (vitrini gezenlerin çoğu oturum
                     * açmaz) ve hata sessiz olurdu: rapor çalışır görünüp
                     * yalnız sahibinin kendi tıklamalarını sayardı.
                     *
                     * ⚠️ Kimlik <b>istenmez ama OKUNUR</b>: istek JWT taşıyorsa
                     * tıklayan kişi kaydedilir ("gerçek user bilgisi"), yoksa
                     * isimsiz ziyaretçi olarak sayılır.
                     * ⚠️ Uç yalnız sayaç artırır ve 204 döner; şişirmeye karşı
                     * koruma serviste (aynı ziyaretçi + aynı bağlantı için
                     * 60 saniyelik tekrar bastırma).
                     */
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/public/links/*/click").permitAll();
                    if (swaggerEnabled) {
                        auth.requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll();
                    }
                    auth.requestMatchers("/api/v1/admin/**").hasRole("ADMIN");
                    auth.anyRequest().authenticated();
                })
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(401);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(response.getWriter(),
                                    ApiError.of(ErrorCode.UNAUTHORIZED, "Kimlik doğrulaması gerekli", request.getRequestURI()));
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(403);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(response.getWriter(),
                                    ApiError.of(ErrorCode.FORBIDDEN, "Bu işlem için yetkiniz yok", request.getRequestURI()));
                        }))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(rateLimitFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Joker yok: yalnızca bilinen kullanıcı ve admin uygulaması origin'leri.
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        // X-Waydee-Pass: vitrin ziyaretçi geçişi (bkz. PublicViewController.PASS_HEADER).
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "X-Waydee-Pass"));
        config.setExposedHeaders(List.of("Location"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        source.registerCorsConfiguration("/ws/**", config);
        return source;
    }

    /**
     * BCrypt maliyeti <b>10</b> (kütüphane varsayılanı).
     *
     * <p>🔴 Eskiden 12'ydi. Her artış CPU'yu <b>ikiye katlar</b>: 12 → 10, bir
     * girişin doğrulama maliyetini <b>4'te 1'e</b> indirir. 1 vCPU'luk tek
     * Fargate task'ında ölçülen tavan ~3 giriş/sn idi; 5.000 kişilik ani giriş
     * sıçraması 200 Tomcat thread'ini BCrypt'te bloke edip
     * {@code /actuator/health}'i de aç bırakıyor, ECS tek task'ı öldürüyordu.
     *
     * <p>⚠️ <b>Mevcut şifreler bozulmaz.</b> Maliyet, hash'in kendi içinde
     * yazılıdır ({@code $2a$12$...}); eski hash'ler 12 ile doğrulanmaya devam
     * eder, yalnız yeni ve değiştirilen şifreler 10 ile üretilir. Migration
     * gerekmez.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }
}
