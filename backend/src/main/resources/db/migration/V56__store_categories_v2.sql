-- V56 — MAĞAZA KATEGORİLERİ YENİLENDİ (25 Ağu 2026, 97. tur 4. bölüm).
--
-- Kullanıcı talimatı: *"soldaki kategorileri sağdakiyle değiştir:
-- Yiyecek · Oyun · Sanat · Sağlık · Güzellik · Eğitim · Müzik · Borsa"*.
--
-- ---------------------------------------------------------------------------
-- 🔴 SİLME YOK, PASİFE ALMA VAR — V52'nin kuralı burada ilk kez işliyor
--
-- Listeden çıkan sekiz kategori (Moda · Teknoloji · Spor · Ev & Yaşam ·
-- Seyahat · Hizmet · Diğer) **silinmiyor**, `active = FALSE` yapılıyor:
--
--  ① `territories.category_id` üzerinde **ON DELETE RESTRICT** var; DELETE
--     zaten patlardı (V52 bunu bilerek böyle kurdu).
--  ② Bugün "Moda" seçmiş mağazaların kategorisi **kaybolmamalı**. Pasif
--     kategori seçim listelerinden düşer, ama zaten seçmiş mağazada durur ve
--     haritada rozeti çizilmeye devam eder.
--
-- ⚠️ Yani bu migration'dan sonra bir mağazanın kategorisi listede olmayan bir
-- değer olabilir. Bu bir hata değil, **tasarım**: kullanıcı mağazasını bir
-- dahaki düzenlemesinde yeni listeden seçer.
UPDATE store_categories
   SET active = FALSE, updated_at = now()
 WHERE code IN ('FASHION', 'TECH', 'SPORT', 'HOME', 'TRAVEL', 'SERVICE', 'OTHER');

-- ---------------------------------------------------------------------------
-- Kalanlar: sıra yeni listeye göre yeniden yazılır ve ikonları tazelenir.
--
-- ⚠️ `code` DEĞİŞTİRİLMEZ — o bir çeviri anahtarıdır ve V52'de "değiştirilemez"
-- diye yazıldı. Değişen yalnız görünen ad, ikon, renk ve sıra.
UPDATE store_categories SET sort_order = 1, icon = 'ForkKnife',  color = '#F97316', active = TRUE, updated_at = now() WHERE code = 'FOOD';
UPDATE store_categories SET sort_order = 3, icon = 'PaintBrush', color = '#A855F7', active = TRUE, updated_at = now() WHERE code = 'ART';
UPDATE store_categories SET sort_order = 5, icon = 'Sparkle',    color = '#F43F5E', active = TRUE, updated_at = now() WHERE code = 'BEAUTY';
UPDATE store_categories SET sort_order = 7, icon = 'MusicNotes', color = '#8B5CF6', active = TRUE, updated_at = now() WHERE code = 'MUSIC';

-- ---------------------------------------------------------------------------
-- Yeni dörtlü.
--
-- 🔴 Kimlikler V52'deki gibi **sabit yazıldı**: ortamlar arası veri dökümü
-- (dump/restore) kategorileri kaybetmesin ve aynı kategori her ortamda aynı
-- kimliği taşısın.
--
-- ⚠️ `name` yalnız **yedektir**: arayüz `storeCategory.<code>` sözlüğünden
-- okur (5 dil). Sunucudan gelen Türkçe ad çok dilli arayüzde basılmaz.
INSERT INTO store_categories (id, code, name, icon, color, sort_order, active) VALUES
    ('a1000000-0000-4000-8000-00000000000c', 'GAMING',    'Oyun',    'GameController', '#6366F1', 2, TRUE),
    ('a1000000-0000-4000-8000-00000000000d', 'HEALTH',    'Sağlık',  'Heartbeat',      '#10B981', 4, TRUE),
    ('a1000000-0000-4000-8000-00000000000e', 'EDUCATION', 'Eğitim',  'GraduationCap',  '#0EA5E9', 6, TRUE),
    ('a1000000-0000-4000-8000-00000000000f', 'FINANCE',   'Borsa',   'ChartLineUp',    '#F59E0B', 8, TRUE)
ON CONFLICT (code) DO UPDATE
   SET icon = EXCLUDED.icon,
       color = EXCLUDED.color,
       sort_order = EXCLUDED.sort_order,
       active = TRUE,
       updated_at = now();

-- ---------------------------------------------------------------------------
-- 🔴 KAYIT POPUP'ININ CEVABI DA TEMİZLENİR.
--
-- `users.store_category_id` kayıt sırasında sorulan sorunun cevabıdır (V52).
-- Artık pasif olan bir kategoriyi işaret ediyorsa, mağaza açıldığında o değer
-- **tohum** olarak geçerdi ve kullanıcı hiç seçmediği, listede olmayan bir
-- kategoriyle mağaza açardı. Cevap boşaltılır; popup bir daha çıkmaz
-- (`needsStoreCategory` ayrı bir bayraktır — "sorulmuş olmak" ile
-- "cevaplanmış olmak" farklı iki olaydır, V52).
UPDATE users
   SET store_category_id = NULL
 WHERE store_category_id IN (SELECT id FROM store_categories WHERE active = FALSE);
