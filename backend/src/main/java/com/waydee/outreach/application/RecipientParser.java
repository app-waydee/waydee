package com.waydee.outreach.application;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * <b>Yapıştırılan alıcı listesini ayrıştırır</b> (V60, 107. tur).
 *
 * <p>Kullanıcının cümlesi *"kopyala yapıştır usulü verdiğim maillere"* idi.
 * Yapıştırılan metin gerçekte hiçbir zaman temiz gelmez: Excel'den sütun,
 * Gmail'den {@code Ada Lovelace &lt;ada@x.com&gt;}, bir belgeden noktalı virgül,
 * bir sohbetten satır sonları. Bu yüzden ayırıcı <b>tek bir karakter değil</b>:
 * virgül, noktalı virgül, boşluk, sekme ve satır sonu — hepsi ayırıcıdır.
 *
 * <p>🔴 <b>Tekilleştirme küçük harf üzerinden yapılır.</b> {@code Ada@x.com} ile
 * {@code ada@x.com} aynı posta kutusudur; ayrı sayılsalardı kişi aynı iletiyi
 * iki kez alırdı ve bu, spam şikâyetinin en hızlı yoludur.
 *
 * <p>⚠️ <b>İlk görülen ad kazanır.</b> Aynı adres iki kez, biri adlı biri adsız
 * yapıştırılırsa adlı olan korunur — daha zengin veriyi daha fakiriyle ezmek
 * sessiz bir kayıptır.
 *
 * <p>⚠️ Geçersiz satırlar <b>atılmaz, döndürülür</b>. Sessizce elenselerdi
 * yönetici 300 kişi yapıştırıp 297'sine gittiğini fark etmezdi; ekran onları
 * tek tek gösteriyor.
 */
@Component
public class RecipientParser {

    /** Ayırıcılar: virgül · noktalı virgül · satır sonu · sekme · boşluk. */
    private static final Pattern SEPARATOR = Pattern.compile("[,;\\r\\n\\t ]+");

    /** {@code Ada Lovelace <ada@x.com>} — köşeli parantez biçimi. */
    private static final Pattern ANGLE_FORM = Pattern.compile("^(.*?)<([^>]+)>$");

    /** Köşeli parantezli bloğun yerine konan işaret — bkz. {@link #parse}. */
    private static final char MARK = 1;

    /**
     * Adres doğrulaması.
     *
     * <p>⚠️ RFC 5322'nin tamamı <b>bilinçli olarak</b> uygulanmadı: tam dilbilgisi
     * yorumlarla, katlanmış boşlukla ve tırnaklı yerel adlarla uğraşır ve pratikte
     * hiç karşılaşılmayan adresleri kabul etmek uğruna yazım hatalarını da
     * geçirir. Buradaki desen sıkı olduğu için <b>faydalı</b>: "ada@gmail" ya da
     * "ada@@x.com" gibi gerçek yapıştırma hataları yakalanır.
     */
    private static final Pattern EMAIL = Pattern.compile(
            "^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*"
                    + "@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
                    + "(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$");

    /**
     * Ayrıştırma sonucu.
     *
     * @param recipients geçerli ve tekilleştirilmiş alıcılar (yapıştırma sırasıyla)
     * @param invalid    adres olarak okunamayan parçalar
     * @param duplicates elenen kopya sayısı
     */
    public record Parsed(List<Recipient> recipients, List<String> invalid, int duplicates) {
    }

    /** Tek alıcı. {@code name} yoksa şablondaki {@code {{name}}} yedek metne düşer. */
    public record Recipient(String email, String name) {
    }

    public Parsed parse(String raw) {
        // LinkedHashMap: tekilleştirir AMA yapıştırma sırasını korur. Sıra korunmasaydı
        // yönetici listesini gönderim ekranında tanıyamazdı.
        Map<String, Recipient> unique = new LinkedHashMap<>();
        List<String> invalid = new ArrayList<>();
        int duplicates = 0;

        if (raw == null || raw.isBlank()) {
            return new Parsed(List.of(), List.of(), 0);
        }

        for (String token : tokenize(raw)) {
            String name = null;
            String email = token;

            Matcher m = ANGLE_FORM.matcher(token);
            if (m.matches()) {
                name = cleanName(m.group(1));
                email = m.group(2).strip();
            }
            // Yapıştırılan listelerde adresin sonunda nokta ya da tırnak kalması çok
            // yaygın; bunlar hata değil, artıktır.
            email = email.replaceAll("^[\"'<]+|[\"'>.,;]+$", "").strip();

            if (!EMAIL.matcher(email).matches()) {
                invalid.add(token);
                continue;
            }
            String key = email.toLowerCase();
            Recipient existing = unique.get(key);
            if (existing == null) {
                unique.put(key, new Recipient(key, name));
            } else {
                duplicates++;
                // İlk görülen ad kazanır; yalnız BOŞ olan ad zenginleştirilir.
                if (existing.name() == null && name != null) {
                    unique.put(key, new Recipient(key, name));
                }
            }
        }
        return new Parsed(List.copyOf(unique.values()), List.copyOf(invalid), duplicates);
    }

    /**
     * Metni parçalara böler.
     *
     * <p>🔴 <b>Köşeli parantezli blok ayırmadan önce çıkarılır</b> çünkü adı
     * adresten ayıran boşluk, aynı zamanda bir ayırıcıdır:
     * {@code Ada Lovelace <ada@x.com>} üç parçaya bölünürdü.
     *
     * <p>⚠️ Çıkarılan bloklar <b>ayrı bir listeye alınmaz</b>, yerlerine bir işaret
     * konur. Ayrı liste denendi ve ölçümde şu çıktı: adlı alıcılar listenin
     * <b>başına</b> toplanıyor, yani yapıştırma sırası bozuluyordu. Sıra bozulunca
     * yönetici gönderim ekranında kendi listesini tanıyamaz.
     */
    private List<String> tokenize(String raw) {
        List<String> extracted = new ArrayList<>();
        Matcher angle = Pattern.compile("[^,;\\r\\n\\t]*<[^>]+>").matcher(raw);
        StringBuilder masked = new StringBuilder();
        int cursor = 0;
        while (angle.find()) {
            masked.append(raw, cursor, angle.start());
            // İşaret U+0001 ile çevrelenir: yapıştırılan hiçbir metinde geçmez
            // ve ayırıcı listesinde de yok, yani bölme onu parçalamaz.
            masked.append(MARK).append(extracted.size()).append(MARK);
            extracted.add(angle.group().strip());
            cursor = angle.end();
        }
        masked.append(raw.substring(cursor));

        List<String> tokens = new ArrayList<>();
        for (String piece : SEPARATOR.split(masked.toString())) {
            String token = piece.strip();
            if (token.isEmpty()) {
                continue;
            }
            if (token.length() > 2 && token.charAt(0) == MARK && token.charAt(token.length() - 1) == MARK) {
                tokens.add(extracted.get(Integer.parseInt(token.substring(1, token.length() - 1))));
            } else {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private String cleanName(String raw) {
        String name = raw.replaceAll("^[\"']+|[\"']+$", "").strip();
        if (name.isEmpty()) {
            return null;
        }
        // Kolon 120 karakter; uzun ad iletiyi değil VERİTABANI yazmasını düşürürdü.
        return name.length() > 120 ? name.substring(0, 120) : name;
    }
}
