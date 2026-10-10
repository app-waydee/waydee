-- V61 — INFLUENCER KEŞFİ: YAPAY ZEKÂ İLE DERİN ARAŞTIRMA (7 Eki 2026, 108. tur)
--
-- Kullanıcı talimatı: *"https://www.influsense.tech/'teki bir özelliğin benzerini
-- ve daha gelişmiş hâlini kendi tasarımımızda yapacağız. Kullanıcılar veya
-- firmalar filtreler girecek — hangi alanda video üretiyor, hangi kategoride,
-- kaç takipçisi olsun. Arka planda Claude ve GPT API'leri olacak; hangisinin
-- anahtarı varsa oradan derin araştırsın."*
--
-- ---------------------------------------------------------------------------
-- 🔴 SONUÇ BİR ANLIK GÖRÜNTÜDÜR (`results_json`)
--
-- Bir arama, koşulduğu andaki web'in fotoğrafıdır. Raporu yeniden açan kullanıcı
-- AYNI listeyi görmelidir (InfluSense de böyle yapar: "results are a snapshot of
-- the creator when that search was run"). Satırları ayrı bir tabloya bölmek,
-- yalnız tek bir arama içinde okunan veriyi parçalayıp birleştirmek olurdu.
--
-- 🔴 SİNYAL PUANLARI SAKLANIR, NİHAİ PUAN SAKLANMAZ
--
-- Her aday için sekiz sinyalin 0–1 değeri `results_json` içinde durur; nihai
-- puan = ağırlıklı ortalama, ve ağırlıklar KULLANICININDIR. Kullanıcı radar
-- grafiğini sürükledikçe sıralama yeni bir API çağrısı OLMADAN değişir — puanı
-- saklasaydık her ağırlık değişikliği yeni (ve ücretli) bir arama isterdi.
--
-- ⚠️ Kredi bu tabloda değil, `credit_ledger`'da (`creator:<id>` / `refund-creator:<id>`).

CREATE TABLE IF NOT EXISTS creator_searches (
    id              UUID PRIMARY KEY,
    user_id         UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- QUEUED → RUNNING → SUCCEEDED | FAILED
    status          VARCHAR(16)  NOT NULL,
    -- Kullanıcının düz dilde yazdığı istek ("Türkiye'de vegan yemek yapan mikro YouTuber'lar").
    brief           TEXT         NOT NULL,
    -- Açık filtreler (platform, kademe, ülke, dil, bütçe…) ve ağırlıklar. İstemcinin
    -- gönderdiği HAM gövde değil, sunucuda doğrulanıp normalleştirilmiş hâli.
    filters_json    TEXT         NOT NULL,
    weights_json    TEXT         NOT NULL,
    -- Yapay zekânın brief'ten çıkardığı yapı (niş, anahtar kelimeler, sorgular).
    criteria_json   TEXT,
    -- Şeffaf boru hattı: her adımın durumu, süresi ve hangi sağlayıcının koştuğu.
    steps_json      TEXT         NOT NULL,
    results_json    TEXT,
    result_count    INTEGER      NOT NULL DEFAULT 0,
    -- Kaç aday ELENDİ ve neden (kaynağı doğrulanamadı, kopya, platform dışı…).
    -- Sessiz eleme yok: kullanıcı "20 istedim, 14 geldi" sorusunun cevabını görür.
    dropped_json    TEXT,
    requested_count INTEGER      NOT NULL,
    cost            INTEGER      NOT NULL,
    locale          VARCHAR(8)   NOT NULL DEFAULT 'tr',
    -- Bilgi amaçlı: hangi sağlayıcı/model koştu, ne kadar tüketti. Yönetim
    -- ekranı maliyet izlemesini bu kolonlardan yapar.
    provider        VARCHAR(16),
    model           VARCHAR(80),
    input_tokens    BIGINT       NOT NULL DEFAULT 0,
    output_tokens   BIGINT       NOT NULL DEFAULT 0,
    web_searches    INTEGER      NOT NULL DEFAULT 0,
    error_message   VARCHAR(500),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      UUID,
    updated_by      UUID,
    version         BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT chk_creator_searches_status
        CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT chk_creator_searches_cost CHECK (cost > 0)
);

-- Geçmiş listesi ve hız kapısı ("son bir saatte kaç arama") aynı indeksi kullanır.
CREATE INDEX IF NOT EXISTS idx_creator_searches_user ON creator_searches (user_id, created_at DESC);

-- Süpürücü: takılı kalan koşuları bulur. Kısmi indeks — bitmiş milyonlarca satır taranmaz.
CREATE INDEX IF NOT EXISTS idx_creator_searches_open
    ON creator_searches (status, created_at) WHERE status IN ('QUEUED', 'RUNNING');

-- 🔴 KISA LİSTE — kullanıcının biriktirdiği içerik üreticileri.
--
-- Aday aramadan KOPYALANIR (`data_json`), aramaya bağlanmaz: arama silinse ya da
-- yenisi koşulsa da kullanıcının listesindeki kişi ve notu kaybolmamalı.
CREATE TABLE IF NOT EXISTS creator_shortlist (
    id               UUID PRIMARY KEY,
    user_id          UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform         VARCHAR(16)  NOT NULL,
    -- Küçük harfli ve '@'sız: aynı kişinin iki yazımı iki kayıt olmasın.
    handle           VARCHAR(120) NOT NULL,
    data_json        TEXT         NOT NULL,
    note             VARCHAR(500),
    source_search_id UUID         NULL REFERENCES creator_searches (id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_shortlist_user_creator
    ON creator_shortlist (user_id, platform, handle);
CREATE INDEX IF NOT EXISTS idx_creator_shortlist_user ON creator_shortlist (user_id, created_at DESC);

COMMENT ON TABLE creator_searches IS
    'Influencer keşfi aramaları (V61). results_json bir anlık görüntüdür; nihai puan saklanmaz, sinyaller saklanır.';
COMMENT ON TABLE creator_shortlist IS
    'Kullanıcının kısa listesi (V61). Aday aramadan kopyalanır, arama silinse de kayıt kalır.';

-- ---------------------------------------------------------------------------
-- Sağlayıcı ayarlarının VARSAYILANI. Anahtarlar burada YOK: gizli değerler
-- yönetim panelinden girilir ve `app_settings`e ŞİFRELİ yazılır (bkz.
-- SecretCipher). Burada yalnız gizli olmayan yapılandırma durur.
--
-- ⚠️ Model adları 7 Eki 2026'da sağlayıcıların güncel dokümanından alındı:
-- Claude Opus 5.5 (`claude-opus-5-5`) ve OpenAI GPT-6 Astra (`gpt-6-astra`).
-- Yönetim panelinden değiştirilebilir — model adı bir dağıtım gerektirmemeli.
INSERT INTO app_settings (setting_key, value, updated_at)
VALUES ('ai.providers.config',
        '{"priority":["ANTHROPIC","OPENAI"],"anthropicModel":"claude-opus-5-5","openaiModel":"gpt-6-astra","anthropicEnabled":true,"openaiEnabled":true,"costSmall":40,"costLarge":70,"maxWebSearches":12}',
        now())
ON CONFLICT (setting_key) DO NOTHING;
