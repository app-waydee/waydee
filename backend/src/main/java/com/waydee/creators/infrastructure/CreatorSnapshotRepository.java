package com.waydee.creators.infrastructure;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.Repository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Takipçi anlık görüntüleri (V62). Entity yok: satır yalnız eklenir ve okunur;
 * günlük tekillik veritabanı indeksindedir ({@code ON CONFLICT DO NOTHING}).
 */
public interface CreatorSnapshotRepository extends Repository<com.waydee.creators.domain.CreatorShortlistEntry, UUID> {

    interface Point {
        Long getFollowers();

        Instant getCapturedAt();
    }

    @Modifying
    @Query(value = """
            INSERT INTO creator_snapshots (id, shortlist_id, followers, captured_at, captured_on)
            VALUES (gen_random_uuid(), :entryId, :followers, :at, :day)
            ON CONFLICT (shortlist_id, captured_on) DO UPDATE SET followers = EXCLUDED.followers,
                captured_at = EXCLUDED.captured_at
            """, nativeQuery = true)
    int upsert(@Param("entryId") UUID entryId, @Param("followers") long followers,
               @Param("at") Instant at, @Param("day") LocalDate day);

    @Query(value = """
            SELECT followers AS followers, captured_at AS capturedAt FROM creator_snapshots
            WHERE shortlist_id = :entryId ORDER BY captured_at
            """, nativeQuery = true)
    List<Point> series(@Param("entryId") UUID entryId);
}
