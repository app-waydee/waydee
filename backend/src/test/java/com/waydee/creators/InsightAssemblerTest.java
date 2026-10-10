package com.waydee.creators;

import static org.assertj.core.api.Assertions.assertThat;

import com.waydee.creators.application.InsightAssembler;
import com.waydee.creators.application.InsightModels.Basis;
import com.waydee.creators.application.InsightModels.RawInsight;
import com.waydee.creators.application.InsightModels.RawWindow;
import com.waydee.creators.application.InsightModels.Report;
import com.waydee.creators.domain.Platform;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class InsightAssemblerTest {

    private final InsightAssembler assembler = new InsightAssembler();
    private final Instant now = Instant.parse("2026-10-09T12:00:00Z");

    @Test
    void boşModelÇıktısıOrtalamalarlaDolar() {
        Report r = assembler.assemble(null, Platform.INSTAGRAM, 50_000L, 0, List.of(), List.of(), now);
        assertThat(r.followers()).isEqualTo(50_000);
        assertThat(r.followersBasis()).isEqualTo(Basis.REPORTED);
        assertThat(r.windows()).extracting(w -> w.days()).containsExactly(7, 14, 30);
        r.windows().forEach(w -> {
            assertThat(w.basis()).isEqualTo(Basis.ESTIMATED);
            assertThat(w.engagementRatePct()).isPositive();
            assertThat(w.avgViews()).isEqualTo(12_500); // 50K × 0.25
            assertThat(w.posts()).isPositive();
            assertThat(w.followerGrowthPct()).isNotNull();
        });
    }

    @Test
    void sayfadaYazanDeğerGerçekSayılır() {
        RawInsight raw = new RawInsight(48_000L, null, "REPORTED",
                List.of(new RawWindow(7, 4.2, 9000L, 1900L, 80L, 5, 1.1, "REPORTED")),
                null, null, null, 5.0, null, null, null, null, null, null, null, null);
        Report r = assembler.assemble(raw, Platform.INSTAGRAM, null, 0, List.of(), List.of(), now);
        assertThat(r.followers()).isEqualTo(48_000);
        assertThat(r.windows().get(0).basis()).isEqualTo(Basis.REPORTED);
        assertThat(r.windows().get(0).engagementRatePct()).isEqualTo(4.2);
        assertThat(r.windows().get(1).basis()).isEqualTo(Basis.ESTIMATED);
    }

    @Test
    void takipÖlçümüVarsaBüyümeBizimÖlçümümüzdür() {
        List<InsightAssembler.Point> series = List.of(
                new InsightAssembler.Point(40_000, now.minus(Duration.ofDays(31))),
                new InsightAssembler.Point(45_000, now.minus(Duration.ofDays(7))),
                new InsightAssembler.Point(50_000, now));
        Report r = assembler.assemble(null, Platform.TIKTOK, 50_000L, 0, series, List.of(), now);
        var w30 = r.windows().get(2);
        assertThat(w30.growthBasis()).isEqualTo(Basis.TRACKED);
        assertThat(w30.followerChange()).isEqualTo(10_000);
        assertThat(w30.followerGrowthPct()).isEqualTo(25.0);
        assertThat(r.windows().get(0).followerChange()).isEqualTo(5_000);
    }

    @Test
    void kısaTakip30GünlükDeğişimGibiGösterilmez() {
        List<InsightAssembler.Point> series = List.of(
                new InsightAssembler.Point(49_000, now.minus(Duration.ofDays(3))),
                new InsightAssembler.Point(50_000, now));
        Report r = assembler.assemble(null, Platform.TIKTOK, 50_000L, 0, series, List.of(), now);
        assertThat(r.windows()).allMatch(w -> w.growthBasis() != Basis.TRACKED);
    }
}
