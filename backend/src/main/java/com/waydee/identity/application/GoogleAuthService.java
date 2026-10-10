package com.waydee.identity.application;

import com.waydee.common.audit.AuditRecorder;
import com.waydee.common.error.ApiException;
import com.waydee.common.error.ErrorCode;
import com.waydee.common.security.GoogleOAuthProperties;
import com.waydee.identity.api.dto.AuthDtos.TokenResponse;
import com.waydee.identity.domain.GoogleProfile;
import com.waydee.identity.domain.User;
import com.waydee.identity.domain.UserStatus;
import com.waydee.identity.domain.VerificationPurpose;
import com.waydee.identity.domain.VerificationToken;
import com.waydee.identity.infrastructure.GoogleOAuthClient;
import com.waydee.identity.infrastructure.UserRepository;
import com.waydee.identity.infrastructure.VerificationTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Google ile giriş / kayıt.
 *
 * <p>Tek bir uç yeterlidir: Google'dan dönen kişi bizde varsa <b>giriş</b>,
 * yoksa <b>kayıt</b> olur. Ayrı "Google ile kayıt" akışı yazmak kullanıcıya
 * hiçbir şey kazandırmaz — hangi düğmeye bastığını hatırlaması gerekirdi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@EnableConfigurationProperties(GoogleOAuthProperties.class)
public class GoogleAuthService {

    private final GoogleOAuthClient googleClient;
    private final GoogleOAuthProperties properties;
    private final UserRepository userRepository;
    private final VerificationTokenRepository tokenRepository;
    private final TokenService tokenService;
    private final AuditRecorder auditRecorder;
    private final SecureRandom random = new SecureRandom();

    public boolean isEnabled() {
        return googleClient.isConfigured();
    }

