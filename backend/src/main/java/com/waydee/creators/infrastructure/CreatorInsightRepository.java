package com.waydee.creators.infrastructure;

import com.waydee.creators.domain.CreatorInsight;
import com.waydee.creators.domain.CreatorSearchStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreatorInsightRepository extends JpaRepository<CreatorInsight, UUID> {

    Optional<CreatorInsight> findFirstByShortlistIdAndUserIdOrderByCreatedAtDesc(UUID shortlistId, UUID userId);

    /** Son BAŞARILI rapor — yenileme sürerken ekran eskisini göstermeye devam eder. */
    Optional<CreatorInsight> findFirstByShortlistIdAndUserIdAndStatusOrderByCreatedAtDesc(
            UUID shortlistId, UUID userId, CreatorSearchStatus status);

    boolean existsByShortlistIdAndStatusIn(UUID shortlistId, Collection<CreatorSearchStatus> statuses);

    long countByUserIdAndCreatedAtAfter(UUID userId, Instant after);

    List<CreatorInsight> findByStatusInAndCreatedAtBefore(Collection<CreatorSearchStatus> statuses, Instant before);
}
