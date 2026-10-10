package com.waydee.creators;

import com.waydee.creators.application.CreatorModels.Filters;
import com.waydee.creators.application.CreatorModels.Momentum;
import com.waydee.creators.application.CreatorScorer;
import com.waydee.creators.domain.Platform;
import com.waydee.creators.domain.Signal;
import com.waydee.creators.domain.SizeTier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * <b>Şeffaf puanlamanın bekçisi</b> (108. tur).
 *
 * <p>🔴 {@link #istemciyleOrtakOrnek()} testi istemcideki
 * {@code features/creators/scoring.ts} dosyasının başında yazılı örnekle
 * <b>aynı sayıları</b> doğrular (→ 71,7). Ağırlıklı ortalama iki yerde yazılı
 * (sunucu ilk sıralama için, istemci radar sürüklenirken); ön yüzde test
 * koşucusu olmadığı için istemci tarafı tarayıcıda ölçüldü.
 */
class CreatorScorerTest {

    private final CreatorScorer scorer = new CreatorScorer();

    private Filters filters(List<SizeTier> tiers, String country, Integer budget) {
        return new Filters(List.of(Platform.INSTAGRAM), List.of(), List.of(), tiers, country, null, "ANY",
                null, false, budget, budget == null ? null : "TRY", false, 10);
    }

    @Test
    @DisplayName("🔴 Bütçe istendi, ücret hiç bilinmiyor → NPE değil, bilinmiyor (null)")
    void butceVarUcretYok() {
        Map<Signal, Double> s = scorer.signals(filters(List.of(), null, 15000), null, null, null, null,
                null, null, null, null, null, 70);
        assertTrue(s.containsKey(Signal.BUDGET));
        assertNull(s.get(Signal.BUDGET));
        Map<Signal, Double> onlyMax = scorer.signals(filters(List.of(), null, 15000), null, null, null, null,
                null, 9000.0, "TRY", null, null, 70);
        assertEquals(1.0, onlyMax.get(Signal.BUDGET));
    }

    @Test
    @DisplayName("İstenmeyen boyut sinyal listesinde YOK; istenen ama bilinmeyen NULL")
    void uygulanamazIleBilinmeyenAyriDir() {
        Map<Signal, Double> s = scorer.signals(filters(List.of(), "TR", null), null, null, null, null,
                null, null, null, null, null, 80);
        assertFalse(s.containsKey(Signal.AUDIENCE), "kademe seçilmedi → uygulanamaz");
        assertFalse(s.containsKey(Signal.BUDGET), "bütçe yok → uygulanamaz");
        assertTrue(s.containsKey(Signal.GEO));
        assertNull(s.get(Signal.GEO), "ülke istendi ama bilinmiyor → null");
        assertEquals(0.8, s.get(Signal.CONTENT_FIT));
    }

    @Test
    @DisplayName("🔴 İstemciyle ortak örnek — formül iki yerde aynı sonucu vermeli")
    void istemciyleOrtakOrnek() {
        Map<Signal, Double> signals = new EnumMap<>(Signal.class);
        signals.put(Signal.CONTENT_FIT, 0.9);
        signals.put(Signal.ENGAGEMENT, 0.6);
        signals.put(Signal.REACH, null);      // bilinmiyor → 0,5
        signals.put(Signal.MOMENTUM, 1.0);
        Map<Signal, Integer> weights = new EnumMap<>(Signal.class);
        weights.put(Signal.CONTENT_FIT, 20);
        weights.put(Signal.ENGAGEMENT, 25);
        weights.put(Signal.REACH, 10);
        weights.put(Signal.MOMENTUM, 5);
        // (20·0,9 + 25·0,6 + 10·0,5 + 5·1,0) / 60 = 43 / 60 = 0,71666… → 71,7
        assertEquals(71.7, scorer.score(signals, weights));
    }

    @Test
    @DisplayName("Sıfır ağırlıklı sinyal hesaba katılmaz; hepsi sıfırsa içerik uyumuna düşer")
    void sifirAgirlik() {
        Map<Signal, Double> signals = new EnumMap<>(Signal.class);
        signals.put(Signal.CONTENT_FIT, 0.4);
        signals.put(Signal.ENGAGEMENT, 1.0);
        Map<Signal, Integer> onlyFit = new EnumMap<>(Signal.class);
        onlyFit.put(Signal.CONTENT_FIT, 10);
        onlyFit.put(Signal.ENGAGEMENT, 0);
        assertEquals(40.0, scorer.score(signals, onlyFit));

        Map<Signal, Integer> none = new EnumMap<>(Signal.class);
        none.put(Signal.CONTENT_FIT, 0);
        none.put(Signal.ENGAGEMENT, 0);
        assertEquals(40.0, scorer.score(signals, none));
    }

    @Test
    @DisplayName("Etkileşim kademeye göre ölçülür: nano %5 → 0,5; mega %1,2 → 0,5")
    void etkilesimKademeyeGore() {
        Filters f = filters(List.of(), null, null);
        assertEquals(0.5, scorer.signals(f, 5_000L, 5.0, null, null, null, null, null, null, null, 50)
                .get(Signal.ENGAGEMENT));
        assertEquals(0.5, scorer.signals(f, 2_000_000L, 1.2, null, null, null, null, null, null, null, 50)
                .get(Signal.ENGAGEMENT));
    }

    @Test
    @DisplayName("⚠️ Bütçe: farklı para birimi karşılaştırılmaz (kur uydurulmaz)")
    void butceParaBirimi() {
        Filters f = filters(List.of(), null, 10_000);
        assertEquals(1.0, scorer.signals(f, null, null, null, null, 5_000.0, 8_000.0, "TRY", null, null, 50)
                .get(Signal.BUDGET));
        assertEquals(0.5, scorer.signals(f, null, null, null, null, 20_000.0, 20_000.0, "TRY", null, null, 50)
                .get(Signal.BUDGET));
        assertNull(scorer.signals(f, null, null, null, null, 100.0, 200.0, "USD", null, null, 50)
                .get(Signal.BUDGET));
    }

    @Test
    @DisplayName("Büyüme etiketi: veri yoksa UNKNOWN — 'istikrarlı' yazılmaz")
    void momentumEtiketi() {
        assertEquals(Momentum.VIRAL, scorer.momentum(35.0, null, null));
        assertEquals(Momentum.VIRAL, scorer.momentum(null, 30_000L, 10_000L));
        assertEquals(Momentum.EMERGING, scorer.momentum(12.0, null, null));
        assertEquals(Momentum.STEADY, scorer.momentum(2.0, null, null));
        assertEquals(Momentum.UNKNOWN, scorer.momentum(null, null, null));
    }

    @Test
    @DisplayName("Ağırlıklar temizlenir: 0–100, eksikler varsayılan, 'yükselenler' büyümeyi artırır")
    void agirlikTemizligi() {
        Map<Signal, Integer> raw = new EnumMap<>(Signal.class);
        raw.put(Signal.ENGAGEMENT, 500);
        raw.put(Signal.GEO, -3);
        Map<Signal, Integer> w = scorer.sanitizeWeights(raw, true);
        assertEquals(100, w.get(Signal.ENGAGEMENT));
        assertEquals(0, w.get(Signal.GEO));
        assertEquals(Signal.ENGAGEMENT.defaultWeight(), w.get(Signal.MOMENTUM));
        assertEquals(Signal.CONTENT_FIT.defaultWeight(), w.get(Signal.CONTENT_FIT));
        assertEquals(Signal.values().length, w.size());
    }
}
