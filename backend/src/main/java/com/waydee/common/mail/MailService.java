package com.waydee.common.mail;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

/**
 * Giden e-posta gönderimi (SMTP).
 *
 * <p><b>Gönderim asenkrondur ve asla çağıranı düşürmez.</b> Kayıt akışının
 * SMTP sunucusunun hızına bağlı olması ya da geçici bir SMTP arızasının kaydı
 * geri alması kabul edilemez; bu yüzden hata yalnızca log'a yazılır. Kullanıcı
 * postayı almadıysa "tekrar gönder" ucu vardır.
 *
 * <p>Kapalıyken ({@code waydee.mail.enabled=false} ya da SMTP host tanımsız)
 * ileti gönderilmez, <b>bağlantı log'a basılır</b> — SMTP'siz yerel geliştirme
 * bu sayede tam akışla çalışır.
 */
@Slf4j
@Service
@EnableConfigurationProperties(MailProperties.class)
public class MailService {

    private final MailProperties properties;
    /** SMTP host tanımlı değilse Spring bu bean'i hiç oluşturmaz — bu yüzden lazy. */
    private final ObjectProvider<JavaMailSender> senderProvider;

    public MailService(MailProperties properties, ObjectProvider<JavaMailSender> senderProvider) {
        this.properties = properties;
        this.senderProvider = senderProvider;
    }

    public boolean isEnabled() {
        return properties.enabled() && senderProvider.getIfAvailable() != null;
    }

    public MailProperties properties() {
        return properties;
    }

    /**
     * İletiyi arka planda gönderir.
     *
     * @param to      alıcı adresi
     * @param message konu + HTML + düz metin
     */
    @Async
    public void send(String to, EmailMessage message) {
        sendBlocking(to, message, java.util.Map.of());
    }

    /**
     * İletiyi <b>çağıran thread'de</b> gönderir ve sonucu döndürür.
     *
     * <p>🔴 Toplu gönderim (V60) bunu kullanır. {@link #send} kullanılamazdı:
     * ①&nbsp;{@code @Async} zaten arka planda koşan bir kampanyanın içinden
     * çağrılınca <b>kendi kendine çağrı</b> olur ve proxy devreye girmez —
     * yani sessizce eşzamanlıya döner, ②&nbsp;kampanya her alıcı için
     * <b>başarılı mı</b> bilmek zorunda: {@code void} bir çağrı, ekranda
     * "gönderildi" yazıp aslında hiçbir şey göndermemek demekti.
     *
     * @param headers ek SMTP başlıkları (toplu postada {@code List-Unsubscribe})
     * @return SMTP sunucusu iletiyi kabul ettiyse {@code true}
     */
    public boolean sendBlocking(String to, EmailMessage message, java.util.Map<String, String> headers) {
        JavaMailSender sender = properties.enabled() ? senderProvider.getIfAvailable() : null;
        if (sender == null) {
            // Geliştirme kolaylığı: gönderemiyorsak en azından içeriği görünür kıl.
            log.warn("""
                    [MAIL KAPALI] Gönderilmedi → {}
                      Konu : {}
                      Metin: {}""", to, message.subject(), message.text());
            return false;
        }
        try {
            MimeMessage mime = sender.createMimeMessage();
            // true = multipart: aynı iletide hem düz metin hem HTML alternatifi.
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
            helper.setFrom(fromAddress());
            helper.setTo(to);
            helper.setSubject(message.subject());
            helper.setText(message.text(), message.html());
            // ⚠️ Başlıklar helper'dan SONRA yazılır: helper gövdeyi kurarken
            // kendi başlıklarını da yazıyor ve önce yazılan ezilirdi.
            for (var entry : headers.entrySet()) {
                mime.setHeader(entry.getKey(), entry.getValue());
            }
            sender.send(mime);
            log.info("E-posta gönderildi → {} ({})", to, message.subject());
            return true;
        } catch (Exception ex) {
            // Bilinçli olarak yutulur: e-posta arızası kayıt/şifre akışını düşürmez.
            log.error("E-posta gönderilemedi → {} ({}): {}", to, message.subject(), ex.getMessage());
            return false;
        }
    }

    /** Toplu gönderimin hata metnine yazacağı gerekçe — SMTP kapalıysa sebep budur. */
    public String disabledReason() {
        if (!properties.enabled()) {
            return "Gönderim kapalı (MAIL_ENABLED=false)";
        }
        if (senderProvider.getIfAvailable() == null) {
            return "SMTP sunucusu tanımlı değil (MAIL_HOST/MAIL_USERNAME)";
        }
        return null;
    }

    private InternetAddress fromAddress() throws UnsupportedEncodingException {
        return new InternetAddress(properties.from(), properties.fromName(), StandardCharsets.UTF_8.name());
    }
}
