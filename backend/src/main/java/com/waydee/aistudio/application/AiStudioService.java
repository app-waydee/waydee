package com.waydee.aistudio.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.waydee.aistudio.api.dto.AiStudioDtos.EditorialRequest;
import com.waydee.aistudio.api.dto.AiStudioDtos.FashionModelRequest;
import com.waydee.aistudio.api.dto.AiStudioDtos.GenerationResponse;
import com.waydee.aistudio.api.dto.AiStudioDtos.PoseRequest;
import com.waydee.aistudio.api.dto.AiStudioDtos.QuoteResponse;
import com.waydee.aistudio.domain.AiGeneration;
import com.waydee.aistudio.domain.AiGenerationKind;
import com.waydee.aistudio.domain.AiGenerationStatus;
import com.waydee.aistudio.infrastructure.AiGenerationRepository;
import com.waydee.common.error.ApiException;
import com.waydee.common.error.ErrorCode;
import com.waydee.identity.application.CreditService;
import com.waydee.social.application.MediaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

/**
 * <b>Yapay zekâ görsel stüdyosu</b> (V45 · 99. tur: üç araç).
 *
 * <h3>Akışın sırası — her adım bir öncekini korur</h3>
 * <ol>
 *   <li><b>Plan kapısı</b> — ücretsiz hesap giremez.</li>
 *   <li><b>Hız kapıları</b> — aynı anda en fazla {@value #MAX_ACTIVE} açık iş,
 *       saatte en fazla {@value #MAX_PER_HOUR} üretim.</li>
 *   <li><b>Sahiplik</b> — her girdi görseli <b>isteği yapanın</b> olmalı.</li>
 *   <li><b>Maliyet</b> sunucuda hesaplanır.</li>
 *   <li><b>Satır yazılır</b> (dış çağrıdan ÖNCE).</li>
 *   <li><b>Kredi düşülür</b> (atomik).</li>
 *   <li>Arka planda sağlayıcıya gidilir; başarısızlıkta <b>iade</b>.</li>
 * </ol>
 *
 * <p>🔴 5 ve 6'nın sırası bilinçli: satır olmadan düşülen bir kredi, iade
 * edilecek bir kaydı olmayan kayıp bir kredidir. Tersi (önce düş, sonra yaz)
 * de mümkündü ama o zaman satır yazımı başarısız olursa kredi kaybolurdu — bu
 * sıralamada ise kredi düşümü başarısız olursa geriye yalnız <b>QUEUED</b>
 * kalan bir satır kalır ve o satır hiç çalıştırılmaz.
 *
 * <p>⚠️ <b>Üç araç, tek akış</b> (99. tur). Editoryal ve Poz açıldığında yeni
 * bir servis yazılmadı: kapılar, kredi düşümü, iade ve yoklama üçünde de aynı
 * olmalı. Ayrı akışlar olsaydı, iade kuralının biri düzeltilip diğeri unutulan
 * bir kopyası ortaya çıkardı.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiStudioService {

    /** Aynı anda açık kalabilecek üretim sayısı (kullanıcı başına). */
    public static final int MAX_ACTIVE = 3;

    /**
     * Saatlik üretim tavanı.
     *
     * <p>🔴 Kredi tek başına yeterli bir fren <b>değil</b>: yıllık Premium bir
     * hesabın 120.000 kredisi var ve bunu bir saatte harcamaya kalkarsa hem
     * sağlayıcı kotamızı hem uygulamanın thread havuzunu tüketir. Kredi
     * <b>ekonomik</b>, bu <b>işletimsel</b> bir sınırdır.
     */
    public static final int MAX_PER_HOUR = 40;

    private final AiGenerationRepository generationRepository;
    private final CreditService creditService;
    private final MediaService mediaService;
    private final FashionPromptBuilder promptBuilder;
    private final ScenePromptBuilder scenePromptBuilder;
    private final FalClient falClient;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final ObjectMapper objectMapper;

    /* ------------------------------------------------------------------ okuma */

    /**
     * Maliyet önizlemesi.
     *
     * <p>⚠️ Bakiyeyi de döndürür: arayüz "240 kredi" yazarken düğmeyi de
     * kilitleyebilsin. İki ayrı çağrı olsaydı ikisi arasında bakiye değişebilir
     * ve düğme yanlış durumda kalırdı.
     *
     * <p>⚠️ {@code count} aracın anlamına göre okunur: mankende <b>ürün
     * sayısı</b>, pozda <b>görsel sayısı</b>, editoryalde <b>kullanılmaz</b>.
     * Üç ayrı uç açmak yerine tek uç: istemci hangi araçta olursa olsun aynı
     * soruyu sorar ve formülü asla kopyalamaz.
     */
    @Transactional(readOnly = true)
    public QuoteResponse quote(UUID userId, AiGenerationKind kind, boolean highQuality, int count) {
        int cost = switch (kind) {
            case FASHION_MODEL -> CreditCost.of(highQuality, count);
            case EDITORIAL -> CreditCost.editorial(highQuality);
            case POSE -> CreditCost.pose(count);
        };
        int balance = creditService.summary(userId).balance();
        return new QuoteResponse(cost, balance, balance >= cost);
    }

    @Transactional(readOnly = true)
    public List<GenerationResponse> list(UUID userId, int limit) {
        return generationRepository
                .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, Math.min(Math.max(limit, 1), 60)))
                .stream()
                .map(GenerationResponse::from)
                .toList();
    }

    /**
     * Tek üretim — arayüz bunu <b>yoklayarak</b> sonucu bekler.
     *
     * <p>🔒 Sahiplik kontrolü şart: kimlik tahmin edilemez olsa da
     * "bulunması zor" güvenlik değildir.
     */
    @Transactional(readOnly = true)
    public GenerationResponse get(UUID userId, UUID generationId) {
        AiGeneration generation = generationRepository.findById(generationId)
                .orElseThrow(() -> ApiException.notFound("Üretim bulunamadı"));
        if (!generation.getUserId().equals(userId)) {
            throw ApiException.forbidden("Bu üretim size ait değil");
        }
        return GenerationResponse.from(generation);
    }

    /* --------------------------------------------------------------- yaratma */

    /**
     * "Manken / Deneme" üretimini <b>başlatır</b> ve hemen döner.
     *
     * <p>⚠️ Yanıt {@code QUEUED} durumundadır; sonuç yoklama ile alınır.
     * Senkron beklemek 6–40 saniye boyunca bir istek thread'ini bloke ederdi.
     */
    @Transactional
    public GenerationResponse createFashionModel(UUID userId, FashionModelRequest request) {
        assertReady(userId);
        assertWithinRateLimits(userId, 1);

        List<UUID> products = request.productMediaIds();
        if (products.isEmpty() || products.size() > CreditCost.MAX_PRODUCTS) {
            throw ApiException.badRequest("En az 1, en fazla " + CreditCost.MAX_PRODUCTS + " ürün görseli ekleyebilirsin");
        }
        /* 🔒 IDOR kapısı: başkasının medya kimliğini yazan bir istek, o görseli
           kendi üretiminde kullanabilirdi. Projedeki diğer medya tüketicileri
           de bu kontrolü yapıyor. */
        products.forEach(mediaId -> mediaService.assertOwnedBy(mediaId, userId));

        String prompt = promptBuilder.build(request);
        int cost = CreditCost.of(request.highQuality(), products.size());

        AiGeneration generation = generationRepository.save(new AiGeneration(
                userId, AiGenerationKind.FASHION_MODEL, cost,
                writeParams(request, promptBuilder.aspectRatio(request), request.highQuality()),
                prompt, products));

        // Atomik düşüm — yetmezse 402 ve satır QUEUED'da kalır (hiç çalıştırılmaz).
        creditService.spend(userId, cost, "gen:" + generation.getId(), "Fast Model");

        /*
         * 🔴 İş DOĞRUDAN çağrılmaz, OLAY yayınlanır.
         *
         * İki tuzağı birden kapatır:
         *   ① Aynı sınıftan çağrılan bir `@Async` metodu proxy'den geçmez ve
         *      sessizce SENKRON koşar — istek 40 saniye asılı kalırdı.
         *   ② Bu transaction henüz COMMIT edilmedi. Arka plan thread'i satırı
         *      okumaya kalksa bulamazdı (kendi bağlantısı, kendi görüşü).
         *      Dinleyici AFTER_COMMIT fazında koşar, yani satır kesin oradadır.
         */
        events.publishEvent(new AiGenerationQueuedEvent(generation.getId()));

        return GenerationResponse.from(generation);
    }

    /**
     * "Editoryal / Değişim" üretimini başlatır (99. tur).
     *
     * <p>🔴 <b>GİRDİ SIRASI: ÖNCE SAHNE, SONRA ÖZNE</b> (102. turda tersine
     * çevrildi). {@code nano-banana/edit} <b>birinci görseli düzenlenen
     * fotoğraf</b> sayar; sahne ikinci sırada gönderildiğinde model onu ya hiç
     * uygulamıyor ya da — özne düz zeminli bir ürün fotoğrafıysa — tutunacak
     * bir mekân bulamayıp <b>sahneyi bütünüyle kopyalıyordu</b>. Kullanıcının
     * *"ne verdik, ne çıktısı veriyor"* dediği hata buydu; yedi ölçüm çağrısıyla
     * bulundu, tablo {@link ScenePromptBuilder#editorial}'de.
     *
     * <p>⚠️ Bu sıra {@link ScenePromptBuilder#editorial} istemine <b>bağlıdır</b>
     * (istem "image 1 = mekân" diyor). Biri değişip öteki kalırsa araç sessizce
     * yine bozulur — ikisi birlikte okunur, birlikte değişir.
     *
     * <p>⚠️ Kullanıcı arayüzündeki kutuların sırası <b>değişmedi</b>: ekranda
     * hâlâ önce "Model / ürün görseli", sonra "Stil referansı" var. Sağlayıcıya
     * gönderim sırası bir <b>uygulama ayrıntısıdır</b> ve kullanıcıya
     * sızdırılmaz.
     */
    @Transactional
    public GenerationResponse createEditorial(UUID userId, EditorialRequest request) {
        assertReady(userId);
        assertWithinRateLimits(userId, 1);

        String aspectRatio = SceneOptions.requireAspectRatio(request.aspectRatio());
        List<UUID> inputs = List.of(request.styleMediaId(), request.subjectMediaId());
        // 🔒 IDOR kapısı — manken aracıyla aynı gerekçe.
        inputs.forEach(mediaId -> mediaService.assertOwnedBy(mediaId, userId));

        int cost = CreditCost.editorial(request.highQuality());
        AiGeneration generation = generationRepository.save(new AiGeneration(
                userId, AiGenerationKind.EDITORIAL, cost,
                writeParams(request, aspectRatio, request.highQuality()),
                scenePromptBuilder.editorial(request), inputs));

        creditService.spend(userId, cost, "gen:" + generation.getId(), "Editorial");
        events.publishEvent(new AiGenerationQueuedEvent(generation.getId()));
        return GenerationResponse.from(generation);
    }

    /**
     * "Poz" üretimini başlatır — istenen sayıda <b>ayrı satır</b> açar (99. tur).
     *
     * <p>🔴 Üç görsel = üç satır, üç ayrı kredi düşümü, üç ayrı iade yolu.
     * Tek satırda üç görsel üretilseydi ikisi başarılı biri başarısız olduğunda
     * ne iade edileceği belirsiz kalırdı — vault kuralı: <i>bir üretim = bir
     * görsel</i>.
     *
     * <p>⚠️ Satırların hepsi <b>aynı transaction</b>'da yazılır: ikisi yazılıp
     * üçüncüsü patlarsa kullanıcı üç görselin ücretini ödemiş ama ikisini almış
     * olurdu.
     */
    @Transactional
    public List<GenerationResponse> createPose(UUID userId, PoseRequest request) {
        assertReady(userId);
        int count = Math.max(1, Math.min(request.imageCount(), CreditCost.MAX_POSE_IMAGES));
        assertWithinRateLimits(userId, count);

        mediaService.assertOwnedBy(request.sceneMediaId(), userId);
        /* ⚠️ Geçerlilik ÖNCE ölçülür: geçersiz bir yaratıcılık kodu döngünün
           ortasında patlasaydı, kullanıcı gördüğü hata mesajını hiçbir satırla
           eşleştiremezdi. */
        String prompt = scenePromptBuilder.pose(request);
        String aspectRatio = scenePromptBuilder.poseAspectRatio();
        int perImage = CreditCost.POSE_PER_IMAGE;

        List<GenerationResponse> out = new ArrayList<>();
        List<UUID> ids = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            AiGeneration generation = generationRepository.save(new AiGeneration(
                    userId, AiGenerationKind.POSE, perImage,
                    writeParams(request, aspectRatio, false),
                    prompt, List.of(request.sceneMediaId())));
            creditService.spend(userId, perImage, "gen:" + generation.getId(), "Fast Pose");
            ids.add(generation.getId());
            out.add(GenerationResponse.from(generation));
        }
        ids.forEach(id -> events.publishEvent(new AiGenerationQueuedEvent(id)));
        return out;
    }

    /* ---------------------------------------------------------------- kapılar */

    /**
     * Üç aracın da ilk iki kapısı.
     *
     * <p>⚠️ Sağlayıcı anahtarı EN BAŞTA sorulur: anahtar yokken kredi düşürmek,
     * kullanıcıdan bizim yapılandırma eksiğimiz için para almak olurdu.
     */
    private void assertReady(UUID userId) {
        if (!falClient.isConfigured()) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR,
                    "Yapay zekâ stüdyosu şu anda kullanılamıyor. Lütfen daha sonra dene.");
        }
        creditService.assertCanUseAi(userId);
    }

    /**
     * @param requested bu istekte açılacak satır sayısı — Poz aracı bir istekte
     *                  üç satır açabiliyor ve tavan <b>toplam</b> üzerinden
     *                  işler. Tek tek sayılsaydı üçlük bir istek tavanı sessizce
     *                  aşardı.
     */
    private void assertWithinRateLimits(UUID userId, int requested) {
        long active = generationRepository.countByUserIdAndStatusIn(
                userId, EnumSet.of(AiGenerationStatus.QUEUED, AiGenerationStatus.RUNNING));
        if (active + requested > MAX_ACTIVE) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "Aynı anda en fazla " + MAX_ACTIVE + " görsel üretebilirsin. Mevcut üretimlerin bitsin.");
        }
        long lastHour = generationRepository.countByUserIdAndCreatedAtAfter(
                userId, Instant.now().minus(Duration.ofHours(1)));
        if (lastHour + requested > MAX_PER_HOUR) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "Saatlik üretim sınırına ulaştın. Bir süre sonra tekrar dene.");
        }
    }

    /**
     * Ayarları JSON'a yazar.
     *
     * <p>⚠️ <b>En-boy oranı ve kalite bayrağı isteğin YANINA değil İÇİNE</b>
     * yazılır: koşucu bu iki değeri üç aracın üçünde de aynı yerden okusun diye.
     * Aksi hâlde her tür için ayrı bir çözümleme dalı gerekirdi ve oran, form
     * alanı olmayan Poz'da hiç yazılamazdı.
     *
     * <p>⚠️ Yazım başarısız olursa üretim <b>durdurulur</b>: parametresiz bir
     * satır, destek talebinde "hangi ayarlarla üretildi" sorusunu yanıtsız
     * bırakır ve "aynı ayarlarla tekrar" özelliği sessizce bozulurdu.
     */
    private String writeParams(Object request, String aspectRatio, boolean highQuality) {
        try {
            ObjectNode node = objectMapper.valueToTree(request);
            node.put("aspectRatio", aspectRatio);
            node.put("highQuality", highQuality);
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Ayarlar kaydedilemedi");
        }
    }
}
