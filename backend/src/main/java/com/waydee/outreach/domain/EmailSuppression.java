package com.waydee.outreach.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

/**
 * <b>Bir daha gönderilmeyecek adres</b> (V60).
 *
 * <p>🔴 Bu liste tek bir kişiyi değil <b>bütün gönderimi</b> korur: "istemiyorum"
 * demiş ya da adresi sekmiş birine tekrar yazmak şikâyet oranını yükseltir ve
 * sağlayıcılar itibarı <b>alan adı</b> düzeyinde tutar. Yani bir kişiye
 * yapılan ısrar, sonraki bütün kampanyaların spam klasörüne düşmesine mal olur.
 *
 * <p>⚠️ Kayıt <b>silinebilir</b> (kişi geri dönmek isterse) ama bu bilinçli bir
 * yönetici kararıdır; gönderim akışı listeyi asla kendiliğinden temizlemez.
 */
@Entity
@Table(name = "email_suppressions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailSuppression {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "email", nullable = false, length = 320, updatable = false)
    private String email;

    @Column(name = "reason", nullable = false, length = 24)
    private String reason;

    @Column(name = "note", length = 300)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by")
    private UUID createdBy;

    public static EmailSuppression of(String email, String reason, String note, UUID by) {
        EmailSuppression s = new EmailSuppression();
        s.email = email;
        s.reason = reason;
        s.note = note;
        s.createdAt = Instant.now();
        s.createdBy = by;
        return s;
    }
}
