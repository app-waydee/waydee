package com.waydee.creators.application;

import com.waydee.creators.domain.CreatorSearch;
import com.waydee.creators.domain.CreatorSearchStatus;
import com.waydee.creators.infrastructure.CreatorSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;

/**
 * <b>Takılı kalan aramaları kapatır ve krediyi iade eder</b> (108. tur).
 *
 * <p>Stüdyonun {@code AiGenerationSweeper}'ıyla aynı gerekçe: koşucunun
 * {@code catch}'i yalnız <b>başlayan</b> bir aramayı kurtarabilir. Havuz
 * kuyruğu dolup arama reddedilirse ya da dağıtımda süreç yeniden başlarsa
 * (kuyruk bellekte) arama hiç başlamaz ve kredi karşılıksız kalırdı.
 *
 * <p>⚠️ Eşik ({@value #STUCK_MINUTES} dk) bilinçli olarak geniş: tek bir
 * araştırma çağrısının zaman aşımı 8–10 dakika ve devam turları var. Eşik
 * dar olsaydı, hâlâ koşan bir arama "başarısız" ilan edilir ve kullanıcı hem
 * krediyi hem sonucu alırdı.
 *
 * <p>⚠️ Açılışta toplu kapatma <b>yok</b>: üretimde birden çok örnek koşabilir
 * ve açılan bir örnek, diğerinde gerçekten süren bir aramayı öldürürdü.
 * Her örnekte koşmak güvenli — iade {@code refund-creator:<id>} ile tekildir.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CreatorSearchSweeper {

    public static final int STUCK_MINUTES = 30;

    private final CreatorSearchRepository repository;
    private final CreatorSearchStore store;
    private final com.waydee.creators.infrastructure.CreatorInsightRepository insights;
    private final InsightStore insightStore;

    @Scheduled(fixedDelay = 5 * 60 * 1000L, initialDelay = 3 * 60 * 1000L)
    public void sweep() {
        List<CreatorSearch> stuck = repository.findByStatusInAndCreatedAtBefore(
                EnumSet.of(CreatorSearchStatus.QUEUED, CreatorSearchStatus.RUNNING),
                Instant.now().minus(Duration.ofMinutes(STUCK_MINUTES)));
        // Detaylı veri raporu kısa bir araştırma: 15 dakikada bitmediyse takılmıştır.
        insights.findByStatusInAndCreatedAtBefore(EnumSet.of(CreatorSearchStatus.QUEUED, CreatorSearchStatus.RUNNING),
                        Instant.now().minus(Duration.ofMinutes(15)))
                .forEach(i -> insightStore.fail(i.getId(), "TIMEOUT"));
        if (stuck.isEmpty()) {
            return;
        }
        log.warn("{} takılı influencer araması kapatılıyor (kredi iade ediliyor)", stuck.size());
        stuck.forEach(s -> store.fail(s.getId(), "TIMEOUT", null));
    }
}
