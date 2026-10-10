package com.waydee.creators.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.creators.application.CreatorModels.Step;
import com.waydee.creators.application.ai.ResearchProvider.Usage;
import com.waydee.creators.domain.CreatorSearch;
import com.waydee.creators.domain.CreatorSearchStatus;
import com.waydee.creators.infrastructure.CreatorSearchRepository;
import com.waydee.identity.application.CreditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * <b>Aramanın durum yazıları</b> — her biri kendi kısa transaction'ında (108. tur).
 *
 * <p>🔴 <b>Neden ayrı bir bean.</b> Koşucu dakikalarca süren ağ çağrıları yapar
 * ve bir transaction tutamaz. Bu yazmalar koşucunun içinde {@code @Transactional}
 * olarak dursaydı <b>kendi kendine çağrı</b> olurdu: Spring'in proxy'si devreye
 * girmez ve annotation hiçbir şey yapmazdı (vault'ta bu hata sınıfı üç kez
 * yaşandı: {@code WelcomeCreditGranter}, {@code CampaignWriter}…).
 *
 * <p>⚠️ Her yazma {@code REQUIRES_NEW}: adım ilerlemesi koşucunun sonunu
 * beklemeden <b>hemen</b> görünür olmalı — istemci saniyede bir okuyor.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CreatorSearchStore {

    private final CreatorSearchRepository repository;
    private final CreditService creditService;
    private final ObjectMapper objectMapper;

    /** Koşucunun ihtiyaç duyduğu değişmez alanlar. */
    public record Snapshot(UUID id, UUID userId, CreatorSearchStatus status, String brief, String filtersJson,
                           String weightsJson, String stepsJson, String locale, int cost) {
    }

    @Transactional(readOnly = true)
    public Snapshot snapshot(UUID id) {
        return repository.findById(id)
                .map(s -> new Snapshot(s.getId(), s.getUserId(), s.getStatus(), s.getBrief(), s.getFiltersJson(),
                        s.getWeightsJson(), s.getStepsJson(), s.getLocale(), s.getCost()))
                .orElse(null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean markRunning(UUID id, List<Step> steps) {
        CreatorSearch search = repository.findById(id).orElse(null);
        // ⚠️ Yalnız QUEUED'dan geçilir: süpürücü onu bu arada FAILED yaptıysa koşu başlamaz.
        if (search == null || search.getStatus() != CreatorSearchStatus.QUEUED) {
            return false;
        }
        search.markRunning(write(steps));
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateSteps(UUID id, List<Step> steps) {
        repository.findById(id).filter(s -> s.getStatus().isOpen()).ifPresent(s -> s.updateSteps(write(steps)));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordCriteria(UUID id, Object criteria) {
        repository.findById(id).ifPresent(s -> s.recordCriteria(write(criteria)));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void addUsage(UUID id, Usage usage, String providerLabel, String model) {
        repository.findById(id).ifPresent(s -> s.addUsage(usage.inputTokens(), usage.outputTokens(),
                usage.webSearches(), providerLabel, model));
    }

    /**
     * Başarıyla bitir.
     *
     * <p>🔴 <b>Sıfır sonuç = kredi iadesi.</b> Arama doğru koştu ama doğrulanabilir
     * tek bir üretici bulamadıysa kullanıcının eline hiçbir şey geçmedi; o
     * aramanın ücretini almak, kullanıcıyı "boşa para ödedim" hissiyle
     * bırakırdı. Durum yine SUCCEEDED (hata değil, dürüst bir boş sonuç).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void succeed(UUID id, Object results, int count, Object dropped, List<Step> steps) {
        CreatorSearch search = repository.findById(id).orElse(null);
        if (search == null || !search.getStatus().isOpen()) {
            return;
        }
        search.succeed(write(results), count, write(dropped), write(steps));
        if (count == 0) {
            creditService.refund(search.getUserId(), search.getCost(), "refund-creator:" + id, "Influencer keşfi — sonuç yok");
        }
    }

    /**
     * Başarısız bitir ve krediyi iade et — <b>tek seferlik</b>.
     *
     * <p>⚠️ Satır zaten kapanmışsa hiçbir şey yapmaz: koşucu ile süpürücü aynı
     * aramayı aynı anda kapatmaya çalışabilir. İade ayrıca defterde
     * {@code refund-creator:<id>} anahtarıyla tekildir (çift iade imkânsız).
     *
     * @param errorCode istemcinin beş dilde çevirdiği kod (ör. {@code PROVIDER_LIMIT})
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(UUID id, String errorCode, List<Step> steps) {
        CreatorSearch search = repository.findById(id).orElse(null);
        if (search == null || !search.getStatus().isOpen()) {
            return;
        }
        search.fail(errorCode, steps == null ? null : write(steps));
        creditService.refund(search.getUserId(), search.getCost(), "refund-creator:" + id, "Influencer keşfi başarısız");
        log.info("Influencer araması başarısız, kredi iade edildi: {} ({})", id, errorCode);
    }

    public List<Step> readSteps(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<List<Step>>() { });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Adım kaydı okunamadı", e);
        }
    }

    String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("JSON yazılamadı", e);
        }
    }
}
