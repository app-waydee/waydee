package com.waydee.bootstrap;

import com.waydee.identity.domain.Role;
import com.waydee.identity.domain.User;
import com.waydee.identity.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * İlk açılışta yalnızca yönetici hesabını garanti eder.
 *
 * Eskiden burada zengin demo verisi (6 demo kullanıcı + satın alınmış alanlar +
 * profiller + gönderiler) üretiliyordu; bu veriler haritada önceden işaretli
 * bölgeler/noktalar olarak görünüyordu. Talep üzerine tamamen kaldırıldı:
 * temiz bir veritabanı sıfırdan ayağa kalktığında harita BOŞ açılmalı.
 * Sadece admin hesabı oluşturulur; içerik gerçek kullanıcı işlemleriyle birikir.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeedService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /** İlk yönetici şifresi ortamdan gelir; kaynak kodda şifre tutulmaz. */
    @Value("${waydee.seed.admin-password:}")
    private String adminPassword;

    @Transactional
    public void ensureAdmin() {
        if (userRepository.existsByUsername("admin")) {
            return;
        }
        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("ADMIN_INITIAL_PASSWORD tanımlı değil — yönetici hesabı oluşturulmadı");
            return;
        }
        userRepository.save(new User("admin", "admin@waydee.app",
                passwordEncoder.encode(adminPassword), "WAYDEE Yönetimi", Role.ADMIN));
        log.info("Admin kullanıcısı oluşturuldu: admin");
    }
}
