-- V62 — KISA LİSTE TAKİBİ + DETAYLI VERİLER (9 Eki 2026, 109. tur)
--
-- Kullanıcı talimatı: *"analiz sonucu çıkan profilleri takip listesine alıp
-- takip listesinde olduğu kadar sürede yaşadığı değişimi göstersin; 7/14/30
-- günlük etkileşim, izlenme, yaptığı iş birlikleri… Gerçek rakamlar olsun,
-- olmazsa ortalama rakamlar gelsin."*
--
-- 🔴 İKİ AYRI VERİ, İKİ AYRI GÜVEN DÜZEYİ
--  * creator_snapshots — BİZİM ölçtüğümüz: profil sayfasının kendisinin yazdığı
--    takipçi sayısı, günde en çok bir kez. "Listedeyken ne kadar büyüdü" sorusunun
--    tek dürüst cevabı budur; yapay zekâ tahmini buraya YAZILMAZ.
--  * creator_insights — yapay zekâ araştırması: 7/14/30 gün metrikleri, iş
--    birlikleri, kitle. Her sayı `basis` taşır: REPORTED (bir sayfada yazıyor)
--    ya da ESTIMATED (platform/kademe ortalaması).
--
-- ⚠️ Kredi `credit_ledger`'da (`insight:<id>` / `refund-insight:<id>`).

CREATE TABLE IF NOT EXISTS creator_snapshots (
    id            UUID PRIMARY KEY,
    shortlist_id  UUID        NOT NULL REFERENCES creator_shortlist (id) ON DELETE CASCADE,
    followers     BIGINT      NOT NULL,
    captured_at   TIMESTAMPTZ NOT NULL,
    -- Günde tek ölçüm: ECS'de birden çok örnek aynı zamanlanmış işi koşar; tekil
    -- indeks ikincisini sessizce düşürür (ON CONFLICT DO NOTHING).
    captured_on   DATE        NOT NULL,
    CONSTRAINT uq_creator_snapshots_day UNIQUE (shortlist_id, captured_on),
    CONSTRAINT chk_creator_snapshots_followers CHECK (followers >= 0)
);

CREATE INDEX IF NOT EXISTS idx_creator_snapshots_entry_time
    ON creator_snapshots (shortlist_id, captured_at);

CREATE TABLE IF NOT EXISTS creator_insights (
    id            UUID PRIMARY KEY,
    shortlist_id  UUID        NOT NULL REFERENCES creator_shortlist (id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- QUEUED → RUNNING → SUCCEEDED | FAILED
    status        VARCHAR(16) NOT NULL,
    locale        VARCHAR(8)  NOT NULL,
    cost          INTEGER     NOT NULL,
    report_json   TEXT,
    -- Ekrandaki ilerleme: PROFILE → RESEARCH → ANALYZE.
    phase         VARCHAR(16),
    error_code    VARCHAR(40),
    input_tokens  BIGINT      NOT NULL DEFAULT 0,
    output_tokens BIGINT      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL,
    finished_at   TIMESTAMPTZ,
    CONSTRAINT chk_creator_insights_status
        CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT chk_creator_insights_cost CHECK (cost > 0)
);

CREATE INDEX IF NOT EXISTS idx_creator_insights_entry_time
    ON creator_insights (shortlist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_insights_open
    ON creator_insights (status, created_at) WHERE status IN ('QUEUED', 'RUNNING');
