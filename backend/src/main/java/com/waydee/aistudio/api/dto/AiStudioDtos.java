package com.waydee.aistudio.api.dto;

import com.waydee.aistudio.domain.AiGeneration;
import com.waydee.common.storage.MediaUrls;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Yapay zekâ stüdyosunun veri sözleşmeleri (V45).
 *
 * <p>⚠️ İstekte <b>hiçbir serbest metin ve hiçbir maliyet alanı yoktur</b>:
 * istem sunucuda kodlardan kurulur, maliyet sunucuda hesaplanır. Gerekçe
 * {@code FashionOptions} ve {@code CreditCost} başlıklarında.
 */
public final class AiStudioDtos {

    private AiStudioDtos() {
    }

    /**
     * "Fast Model" isteği.
     *
     * @param productMediaIds yüklenmiş ürün görselleri — <b>sıra korunur</b>
     * @param heightCm        150–200; istem "yaklaşık şu boyda" der
     * @param highQuality     2K (büyütmeli) mi
     */
    public record FashionModelRequest(
            @NotEmpty @Size(max = 4) List<UUID> productMediaIds,
            @NotNull String gender,
            @NotNull String ethnicity,
            @NotNull String age,
            @NotNull String skinTone,
            @NotNull String faceType,
            @NotNull String eyeColor,
            @NotNull String expression,
            @NotNull String hairColor,
            @NotNull String hairstyle,
            @NotNull String bodySize,
            @Min(150) @Max(200) int heightCm,
            @NotNull String shot,
            @NotNull String background,
            boolean highQuality) {
    }


    /**
     * "Editoryal / Değişim" isteği (99. tur).
     *
     * <p>🔴 <b>Mod istekten alınmaz.</b> Referans üründe kullanıcı Editorial ve
     * Swap arasında seçim yapıyor; burada modu <b>istem</b> belirler ve istem
     * sunucuda kurulur. Sebep basit: mod, yüklenen görselin ne olduğuna bağlı
     * bir <b>gözlemdir</b> (üzerinde insan var mı), bir tercih değil — ve
     * istemciye sorulsaydı yanlış cevap sessizce kötü bir çıktı üretirdi.
     * Model iki görseli de görüyor, ayrımı o yapıyor.
     *
     * @param subjectMediaId model ya da ürün görseli — <b>özne</b>
     * @param styleMediaId   sahneyi/ışığı veren <b>stil referansı</b>
     * @param aspectRatio    {@code SceneOptions.ASPECT_RATIOS} içinden
     */
    public record EditorialRequest(
            @NotNull UUID subjectMediaId,
            @NotNull UUID styleMediaId,
            @NotNull String aspectRatio,
            boolean highQuality) {
    }

    /**
     * "Poz" isteği (99. tur).
     *
     * <p>⚠️ {@code imageCount} <b>kaç satır yazılacağını</b> söyler, tek bir
     * satırda kaç görsel üretileceğini değil. Gerekçe {@code CreditCost}'ta.
     *
     * @param creativity {@code STANDARD} | {@code CREATIVE}
     */
    public record PoseRequest(
            @NotNull UUID sceneMediaId,
            @NotNull String creativity,
            @Min(1) @Max(3) int imageCount) {
    }

    /**
     * Maliyet önizlemesi — "Oluştur" düğmesinin altındaki <b>… kredi</b> yazısı.
     *
     * <p>🔴 Ayrı bir uç olması bilinçli: istemci formülü <b>kopyalamaz</b>,
     * sorar. Kopyalasaydı iki formül er geç birbirinden sapar ve ekranda yazan
     * rakam ile düşen rakam farklı olurdu.
     *
     * @param affordable bakiye yetiyor mu (düğme buna göre kilitlenir)
     */
    public record QuoteResponse(int cost, int balance, boolean affordable) {
    }

    /**
     * Bir üretim.
     *
     * <p>⚠️ {@code paramsJson} <b>dışarı verilmez</b> — arayüz "aynı ayarlarla
     * tekrar" için kendi durumunu zaten tutuyor; sunucudan geri okumak yeni bir
     * ayrıştırma yüzeyi açardı.
     */
    public record GenerationResponse(UUID id, String status, String kind,
                                     int creditCost, String imageUrl,
                                     UUID mediaId, String errorMessage,
                                     int productCount, Instant createdAt) {

        public static GenerationResponse from(AiGeneration g) {
            return new GenerationResponse(
                    g.getId(),
                    g.getStatus().name(),
                    g.getKind().name(),
                    g.getCreditCost(),
                    /* ⚠️ Adres HER OKUMADA yeniden imzalanır (imza süreli).
                       Kaydedilmiş bir adres saklamak, yedi gün sonra kırık
                       görsellerle dolu bir galeri demekti. */
                    g.getResultMediaId() == null ? null : MediaUrls.of(g.getResultMediaId()),
                    g.getResultMediaId(),
                    g.getErrorMessage(),
                    g.getInputMediaIds().size(),
                    g.getCreatedAt());
        }
    }
}
