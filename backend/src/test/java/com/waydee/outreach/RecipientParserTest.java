package com.waydee.outreach;

import com.waydee.outreach.application.RecipientParser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * <b>Yapıştırma ayrıştırıcısının bekçisi</b> (V60).
 *
 * <p>🔴 Buradaki testlerin hepsi <b>gerçek yapıştırma biçimlerinden</b> alındı:
 * Excel sütunu (satır sonu), Gmail alıcı çubuğu ({@code Ad &lt;adres&gt;}),
 * belge (noktalı virgül), sohbet (boşluk). Ayrıştırıcı bunlardan birini
 * kaçırırsa gönderim listesi sessizce eksilir — ve eksildiği hiçbir yerde
 * yazmaz.
 */
class RecipientParserTest {

    private final RecipientParser parser = new RecipientParser();

    @Test
    @DisplayName("Karışık ayırıcılar: virgül, noktalı virgül, satır sonu, boşluk, sekme")
    void karisikAyiricilar() {
        var parsed = parser.parse("a@x.com, b@x.com; c@x.com\nd@x.com\te@x.com f@x.com");
        assertEquals(6, parsed.recipients().size());
        assertTrue(parsed.invalid().isEmpty());
    }

    @Test
    @DisplayName("Gmail biçimi: ad ayrıştırılır, adres ayrılır")
    void gmailBicimi() {
        var parsed = parser.parse("Ada Lovelace <ada@x.com>, bob@x.com");
        assertEquals(2, parsed.recipients().size());
        assertEquals("ada@x.com", parsed.recipients().get(0).email());
        assertEquals("Ada Lovelace", parsed.recipients().get(0).name());
        assertNull(parsed.recipients().get(1).name());
    }

    @Test
    @DisplayName("🔴 Büyük/küçük harf aynı kutudur — kopya elenir, kişi postayı İKİ KEZ almaz")
    void buyukKucukHarfKopyaSayilir() {
        var parsed = parser.parse("Ada@X.com\nada@x.com\nADA@X.COM");
        assertEquals(1, parsed.recipients().size());
        assertEquals("ada@x.com", parsed.recipients().getFirst().email());
        assertEquals(2, parsed.duplicates());
    }

    @Test
    @DisplayName("⚠️ İlk görülen ad kazanır; boş ad sonradan zenginleşir")
    void adKorunur() {
        assertEquals("Ada", parser.parse("Ada <ada@x.com>, ada@x.com").recipients().getFirst().name());
        assertEquals("Ada", parser.parse("ada@x.com, Ada <ada@x.com>").recipients().getFirst().name());
    }

    @Test
    @DisplayName("🔴 Yapıştırma SIRASI korunur — adlı alıcılar başa toplanmaz")
    void siraKorunur() {
        var parsed = parser.parse("a@x.com\nBob Smith <b@x.com>\nc@x.com");
        assertEquals(List.of("a@x.com", "b@x.com", "c@x.com"),
                parsed.recipients().stream().map(RecipientParser.Recipient::email).toList());
        assertEquals("Bob Smith", parsed.recipients().get(1).name());
    }

    @Test
    @DisplayName("🔴 Geçersiz satırlar SESSİZCE ELENMEZ, geri döner")
    void gecersizlerGeriDoner() {
        var parsed = parser.parse("iyi@x.com, ada@gmail, @x.com, bos");
        assertEquals(1, parsed.recipients().size());
        assertEquals(3, parsed.invalid().size());
    }

    @Test
    @DisplayName("Yapıştırma artıkları temizlenir: sondaki nokta, tırnak")
    void artiklarTemizlenir() {
        var parsed = parser.parse("\"ada@x.com\", bob@x.com.");
        assertEquals(2, parsed.recipients().size());
        assertEquals("ada@x.com", parsed.recipients().get(0).email());
        assertEquals("bob@x.com", parsed.recipients().get(1).email());
    }

    @Test
    @DisplayName("Boş girdi patlamaz")
    void bosGirdi() {
        assertEquals(0, parser.parse("").recipients().size());
        assertEquals(0, parser.parse(null).recipients().size());
    }
}
