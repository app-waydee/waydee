-- V60 — YÖNETİMDEN TOPLU E-POSTA: ŞABLON + KAMPANYA (1 Eyl 2026, 107. tur)
--
-- Kullanıcı talimatı: *"admin tarafına mail gönderme sistemi oluşturacağız,
-- noreply@waydee.com üzerinden gidecek, mail şablonları oluşturabilelim ve
-- kopyala yapıştır usulü verdiğim maillere o şablon gitsin. CC falan ekleme
-- yok. Günlük kaç mail atabiliriz spama düşmemek için uyarıyı da yaz."*
--
-- ---------------------------------------------------------------------------
-- 🔴 HER ALICIYA AYRI İLETİ — CC/BCC YOK
--
-- Kural yalnız bir istek değil, teknik bir zorunluluktur: tek iletiye 200 kişi
-- CC'lemek ① adresleri birbirine ifşa eder (KVKK/GDPR ihlali), ② alıcı başına
-- teslim durumu ölçülemez hale getirir, ③ neredeyse tüm sağlayıcılarda doğrudan
-- spam işaretidir. Bu yüzden `email_recipients` **satır başına bir ileti**
-- tutar ve her satırın kendi durumu vardır.
--
-- 🔴 İÇERİK KAMPANYAYA KOPYALANIR (`subject_snapshot` / `html_snapshot`)
--
-- Şablon yarın değişecektir. Anlık görüntü alınmasaydı "bu kişiye ne
-- gönderdik" sorusunun cevabı, şablonun BUGÜNKÜ hâli olurdu — yani geçmiş
-- sessizce yeniden yazılırdı. Gönderilmiş posta değiştirilemez bir kayıttır.
--
-- ⚠️ Günlük kota tabloda DEĞİL: `email_recipients.sent_at` üzerinden sayılır.
-- Ayrı bir sayaç kolonu tutmak, iki kaynağın (sayaç ve gerçek satırlar) bir
-- gün ayrışması demekti — vault'un tekrar eden hatası.

