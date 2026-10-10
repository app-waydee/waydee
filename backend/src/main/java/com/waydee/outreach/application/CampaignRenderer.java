package com.waydee.outreach.application;

import com.waydee.common.mail.EmailMessage;
import com.waydee.outreach.domain.EmailTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * <b>Şablonu gönderilmeye hazır iletiye çevirir</b> (V60, 107. tur).
 *
 * <p>Görsel dil {@code common.mail.EmailTemplates} ile <b>aynıdır</b> (aynı
 * tokenlar, aynı kart, aynı hap düğme): doğrulama postasıyla davet postası
 * birbirinden farklı görünseydi ikisinden biri sahte görünürdü.
 *
 * <p>🔴 <b>Ham HTML kabul edilmez.</b> Gövde önce baştan sona kaçırılır, sonra
 * yalnız üç işaret tanınır: boş satır → paragraf, {@code [metin](adres)} →
 * bağlantı, {@code **metin**} → kalın. Sebep üç katlı: ①&nbsp;yönetim paneline
 * yapıştırılan HTML doğrudan bir enjeksiyon yolu olurdu, ②&nbsp;Gmail
 * {@code <style>} bloğunu eler ve Outlook modern yerleşimi bilmez — yapıştırılan
 * HTML kaçınılmaz olarak bozulur, ③&nbsp;her şablonun ayrı görünmesi ürünün
 * posta dilini dağıtırdı.
 *
 * <p>🔴 <b>Tüm stiller satır içidir.</b> Bu bir tercih değil zorunluluk: Gmail
 * {@code <head>} içindeki {@code <style>} bloğunu büyük ölçüde atar.
 *
 * <p>⚠️ Düz metin karşılığı <b>her zaman</b> üretilir. Yalnız HTML gönderen
 * ileti spam filtrelerinde ceza alır — bu, kotadan sonraki en somut
 * teslim-edilebilirlik kaldıracıdır.
 */
@Component
public class CampaignRenderer {

    /** Görsel tokenlar — {@code EmailTemplates} ile birebir aynı değerler. */
    private static final String INK = "#1a1d1f";
    private static final String MUTED = "#6f767e";
    private static final String CANVAS = "#f1f1f1";
    private static final String LINE = "#efefef";

    /** Gerçekten okunan destek adresi — {@code noreply} yanıtlanamaz. */
    private static final String SUPPORT_EMAIL = "info@waydee.com";

