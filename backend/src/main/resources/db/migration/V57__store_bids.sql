-- V57 — MAĞAZANI ÖNE TAŞI: ÖDEMELİ SIRALAMA (25 Ağu 2026, 98. tur)
--
-- Kullanıcı talimatı: bidkick.me benzeri bir yapı. *"Sistem çok basit: en çok
-- parayı verenler yukarıdan aşağı listelenecek mağazası."*
--
-- ---------------------------------------------------------------------------
-- 🔴 TEKLİFLER TOPLANMAZ (bidkick kuralı) — AMA GERİYE DE GİTMEZ
--
-- bidkick.me'de yeni teklif eskisinin YERİNİ alır, üstüne eklenmez. Bu kural
-- aynen alındı; tek fark: burada geçerli teklif kullanıcının **ödediği en
-- yüksek** tutardır. Sebep somut: kurala harfiyen uyup "son ödenen tutar"
-- deseydik, 1000₺ ödemiş bir kullanıcının 50₺'lik ikinci ödemesi onu listenin
-- dibine düşürürdü — para ödeyip sırasını KAYBETMEK hiçbir kullanıcının
-- beklemediği sonuçtur ve destek talebine dönüşür.
--
-- ⚠️ Bu yüzden satır **geçmiş** tutar: her ödeme bir satırdır ve yalnız biri
-- ACTIVE olur. Eski satırlar REPLACED olarak durur — "kim ne zaman ne kadar
-- ödedi" sorusunun cevabı faturadan bağımsız olarak da okunabilmeli.
--
-- 🔴 SÜRE YOK: sıra, biri geçene kadar durur (bidkick: *"Stay up — until
-- someone outbids you"*). Bitiş tarihi koymak, ödeyen kullanıcının bir sabah
-- listeden düşmesi demekti ve ürün bunu vaat etmiyor.
CREATE TABLE IF NOT EXISTS store_bids (
    id            UUID PRIMARY KEY,
    user_id       UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Öne çıkarılan mağaza. ⚠️ Mağaza silinirse teklif satırı DURUR (SET NULL):
    -- para ödenmiştir, muhasebe kaydı yok edilemez. Listeleme zaten mağazası
    -- olmayan teklifi göstermez.
    territory_id  UUID               NULL REFERENCES territories (id) ON DELETE SET NULL,
    amount        NUMERIC(12, 2) NOT NULL,
    currency      VARCHAR(3)     NOT NULL,
    -- PENDING → ödeme bekliyor · ACTIVE → sırada · REPLACED → daha yüksek
    -- teklifi geldiği için düştü · FAILED → ödeme tamamlanamadı
    status        VARCHAR(16)    NOT NULL,
    checkout_id   UUID,
    invoice_id    UUID,
    placed_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    activated_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    created_by    UUID,
    updated_by    UUID,
    version       BIGINT         NOT NULL DEFAULT 0,
    CONSTRAINT chk_store_bids_amount CHECK (amount > 0)
);

-- 🔴 KULLANICI BAŞINA TEK AKTİF TEKLİF — veritabanı seviyesinde.
-- Uygulama da kontrol ediyor ama iki eşzamanlı webhook (sağlayıcılar aynı
-- olayı iki kez gönderebilir) uygulamadaki kontrolü aşar ve aynı kullanıcı
-- listede İKİ kez görünürdü.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_bids_active_user
    ON store_bids (user_id) WHERE status = 'ACTIVE';

-- Sıralama sorgusunun indeksi: en yüksek tutar üstte, eşitlikte ÖNCE ödeyen.
CREATE INDEX IF NOT EXISTS idx_store_bids_rank
    ON store_bids (status, amount DESC, activated_at ASC);

CREATE INDEX IF NOT EXISTS idx_store_bids_user ON store_bids (user_id, placed_at DESC);

COMMENT ON TABLE store_bids IS
    'Mağaza öne çıkarma teklifleri (V57). Sıralama: amount DESC, eşitlikte activated_at ASC.';
COMMENT ON COLUMN store_bids.status IS
    'PENDING | ACTIVE | REPLACED | FAILED. Kullanıcı başına yalnız bir ACTIVE (kısmi tekil indeks).';
