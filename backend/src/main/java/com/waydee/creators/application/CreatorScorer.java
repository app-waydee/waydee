package com.waydee.creators.application;

import com.waydee.creators.application.CreatorModels.Filters;
import com.waydee.creators.application.CreatorModels.Momentum;
import com.waydee.creators.domain.Signal;
import com.waydee.creators.domain.SizeTier;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * <b>Şeffaf puanlama</b> (108. tur) — InfluSense'in "kara kutu yok" vaadinin
 * bizdeki karşılığı.
 *
 * <h3>Formül (tek cümle)</h3>
 * {@code puan = Σ(ağırlık × sinyal) / Σ(ağırlık)}, toplam yalnız
 * <b>uygulanabilir</b> sinyaller üzerinden; verisi bulunamayan sinyal
 * <b>0,5 (nötr)</b> sayılır.
 *
 * <h3>Neden bilinmeyen = 0,5</h3>
 * <ul>
 *   <li>0 sayılsaydı, verisi bulunamayan dürüst bir hesap cezalandırılırdı —
 *       "bilinmiyor" ile "kötü" aynı şey değil.</li>
 *   <li>Hesaba hiç katılmasaydı, tek bir sinyali (içerik uyumu) bilinen bir
 *       hesap, sekizi de kanıtlanmış bir hesabın önüne geçebilirdi.</li>
 * </ul>
 * Nötr değer ikisinin ortası: kanıtlanmış iyi değer yukarı, kanıtlanmış zayıf
 * değer aşağı çeker; kanıtsızlık yerinde sayar. Ayrıca {@code coverage}
 * (veri kapsamı) ayrı gösterilir.
 *
 * <h3>⚠️ Formül istemcide de var</h3>
 * Kullanıcı radar grafiğini sürükledikçe sıralama tarayıcıda yeniden hesaplanır
 * ({@code features/creators/scoring.ts}) — her değişiklikte sunucuya gitmek
 * ücretsiz bir işlemi yavaşlatırdı. Sinyallerin <b>kendisi</b> yalnız burada
 * hesaplanır; istemcide yalnız bu tek satırlık ağırlıklı ortalama var.
 * Ortak örnek (→ 71,7) {@code CreatorScorerTest}'te ve istemci dosyasının
 * başında yazılı. ⚠️ Ön yüzde test koşucusu yok; istemci tarafı 108. turda
 * tarayıcıda aynı örnekle ölçüldü — formül değişirse ikisi birlikte değişmeli.
 */
@Component
public class CreatorScorer {

    /** Bilinmeyen sinyalin değeri. */
    static final double NEUTRAL = 0.5;

    /**
     * Sinyalleri hesaplar.
     *
     * @return anahtarı olmayan sinyal = uygulanamaz (kullanıcı o boyutu
     *         istemedi); değeri {@code null} olan = veri yok
     */
    public Map<Signal, Double> signals(Filters filters, Long followers, Double engagementPct, Long avgViews,
                                       Double growthPct, Double costMin, Double costMax, String costCurrency,
                                       String country, String language, int contentFit) {
        Map<Signal, Double> out = new EnumMap<>(Signal.class);

        // Takipçi: yalnız kademe istendiyse anlamlı. Kademe dışındakiler zaten
        // elendi; burada "boyutu KANITLANMIŞ" ile "boyutu bilinmeyen" ayrılır.
        if (!filters.tiers().isEmpty()) {
            out.put(Signal.AUDIENCE, followers == null ? null
                    : filters.tiers().stream().anyMatch(t -> t.contains(followers)) ? 1.0 : 0.0);
        }

        out.put(Signal.CONTENT_FIT, clamp(contentFit / 100.0));

        if (filters.country() != null) {
            out.put(Signal.GEO, country == null ? null : filters.country().equalsIgnoreCase(country) ? 1.0 : 0.0);
        }
        if (filters.language() != null) {
            out.put(Signal.LANGUAGE, language == null ? null : filters.language().equalsIgnoreCase(language) ? 1.0 : 0.0);
        }

        if (filters.budgetMax() != null) {
            out.put(Signal.BUDGET, budgetFit(filters.budgetMax(), filters.currency(), costMin, costMax, costCurrency));
        }

        out.put(Signal.ENGAGEMENT, engagementPct == null ? null
                : clamp(engagementPct / (2 * benchmarkTier(filters, followers).typicalEngagementPct())));

        // Erişim: ortalama izlenme / takipçi. 0,6 ve üstü tam puan — kitlesinin
        // çoğuna ulaşan bir hesap; bu oran büyük hesaplarda nadirdir.
        out.put(Signal.REACH, avgViews == null || followers == null || followers <= 0 ? null
                : clamp((avgViews / (double) followers) / 0.6));

        // Büyüme: aylık %20 ve üstü tam puan; küçülen hesap 0.
        out.put(Signal.MOMENTUM, growthPct == null ? null : clamp(growthPct / 20.0));
        return out;
    }

