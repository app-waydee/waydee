package com.waydee.common.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

/**
 * <b>Veritabanında duran gizli değerlerin şifrelenmesi</b> (108. tur).
 *
 * <p>Yönetim panelinden girilen Claude / OpenAI API anahtarları
 * {@code app_settings} tablosuna yazılıyor. O tablo bugüne kadar yalnız
 * <b>genel</b> değerler taşıyordu (Mapbox {@code pk.} anahtarı, fiyatlar) ve
 * düz metin olması doğruydu. Gizli bir anahtarı düz metin yazmak ise bir
 * veritabanı yedeğinin, bir okuma replikasının ya da yanlış bir SQL çıktısının
 * <b>faturalı bir API anahtarını</b> sızdırması demekti.
 *
 * <h3>Algoritma</h3>
 * AES-256-GCM (kimlik doğrulamalı): şifreli metin değiştirilirse çözme
 * <b>başarısız olur</b>, sessizce bozuk bir anahtar üretmez. Her şifrelemede
 * rastgele 12 baytlık IV; çıktı biçimi {@code enc:v1:<base64(iv‖şifreli)>}.
 * Sürüm öneki ileride algoritma değişirse eski kayıtların ayırt edilmesi için.
 *
 * <h3>🔴 Anahtar nereden geliyor — ve neden ayrı bir ortam değişkeni ZORUNLU değil</h3>
 * <ol>
 *   <li>{@code SECRETS_KEY} tanımlıysa ondan türetilir (önerilen).</li>
 *   <li>Yoksa {@code JWT_SECRET}'tan <b>HKDF</b> ile, ayrı bir etiketle türetilir.</li>
 * </ol>
 * Yeni bir zorunlu değişken eklemek, üretimin bir sonraki dağıtımda
 * <b>hiç açılmaması</b> riskini getirirdi; JWT anahtarı ise üretimde zaten
 * zorunlu ve en az 64 bayt ({@code ProductionSecretsGuard}). HKDF etiketi
 * sayesinde türetilen anahtar JWT imza anahtarıyla <b>aynı değildir</b>.
 *
 * <p>⚠️ <b>Bedeli:</b> JWT anahtarı döndürülürse (ve {@code SECRETS_KEY} yoksa)
 * kayıtlı API anahtarları çözülemez. Bu sessiz bir hata değildir:
 * {@link #decrypt} boş döner, yönetim ekranı "anahtar çözülemedi, yeniden girin"
 * der ve arama özelliği kapalı görünür — kimse bozuk bir anahtarla istek atmaz.
 */
@Slf4j
@Component
public class SecretCipher {

    private static final String PREFIX = "enc:v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final byte[] HKDF_INFO = "waydee:app-settings-secrets:v1".getBytes(StandardCharsets.UTF_8);

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public SecretCipher(@Value("${waydee.security.secrets-key:}") String secretsKey,
                        JwtProperties jwtProperties) {
        byte[] material;
        if (secretsKey != null && !secretsKey.isBlank()) {
            material = secretsKey.getBytes(StandardCharsets.UTF_8);
        } else {
            material = jwtProperties.secret().getBytes(StandardCharsets.UTF_8);
            log.info("SECRETS_KEY tanımlı değil — gizli ayarların anahtarı JWT_SECRET'tan HKDF ile türetiliyor");
        }
        this.key = new SecretKeySpec(hkdf(material), "AES");
    }

    /** Değer bu sınıfça şifrelenmiş mi (önekten anlaşılır). */
    public static boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            ByteBuffer out = ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted);
            return PREFIX + Base64.getEncoder().encodeToString(out.array());
        } catch (GeneralSecurityException e) {
            // JDK'da AES-GCM her zaman vardır; buraya düşmek ortamın bozuk olduğunu gösterir.
            throw new IllegalStateException("Gizli değer şifrelenemedi", e);
        }
    }

    /**
     * Çözer. Çözülemezse <b>boş</b> döner, istisna fırlatmaz.
     *
     * <p>⚠️ Fırlatmak yerine boş dönmek bilinçli: çözülemeyen bir anahtar
     * "yapılandırılmamış" ile aynı sonucu doğurmalı (özellik kapalı görünür),
     * isteği 500'e düşürmemeli. Sebep log'a yazılır.
     */
    public Optional<String> decrypt(String stored) {
        if (!isEncrypted(stored)) {
            return Optional.empty();
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            if (all.length <= IV_BYTES) {
                return Optional.empty();
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            byte[] plain = cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES);
            return Optional.of(new String(plain, StandardCharsets.UTF_8));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            log.warn("Gizli ayar çözülemedi (anahtar değişmiş olabilir): {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    /**
     * HKDF-SHA256 (RFC 5869), tek blok — 32 baytlık AES-256 anahtarı.
     *
     * <p>⚠️ Anahtar malzemesi doğrudan {@code SHA-256(secret)} ile
     * alınmadı: aynı sır başka bir yerde de özetleniyorsa iki kullanım aynı
     * anahtarı paylaşırdı. HKDF'nin {@code info} etiketi bu amacı ayırır.
     */
    private static byte[] hkdf(byte[] inputKeyMaterial) {
        try {
            Mac extract = Mac.getInstance("HmacSHA256");
            extract.init(new SecretKeySpec(new byte[32], "HmacSHA256"));
            byte[] prk = extract.doFinal(inputKeyMaterial);

            Mac expand = Mac.getInstance("HmacSHA256");
            expand.init(new SecretKeySpec(prk, "HmacSHA256"));
            expand.update(HKDF_INFO);
            expand.update((byte) 1);
            return expand.doFinal();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Anahtar türetilemedi", e);
        }
    }
}
