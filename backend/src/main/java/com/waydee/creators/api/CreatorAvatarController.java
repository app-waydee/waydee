package com.waydee.creators.api;

import com.waydee.common.storage.StorageService;
import com.waydee.creators.application.ProfileEnricher;
import com.waydee.creators.domain.Platform;
import java.io.InputStream;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Keşif sonuçlarındaki <b>gerçek profil fotoğrafı</b> (108. tur ek).
 *
 * <p>Görsel {@link ProfileEnricher} tarafından platformdan bir kez indirilip
 * depoya yazılır; burada yalnız sunulur. {@code /api/v1/public/**} GET'i
 * herkese açık — {@code <img>} etiketi yetkilendirme başlığı gönderemez.
 * Yol bileşenleri platform enum'u ve platformun kendi kullanıcı adı kuralıyla
 * denetlenir; depoda keyfi bir anahtar okunamaz.
 */
@RestController
@RequestMapping("/api/v1/public/creator-avatars")
@RequiredArgsConstructor
public class CreatorAvatarController {

    private final StorageService storage;

    @GetMapping("/{platform}/{handle}")
    public ResponseEntity<byte[]> avatar(@PathVariable String platform, @PathVariable String handle) {
        Platform p;
        try {
            p = Platform.valueOf(platform);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
        if (!p.isValidHandle(handle)) {
            return ResponseEntity.notFound().build();
        }
        try (InputStream in = storage.get(ProfileEnricher.objectKey(p, handle))) {
            byte[] bytes = in.readAllBytes();
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                    .contentType(MediaType.IMAGE_JPEG)
                    .body(bytes);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
