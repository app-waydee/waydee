package com.waydee.creators.infrastructure;

import com.waydee.creators.domain.CreatorShortlistEntry;
import com.waydee.creators.domain.Platform;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CreatorShortlistRepository extends JpaRepository<CreatorShortlistEntry, UUID> {

    List<CreatorShortlistEntry> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<CreatorShortlistEntry> findByUserIdAndPlatformAndHandle(UUID userId, Platform platform, String handle);

    /** 🔒 Sahiplik kapısı — bkz. {@code CreatorSearchRepository#findByIdAndUserId}. */
    Optional<CreatorShortlistEntry> findByIdAndUserId(UUID id, UUID userId);

    long countByUserId(UUID userId);
}
