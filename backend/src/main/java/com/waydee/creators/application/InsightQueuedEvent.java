package com.waydee.creators.application;

import java.util.UUID;

/** Detaylı veri raporu sıraya alındı — koşucu bunu commit sonrası dinler (109. tur). */
public record InsightQueuedEvent(UUID insightId) {
}
