package com.waydee.creators.infrastructure;

import com.waydee.creators.domain.CreatorSearch;
import com.waydee.creators.domain.CreatorSearchStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CreatorSearchRepository extends JpaRepository<CreatorSearch, UUID> {

    /**
     * 🔒 Sahiplik kapısı tek sorguda: başkasının aramasını kimliğini tahmin
     * ederek okumak mümkün olmamalı (IDOR). "Yok" ile "senin değil" aynı
     * cevabı alır — varlığı bile sızmasın.
     */
    Optional<CreatorSearch> findByIdAndUserId(UUID id, UUID userId);

    Page<CreatorSearch> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    long countByUserIdAndStatusIn(UUID userId, Collection<CreatorSearchStatus> statuses);

    long countByUserIdAndCreatedAtAfter(UUID userId, Instant since);

    /** Süpürücü: bu andan önce açılmış ve hâlâ bitmemiş aramalar. */
    List<CreatorSearch> findByStatusInAndCreatedAtBefore(Collection<CreatorSearchStatus> statuses, Instant before);

    // --------------------------------------------------------------- yönetim

    long countByCreatedAtAfter(Instant since);

    long countByStatusAndCreatedAtAfter(CreatorSearchStatus status, Instant since);

    /**
     * Sağlayıcı bazında tüketim — yönetim ekranının maliyet tablosu.
     * Satır: [sağlayıcı, arama sayısı, girdi token, çıktı token, web sorgusu].
     */
    @Query("""
            select s.provider, count(s), coalesce(sum(s.inputTokens), 0), coalesce(sum(s.outputTokens), 0),
                   coalesce(sum(s.webSearches), 0)
              from CreatorSearch s
             where s.createdAt >= :since and s.provider is not null
             group by s.provider
            """)
    List<Object[]> usageByProvider(@Param("since") Instant since);
}
