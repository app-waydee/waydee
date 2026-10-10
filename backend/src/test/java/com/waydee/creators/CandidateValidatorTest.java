package com.waydee.creators;

import com.waydee.creators.application.CandidateValidator;
import com.waydee.creators.application.CreatorModels.DropReason;
import com.waydee.creators.application.CreatorModels.Filters;
import com.waydee.creators.application.CreatorModels.RawCandidate;
import com.waydee.creators.application.CreatorModels.RawEvidence;
import com.waydee.creators.application.CreatorScorer;
import com.waydee.creators.application.ai.ResearchProvider.Source;
import com.waydee.creators.domain.Platform;
import com.waydee.creators.domain.Signal;
import com.waydee.creators.domain.SizeTier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * <b>Uydurma kalkanının bekçisi</b> (108. tur).
 *
 * <p>🔴 Asıl iş {@link #kaynagiOkunmamisAdayELENIR()}: modelin "bildiği" ama
 * araştırmada hiç okunmamış bir hesap sonuçlara giremez. Bu kural bozulursa
 * ürün, var olmayan influencer'ları gerçekmiş gibi göstermeye başlar.
 */
class CandidateValidatorTest {

    private final CreatorScorer scorer = new CreatorScorer();
    private final CandidateValidator validator = new CandidateValidator(scorer);
    private final Map<Signal, Integer> weights = scorer.sanitizeWeights(null, false);

    private Filters filters(List<Platform> platforms, List<SizeTier> tiers, String country, int count) {
        return new Filters(platforms, List.of(), List.of(), tiers, country, null, "ANY", null, false,
                null, null, false, count);
    }

    private RawCandidate candidate(String platform, String handle, String url, Long followers, String country) {
        return new RawCandidate(platform, handle, "Ad", null, country, null, List.of("FOOD"), followers,
                4.0, null, null, null, null, null, 80, "özet", List.of("neden"), List.of(),
                List.of(new RawEvidence(url, "kanıt")));
    }

    @Test
    @DisplayName("Okunmuş kaynağı olan aday geçer; profil adresi KANONİK biçimde kurulur")
    void okunmusKaynakGecer() {
        var out = validator.validate(
                List.of(candidate("INSTAGRAM", "@vegan.ayse", "https://www.example.com/list?utm=1", 20_000L, "TR")),
                List.of(new Source("https://example.com/list/", "Liste")),
                filters(List.of(Platform.INSTAGRAM), List.of(), null, 10), weights);
        assertEquals(1, out.creators().size());
        assertEquals("vegan.ayse", out.creators().getFirst().handle());
        assertEquals("https://www.instagram.com/vegan.ayse/", out.creators().getFirst().profileUrl());
        assertTrue(out.creators().getFirst().evidence().getFirst().verified(),
                "izleme parametresi ve www farkı aynı sayfa sayılmalı");
    }

    @Test
    @DisplayName("🔴 Kaynağı okunmamış aday ELENİR (UNVERIFIED_SOURCE)")
    void kaynagiOkunmamisAdayELENIR() {
        var out = validator.validate(
                List.of(candidate("TIKTOK", "uydurma_hesap", "https://hic-okunmadi.com/x", 15_000L, null)),
                List.of(new Source("https://baska-bir-sayfa.com", "Başka")),
                filters(List.of(Platform.TIKTOK), List.of(), null, 10), weights);
        assertTrue(out.creators().isEmpty());
        assertEquals(DropReason.UNVERIFIED_SOURCE, out.dropped().getFirst().reason());
    }

    @Test
    @DisplayName("Kanıt bağlantısı okunmamış olsa da PROFİLİN KENDİSİ okunduysa aday geçer")
    void profilOkunduysaGecer() {
        var out = validator.validate(
                List.of(candidate("YOUTUBE", "chefmert", "https://okunmadi.com", null, null)),
                List.of(new Source("https://www.youtube.com/@chefmert", "Chef Mert")),
                filters(List.of(Platform.YOUTUBE), List.of(), null, 10), weights);
        assertEquals(1, out.creators().size());
    }

    @Test
    @DisplayName("Geçersiz kullanıcı adı profil adresinden kurtarılır; gönderi bağlantısı kullanıcı adı DEĞİLDİR")
    void kullaniciAdiAdrestenKurtarilir() {
        RawCandidate fromUrl = new RawCandidate("INSTAGRAM", "Ayşe Vegan Mutfak", "Ayşe",
                "https://instagram.com/aysevegan/", null, null, List.of(), null, null, null, null, null, null,
                null, 70, "", List.of(), List.of(), List.of(new RawEvidence("https://instagram.com/aysevegan", "profil")));
        RawCandidate postLink = new RawCandidate("INSTAGRAM", "bir gönderi", "X",
                "https://www.instagram.com/p/C1abc/", null, null, List.of(), null, null, null, null, null, null,
                null, 70, "", List.of(), List.of(), List.of(new RawEvidence("https://instagram.com/aysevegan", "profil")));
        var out = validator.validate(List.of(fromUrl, postLink),
                List.of(new Source("https://instagram.com/aysevegan", null)),
                filters(List.of(Platform.INSTAGRAM), List.of(), null, 10), weights);
        assertEquals(1, out.creators().size());
        assertEquals("aysevegan", out.creators().getFirst().handle());
        assertEquals(DropReason.INVALID_HANDLE, out.dropped().getFirst().reason());
    }

    @Test
    @DisplayName("Kopya, istenmeyen platform, kademe dışı ve ülke uyuşmazlığı gerekçesiyle elenir")
    void filtreElemeleri() {
        String seen = "https://kaynak.com/a";
        List<RawCandidate> raw = List.of(
                candidate("INSTAGRAM", "bir", seen, 50_000L, "TR"),
                candidate("INSTAGRAM", "BIR", seen, 50_000L, "TR"),          // kopya (büyük/küçük harf)
                candidate("TWITCH", "yayinci", seen, 50_000L, "TR"),         // platform istenmedi
                candidate("INSTAGRAM", "buyuk", seen, 2_000_000L, "TR"),     // kademe dışı
                candidate("INSTAGRAM", "almanya", seen, 50_000L, "DE"),      // ülke uyuşmuyor
                candidate("INSTAGRAM", "bilinmeyen", seen, null, null));      // bilinmeyen → KALIR
        var out = validator.validate(raw, List.of(new Source(seen, null)),
                filters(List.of(Platform.INSTAGRAM), List.of(SizeTier.MICRO), "TR", 10), weights);
        assertEquals(2, out.creators().size());
        List<DropReason> reasons = out.dropped().stream().map(d -> d.reason()).toList();
        assertTrue(reasons.containsAll(List.of(DropReason.DUPLICATE, DropReason.PLATFORM_NOT_REQUESTED,
                DropReason.OUT_OF_TIER, DropReason.COUNTRY_MISMATCH)));
        var unknown = out.creators().stream().filter(c -> c.handle().equals("bilinmeyen")).findFirst().orElseThrow();
        assertNull(unknown.signals().get(Signal.AUDIENCE), "bilinmeyen takipçi → nötr, elenmez");
    }

    @Test
    @DisplayName("Fazlası en iyiler tutularak kesilir (OVER_LIMIT) ve sıralama puana göredir")
    void fazlasiKesilir() {
        String seen = "https://kaynak.com/a";
        List<RawCandidate> raw = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            raw.add(new RawCandidate("INSTAGRAM", "hesap" + i, "H", null, null, null, List.of(), null, null,
                    null, null, null, null, null, i * 8, "", List.of(), List.of(),
                    List.of(new RawEvidence(seen, "k"))));
        }
        var out = validator.validate(raw, List.of(new Source(seen, null)),
                filters(List.of(Platform.INSTAGRAM), List.of(), null, 10), weights);
        assertEquals(10, out.creators().size());
        assertEquals("hesap11", out.creators().getFirst().handle());
        assertEquals(2, out.dropped().stream().filter(d -> d.reason() == DropReason.OVER_LIMIT).count());
    }

    @Test
    @DisplayName("Makul olmayan sayılar BOŞ bırakılır (sıfır yazılmaz); para birimi yoksa ücret gösterilmez")
    void makulOlmayanSayilar() {
        String seen = "https://kaynak.com/a";
        RawCandidate bad = new RawCandidate("INSTAGRAM", "sayi", "S", null, "XX", "zz", List.of(), -5L, 150.0,
                null, 5_000.0, 900.0, 300.0, null, 140, "", List.of(), List.of(),
                List.of(new RawEvidence(seen, "k")));
        var c = validator.validate(List.of(bad), List.of(new Source(seen, null)),
                filters(List.of(Platform.INSTAGRAM), List.of(), null, 10), weights).creators().getFirst();
        assertNull(c.followers());
        assertNull(c.engagementRatePct());
        assertNull(c.growth30dPct());
        assertNull(c.country());
        assertNull(c.language());
        assertNull(c.estCostMin(), "para birimi bilinmeyen tutar gösterilmez");
        assertEquals(100, c.contentFit());
    }
}
