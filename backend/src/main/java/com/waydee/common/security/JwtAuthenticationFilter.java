package com.waydee.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.waydee.common.logging.RequestLogFilter;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * JWT'yi doğrular ve oturumu kurar.
 *
 * <h3>🔴 Ayrıca kullanıcı kimliğini MDC'ye yazar — ve bunun sebebi önemli</h3>
 * <p>20 Ağu 2026'da ölçüldü: erişim logu satırlarında {@code requestId} ve
 * {@code ip} vardı ama <b>{@code userId} HİÇ YOKTU</b>, oturum açmış
 * kullanıcıda bile.
 *
 * <p><b>Kök neden:</b> {@code RequestLogFilter} Spring Security zincirinin
 * <b>DIŞINDA</b> duruyor (en yüksek öncelik) ve satırını isteğin
 * <b>sonunda</b> yazıyor. Spring Security'nin {@code SecurityContextHolderFilter}
 * ise {@code SecurityContextHolder}'ı <b>kendi {@code finally}'sinde
 * temizler</b> — ve o {@code finally}, dış filtrenin {@code finally}'sinden
 * <b>ÖNCE</b> koşar. Yani log satırı yazılırken oturum bağlamı çoktan
 * boşaltılmış oluyordu: {@code getAuthentication()} her seferinde {@code null}.
 *
 * <p><b>Çözüm:</b> kimliği <b>doğrulandığı anda</b>, yani zincirin
 * <b>içinde</b> MDC'ye koymak. MDC iş parçacığına bağlıdır ve dış filtrenin
 * {@code finally}'sine kadar yaşar; oradaki temizlik onu yine siler.
 *
 * <p>⚠️ Bu, güvenlik filtresine bir günlükleme sorumluluğu ekler. Kabul
 * edildi çünkü alternatif — bağlamı kopyalayıp taşıyan ek bir filtre —
 * aynı bağımlılığı <b>daha dolaylı</b> biçimde kurardı. Temizlik yine tek
 * yerde: {@code RequestLogFilter}.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            jwtService.parse(header.substring(BEARER_PREFIX.length())).ifPresent(user -> {
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.role()));
                var authentication = new UsernamePasswordAuthenticationToken(user, null, authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
                /* 🔴 Kimlik BURADA MDC'ye girer (gerekçe sınıf notunda).
                   Temizliği RequestLogFilter'ın `finally`si yapar — iki yerde
                   temizlemek, birinin unutulmasıyla sızıntıya döner. */
                MDC.put(RequestLogFilter.MDC_USER_ID, user.id().toString());
            });
        }
        filterChain.doFilter(request, response);
    }
}