    /** Ağırlıklı ortalama, 0..100, bir ondalık. ⚠️ İstemcideki formülle birebir aynı. */
    public double score(Map<Signal, Double> signals, Map<Signal, Integer> weights) {
        double weighted = 0;
        double total = 0;
        for (Map.Entry<Signal, Double> entry : signals.entrySet()) {
            int w = weights.getOrDefault(entry.getKey(), entry.getKey().defaultWeight());
            if (w <= 0) {
                continue;
            }
            double value = entry.getValue() == null ? NEUTRAL : entry.getValue();
            weighted += w * value;
            total += w;
        }
        if (total == 0) {
            // Tüm ağırlıklar sıfırlandıysa sıralama içerik uyumuna düşer — boş bir puan değil.
            Double fit = signals.get(Signal.CONTENT_FIT);
            return round1((fit == null ? NEUTRAL : fit) * 100);
        }
        return round1(weighted / total * 100);
    }

    /** Uygulanabilir sinyallerin veriye dayanan oranı. */
    public double coverage(Map<Signal, Double> signals) {
        if (signals.isEmpty()) {
            return 0;
        }
        long known = signals.values().stream().filter(v -> v != null).count();
        return round1((double) known / signals.size() * 100) / 100;
    }

    /**
     * Büyüme etiketi.
     *
     * <ul>
     *   <li><b>VIRAL</b> — aylık %30+ büyüme ya da izlenmesi takipçisinin 1,5
     *       katı (içerik kitlesinin dışına taşıyor);</li>
     *   <li><b>EMERGING</b> — aylık %8+ büyüme;</li>
     *   <li><b>STEADY</b> — büyüme biliniyor ve bunun altında;</li>
     *   <li><b>UNKNOWN</b> — veri yok. ⚠️ "İstikrarlı" yazılmaz: bilinmeyeni
     *       olumlu bir etiketle göstermek veriyi olduğundan zengin gösterirdi.</li>
     * </ul>
     */
    public Momentum momentum(Double growthPct, Long avgViews, Long followers) {
        boolean breakout = avgViews != null && followers != null && followers > 0
                && avgViews >= followers * 1.5;
        if ((growthPct != null && growthPct >= 30) || breakout) {
            return Momentum.VIRAL;
        }
        if (growthPct != null && growthPct >= 8) {
            return Momentum.EMERGING;
        }
        return growthPct != null ? Momentum.STEADY : Momentum.UNKNOWN;
    }

    /**
     * Ağırlıkları temizler: bilinmeyen anahtar yok, 0–100 arası, eksik olan
     * varsayılan. "Yalnız yükselenler" seçiliyse büyümenin varsayılanı artar.
     */
    public Map<Signal, Integer> sanitizeWeights(Map<Signal, Integer> raw, boolean emergingOnly) {
        Map<Signal, Integer> out = new LinkedHashMap<>();
        for (Signal signal : Signal.values()) {
            // "Yalnız yükselenler": büyüme, etkileşimle aynı ağırlığa çıkar.
            int fallback = signal == Signal.MOMENTUM && emergingOnly
                    ? Signal.ENGAGEMENT.defaultWeight() : signal.defaultWeight();
            Integer value = raw == null ? null : raw.get(signal);
            out.put(signal, value == null ? fallback : Math.max(0, Math.min(100, value)));
        }
        return out;
    }

    // ---------------------------------------------------------------- yardımcı

    /**
     * Bütçe uyumu.
     *
     * <p>⚠️ Para birimi farklıysa <b>karşılaştırılmaz</b> (bilinmiyor döner):
     * kur çevrimi yapmak, günü belli olmayan bir kurla uydurma bir uyum
     * hesaplamak olurdu.
     */
    private static Double budgetFit(int budget, String currency, Double costMin, Double costMax, String costCurrency) {
        /* 🔴 10 Eki 2026, ölçülerek bulundu: eski hâli tek bir üçlü ifadeydi ve ilk
           dalı ilkel `double` olduğu için bütün ifade `double`'a kutusuzlaşıyordu —
           iki uç da null iken `costMax` açılırken NullPointerException, arama düşüyordu.
           Dallar ayrı yazılır; hiçbiri ilkel tipe zorlanmaz. */
        Double estimate;
        if (costMin != null && costMax != null) {
            estimate = (costMin + costMax) / 2;
        } else if (costMin != null) {
            estimate = costMin;
        } else {
            estimate = costMax;
        }
        if (estimate == null || estimate <= 0 || costCurrency == null || currency == null
                || !currency.equalsIgnoreCase(costCurrency)) {
            return null;
        }
        return estimate <= budget ? 1.0 : clamp(budget / estimate);
    }

    /** Etkileşim ölçütünün kademesi: takipçi biliniyorsa kendi kademesi, yoksa istenen en küçük kademe. */
    private static SizeTier benchmarkTier(Filters filters, Long followers) {
        if (followers != null) {
            return SizeTier.of(followers);
        }
        return filters.tiers().stream().min(Enum::compareTo).orElse(SizeTier.MICRO);
    }

    private static double clamp(double v) {
        return Double.isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
