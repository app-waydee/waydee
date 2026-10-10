package com.waydee.outreach;

import com.waydee.common.mail.EmailMessage;
import com.waydee.outreach.application.CampaignRenderer;
import com.waydee.outreach.domain.EmailTemplate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * <b>Şablon derleyicisinin bekçisi</b> (V60).
 *
 * <p>🔴 Asıl iş {@link #hamHtmlGovdeyeSIZMAZ()} ve {@link #tehlikeliAdresELENIR()}
 * testlerinde: gövde yönetim panelinden geliyor ve ham HTML geçirseydi şablon
 * kutusu doğrudan bir enjeksiyon yolu olurdu. İkisi de derlemeyi kırmadan
 * bozulabilecek şeyler — yani ancak bir test bakabilir.
 */
class CampaignRendererTest {

    private final CampaignRenderer renderer = new CampaignRenderer();

    private EmailTemplate template(String body) {
        return EmailTemplate.create("t", "Konu", "ön izleme", "Başlık", body,
                "Discover Waydee", "https://waydee.com/", null, "en", true);
    }

    @Test
    @DisplayName("🔴 Ham HTML gövdeye SIZMAZ — kaçırılıp düz metin olarak basılır")
    void hamHtmlGovdeyeSIZMAZ() {
        String html = renderer.render(template("<script>alert(1)</script> merhaba"), null, "a@x.com").html();
        assertFalse(html.contains("<script>"));
        assertTrue(html.contains("&lt;script&gt;"));
    }

    @Test
    @DisplayName("🔴 javascript: adresi bağlantı olmaz ama METİN KAYBOLMAZ")
    void tehlikeliAdresELENIR() {
        String html = renderer.render(template("[tıkla](javascript:alert(1))"), null, "a@x.com").html();
        assertFalse(html.contains("javascript:"));
        assertTrue(html.contains("tıkla"), "yöneticinin yazdığı metin silinmemeli");
    }

    @Test
    @DisplayName("Bağlantı ve kalın işaretleri çalışır")
    void isaretlerCalisir() {
        String html = renderer.render(template("**kalın** ve [site](https://waydee.com)"), null, "a@x.com").html();
        assertTrue(html.contains("<strong>kalın</strong>"));
        assertTrue(html.contains("href=\"https://waydee.com\""));
    }

    @Test
    @DisplayName("Boş satır paragraf ayırır")
    void paragraflar() {
        String html = renderer.render(template("bir\n\niki\n\nüç"), null, "a@x.com").html();
        assertEquals(3, html.split("<p style=\"margin:0 0 16px 0;font-size:15px").length - 1);
    }

    @Test
    @DisplayName("⚠️ Düz metin karşılığı HER ZAMAN üretilir — yalnız HTML spam cezası alır")
    void duzMetinDeUretilir() {
        EmailMessage m = renderer.render(template("merhaba [site](https://waydee.com)"), null, "a@x.com");
        assertFalse(m.text().isBlank());
        assertFalse(m.text().contains("<p"));
        // Bağlantı düz metinde "etiket (adres)" olarak açılır; yoksa tıklanacak şey kalmaz.
        assertTrue(m.text().contains("site (https://waydee.com)"));
    }

    @Test
    @DisplayName("🔴 Anlık görüntü yer tutucuyu KORUR, kişiselleştirme sonra doldurur")
    void anlikGoruntuYerTutucuyuKorur() {
        EmailTemplate t = template("Hi {{name}}, adresin {{email}}");
        EmailMessage snapshot = renderer.renderWithPlaceholders(t);
        assertTrue(snapshot.html().contains("{{name}}"));

        EmailMessage one = renderer.personalize(snapshot.subject(), snapshot.html(), snapshot.text(),
                "Ada", "ada@x.com");
        assertTrue(one.html().contains("Hi Ada"));
        assertTrue(one.html().contains("ada@x.com"));
        assertFalse(one.html().contains("{{"));
    }

    @Test
    @DisplayName("⚠️ Ad yoksa 'Hi ,' yazılmaz — nötr hitap kullanılır")
    void adsizAliciNotrHitapAlir() {
        EmailTemplate t = template("Hi {{name}},");
        EmailMessage snapshot = renderer.renderWithPlaceholders(t);
        EmailMessage one = renderer.personalize(snapshot.subject(), snapshot.html(), snapshot.text(),
                null, "a@x.com");
        assertTrue(one.html().contains("Hi there,"));
    }

    @Test
    @DisplayName("🔴 Kişiselleştirmede ad HTML tarafında kaçırılır, düz metinde kaçırılmaz")
    void adKacirilir() {
        EmailTemplate t = template("Hi {{name}}");
        EmailMessage s = renderer.renderWithPlaceholders(t);
        EmailMessage one = renderer.personalize(s.subject(), s.html(), s.text(), "<b>Ada</b>", "a@x.com");
        assertTrue(one.html().contains("&lt;b&gt;Ada&lt;/b&gt;"));
        assertTrue(one.text().contains("<b>Ada</b>"));
    }

    @Test
    @DisplayName("Ön izleme satırı iletide GÖRÜNMEZ ama HTML'de vardır")
    void onIzlemeGizli() {
        String html = renderer.render(template("gövde"), null, "a@x.com").html();
        assertTrue(html.contains("display:none;max-height:0"));
        assertTrue(html.contains("ön izleme"));
    }

    @Test
    @DisplayName("🔴 Çıkış yolu (unsubscribe) her iletide vardır — hem HTML hem düz metin")
    void cikisYoluHerZamanVar() {
        EmailMessage m = renderer.render(template("gövde"), null, "a@x.com");
        assertTrue(m.html().contains("info@waydee.com"));
        assertTrue(m.text().contains("info@waydee.com"));
    }
}
