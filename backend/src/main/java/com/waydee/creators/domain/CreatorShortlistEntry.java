package com.waydee.creators.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * <b>Kısa listedeki bir içerik üreticisi</b> (V61, 108. tur).
 *
 * <p>🔴 Aday aramadan <b>kopyalanır</b> ({@code dataJson}); aramaya yalnız gevşek
 * bağlıdır. Arama silinse ya da yeni bir arama aynı kişiyi farklı sayılarla
 * getirse de kullanıcının kaydettiği kişi ve notu olduğu gibi kalır.
 */
@Entity
@Table(name = "creator_shortlist")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CreatorShortlistEntry {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 16, updatable = false)
    private Platform platform;

    /** Küçük harfli, {@code @}'sız — tekillik buna dayanır. */
    @Column(name = "handle", nullable = false, length = 120, updatable = false)
    private String handle;

    @Column(name = "data_json", nullable = false, columnDefinition = "text")
    private String dataJson;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "source_search_id")
    private UUID sourceSearchId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public CreatorShortlistEntry(UUID userId, Platform platform, String handle, String dataJson, UUID sourceSearchId) {
        this.userId = userId;
        this.platform = platform;
        this.handle = normalizeHandle(handle);
        this.dataJson = dataJson;
        this.sourceSearchId = sourceSearchId;
        this.createdAt = Instant.now();
    }

    public void updateNote(String note) {
        String trimmed = note == null ? null : note.strip();
        this.note = trimmed == null || trimmed.isEmpty() ? null
                : trimmed.substring(0, Math.min(trimmed.length(), 500));
    }

    public static String normalizeHandle(String handle) {
        String h = handle == null ? "" : handle.strip();
        while (h.startsWith("@")) {
            h = h.substring(1);
        }
        return h.toLowerCase(Locale.ROOT);
    }
}
