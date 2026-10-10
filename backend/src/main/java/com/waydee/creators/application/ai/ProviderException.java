package com.waydee.creators.application.ai;

import com.waydee.common.ai.AiProvider;

/**
 * Sağlayıcı çağrısının <b>sınıflandırılmış</b> hatası (108. tur).
 *
 * <p>Sınıf, iki karar için var: ① diğer sağlayıcıya geçilsin mi,
 * ② kullanıcıya ne söylensin. Ham sağlayıcı mesajı kullanıcıya <b>gösterilmez</b>
 * — içinde model adı, istek kimliği ve bazen anahtarın bir parçası olabilir.
 */
public class ProviderException extends RuntimeException {

    public enum Kind {
        /** Anahtar geçersiz / yetkisiz (401, 403). */
        AUTH,
        /** Kota ya da hız sınırı (429). */
        RATE_LIMIT,
        /** Sağlayıcı tarafında arıza (5xx, aşırı yük). */
        UNAVAILABLE,
        /** Bağlantı / zaman aşımı. */
        NETWORK,
        /** İstek reddedildi (400) — çoğunlukla model adı ya da parametre. */
        BAD_REQUEST,
        /** Claude anahtarı bir çalışma alanına bağlı değil — Workspace ID gerekli. */
        WORKSPACE_REQUIRED,
        /** Güvenlik sınıflandırıcısı reddetti. */
        REFUSAL,
        /** Çıktı yarıda kesildi ya da şemaya uymadı. */
        MALFORMED
    }

    private final AiProvider provider;
    private final Kind kind;

    public ProviderException(AiProvider provider, Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.provider = provider;
        this.kind = kind;
    }

    public ProviderException(AiProvider provider, Kind kind, String message) {
        this(provider, kind, message, null);
    }

    public AiProvider provider() {
        return provider;
    }

    public Kind kind() {
        return kind;
    }
}