    /**
     * Google'dan dönen profili bir Waydee oturumuna çevirir.
     *
     * <p>Eşleme sırası ve gerekçeleri:
     * <ol>
     *   <li><b>{@code google_sub}</b> — birincil ve en güvenilir yol. Kullanıcı
     *       Google hesabının adresini değiştirse bile aynı hesaba düşer.</li>
     *   <li><b>E-posta</b> — daha önce şifreyle kayıt olmuş biri Google düğmesine
     *       basmıştır. ⚠️ Bağlama YALNIZ Google adresi <b>doğrulanmışsa</b>
     *       yapılır; aksi halde adresi kendisininmiş gibi gösteren bir Google
     *       hesabı mevcut bir Waydee hesabını ele geçirebilirdi.</li>
     *   <li>Hiçbiri yoksa <b>yeni hesap</b>.</li>
     * </ol>
     */
    @Transactional
    public TokenResponse completeLogin(String code, String ip, String userAgent) {
        GoogleProfile profile = googleClient.exchangeCode(code);

        Optional<User> bySub = userRepository.findByGoogleSub(profile.sub());
        User user;
        if (bySub.isPresent()) {
            user = bySub.get();
        } else {
            Optional<User> byEmail = userRepository.findByEmail(profile.email());
            if (byEmail.isPresent()) {
                if (!profile.emailVerified()) {
                    // Google adresi doğrulamamış → hesap devralma riski. Kapı burada kapanır.
                    auditRecorder.record(byEmail.get().getId(), byEmail.get().getUsername(),
                            "GOOGLE_LINK_DENIED", "USER", byEmail.get().getId().toString(),
                            Map.of("reason", "email_not_verified"), ip);
                    throw new ApiException(ErrorCode.FORBIDDEN,
                            "Google hesabının e-posta adresi doğrulanmamış");
                }
                user = byEmail.get();
                user.linkGoogle(profile.sub());
                auditRecorder.record(user.getId(), user.getUsername(), "GOOGLE_LINKED", "USER",
                        user.getId().toString(), Map.of("email", profile.email()), ip);
            } else {
                if (!profile.emailVerified()) {
                    throw new ApiException(ErrorCode.FORBIDDEN,
                            "Google hesabının e-posta adresi doğrulanmamış");
                }
                user = userRepository.save(User.fromGoogle(
                        uniqueUsername(profile.email()),
                        profile.email(),
                        displayNameFrom(profile),
                        profile.sub()));
                auditRecorder.record(user.getId(), user.getUsername(), "USER_REGISTERED", "USER",
                        user.getId().toString(), Map.of("provider", "google"), ip);
            }
        }

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, "Hesabınız askıya alınmış");
        }
        user.markLogin();
        auditRecorder.record(user.getId(), user.getUsername(), "LOGIN", "USER",
                user.getId().toString(), Map.of("provider", "google"), ip);
        return tokenService.issue(user, ip, userAgent);
    }

    // ------------------------------------------------------------------ bilet
    /**
     * Oturumu <b>tek kullanımlık bir bilete</b> saklar ve bileti döner.
     *
     * <p>⚠️ Neden: Google akışı bir yönlendirmeyle biter. Jetonları yönlendirme
     * adresine koymak onları adres çubuğuna, tarayıcı geçmişine, sunucu
     * loglarına ve {@code Referer} başlığına yazmak demektir. Bunun yerine
     * anlamsız, kısa ömürlü bir bilet taşınır; arayüz onu <b>POST</b> ile
     * jetona çevirir.
     */
    @Transactional
    public String issueTicket(UUID userId, String ip) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokenRepository.save(new VerificationToken(
                userId, hash(raw), VerificationPurpose.OAUTH_EXCHANGE, null,
                Instant.now().plus(properties.ticketTtl()), ip));
        return raw;
    }

    /** Bileti oturuma çevirir. Bilet tek kullanımlıktır ve amaç bazlıdır. */
    @Transactional
    public TokenResponse redeemTicket(String rawTicket, String ip, String userAgent) {
        VerificationToken ticket = tokenRepository.findByTokenHash(hash(rawTicket.trim()))
                .filter(t -> t.getPurpose() == VerificationPurpose.OAUTH_EXCHANGE)
                .filter(t -> t.isUsable(Instant.now()))
                .orElseThrow(() -> new ApiException(ErrorCode.VERIFICATION_TOKEN_INVALID,
                        "Giriş bağlantısı geçersiz ya da süresi dolmuş. Tekrar deneyin."));
        ticket.markUsed();
        User user = userRepository.findById(ticket.getUserId())
                .orElseThrow(() -> new ApiException(ErrorCode.VERIFICATION_TOKEN_INVALID,
                        "Giriş bağlantısı geçersiz"));
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, "Hesabınız askıya alınmış");
        }
        return tokenService.issue(user, ip, userAgent);
    }

    // ------------------------------------------------------------------ yardımcılar
    /**
     * E-posta yerel kısmından kullanılabilir bir kullanıcı adı üretir.
     *
     * <p>Kurallar kayıt formuyla aynı: yalnız {@code [a-z0-9_]}, 3–30 karakter.
     * Çakışırsa sonuna sayı eklenir.
     */
    private String uniqueUsername(String email) {
        String base = email.substring(0, email.indexOf('@'))
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9_]", "");
        if (base.length() < 3) {
            base = "waydee" + base;
        }
        if (base.length() > 24) {
            base = base.substring(0, 24);
        }
        if (!userRepository.existsByUsername(base)) {
            return base;
        }
        for (int i = 1; i < 1000; i++) {
            String candidate = base + i;
            if (!userRepository.existsByUsername(candidate)) {
                return candidate;
            }
        }
        // Pratikte ulaşılmaz; yine de sessizce patlamaktansa benzersiz bir ad üret.
        return base + Instant.now().toEpochMilli() % 100000;
    }

    private String displayNameFrom(GoogleProfile profile) {
        String name = profile.name() == null ? "" : profile.name().trim();
        if (name.isBlank()) {
            name = profile.email().substring(0, profile.email().indexOf('@'));
        }
        return name.length() > 60 ? name.substring(0, 60) : name;
    }

    private static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 yok", ex);
        }
    }
}
