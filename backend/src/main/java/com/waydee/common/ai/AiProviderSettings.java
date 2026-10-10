package com.waydee.common.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.waydee.common.error.ApiException;
import com.waydee.common.persistence.AppSetting;
import com.waydee.common.persistence.AppSettingRepository;
import com.waydee.common.security.SecretCipher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * <b>Claude / OpenAI sağlayıcı ayarları</b> (108. tur).
 *
 * <p>Kullanıcının cümlesi: *"arka planda sana hem Claude API'si hem GPT API'leri
 * vereceğim, bir alanı da admin paneline ekle — hangisinin API'si varsa
 * oradan derin araştırsın."* Buradan iki kural çıkar:
 * <ol>
 *   <li><b>Anahtarı olan çalışır</b> — {@link #usableProviders()} yalnız
 *       anahtarı girilmiş ve açık olanları, öncelik sırasıyla döndürür.</li>
 *   <li><b>İkisi de varsa yedeklenir</b> — öncelikli sağlayıcı bir adımda
 *       düşerse (kota, kesinti, geçersiz anahtar) o adım diğeriyle denenir.</li>
 * </ol>
 *
 * <h3>🔒 Anahtarlar</h3>
 * <ul>
 *   <li>{@code app_settings}e <b>şifreli</b> yazılır ({@link SecretCipher}).</li>
 *   <li>Yönetim ekranına <b>asla geri dönmez</b> — yalnız maskeli hâli
 *       ({@code sk-ant-…a1b2}). Alan yalnız yazılabilir: anahtarı görmek
 *       isteyen sağlayıcının paneline gider.</li>
 *   <li>⚠️ Ortam değişkeni yedeği <b>bilerek yok</b>: bu makinede başka araçlar
 *       için tanımlı bir {@code ANTHROPIC_API_KEY} varsa sessizce oradan
 *       harcama yapılırdı.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiProviderSettings {

    static final String CONFIG_KEY = "ai.providers.config";
    static final String ANTHROPIC_KEY = "ai.anthropic.key";
    static final String OPENAI_KEY = "ai.openai.key";
    static final String ANTHROPIC_WORKSPACE = "ai.anthropic.workspace";

    /** Anthropic çalışma alanı kimliği biçimi (ör. {@code wrkspc_01AbC…}). */
    private static final Pattern WORKSPACE_ID = Pattern.compile("^wrkspc_[A-Za-z0-9]{6,80}$");

    /** Varsayılan modeller — V61 ile aynı. Yönetimden değiştirilebilir. */
    public static final String DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";
    public static final String DEFAULT_OPENAI_MODEL = "gpt-6-astra";

    /**
     * Model adı biçimi. ⚠️ Serbest metin kabul edilmez: model adı bir HTTP
     * gövdesine girer ve beklenmeyen karakterler (boşluk, tırnak) sağlayıcıda
     * anlaşılmaz bir 400 olarak dönerdi.
     */
    private static final Pattern MODEL_NAME = Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9._:\\-]{1,79}$");

    private final AppSettingRepository settings;
    private final SecretCipher cipher;
    private final ObjectMapper objectMapper;

    /**
     * Gizli olmayan yapılandırma.
     *
     * @param priority        deneme sırası — ilk anahtarı olan çalışır
     * @param costSmall       10 sonuçlu aramanın kredi maliyeti
     * @param costLarge       20 sonuçlu aramanın kredi maliyeti
     * @param maxWebSearches  bir aramada en çok web sorgusu (sağlayıcı faturası buna bağlı)
     */
    public record Config(List<AiProvider> priority, String anthropicModel, String openaiModel,
                         boolean anthropicEnabled, boolean openaiEnabled,
                         int costSmall, int costLarge, int maxWebSearches) {

        public Config {
            priority = normalizePriority(priority);
            anthropicModel = blankTo(anthropicModel, DEFAULT_ANTHROPIC_MODEL);
            openaiModel = blankTo(openaiModel, DEFAULT_OPENAI_MODEL);
            costSmall = costSmall > 0 ? costSmall : 40;
            costLarge = costLarge > 0 ? costLarge : 70;
            maxWebSearches = maxWebSearches > 0 ? Math.min(maxWebSearches, 30) : 12;
        }

        public String modelFor(AiProvider provider) {
            return provider == AiProvider.ANTHROPIC ? anthropicModel : openaiModel;
        }

        public boolean enabled(AiProvider provider) {
            return provider == AiProvider.ANTHROPIC ? anthropicEnabled : openaiEnabled;
        }

        static Config defaults() {
            return new Config(List.of(AiProvider.ANTHROPIC, AiProvider.OPENAI),
                    DEFAULT_ANTHROPIC_MODEL, DEFAULT_OPENAI_MODEL, true, true, 40, 70, 12);
        }

        /**
         * Öncelik listesi her zaman iki sağlayıcıyı da, tekrarsız içerir.
         * ⚠️ Eksik bir sağlayıcı listede yoksa "anahtarı var ama hiç
         * denenmiyor" gibi açıklanamaz bir durum doğardı.
         */
        private static List<AiProvider> normalizePriority(List<AiProvider> raw) {
            Set<AiProvider> ordered = new LinkedHashSet<>();
            if (raw != null) {
                raw.stream().filter(p -> p != null).forEach(ordered::add);
            }
            ordered.addAll(List.of(AiProvider.values()));
            return List.copyOf(ordered);
        }

        private static String blankTo(String value, String fallback) {
            return value == null || value.isBlank() ? fallback : value.trim();
        }
    }

    /** Çalışmaya hazır bir sağlayıcı: anahtarı çözülmüş, modeli belli. */
    public record ProviderAccess(AiProvider provider, String apiKey, String model, String workspaceId) {

        /** ⚠️ Anahtar asla log'a ya da istisna mesajına düşmesin. */
        @Override
        public String toString() {
            return "ProviderAccess[" + provider + ", " + model + (workspaceId == null ? "" : ", " + workspaceId) + "]";
        }
    }

    /** Anahtarın durumu — yönetim ekranının rozetleri. */
    public enum KeyStatus { CONFIGURED, MISSING, UNREADABLE }

    public record ProviderView(AiProvider provider, String label, KeyStatus keyStatus, String maskedKey,
                               String model, boolean enabled, Instant keyUpdatedAt, String workspaceId) {
    }

    public record AdminView(List<ProviderView> providers, List<AiProvider> priority,
                            int costSmall, int costLarge, int maxWebSearches, boolean anyUsable) {
    }

    // ------------------------------------------------------------------ okuma

    @Transactional(readOnly = true)
    public Config config() {
        return settings.findById(CONFIG_KEY)
                .map(AppSetting::getValue)
                .map(this::parseConfig)
                .orElseGet(Config::defaults);
    }

    /**
     * Şu an kullanılabilir sağlayıcılar, <b>öncelik sırasıyla</b>.
     *
     * <p>Boş liste = özellik kapalı. Çağıran bunu "kullanıcıdan para almadan
     * reddet" olarak yorumlamalı (bkz. {@code CreatorSearchService}).
     */
    @Transactional(readOnly = true)
    public List<ProviderAccess> usableProviders() {
        Config config = config();
        List<ProviderAccess> out = new ArrayList<>();
        for (AiProvider provider : config.priority()) {
            if (!config.enabled(provider)) {
                continue;
            }
            readKey(provider).ifPresent(key -> out.add(new ProviderAccess(provider, key, config.modelFor(provider), workspaceFor(provider))));
        }
        return List.copyOf(out);
    }

    @Transactional(readOnly = true)
    public AdminView adminView() {
        Config config = config();
        List<ProviderView> views = new ArrayList<>();
        for (AiProvider provider : AiProvider.values()) {
            Optional<AppSetting> stored = settings.findById(keySetting(provider));
            Optional<String> plain = stored.map(AppSetting::getValue).flatMap(cipher::decrypt);
            KeyStatus status = stored.isEmpty() ? KeyStatus.MISSING
                    : plain.isPresent() ? KeyStatus.CONFIGURED : KeyStatus.UNREADABLE;
            views.add(new ProviderView(provider, provider.label(), status, plain.map(AiProviderSettings::mask).orElse(null),
                    config.modelFor(provider), config.enabled(provider), stored.map(AppSetting::getUpdatedAt).orElse(null),
                    workspaceFor(provider)));
        }
        boolean anyUsable = !usableProviders().isEmpty();
        return new AdminView(views, config.priority(), config.costSmall(), config.costLarge(),
                config.maxWebSearches(), anyUsable);
    }

    // ------------------------------------------------------------------ yazma

    /**
     * Anahtarı şifreleyip yazar.
     *
     * <p>⚠️ Biçim kontrolü <b>kaba</b> ve bilerek öyle: sağlayıcılar önek
     * şemalarını değiştirebiliyor. Asıl doğrulama "Bağlantıyı test et"
     * düğmesidir — gerçek bir istek atar.
     */
    @Transactional
    public void setKey(AiProvider provider, String rawKey) {
        String key = rawKey == null ? "" : rawKey.strip();
        if (key.isEmpty()) {
            throw ApiException.badRequest("Anahtar boş olamaz");
        }
        if (key.length() < 20 || key.length() > 400 || key.chars().anyMatch(Character::isWhitespace)) {
            throw ApiException.badRequest("Anahtar biçimi geçersiz görünüyor");
        }
        if (provider == AiProvider.ANTHROPIC && !key.startsWith("sk-ant-")) {
            throw ApiException.badRequest("Claude API anahtarı 'sk-ant-' ile başlamalıdır");
        }
        if (provider == AiProvider.OPENAI && !key.startsWith("sk-")) {
            throw ApiException.badRequest("OpenAI API anahtarı 'sk-' ile başlamalıdır");
        }
        String encrypted = cipher.encrypt(key);
        AppSetting setting = settings.findById(keySetting(provider)).orElse(null);
        if (setting == null) {
            settings.save(new AppSetting(keySetting(provider), encrypted));
        } else {
            setting.update(encrypted);
        }
        // ⚠️ Yalnız son dört karakter log'a düşer.
        log.info("{} API anahtarı güncellendi ({})", provider.label(), mask(key));
    }

    @Transactional
    public void clearKey(AiProvider provider) {
        settings.findById(keySetting(provider)).ifPresent(settings::delete);
        log.info("{} API anahtarı kaldırıldı", provider.label());
    }

    @Transactional
    public Config updateConfig(List<AiProvider> priority, String anthropicModel, String openaiModel,
                               boolean anthropicEnabled, boolean openaiEnabled,
                               int costSmall, int costLarge, int maxWebSearches) {
        validateModel(anthropicModel);
        validateModel(openaiModel);
        if (costSmall < 1 || costSmall > 10_000 || costLarge < 1 || costLarge > 10_000) {
            throw ApiException.badRequest("Kredi maliyeti 1 ile 10.000 arasında olmalı");
        }
        // ⚠️ Büyük arama küçükten ucuz olamaz: ekranda "20 sonuç daha ucuz"
        // yazması hem anlamsız hem de kullanıcıyı hep büyük aramaya iterdi.
        if (costLarge < costSmall) {
            throw ApiException.badRequest("20 sonuçlu arama 10 sonuçludan ucuz olamaz");
        }
        if (maxWebSearches < 3 || maxWebSearches > 30) {
            throw ApiException.badRequest("Web sorgusu sınırı 3 ile 30 arasında olmalı");
        }
        Config config = new Config(priority, anthropicModel, openaiModel, anthropicEnabled, openaiEnabled,
                costSmall, costLarge, maxWebSearches);
        String json;
        try {
            json = objectMapper.writeValueAsString(config);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Yapılandırma yazılamadı", e);
        }
        AppSetting setting = settings.findById(CONFIG_KEY).orElse(null);
        if (setting == null) {
            settings.save(new AppSetting(CONFIG_KEY, json));
        } else {
            setting.update(json);
        }
        return config;
    }

    /**
     * <b>Claude çalışma alanı (workspace) kimliği</b> — 7 Eki 2026, ilk gerçek anahtarla bulundu.
     *
     * <p>Kullanıcının girdiği anahtar bir çalışma alanına bağlı değildi ve Anthropic her
     * isteği şöyle reddetti: <i>"This API key is not scoped to a workspace, so this request
     * must include the anthropic-workspace-id header."</i> Bu tür anahtarlarda kimlik
     * {@code anthropic-workspace-id} başlığıyla gönderilmek zorunda.
     *
     * <p>⚠️ Gizli bir değer DEĞİL (Console'da görünen bir kimlik) — şifrelenmez, panelde
     * açık gösterilir. Boş bırakılırsa başlık gönderilmez (çalışma alanına bağlı
     * anahtarlarda gerekmez ve göndermek gereksiz bir bağımlılık olurdu).
     */
    @Transactional
    public void setWorkspace(AiProvider provider, String raw) {
        if (provider != AiProvider.ANTHROPIC) {
            throw ApiException.badRequest("Çalışma alanı kimliği yalnız Claude için geçerlidir");
        }
        String value = raw == null ? "" : raw.strip();
        if (value.isEmpty()) {
            settings.findById(ANTHROPIC_WORKSPACE).ifPresent(settings::delete);
            return;
        }
        if (!WORKSPACE_ID.matcher(value).matches()) {
            throw ApiException.badRequest("Çalışma alanı kimliği 'wrkspc_' ile başlamalıdır (Console → Settings → Workspaces)");
        }
        AppSetting setting = settings.findById(ANTHROPIC_WORKSPACE).orElse(null);
        if (setting == null) {
            settings.save(new AppSetting(ANTHROPIC_WORKSPACE, value));
        } else {
            setting.update(value);
        }
        log.info("Claude çalışma alanı kimliği güncellendi ({})", value);
    }

    private String workspaceFor(AiProvider provider) {
        if (provider != AiProvider.ANTHROPIC) {
            return null;
        }
        return settings.findById(ANTHROPIC_WORKSPACE).map(AppSetting::getValue)
                .filter(v -> !v.isBlank()).orElse(null);
    }

    // ---------------------------------------------------------------- yardımcı

    /** Test bağlantısı için tek bir sağlayıcının erişimi (açık/kapalı bayrağına bakmaz). */
    @Transactional(readOnly = true)
    public Optional<ProviderAccess> access(AiProvider provider) {
        Config config = config();
        return readKey(provider).map(key -> new ProviderAccess(provider, key, config.modelFor(provider), workspaceFor(provider)));
    }

    private Optional<String> readKey(AiProvider provider) {
        return settings.findById(keySetting(provider)).map(AppSetting::getValue).flatMap(cipher::decrypt);
    }

    private Config parseConfig(String json) {
        try {
            return objectMapper.readValue(json, Config.class);
        } catch (JsonProcessingException e) {
            // ⚠️ Bozuk bir ayar satırı özelliği kilitlememeli — varsayılana düşülür ve söylenir.
            log.warn("ai.providers.config okunamadı, varsayılan kullanılıyor: {}", e.getOriginalMessage());
            return Config.defaults();
        }
    }

    private static void validateModel(String model) {
        if (model == null || !MODEL_NAME.matcher(model.trim()).matches()) {
            throw ApiException.badRequest("Model adı geçersiz: harf, rakam, '.', '-', '_' ve ':' kullanılabilir");
        }
    }

    private static String keySetting(AiProvider provider) {
        return provider == AiProvider.ANTHROPIC ? ANTHROPIC_KEY : OPENAI_KEY;
    }

    /**
     * {@code sk-ant-api03-…a1b2}: önek tanınsın diye ilk birkaç karakter ve
     * hangi anahtar olduğu anlaşılsın diye son dört karakter.
     */
    static String mask(String key) {
        if (key.length() <= 12) {
            return "••••";
        }
        String head = key.toLowerCase(Locale.ROOT).startsWith("sk-ant-") ? key.substring(0, 7) : key.substring(0, 3);
        return head + "…" + key.substring(key.length() - 4);
    }
}