CREATE TABLE IF NOT EXISTS email_templates (
    id            UUID PRIMARY KEY,
    -- Yönetimde görünen İÇ ad ("Davet — İngilizce"). Alıcı bunu hiç görmez.
    name          VARCHAR(120)  NOT NULL,
    subject       VARCHAR(200)  NOT NULL,
    -- Gelen kutusunda konunun yanında beliren ön izleme satırı. Boş bırakılırsa
    -- istemci gövdenin ilk kelimelerini basar ve bu genelde "Hi," olur.
    preheader     VARCHAR(200),
    -- İletinin içindeki büyük başlık. Konudan AYRI tutulur: konu gelen kutusunu
    -- kazanmak için, başlık iletiyi açan kişiyi karşılamak için yazılır.
    heading       VARCHAR(200)  NOT NULL,
    -- Gövde. Boş satır = yeni paragraf. Satır içi [metin](https://adres) ve
    -- **kalın** desteklenir; başka HTML KABUL EDİLMEZ (bkz. CampaignRenderer).
    body          TEXT          NOT NULL,
    cta_label     VARCHAR(80),
    cta_url       VARCHAR(500),
    -- Gövdenin altındaki gri kutu (yasal not, iletişim adresi).
    footer_note   TEXT,
    -- İletinin dili: `lang` özniteliği ve alt bilgi metni buna göre yazılır.
    locale        VARCHAR(8)    NOT NULL DEFAULT 'en',
    active        BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by    UUID,
    updated_by    UUID,
    version       BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT chk_email_templates_cta CHECK (
        (cta_label IS NULL AND cta_url IS NULL) OR (cta_label IS NOT NULL AND cta_url IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_templates_name ON email_templates (lower(name));

CREATE TABLE IF NOT EXISTS email_campaigns (
    id               UUID PRIMARY KEY,
    -- ⚠️ Şablon silinirse kampanya DURUR (SET NULL): gönderilmiş postanın
    -- kaydı, kaynağının silinmesiyle yok olamaz.
    template_id      UUID          NULL REFERENCES email_templates (id) ON DELETE SET NULL,
    template_name    VARCHAR(120)  NOT NULL,
    subject_snapshot VARCHAR(200)  NOT NULL,
    html_snapshot    TEXT          NOT NULL,
    text_snapshot    TEXT          NOT NULL,
    -- SENDING → koşuyor · SENT → bitti · FAILED → hepsi düştü ·
    -- CANCELLED → yönetici durdurdu
    status           VARCHAR(16)   NOT NULL,
    total_count      INTEGER       NOT NULL DEFAULT 0,
    sent_count       INTEGER       NOT NULL DEFAULT 0,
    failed_count     INTEGER       NOT NULL DEFAULT 0,
    skipped_count    INTEGER       NOT NULL DEFAULT 0,
    started_at       TIMESTAMPTZ,
    finished_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by       UUID,
    updated_by       UUID,
    version          BIGINT        NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_recent ON email_campaigns (created_at DESC);

CREATE TABLE IF NOT EXISTS email_recipients (
    id           UUID PRIMARY KEY,
    campaign_id  UUID         NOT NULL REFERENCES email_campaigns (id) ON DELETE CASCADE,
    -- Adres HER ZAMAN küçük harfe indirilmiş saklanır: tekilleştirme ve
    -- bastırma listesi eşleşmesi ancak tek bir yazımla çalışır.
    email        VARCHAR(320) NOT NULL,
    -- "Ada Lovelace <ada@x.com>" biçiminde yapıştırılmışsa ad da saklanır ve
    -- şablondaki {{name}} bununla dolar.
    name         VARCHAR(120),
    -- QUEUED · SENT · FAILED · SKIPPED (bastırma listesinde)
    status       VARCHAR(16)  NOT NULL,
    error        VARCHAR(500),
    sent_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 🔴 AYNI KAMPANYADA AYNI ADRES İKİ KEZ OLAMAZ — veritabanı seviyesinde.
-- Uygulama zaten tekilleştiriyor ama yapıştırılan listede aynı adresin iki
-- yazımı (Ada@x.com / ada@x.com) uygulama kontrolünü aşabilirdi ve kişi aynı
-- postayı iki kez alırdı: bu, spam şikâyetinin en hızlı yoludur.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_recipients_campaign_email
    ON email_recipients (campaign_id, email);

-- Günlük kota sorgusunun indeksi: "son 24 saatte kaç SENT satırı var".
CREATE INDEX IF NOT EXISTS idx_email_recipients_sent_at
    ON email_recipients (sent_at) WHERE status = 'SENT';

CREATE INDEX IF NOT EXISTS idx_email_recipients_campaign
    ON email_recipients (campaign_id, status);

-- 🔴 BASTIRMA LİSTESİ (suppression list)
--
-- Bir kez "istemiyorum" diyen ya da adresi sekmiş (bounce) kişiye bir daha
-- gönderilmez. Liste olmasaydı her kampanyada aynı hataya düşülür, şikâyet
-- oranı birikir ve alan adının itibarı topluca yanardı — tek bir kişiye değil,
-- BÜTÜN gönderime mal olan bir hatadır.
CREATE TABLE IF NOT EXISTS email_suppressions (
    id          UUID PRIMARY KEY,
    email       VARCHAR(320) NOT NULL,
    -- UNSUBSCRIBE · BOUNCE · COMPLAINT · MANUAL
    reason      VARCHAR(24)  NOT NULL,
    note        VARCHAR(300),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_suppressions_email ON email_suppressions (email);

COMMENT ON TABLE email_templates IS
    'Yonetimden yazilan giden e-posta sablonlari (V60). Govde sinirli bicimlendirme: paragraf, [baglanti](url), **kalin**.';
COMMENT ON TABLE email_campaigns IS
    'Tek bir gonderim turu (V60). Icerik anlik goruntu olarak kopyalanir - sablon degisse de gecmis degismez.';
COMMENT ON TABLE email_recipients IS
    'Kampanyadaki her alici icin AYRI satir ve AYRI ileti (V60). CC/BCC kullanilmaz.';
COMMENT ON TABLE email_suppressions IS
    'Bir daha gonderilmeyecek adresler (V60): cikis istegi, sekme, sikayet.';

-- ---------------------------------------------------------------------------
-- Kullanıcının verdiği davet metni ilk şablon olarak yüklenir.
--
-- ⚠️ Koşul "tablo boşsa" biçimindedir, ada bakmaz: `lower()` Türkçe 'İ' harfini
-- veritabanı yerel ayarına göre farklı çevirir ve ada bakan bir koşul kimi
-- kurulumda eşleşmeyip şablonu İKİNCİ kez eklerdi.
INSERT INTO email_templates (id, name, subject, preheader, heading, body, cta_label, cta_url, footer_note, locale, active)
SELECT gen_random_uuid(),
       'Davet — İngilizce',
       $s$Congratulations, you're invited to Waydee 🎉$s$,
       $p$Discover new digital products, tools and emerging startups before everyone else does.$p$,
       $h$You're invited to Waydee 🎉$h$,
       $b$Hi,

You're invited to Waydee, home to thousands of startups and organizations.

Discover new digital products, tools and emerging startups before everyone else does. Explore what's being built around the world, access their links directly, and get early access to the products that catch your attention.

Don't search for what's next. Discover it on Waydee.$b$,
       'Discover Waydee',
       'https://waydee.com/',
       NULL,
       'en',
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM email_templates);
