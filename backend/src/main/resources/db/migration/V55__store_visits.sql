-- V55 — MAĞAZA ZİYARETİ: KAPIDAN KAÇ KİŞİ GEÇTİ, İÇERİDE NE KADAR KALDI
-- (24 Ağu 2026, 97. tur).
--
-- Kullanıcı talimatı: *"kaç kişinin kapıdan geçip kaç kişinin mağazada ne kadar
-- kaldığını ... istatistikler butonu ... stant sahibi görebilsin"*.
--
-- ---------------------------------------------------------------------------
-- 🔴 NEDEN YENİ TABLO, NEDEN `territory_views` DEĞİL
--
-- `territory_views` haritadaki **dairenin** görüntülenmesidir: bir bakış, süresi
-- yok. Buradaki olay ise **3B caddede bir kapıdan içeri girmek** ve içeride
-- **süre geçirmek**tir. İkisini aynı tabloya sıkıştırmak, süresi olmayan
-- satırlarla süresi olan satırları aynı ortalamaya sokardı — "ortalama kalış
-- süresi" o an yalan söylemeye başlar.
--
-- 🔴 GÜNDE BİR KEZ **DEĞİL**: bir mağazaya gün içinde üç kez girmek üç ayrı
-- ziyarettir; V54'ün profil kuralı burada geçerli değil çünkü ölçülen şey
-- "kim baktı" değil **"kaç kez uğrandı"**. Tekil ziyaretçi sayısı ayrıca
-- `COUNT(DISTINCT visitor_id)` ile raporlanır — iki ayrı soru, iki ayrı sayı.
--
-- ⚠️ `dwell_seconds` ziyaret **başlarken 0** yazılır ve çıkışta güncellenir:
-- sekmesini kapatan ziyaretçi için hiç satır olmamasındansa, süresi 0 olan bir
-- kapı geçişi olması doğruya daha yakındır (kapıdan geçtiği doğrudur).
--
-- ⚠️ `visitor_id` NULL olabilir: bugün evren oturum istiyor ama ileride vitrin
-- ziyaretçisine açılırsa şema değişmesin. Kullanıcı silinirse ziyaret sayısı
-- geçmişe dönük düşmesin diye `ON DELETE SET NULL`.
CREATE TABLE IF NOT EXISTS store_visits (
    id             UUID PRIMARY KEY,
    listing_id     UUID        NOT NULL REFERENCES marketplace_listings (id) ON DELETE CASCADE,
    visitor_id     UUID            NULL REFERENCES users (id) ON DELETE SET NULL,
    entered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- İçeride geçirilen saniye. Çıkışta (ya da sahneden ayrılırken) yazılır.
    dwell_seconds  INTEGER     NOT NULL DEFAULT 0,
    -- UTC gün — raporun gruplama anahtarı. V54 ile aynı hizada: "kimin günü?"
    -- sorusunun tek tutarlı cevabı UTC'dir.
    visit_day      DATE        NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date
);

-- Raporun tek sorgusu: "şu stantta, şu tarihten sonra". İkisi birlikte indekslenir.
CREATE INDEX IF NOT EXISTS idx_store_visits_listing_day
    ON store_visits (listing_id, visit_day);

-- Tekil ziyaretçi sayımı bu indeksten okur.
CREATE INDEX IF NOT EXISTS idx_store_visits_listing_visitor
    ON store_visits (listing_id, visitor_id);

-- 🔴 Süre **negatif ya da absürt** olamaz: değer istemciden geliyor ve istemci
-- her zaman kullanıcının elindedir. Uygulama da kırpıyor; burası son savunma.
-- Tavan 4 saat: bir sekmeyi açık unutan ziyaretçi ortalamayı tek başına
-- havaya uçurmasın.
ALTER TABLE store_visits
    ADD CONSTRAINT chk_store_visits_dwell CHECK (dwell_seconds >= 0 AND dwell_seconds <= 14400);
