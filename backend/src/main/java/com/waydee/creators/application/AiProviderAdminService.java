package com.waydee.creators.application;

import com.waydee.common.ai.AiProvider;
import com.waydee.common.ai.AiProviderSettings;
import com.waydee.creators.application.ai.ProviderException;
import com.waydee.creators.application.ai.ResearchGateway;
import com.waydee.creators.domain.CreatorSearchStatus;
import com.waydee.creators.infrastructure.CreatorSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * <b>Yönetim · yapay zekâ sağlayıcıları</b> (108. tur): anahtar, model,
 * öncelik, fiyat ve son 30 günün tüketimi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiProviderAdminService {

    private final AiProviderSettings settings;
    private final ResearchGateway gateway;
    private final CreatorSearchRepository searches;

    /** Sağlayıcı bazında tüketim satırı. */
    public record ProviderUsage(String provider, long searches, long inputTokens, long outputTokens,
                                long webSearches) {
    }

    public record Stats(int days, long total, long succeeded, long failed, List<ProviderUsage> byProvider) {
    }

    public record Overview(AiProviderSettings.AdminView settings, Stats stats) {
    }

    /** Test sonucu — {@code kind} başarısızlıkta sınıflandırılmış sebep. */
    public record TestResult(boolean ok, String kind, String message, long durationMs) {
    }

    @Transactional(readOnly = true)
    public Overview overview() {
        Instant since = Instant.now().minus(Duration.ofDays(30));
        List<ProviderUsage> usage = searches.usageByProvider(since).stream()
                .map(r -> new ProviderUsage(String.valueOf(r[0]), ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue(), ((Number) r[3]).longValue(), ((Number) r[4]).longValue()))
                .toList();
        Stats stats = new Stats(30, searches.countByCreatedAtAfter(since),
                searches.countByStatusAndCreatedAtAfter(CreatorSearchStatus.SUCCEEDED, since),
                searches.countByStatusAndCreatedAtAfter(CreatorSearchStatus.FAILED, since), usage);
        return new Overview(settings.adminView(), stats);
    }

    /**
     * Bağlantı testi — <b>gerçek bir istek</b>.
     *
     * <p>⚠️ Ham sağlayıcı mesajı yönetim ekranında gösterilir (kullanıcı
     * ekranında değil): yönetici "model bulunamadı" ile "anahtar geçersiz"
     * arasındaki farkı görmeli. Mesaj zaten kısaltılmış ve anahtar içermiyor.
     */
    public TestResult test(AiProvider provider) {
        long start = System.currentTimeMillis();
        try {
            gateway.ping(provider);
            return new TestResult(true, null, null, System.currentTimeMillis() - start);
        } catch (ProviderException e) {
            return new TestResult(false, e.kind().name(), e.getMessage(), System.currentTimeMillis() - start);
        } catch (RuntimeException e) {
            log.warn("{} bağlantı testinde beklenmeyen hata", provider.label(), e);
            return new TestResult(false, ProviderException.Kind.UNAVAILABLE.name(),
                    e.getClass().getSimpleName(), System.currentTimeMillis() - start);
        }
    }
}
