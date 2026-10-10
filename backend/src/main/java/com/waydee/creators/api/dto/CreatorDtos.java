package com.waydee.creators.api.dto;

import com.waydee.creators.application.CreatorModels.Creator;
import com.waydee.creators.application.CreatorModels.Criteria;
import com.waydee.creators.application.CreatorModels.Dropped;
import com.waydee.creators.application.CreatorModels.Filters;
import com.waydee.creators.application.CreatorModels.Step;
import com.waydee.creators.domain.ContentFormat;
import com.waydee.creators.domain.CreatorCategory;
import com.waydee.creators.domain.Platform;
import com.waydee.creators.domain.Signal;
import com.waydee.creators.domain.SizeTier;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Influencer keşfi uçlarının sözleşmeleri (108. tur). */
public final class CreatorDtos {

    private CreatorDtos() {
    }

    /**
     * Arama isteği.
     *
     * <p>⚠️ Buradaki doğrulama ilk kapıdır; asıl normalleştirme
     * {@code CreatorSearchService.normalize} içindedir (ülke kodu ISO listesinde
     * mi, kademeler tekrarsız mı…). İstemci her zaman güvenilmez kabul edilir.
     */
    public record SearchRequest(
            @NotBlank(message = "Ne aradığını birkaç cümleyle yaz")
            @Size(min = 10, max = 1500, message = "Açıklama 10 ile 1500 karakter arasında olmalı")
            String brief,
            @NotEmpty(message = "En az bir platform seç")
            @Size(max = 6) List<Platform> platforms,
            @Size(max = 5, message = "En çok 5 kategori seçilebilir") List<CreatorCategory> categories,
            @Size(max = 5) List<ContentFormat> formats,
            @Size(max = 5) List<SizeTier> tiers,
            @Size(max = 2) String country,
            @Size(max = 2) String language,
            @Size(max = 8) String gender,
            Double minEngagementPct,
            Boolean emergingOnly,
            Integer budgetMax,
            @Size(max = 3) String currency,
            Boolean brandSafe,
            Integer resultCount,
            Map<Signal, Integer> weights,
            @Size(max = 8) String locale) {
    }

    public record WeightsRequest(Map<Signal, Integer> weights) {
    }

    /** Kullanıcı tarafı yapılandırma — fiyat ve kullanılabilirlik. */
    public record CreatorConfig(boolean available, int costSmall, int costLarge) {
    }

    public record SearchSummary(UUID id, String status, String brief, List<Platform> platforms, int resultCount,
                                int requestedCount, int cost, String errorCode, Instant createdAt,
                                Instant finishedAt) {
    }

    /**
     * Arama ayrıntısı — istemci süren aramayı saniyede bir bunu okur.
     *
     * @param errorCode başarısızlıkta istemcinin çevirdiği kod (bkz. {@code CreatorSearchRunner#errorCode})
     */
    public record SearchDetail(UUID id, String status, String brief, Filters filters, Map<Signal, Integer> weights,
                               Criteria criteria, List<Step> steps, List<Creator> results, List<Dropped> dropped,
                               int resultCount, int requestedCount, int cost, String errorCode,
                               Instant createdAt, Instant startedAt, Instant finishedAt) {
    }

    /**
     * Kısa listeye ekleme. ⚠️ İstemci üreticinin VERİSİNİ göndermez, yalnız
     * kimliğini: veri sunucuda aramanın anlık görüntüsünden kopyalanır. Aksi
     * hâlde kısa listeye istemcinin uydurduğu herhangi bir JSON yazılabilirdi.
     * ⚠️ {@code UUID} alanında {@code @NotNull} — {@code @NotBlank} yalnız metin
     * türlerinde geçerlidir ve burada ilk istekte 500 üretirdi.
     */
    public record ShortlistRequest(
            @NotNull UUID searchId,
            @NotBlank @Size(max = 160) String creatorId) {
    }

    public record NoteRequest(@Size(max = 500) String note) {
    }

    public record ShortlistItem(UUID id, Platform platform, String handle, Creator creator, String note,
                                UUID sourceSearchId, Instant createdAt) {
    }
}
