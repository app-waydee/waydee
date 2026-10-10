package com.waydee.outreach.infrastructure;

import com.waydee.outreach.domain.EmailTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, UUID> {

    /** Ad tekilliği veritabanında da var; bu sorgu okunabilir bir hata mesajı için. */
    Optional<EmailTemplate> findByNameIgnoreCase(String name);

    /**
     * Ad ya da konuda arama.
     *
     * <p>🔴 Arama boşsa {@code query} <b>boş dize</b> gelir, {@code null} değil —
     * ve JPQL'de {@code :query is null} dalı <b>yoktur</b>. Sebebi ölçüldü:
     * {@code null} bir String parametresini PostgreSQL {@code bytea} olarak
     * çıkarsıyor ve sorgu <b>{@code function lower(bytea) does not exist}</b>
     * ile 500 dönüyor. Derleme ve tip denetimi bunu göremez; yalnız gerçek bir
     * istek yakalar.
     *
     * <p>⚠️ Boş dize ile {@code like '%%'} tüm satırları getirir — {@code name}
     * ve {@code subject} zaten {@code NOT NULL}.
     */
    @Query("""
            select t from EmailTemplate t
            where lower(t.name) like lower(concat('%', :query, '%'))
               or lower(t.subject) like lower(concat('%', :query, '%'))
            order by t.updatedAt desc
            """)
    Page<EmailTemplate> search(@Param("query") String query, Pageable pageable);
}
