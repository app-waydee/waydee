package com.waydee.creators.application;

import java.util.UUID;

/**
 * Arama sıraya alındı — koşucu bunu <b>commit sonrası</b> dinler (108. tur).
 *
 * <p>⚠️ Koşucu doğrudan çağrılmaz: transaction henüz commit edilmemişken arka
 * plan iş parçacığı satırı göremezdi, ve aynı sınıftan çağrılan bir
 * {@code @Async} metodu proxy'den geçmeyip senkron koşardı.
 */
public record CreatorSearchQueuedEvent(UUID searchId) {
}
