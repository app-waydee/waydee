package com.waydee.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * <b>Gizli ayar şifrelemesinin bekçisi</b> (108. tur).
 *
 * <p>🔴 Asıl iş {@link #degistirilenSifreliMetinCOZULMEZ()} testinde: AES-GCM
 * kimlik doğrulamalı olduğu için oynanmış bir şifreli metin bozuk bir anahtar
 * üretmek yerine <b>hiç çözülmemeli</b> — aksi hâlde sağlayıcıya çöp bir anahtar
 * gönderilir ve hata "OpenAI çalışmıyor" gibi görünürdü.
 */
class SecretCipherTest {

    private static final JwtProperties JWT = new JwtProperties(
            "dGVzdC1qd3Qtc2VjcmV0LWZvci11bml0LXRlc3RzLW9ubHktNjQtYnl0ZXMtbG9uZy0xMjM0NTY3ODkw",
            "waydee", Duration.ofMinutes(15), Duration.ofDays(30));

    @Test
    @DisplayName("Şifrele → çöz aynı değeri verir; düz metin çıktıda görünmez")
    void gidisDonus() {
        SecretCipher cipher = new SecretCipher("", JWT);
        String encrypted = cipher.encrypt("sk-ant-api03-secret-value");
        assertTrue(SecretCipher.isEncrypted(encrypted));
        assertFalse(encrypted.contains("secret-value"));
        assertEquals("sk-ant-api03-secret-value", cipher.decrypt(encrypted).orElseThrow());
    }

    @Test
    @DisplayName("Her şifreleme farklı çıktı verir (rastgele IV)")
    void rastgeleIv() {
        SecretCipher cipher = new SecretCipher("", JWT);
        assertNotEquals(cipher.encrypt("aynı"), cipher.encrypt("aynı"));
    }

    @Test
    @DisplayName("🔴 Değiştirilen şifreli metin ÇÖZÜLMEZ (bozuk anahtar üretmez)")
    void degistirilenSifreliMetinCOZULMEZ() {
        SecretCipher cipher = new SecretCipher("", JWT);
        String encrypted = cipher.encrypt("sk-ant-api03-secret-value");
        // ⚠️ Ortadan bir karakter: Base64'ün son karakterlerinde kullanılmayan
        // dolgu bitleri var — orayı değiştirmek bazen veriyi hiç bozmuyordu.
        int i = encrypted.length() / 2;
        char c = encrypted.charAt(i);
        String tampered = encrypted.substring(0, i) + (c == 'A' ? 'B' : 'A') + encrypted.substring(i + 1);
        assertTrue(cipher.decrypt(tampered).isEmpty());
    }

    @Test
    @DisplayName("⚠️ Anahtar değişince eski kayıt çözülmez — istisna değil, boş döner")
    void anahtarDegisinceBos() {
        String encrypted = new SecretCipher("", JWT).encrypt("değer");
        SecretCipher other = new SecretCipher("tamamen-baska-bir-anahtar-malzemesi", JWT);
        assertTrue(other.decrypt(encrypted).isEmpty());
    }

    @Test
    @DisplayName("Şifrelenmemiş ya da bozuk değer boş döner")
    void sifresizDegerBos() {
        SecretCipher cipher = new SecretCipher("", JWT);
        assertTrue(cipher.decrypt("pk.duz-metin").isEmpty());
        assertTrue(cipher.decrypt("enc:v1:!!!base64-degil").isEmpty());
        assertTrue(cipher.decrypt(null).isEmpty());
    }
}