    private static final Pattern LINK = Pattern.compile("\\[([^\\]]{1,120})]\\(([^)\\s]{1,500})\\)");
    private static final Pattern BOLD = Pattern.compile("\\*\\*(.+?)\\*\\*");
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{\\s*(\\w+)\\s*}}");

    /** Şablonda kullanılabilen yer tutucular — yönetim ekranı bu listeyi gösterir. */
    public static final List<String> VARIABLES = List.of("name", "email");

    /**
     * İletiyi üretir.
     *
     * @param template şablon
     * @param name     alıcının adı (yoksa {@code null})
     * @param email    alıcının adresi
     */
    public EmailMessage render(EmailTemplate template, String name, String email) {
        Map<String, String> vars = Map.of(
                // 🔴 Ad yoksa "{{name}}" ham hâliyle basılamaz ve boş da bırakılamaz
                // ("Hi ," diye başlayan bir ileti amatör görünür). Nötr bir hitap
                // her iki tuzağı da atlar.
                "name", (name == null || name.isBlank()) ? neutralName(template.getLocale()) : name,
                "email", email == null ? "" : email);
        return render(template, vars);
    }

    /**
     * Yer tutucular <b>korunarak</b> üretir — kampanyanın anlık görüntüsü budur.
     *
     * <p>🔴 Alıcı başına ayrı bir anlık görüntü saklanmadı: 500 kişilik bir
     * kampanya, aralarındaki tek fark bir kelime olan 500 HTML kopyası demekti.
     * Yer tutucu duruyor ve gönderim anında dolduruluyor.
     *
     * <p>⚠️ Bu işe yarıyor çünkü {@code {{name}}} kaçırmadan <b>etkilenmez</b>:
     * içinde {@code & < > "} yok, yani kaçırılmış metinde de aynen kalır.
     */
    public EmailMessage renderWithPlaceholders(EmailTemplate template) {
        return render(template, Map.of("name", "{{name}}", "email", "{{email}}"));
    }

    /**
     * Anlık görüntüdeki yer tutucuları tek bir alıcı için doldurur.
     *
     * <p>🔴 HTML tarafında ad <b>kaçırılır</b>, düz metin tarafında kaçırılmaz.
     * Tek bir sürüm kullanılsaydı ikisinden biri yanlış olurdu: düz metinde
     * {@code O&amp;#39;Brien}, ya da HTML'de yapıştırılan bir etiketin gövdeye
     * sızması.
     *
     * <p>⚠️ Yedek hitabın dili <b>anlık görüntüden</b> okunur ({@code lang="tr"}).
     * Şablon silinmiş olabilir; dilin kampanyayla birlikte yaşamasının tek yolu
     * onu zaten taşıyan HTML'in kendisidir.
     */
    public EmailMessage personalize(String subject, String html, String text, String name, String email) {
        boolean turkish = html.contains("<html lang=\"tr");
        String display = (name == null || name.isBlank()) ? (turkish ? "merhaba" : "there") : name;
        return new EmailMessage(
                replaceVars(subject, display, email, false),
                replaceVars(html, display, email, true),
                replaceVars(text, display, email, false));
    }

    private String replaceVars(String raw, String name, String email, boolean escapeValues) {
        String n = escapeValues ? escape(name) : name;
        String e = escapeValues ? escape(email) : email;
        return raw.replace("{{name}}", n).replace("{{email}}", e);
    }

    private EmailMessage render(EmailTemplate template, Map<String, String> vars) {
        String subject = fill(template.getSubject(), vars);
        String heading = fill(template.getHeading(), vars);
        String body = fill(template.getBody(), vars);
        String preheader = template.getPreheader() == null ? null : fill(template.getPreheader(), vars);
        String footerNote = template.getFooterNote() == null ? null : fill(template.getFooterNote(), vars);

        String html = layout(template.getLocale(), heading, preheader,
                blocks(body), template.getCtaLabel(), template.getCtaUrl(), footerNote);
        String text = plain(heading, body, template.getCtaLabel(), template.getCtaUrl(), footerNote);
        return new EmailMessage(subject, html, text);
    }

    // ------------------------------------------------------------ biçimlendirme

    /** Gövdeyi paragraflara böler; her paragraf kaçırılır ve satır içi işaretler uygulanır. */
    private String blocks(String body) {
        StringBuilder out = new StringBuilder();
        // \n{2,} = boş satır. Windows'tan yapıştırılan metinde \r de gelir.
        for (String block : body.replace("\r\n", "\n").split("\n{2,}")) {
            String trimmed = block.strip();
            if (trimmed.isEmpty()) {
                continue;
            }
            // Tek paragraf içindeki tek satır sonu <br> olur: adres/imza blokları
            // yapıştırıldığında satırların birbirine yapışmasını engeller.
            String inline = inline(trimmed).replace("\n", "<br>");
            out.append("<p style=\"margin:0 0 16px 0;font-size:15px;line-height:1.6;color:")
                    .append(INK).append(";\">").append(inline).append("</p>");
        }
        return out.toString();
    }

    /**
     * Satır içi işaretler.
     *
     * <p>🔴 <b>Sıra önemlidir:</b> önce kaçırma, sonra işaretleme. Ters yapılsaydı
     * üretilen {@code <a>} etiketinin kendisi de kaçırılır ve alıcı ekranda ham
     * HTML görürdü.
     */
    private String inline(String raw) {
        String escaped = escape(raw);

        Matcher link = LINK.matcher(escaped);
        StringBuilder withLinks = new StringBuilder();
        while (link.find()) {
            String label = link.group(1);
            String url = safeUrl(link.group(2));
            String replacement = url == null
                    // Adres güvenli değilse bağlantı kurulmaz ama metin KAYBOLMAZ:
                    // sessizce silmek, yöneticinin yazdığı cümleyi yok etmek olurdu.
                    ? label
                    : "<a href=\"" + url + "\" style=\"color:" + INK + ";text-decoration:underline;\">"
                            + label + "</a>";
            link.appendReplacement(withLinks, Matcher.quoteReplacement(replacement));
        }
        link.appendTail(withLinks);

        Matcher bold = BOLD.matcher(withLinks.toString());
        StringBuilder out = new StringBuilder();
        while (bold.find()) {
            bold.appendReplacement(out, Matcher.quoteReplacement("<strong>" + bold.group(1) + "</strong>"));
        }
        bold.appendTail(out);
        return out.toString();
    }

    /**
     * Yer tutucuları doldurur.
     *
     * <p>⚠️ Değerler burada <b>kaçırılmaz</b>: doldurma, kaçırmadan önce yapılır ve
     * kaçırma {@link #inline} içinde tüm metne birden uygulanır. İki kez kaçırmak
     * "O'Brien" adını "O&amp;#39;Brien" diye basardı.
     *
     * <p>⚠️ Tanınmayan yer tutucu <b>olduğu gibi bırakılır</b>. Boşaltmak, yazım
     * hatasını görünmez kılıp cümlenin ortasında sessiz bir boşluk bırakırdı.
     */
    private String fill(String raw, Map<String, String> vars) {
        if (raw == null || raw.indexOf('{') < 0) {
            return raw;
        }
        Matcher m = VARIABLE.matcher(raw);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String value = vars.get(m.group(1).toLowerCase(Locale.ROOT));
            m.appendReplacement(out, Matcher.quoteReplacement(value != null ? value : m.group()));
        }
        m.appendTail(out);
        return out.toString();
    }

    /**
     * Yalnız {@code http}, {@code https} ve {@code mailto} geçer.
     *
     * <p>🔴 {@code javascript:} ve {@code data:} adresleri elenir. Kimi e-posta
     * istemcisi (özellikle tarayıcı içi önizlemeler) bunları çalıştırır; süzgeç
     * olmasaydı şablon kutusu bir saldırı yüzeyi olurdu.
     */
    private String safeUrl(String raw) {
        // Adres kaçırılmış metinden geliyor: `&amp;` geri çevrilmezse sorgu dizesi bozulur.
        String url = raw.replace("&amp;", "&").strip();
        String lower = url.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://") && !lower.startsWith("mailto:")) {
            return null;
        }
        return escape(url);
    }

    // ------------------------------------------------------------------ yerleşim

    private String layout(String locale, String heading, String preheader, String bodyHtml,
                          String ctaLabel, String ctaUrl, String footerNote) {
        String cta = "";
        String safeCta = ctaUrl == null ? null : safeUrl(ctaUrl);
        if (ctaLabel != null && safeCta != null) {
            cta = "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
                    + "style=\"margin:8px 0 24px 0;\"><tr><td style=\"border-radius:999px;background:" + INK + ";\">"
                    + "<a href=\"" + safeCta + "\" style=\"display:inline-block;padding:14px 28px;font-size:15px;"
                    + "font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;\">"
                    + escape(ctaLabel) + "</a></td></tr></table>"
                    // Düğme çalışmayan istemciler için ham adres — kurumsal Outlook
                    // kurulumlarında düğmeler hâlâ sessizce ölüyor.
                    + "<p style=\"margin:0 0 16px 0;font-size:12px;line-height:1.6;color:" + MUTED + ";"
                    + "word-break:break-all;\">" + linkFallback(locale) + "<br>"
                    + "<span style=\"color:" + INK + ";\">" + safeCta + "</span></p>";
        }

        String note = footerNote == null ? ""
                : "<div style=\"margin-top:8px;padding:14px 16px;background:#f4f4f4;border-radius:16px;"
                        + "font-size:13px;line-height:1.6;color:" + MUTED + ";\">" + inline(footerNote) + "</div>";

        // 🔴 Ön izleme satırı: gelen kutusunda konunun yanında görünür ama İLETİDE
        // görünmez (sıfır yükseklik + gizli). Yazılmazsa istemci gövdenin ilk
        // kelimelerini basar ve bu davet metninde "Hi," olurdu.
        String hidden = preheader == null ? ""
                : "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">"
                        + escape(preheader) + "</div>";

        return """
                <!doctype html>
                <html lang="%s"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>%s</title></head>
                <body style="margin:0;padding:0;background:%s;">
                %s
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"
                       style="background:%s;padding:32px 12px;">
                  <tr><td align="center">
                    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"
                           style="max-width:520px;background:#ffffff;border-radius:24px;
                                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
                      <tr><td style="padding:32px 32px 8px 32px;">
                        <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:%s;">Waydee</div>
                      </td></tr>
                      <tr><td style="padding:8px 32px 0 32px;">
                        <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;font-weight:700;
                                   letter-spacing:-0.02em;color:%s;">%s</h1>
                      </td></tr>
                      <tr><td style="padding:0 32px 8px 32px;">%s%s%s</td></tr>
                      <tr><td style="padding:16px 32px 32px 32px;">
                        <div style="border-top:1px solid %s;padding-top:16px;font-size:12px;line-height:1.6;color:%s;">
                          %s
                        </div>
                      </td></tr>
                    </table>
                  </td></tr>
                </table>
                </body></html>
                """.formatted(escape(locale), escape(heading), CANVAS, hidden, CANVAS, INK, INK,
                escape(heading), bodyHtml, cta, note, LINE, MUTED, footer(locale));
    }

    /**
     * Alt bilgi — <b>çıkış yolu burada</b>.
     *
     * <p>🔴 Toplu postada çıkış yolu yazmak yasal bir zorunluluk (GDPR / CAN-SPAM)
     * <b>ve</b> teslim edilebilirliğin temel taşıdır: çıkamayan kullanıcı "spam"
     * düğmesine basar ve o şikâyet, tek bir kişiyi değil alan adının itibarını
     * vurur.
     *
     * <p>⚠️ Çıkış bir <b>bağlantı değil, adres</b>: tek tıkla çalışan bir çıkış ucu
     * herkese açık olmak zorundadır ve e-posta tarayıcıları bağlantıları önceden
     * çeker — yani kimse tıklamadan insanlar listeden düşerdi. {@code mailto}
     * bu tuzağı hiç kurmadan aynı sözü verir ve gelen istek bastırma listesine
     * elle işlenir.
     */
    private String footer(String locale) {
        boolean tr = isTurkish(locale);
        String mail = "<a href=\"mailto:" + SUPPORT_EMAIL + "?subject=unsubscribe\" style=\"color:"
                + MUTED + ";\">" + SUPPORT_EMAIL + "</a>";
        return tr
                ? "Bu ileti Waydee tarafından gönderildi.<br>"
                        + "Bu tür iletileri almak istemiyorsan " + mail + " adresine yaz — listeden çıkarırız."
                : "This message was sent by Waydee.<br>"
                        + "If you'd rather not receive these, email " + mail + " and we'll remove you.";
    }

    private String linkFallback(String locale) {
        return isTurkish(locale)
                ? "Düğme çalışmıyorsa bu adresi tarayıcına yapıştır:"
                : "If the button doesn't work, paste this address into your browser:";
    }

    private String neutralName(String locale) {
        return isTurkish(locale) ? "merhaba" : "there";
    }

    private boolean isTurkish(String locale) {
        return locale != null && locale.toLowerCase(Locale.ROOT).startsWith("tr");
    }

    // ---------------------------------------------------------------- düz metin

    /**
     * HTML'in düz metin karşılığı.
     *
     * <p>⚠️ Bağlantılar <b>"metin (adres)"</b> biçiminde açılır. Yalnız etiketi
     * bırakmak, düz metin okuyan alıcıya tıklanacak hiçbir şey bırakmazdı.
     */
    private String plain(String heading, String body, String ctaLabel, String ctaUrl, String footerNote) {
        List<String> parts = new ArrayList<>();
        parts.add(heading);
        parts.add("");
        parts.add(unmark(body));
        if (ctaLabel != null && ctaUrl != null) {
            parts.add("");
            parts.add(ctaLabel + ": " + ctaUrl);
        }
        if (footerNote != null) {
            parts.add("");
            parts.add(unmark(footerNote));
        }
        parts.add("");
        parts.add("— Waydee");
        parts.add("Bu tür iletileri almak istemiyorsan / to unsubscribe: " + SUPPORT_EMAIL);
        return String.join("\n", parts);
    }

    private String unmark(String raw) {
        String text = LINK.matcher(raw).replaceAll(m -> Matcher.quoteReplacement(m.group(1) + " (" + m.group(2) + ")"));
        return BOLD.matcher(text).replaceAll(m -> Matcher.quoteReplacement(m.group(1)));
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
