package com.waydee.identity.application;

import com.waydee.common.error.ApiException;
import com.waydee.common.error.ErrorCode;
import com.waydee.common.security.JwtProperties;
import com.waydee.common.security.JwtService;
import com.waydee.identity.api.dto.AuthDtos.TokenResponse;
import com.waydee.identity.api.dto.AuthDtos.UserResponse;
import com.waydee.identity.domain.RefreshToken;
import com.waydee.identity.domain.User;
import com.waydee.identity.infrastructure.RefreshTokenRepository;
import com.waydee.identity.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;

    @Transactional
    public TokenResponse issue(User user, String ip, String userAgent) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getUsername(), user.getRole().name());
        String rawRefreshToken = generateRawToken();
        refreshTokenRepository.save(new RefreshToken(
                user.getId(),
                hash(rawRefreshToken),
                Instant.now().plus(jwtProperties.refreshTokenTtl()),
                ip,
                userAgent));
        return new TokenResponse(accessToken, rawRefreshToken, jwtService.accessTokenTtlSeconds(),
                UserResponse.from(user));
    }

    /**
     * Refresh token rotasyonu: eski token iptal edilir, yenisi verilir.
     * İptal edilmiş bir token'ın tekrar kullanılması çalınma işaretidir —
     * kullanıcının tüm oturumları kapatılır.
     */
    @Transactional
    public TokenResponse rotate(String rawRefreshToken, String ip, String userAgent) {
        RefreshToken current = refreshTokenRepository.findByTokenHash(hash(rawRefreshToken))
                .orElseThrow(() -> new ApiException(ErrorCode.TOKEN_INVALID, "Geçersiz refresh token"));

        if (current.isRevoked()) {
            log.warn("İptal edilmiş refresh token tekrar kullanıldı — kullanıcı oturumları kapatılıyor: {}",
                    current.getUserId());
            refreshTokenRepository.revokeAllForUser(current.getUserId(), Instant.now());
            throw new ApiException(ErrorCode.TOKEN_INVALID, "Oturum güvenliği ihlali tespit edildi, yeniden giriş yapın");
        }
        if (current.isExpired()) {
            throw new ApiException(ErrorCode.TOKEN_EXPIRED, "Oturum süresi doldu, yeniden giriş yapın");
        }

        User user = userRepository.findById(current.getUserId())
                .orElseThrow(() -> new ApiException(ErrorCode.TOKEN_INVALID, "Kullanıcı bulunamadı"));
        if (!user.isActive()) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, "Hesabınız askıya alınmış");
        }

        String newRawToken = generateRawToken();
        RefreshToken replacement = refreshTokenRepository.save(new RefreshToken(
                user.getId(),
                hash(newRawToken),
                Instant.now().plus(jwtProperties.refreshTokenTtl()),
                ip,
                userAgent));
        current.revoke(replacement.getId());

        String accessToken = jwtService.generateAccessToken(user.getId(), user.getUsername(), user.getRole().name());
        return new TokenResponse(accessToken, newRawToken, jwtService.accessTokenTtlSeconds(),
                UserResponse.from(user));
    }

    @Transactional
    public void revoke(String rawRefreshToken) {
        refreshTokenRepository.findByTokenHash(hash(rawRefreshToken))
                .ifPresent(token -> token.revoke(null));
    }

    /** Kullanıcının tüm oturumlarını kapatır (şifre değişiminde çağrılır). */
    @Transactional
    public void revokeAllForUser(java.util.UUID userId) {
        refreshTokenRepository.revokeAllForUser(userId, Instant.now());
    }

    private String generateRawToken() {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 kullanılamıyor", ex);
        }
    }
}
