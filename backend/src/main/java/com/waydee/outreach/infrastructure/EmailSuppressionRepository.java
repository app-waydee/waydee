package com.waydee.outreach.infrastructure;

import com.waydee.outreach.domain.EmailSuppression;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EmailSuppressionRepository extends JpaRepository<EmailSuppression, UUID> {

    boolean existsByEmail(String email);

    /**
     * Yapıştırılan listedeki adreslerden bastırılmış olanlar.
     *
     * <p>⚠️ Adres <b>başına</b> sorgu atılmaz: 300 kişilik bir listede bu 300
     * gidiş-dönüş demekti. Tek {@code IN} sorgusu tüm kesişimi getirir.
     */
    @Query("select s.email from EmailSuppression s where s.email in :emails")
    List<String> findSuppressed(@Param("emails") Collection<String> emails);

    /** ⚠️ Boş arama {@code null} değil <b>boş dize</b> gelir — bkz. {@code EmailTemplateRepository.search}. */
    @Query("""
            select s from EmailSuppression s
            where lower(s.email) like lower(concat('%', :query, '%'))
            order by s.createdAt desc
            """)
    Page<EmailSuppression> search(@Param("query") String query, Pageable pageable);
}
