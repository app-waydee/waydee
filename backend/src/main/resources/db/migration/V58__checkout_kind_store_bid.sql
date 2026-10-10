-- V58 — ÖDEME TÜRÜ LİSTESİNE `STORE_BID` (25 Ağu 2026, 98. tur)
--
-- 🔴 UÇTAN UCA TEST BUNU YAKALADI. V57 teklif tablosunu kurdu ve kod derlendi,
-- ama ilk gerçek ödeme oturumu **409 CONFLICT** ile düştü: `payment_checkouts`
-- tablosundaki `ck_payment_checkouts_kind` kısıtı yalnız dört türü tanıyordu
-- (TERRITORY_PURCHASE · TERRITORY_RENEWAL · PLAN_PRO · PLAN_PREMIUM) ve yeni
-- `STORE_BID` satırı veritabanı tarafından reddediliyordu.
--
-- ⚠️ DERS: bir enum'a değer eklemek Java tarafında **tek satırdır** ama o enum
-- veritabanında bir CHECK kısıtı olarak da yazılıysa şema da güncellenmeli.
-- Derleyici bunu göremez; yalnız gerçek bir istek gösterir.
ALTER TABLE payment_checkouts DROP CONSTRAINT IF EXISTS ck_payment_checkouts_kind;

ALTER TABLE payment_checkouts ADD CONSTRAINT ck_payment_checkouts_kind
    CHECK (kind IN ('TERRITORY_PURCHASE', 'TERRITORY_RENEWAL',
                    'PLAN_PRO', 'PLAN_PREMIUM', 'STORE_BID'));

-- Fatura türü de aynı sebeple genişler: `invoices.kind` PURCHASE | RENEWAL
-- dışında bir değer alıyorsa (STORE_BID) kısıt varsa reddederdi.
-- ⚠️ Kısıt yoksa bu blok sessizce hiçbir şey yapmaz — `IF EXISTS` ile güvenli.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS ck_invoices_kind;

ALTER TABLE invoices ADD CONSTRAINT ck_invoices_kind
    CHECK (kind IN ('PURCHASE', 'RENEWAL', 'STORE_BID'));
