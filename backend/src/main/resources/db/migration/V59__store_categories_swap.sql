-- V59 — KATEGORİ DEĞİŞİMİ DÜZELTİLDİ (25 Ağu 2026, 98. tur 2. bölüm)
--
-- 🔴 V56 KULLANICIYI YANLIŞ ANLADI. Talimat şuydu:
--
--     Yiyecek  - Oyun
--     Sanat    - Sağlık
--     Güzellik - Eğitim
--     Müzik    - Borsa
--
-- Bu bir **liste** değil, **eşleştirme** tablosuydu: *"soldakini sağdakiyle
-- değiştirecektin"*. V56 bunu "yeni kategori listesi bu sekizlidir" diye okudu
-- ve listede olmayan yedi kategoriyi (Moda · Teknoloji · Spor · Ev & Yaşam ·
-- Seyahat · Hizmet · Diğer) pasife aldı.
--
-- Bu migration ikisini birden yapar:
--   ① V56'nın pasife aldığı yedi kategoriyi **geri getirir**,
--   ② asıl istenen **dört değişimi** uygular.
--
-- ⚠️ DERS: iki sütunlu bir liste verildiğinde "bu yeni liste mi, yoksa
-- eşleştirme mi?" sorusu sorulmalı. Yanlış okuma, veriyi sessizce değil
-- görünür biçimde bozdu — ama kullanıcının fark etmesiyle düzeldi.

-- ---------------------------------------------------------------------------
-- ① GERİ AL — V56'nın düşürdüğü kategoriler yeniden yayında.
--
-- Sıra numaraları V52'deki özgün değerlerine döner: aradaki turda karışan sıra,
-- kullanıcının alışkın olduğu şeridi yeniden dizerdi.
UPDATE store_categories SET active = TRUE, sort_order = 1,  updated_at = now() WHERE code = 'FASHION';
UPDATE store_categories SET active = TRUE, sort_order = 2,  updated_at = now() WHERE code = 'TECH';
UPDATE store_categories SET active = TRUE, sort_order = 5,  updated_at = now() WHERE code = 'SPORT';
UPDATE store_categories SET active = TRUE, sort_order = 7,  updated_at = now() WHERE code = 'HOME';
UPDATE store_categories SET active = TRUE, sort_order = 9,  updated_at = now() WHERE code = 'TRAVEL';
UPDATE store_categories SET active = TRUE, sort_order = 10, updated_at = now() WHERE code = 'SERVICE';
UPDATE store_categories SET active = TRUE, sort_order = 99, updated_at = now() WHERE code = 'OTHER';

-- ---------------------------------------------------------------------------
-- ② DEĞİŞİM — soldaki gider, sağdaki onun YERİNİ alır.
--
-- 🔴 Yeni kategori, değiştirdiğinin **sıra numarasını devralır**: şerit aynı
-- yerde aynı sayıda çip gösterir, yalnız o çipin kimliği değişir. Sona eklemek,
-- kullanıcının kas hafızasını bozardı.
--
-- ⚠️ Giden kategoriler **silinmez, pasife alınır** (V52 kuralı): bugün
-- "Yiyecek" seçmiş mağazaların rozeti kaybolmamalı. `ON DELETE RESTRICT` zaten
-- silmeye izin vermez.
UPDATE store_categories SET active = FALSE, updated_at = now()
 WHERE code IN ('FOOD', 'ART', 'BEAUTY', 'MUSIC');

-- Yerlerini alanlar (V56'da eklenmişlerdi; sıraları devralıyorlar):
UPDATE store_categories SET active = TRUE, sort_order = 3, updated_at = now() WHERE code = 'GAMING';    -- Yiyecek  → Oyun
UPDATE store_categories SET active = TRUE, sort_order = 4, updated_at = now() WHERE code = 'HEALTH';    -- Sanat    → Sağlık
UPDATE store_categories SET active = TRUE, sort_order = 6, updated_at = now() WHERE code = 'EDUCATION'; -- Güzellik → Eğitim
UPDATE store_categories SET active = TRUE, sort_order = 8, updated_at = now() WHERE code = 'FINANCE';   -- Müzik    → Borsa

-- ---------------------------------------------------------------------------
-- 🔴 KAYIT POPUP'ININ CEVABI — yalnız GERÇEKTEN pasif kalanlar temizlenir.
--
-- V56 bu temizliği yapmıştı ve o an doğruydu; ama şimdi yedi kategori geri
-- geldi. Tekrar çalıştırmak, geri gelen bir kategoriyi seçmiş kullanıcının
-- cevabını da silerdi — bu yüzden koşul `active = FALSE` üzerinden yeniden
-- değerlendiriliyor (yani yalnız FOOD/ART/BEAUTY/MUSIC ve V56'dan kalanlar).
--
-- ⚠️ V56'nın sildiği cevaplar geri gelmez: silinen veri geri getirilemez.
-- Etkilenen kullanıcı mağaza açarken kategorisini yeniden seçer.
UPDATE users
   SET store_category_id = NULL
 WHERE store_category_id IN (SELECT id FROM store_categories WHERE active = FALSE);
