import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, ImagePlus, Lock, Shuffle, Sparkles, X } from 'lucide-react'
import { Dropdown } from '@/components/ui/dropdown'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { looksLikeImage, prepareImageForUpload, uploadImage } from '@/lib/media'
import {
  createFashionModel,
  getAiOptions,
  getCredits,
  getGeneration,
  listGenerations,
  quoteFashion,
  type AiGeneration,
  type FashionModelParams,
} from '@/lib/aiStudio'
import { useT } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'
import { optKey } from './aiLabels'
import { EditorialPanel } from './EditorialPanel'
import { PosePanel } from './PosePanel'

/**
 * <b>Waydee AI stüdyosu</b> (V45, 16 Ağustos 2026 · 99. tur: üç araç).
 *
 * <h3>🔴 Tasarım kuralı</h3>
 * <p><i>"Tasarım bizim home ve me tasarımımızdan uzaklaşmasın kesinlikle."</i>
 * Yerleşim referanstan (sol ayar sütunu / sağ sonuç paneli), <b>dil</b>
 * Waydee'den: `--color-*` tokenları · `waydee-*` sınıf ailesi. Referansın koyu
 * paleti alınmadı.
 *
 * <h3>🔴 Yükleme durumu ÇİZİLİR, KONTROLLER ÇİZİLMEZ</h3>
 * <p>Kullanıcı düzeltmesi (90. tur): ekran görüntülerinde sayfanın ortasında
 * <b>anlamsız gri bir çubuk</b> ve <b>değeri olmayan</b> açılır kutular vardı.
 * Sebebi tekti: seçenekler ({@code GET /ai/options}) gelmeden kontroller
 * çiziliyordu — boş bir bölünmüş seçim şeridi ince bir çubuğa, boş bir açılır
 * kutu da etiketli ama değersiz bir kutuya dönüşüyordu.
 * <p><b>Kural:</b> verisi olmayan bir kontrol <b>doğmaz</b>; yerini aynı
 * ölçüde bir iskelet tutar ({@link Skeleton}) — böylece veri gelince sayfa
 * <b>zıplamaz</b>.
 *
 * <h3>🔴 Örnek görseller ÖRNEK rozetiyle çizilir (99. tur)</h3>
 * <p>Boş bir yükleme kutusu ve boş bir sonuç sahnesi, aracın ne yaptığını
 * anlatmıyor. Kullanıcı isteği: <i>"örnek fotoğrafları fotoğraftaki gibi
 * yerleştir"</i> — girdi örneği yükleme kutusunda, çıktı örneği sonuç
 * panelinde. <b>Rozet şart:</b> rozetsiz bir görsel "bu yüklendi / bu üretildi"
 * diye okunur ve kullanıcı kendi dosyasını hiç seçmezdi.
 *
 * <h3>⚠️ Maliyet burada HESAPLANMAZ</h3>
 * <p>Formül sunucudadır; ekrandaki rakam {@code GET /ai/quote}'tan gelir.
 *
 * <h3>⚠️ Sonuç YOKLANIR ve yoklama iş bitince DURUR</h3>
 */
export function AiStudioPage() {
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const qc = useQueryClient()

  /* ------------------------------------------------------------ sunucu verisi */
  const optionsQuery = useQuery({ queryKey: ['ai-options'], queryFn: getAiOptions, staleTime: 60 * 60 * 1000 })
  const creditsQuery = useQuery({ queryKey: ['credits'], queryFn: getCredits })
  const galleryQuery = useQuery({ queryKey: ['ai-generations'], queryFn: () => listGenerations(24) })

  /* ------------------------------------------------------------------ durum */
  /**
   * Açık araç (99. tur).
   *
   * ⚠️ Seçim URL'de DEĞİL bileşen durumunda: üç araç da aynı sayfanın
   * yüzeyleri. Ayrı yollar açsaydık sekme değiştirmek, galeriyi ve kredi
   * özetini yeniden yükleyen bir sayfa geçişi gibi hissettirirdi.
   */
  const [tab, setTab] = useState<'MODEL' | 'EDITORIAL' | 'POSE'>('MODEL')

  const [products, setProducts] = useState<{ id: string; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [over, setOver] = useState(false)

  const [gender, setGender] = useState('FEMALE')
  const [ethnicity, setEthnicity] = useState('INTERNATIONAL')
  const [age, setAge] = useState('A25_34')
  const [skinTone, setSkinTone] = useState('MEDIUM')
  const [faceType, setFaceType] = useState('OVAL')
  const [eyeColor, setEyeColor] = useState('DARK_BROWN')
  const [expression, setExpression] = useState('SOFT_NEUTRAL')
  const [hairColor, setHairColor] = useState('DARK_BROWN')
  const [hairstyle, setHairstyle] = useState('STRAIGHT_LONG')
  const [bodySize, setBodySize] = useState('S')
  const [heightCm, setHeightCm] = useState(175)
  const [shot, setShot] = useState('FULL_BODY')
  const [background, setBackground] = useState('STUDIO_GREY')
  const [highQuality, setHighQuality] = useState(false)

  /** Yoklanan üretim — hem yeni başlatılan hem galeriden seçilen. */
  const [activeId, setActiveId] = useState<string | null>(null)

  /* ------------------------------------------------------------------ fiyat */
  const quoteQuery = useQuery({
    queryKey: ['ai-quote', highQuality, products.length],
    queryFn: () => quoteFashion(highQuality, Math.max(1, products.length)),
  })

  /* --------------------------------------------------------------- yoklama */
  const activeQuery = useQuery({
    queryKey: ['ai-generation', activeId],
    queryFn: () => getGeneration(activeId as string),
    enabled: activeId != null,
    /* ⚠️ İş bitince yoklama durur; sabit bir aralık sekme açık kaldıkça
       sonsuza kadar istek atardı. */
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === 'QUEUED' || s === 'RUNNING' ? 2000 : false
    },
  })
  const active = activeQuery.data

  /* İş bittiğinde galeri ve bakiye tazelenir — ikisi de değişmiştir. */
  const settledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!active || (active.status !== 'SUCCEEDED' && active.status !== 'FAILED')) return
    if (settledRef.current === active.id) return
    settledRef.current = active.id
    void qc.invalidateQueries({ queryKey: ['ai-generations'] })
    void qc.invalidateQueries({ queryKey: ['credits'] })
    void qc.invalidateQueries({ queryKey: ['ai-quote'] })
    if (active.status === 'FAILED') {
      // ⚠️ İade sunucuda otomatik; kullanıcıya da SÖYLENİR, yoksa krediyi
      // kaybettiğini sanır.
      toast.error(`${active.errorMessage ?? t('ai.failed')} — ${t('ai.refunded')}`)
    }
  }, [active, qc, t])

  /* ------------------------------------------------------------- yüklemeler */
  const maxProducts = optionsQuery.data?.maxProducts ?? 4

  /**
   * Seçilen/sürüklenen ürün görsellerini yükler.
   *
   * <p>⚠️ Parametre <b>`File[]`</b>, `FileList` <b>değil</b>. Gerekçe aşağıda
   * ({@code onChange}) — canlı bir `FileList` çağıran tarafta boşaltılabiliyor.
   *
   * <p>⚠️ <b>Sessiz eleme yok:</b> dosya türü tutmuyorsa ya da kota doluysa
   * kullanıcıya <b>söylenir</b>. Önceki sürüm hiçbir şey demeden dönüyordu ve
   * "yükleme çalışmıyor" şikâyeti tam olarak böyle bir sessizlikten doğdu.
   */
  const addFiles = async (incoming: File[]) => {
    // ⚠️ Yükleme sürerken ikinci bir seçim yok sayılır: iki eşzamanlı döngü
    // kotayı birlikte aşabilir ve `uploading` bayrağını birbirinin üstüne
    // yazardı (ilk biten "bitti" der, ikincisi hâlâ sürer).
    if (uploading || !incoming.length) return
    /* ⚠️ `type.startsWith('image/')` TEK BAŞINA YETMEZ: bazı dosyalar
       `type: ""` ile geliyor (bilinmeyen uzantı eşlemesi, bazı uygulamalardan
       sürükleme, `.jfif`) ve sessizce eleniyorlardı. Uzantı da bakılır. */
    const images = incoming.filter(looksLikeImage)
    if (!images.length) {
      toast.error(t('ai.onlyImages'))
      return
    }
    const room = Math.max(0, maxProducts - products.length)
    if (room === 0) {
      toast.error(t('ai.maxProducts', { count: maxProducts }))
      return
    }
    const list = images.slice(0, room)
    // Kotayı aşan kısım atılıyorsa bunu da söyle.
    if (images.length > room) toast.error(t('ai.maxProducts', { count: maxProducts }))

    setUploading(true)
    try {
      for (const file of list) {
        /* 🔴 Büyük fotoğraflar İSTEMCİDE küçültülür. Sunucunun tavanı 10 MB ve
           sıradan bir telefon fotoğrafı bunu aşıyor (ölçüldü: 4000×3000 JPEG
           = 11,6 MB → 413). Tavanı yükseltmek yanlış olurdu: model zaten
           1280px kullanıyor. Gerekçe `prepareImageForUpload` başında. */
        let ready: File
        try {
          ready = await prepareImageForUpload(file)
        } catch {
          // Tarayıcı çözemedi (çoğunlukla HEIC) — net bir mesaj ver.
          toast.error(t('ai.unsupportedImage'))
          continue
        }
        const media = await uploadImage(ready)
        setProducts((prev) => (prev.length >= maxProducts ? prev : [...prev, { id: media.id, url: media.url }]))
      }
    } catch (e) {
      // 🔴 Yakalanmamış bir `await`, düğmenin sessizce çalışmaması demekti
      // (vault, 73. tur). Hata her zaman görünür olmalı.
      toast.error(apiErrorMessage(e, t('ai.uploadFailed')))
    } finally {
      setUploading(false)
    }
  }

  /* ------------------------------------------------------------- oluşturma */
  const generate = useMutation({
    mutationFn: async () => {
      const params: FashionModelParams = {
        productMediaIds: products.map((p) => p.id),
        gender, ethnicity, age, skinTone, faceType, eyeColor, expression,
        hairColor, hairstyle, bodySize, heightCm, shot, background, highQuality,
      }
      return createFashionModel(params)
    },
    onSuccess: (g: AiGeneration) => {
      settledRef.current = null
      setActiveId(g.id)
      void qc.invalidateQueries({ queryKey: ['credits'] })
      void qc.invalidateQueries({ queryKey: ['ai-generations'] })
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('ai.failed'))),
  })

  /* --------------------------------------------------------------- rastgele */
  const cat = optionsQuery.data?.catalogue
  const ready = !!cat
  const pickRandom = (list: string[] | undefined, set: (v: string) => void) => {
    if (!list?.length) return
    set(list[Math.floor(Math.random() * list.length)])
  }
  const shuffleIdentity = () => {
    pickRandom(cat?.gender, setGender)
    pickRandom(cat?.ethnicity, setEthnicity)
    pickRandom(cat?.age, setAge)
  }
  const shuffleFace = () => {
    pickRandom(cat?.skinTone, setSkinTone)
    pickRandom(cat?.faceType, setFaceType)
    pickRandom(cat?.eyeColor, setEyeColor)
    pickRandom(cat?.expression, setExpression)
  }
  const shuffleHair = () => {
    pickRandom(cat?.hairColor, setHairColor)
    pickRandom(cat?.hairstyle, setHairstyle)
  }
  const shuffleBody = () => {
    pickRandom(cat?.bodySize, setBodySize)
    setHeightCm(160 + Math.floor(Math.random() * 30))
  }

  /* --------------------------------------------------------------- türevler */
  const credits = creditsQuery.data
  const cost = quoteQuery.data?.cost ?? 0
  const balance = credits?.balance ?? 0
  const running = active?.status === 'QUEUED' || active?.status === 'RUNNING'
  const canGenerate =
    ready && products.length > 0 && !uploading && !generate.isPending && !running
    && balance >= cost && !!credits?.aiEnabled

  const options = (category: string) =>
    (cat?.[category] ?? []).map((code) => ({ value: code, label: t(optKey(category, code)) }))

  const done = useMemo(
    () => (galleryQuery.data ?? []).filter((g) => g.status === 'SUCCEEDED'),
    [galleryQuery.data],
  )

  /** Sekmeye göre alt başlık — üç aracın işi birbirinden farklı. */
  const subtitle =
    tab === 'MODEL' ? t('ai.subtitle') : tab === 'EDITORIAL' ? t('ai.edSubtitle') : t('ai.poseSubtitle')

  /* ==================================================================== çizim */
  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* --- başlık + bakiye --- */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 shrink-0 text-violet" />
            {t('ai.title')}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{subtitle}</p>
        </div>
        <CreditPill balance={balance} perPeriod={credits?.perPeriod ?? 0} locale={locale} />
      </div>

      {/* --- araç sekmeleri (üçü açık, ikisi "yakında") --- */}
      <div className="waydee-ai-tabs mb-5" role="tablist" aria-label={t('ai.title')}>
        {([
          ['MODEL', 'tabModel'],
          ['EDITORIAL', 'tabEditorial'],
          ['POSE', 'tabPose'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className="waydee-ai-tab"
          >
            {t(`ai.${label}` as never)}
          </button>
        ))}
        {(['tabVideo', 'tabTools'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={false}
            /* 🔴 Gerçekten `disabled`: yalnız soluklaştırmak, klavyeyle
               odaklanan kullanıcıyı boş bir ekrana götürürdü. */
            disabled
            title={t('ai.soon')}
            className="waydee-ai-tab"
          >
            <Lock className="h-3 w-3" />
            {t(`ai.${key}` as never)}
            <span className="waydee-ai-soon">{t('ai.soon')}</span>
          </button>
        ))}
      </div>

      {/*
        🔴 Ücretsiz DENEME şeridi (18 Ağu 2026). Ücretsiz hesap stüdyoyu bir
        kez, tam kapasitede kullanabiliyor; bunu söylemeyen bir ekran ya
        "neden çalışıyor" ya da "neden bir daha çalışmıyor" sorusunu doğurur.
        ⚠️ Koşul plan ADINA bakar çünkü soru tam olarak "bu ücretsiz hesap mı":
        ücretli hesapta kalan deneme sayısı doğru hesaplansa bile anlamsızdır.
      */}
      {/* 9 Eki 2026: plan değil bakiye belirler — deneme bandı kapatıldı. */}
      {false && credits && (
        <div className="mb-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl bg-subtle px-4 py-3 text-center text-sm">
          <span className="font-semibold text-ink">{t('ai.trialTitle')}</span>
          <span className="text-muted">
            {t('ai.trialDesc').replace('{credits}', String(credits?.trialRemaining ?? 0))}
          </span>
        </div>
      )}

      {/* Ücretsiz hesap: stüdyo kapalı — kapı SUNUCUDA, bu yalnız açıklama. */}
      {credits && !credits.aiEnabled && (
        <div className="mb-5 rounded-2xl bg-surface p-6 text-center shadow-card">
          <h2 className="text-base font-bold">{t('ai.lockedTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{t('ai.lockedDesc')}</p>
          <Link
            to="/plan"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-ink px-6 text-sm font-semibold text-on-ink transition-opacity hover:opacity-90"
          >
            {t('ai.lockedCta')}
          </Link>
        </div>
      )}

      {/*
        ⚠️ Kapalı sekmenin paneli ÇİZİLMEZ (monte edilmez): her panel kendi
        yoklama ve fiyat sorgusunu açıyor ve gizli bir panel arka planda istek
        atmaya devam ederdi.
      */}
      {tab === 'EDITORIAL' ? (
        <EditorialPanel
          options={optionsQuery.data}
          locale={locale}
          aiEnabled={!!credits?.aiEnabled}
          balance={balance}
        />
      ) : tab === 'POSE' ? (
        <PosePanel
          options={optionsQuery.data}
          locale={locale}
          aiEnabled={!!credits?.aiEnabled}
          balance={balance}
        />
      ) : (
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* ============================================== SOL: ayarlar */}
        <div className="waydee-ai-panel">
          {/* --- ürünler --- */}
          <section className="waydee-ai-section">
            <span className="waydee-ai-label">
              {t('ai.products')} · {products.length}/{maxProducts}
            </span>
            {products.length > 0 && (
              <div className="waydee-ai-products mb-2.5">
                {products.map((p) => (
                  <div key={p.id} className="waydee-ai-product">
                    <img src={p.url} alt="" />
                    <button
                      type="button"
                      onClick={() => setProducts((prev) => prev.filter((x) => x.id !== p.id))}
                      aria-label={t('common.clear')}
                      className="waydee-ai-product-x"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {products.length < maxProducts && (
              <label
                className={`waydee-ai-drop ${products.length === 0 ? 'waydee-ai-drop-sample' : ''}`}
                data-over={over}
                onDragOver={(e) => { e.preventDefault(); setOver(true) }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles(Array.from(e.dataTransfer.files)) }}
              >
                {products.length === 0 ? (
                  /*
                    🔴 ÖRNEK ÜRÜN GÖRSELİ (99. tur, kullanıcı ekran görüntüsü).
                    Kutu boşken "ürün görseli" ne demek belli değil; bir örnek
                    bunu tek bakışta anlatıyor. ⚠️ Rozet şart — rozetsiz görsel
                    "yüklenmiş" diye okunur ve kullanıcı kendi ürününü hiç
                    seçmezdi. ⚠️ İlk ürün eklenince örnek KAYBOLUR: bu kutu artık
                    "bir tane daha ekle" kutusudur.
                  */
                  <div className="waydee-ai-sample h-28">
                    <img src="/ai-samples/model-products.webp" alt={t('ai.products')} loading="lazy" />
                    <span className="waydee-ai-sample-badge">{t('ai.sample')}</span>
                    <div className="waydee-ai-sample-veil">
                      {uploading ? <Spinner /> : <ImagePlus className="h-5 w-5" />}
                      <span className="text-[11px] font-semibold">{t('ai.uploadCta')}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {uploading ? <Spinner /> : <ImagePlus className="h-6 w-6" />}
                    <span className="text-[13px] font-medium">{t('ai.uploadCta')}</span>
                    <span className="text-[11px] leading-snug text-faint">{t('ai.uploadHint')}</span>
                  </>
                )}
                <input
                  type="file"
                  /* ⚠️ `image/*`: dar bir liste, işletim sistemi diyaloğunda
                     bazı geçerli fotoğrafları (ör. `.jfif`) gizliyordu. Gerçek
                     doğrulama zaten sunucuda (sihirli bayt kontrolü). */
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    /*
                     * 🔴🔴 "ÜRÜN YÜKLEME ÇALIŞMIYOR"UN KÖK NEDENİ BURASIYDI.
                     *
                     * Önceki sürüm `const files = e.target.files` ile
                     * <b>FileList referansını</b> alıyor, sonra
                     * `e.target.value = ''` yazıyor ve ardından o referansı
                     * kullanıyordu. Ama <b>`FileList` CANLIDIR</b>: girdinin
                     * değerini sıfırlamak <b>elimizdeki listeyi de boşaltır</b>.
                     * Yani `addFiles` her seferinde <b>sıfır dosya</b> alıyor
                     * ve sessizce dönüyordu — ne hata, ne görsel, hiçbir iz.
                     *
                     * <b>Tarayıcıda ölçüldü:</b> iki dosyalı bir girdide
                     * `files.length` → 2, `input.value=''` sonrası <b>aynı
                     * nesnede</b> → <b>0</b>. Buna karşılık `File` nesnesi
                     * (liste değil) sıfırlamadan sonra <b>hayatta kalıyor</b>.
                     *
                     * ⚠️ Sürükle-bırak yolu çalışıyordu çünkü o
                     * `dataTransfer.files` kullanıyor ve girdiye bağlı değil —
                     * bu da hatayı "bazen çalışıyor" gibi gösteriyordu.
                     *
                     * <b>Kural: FileList'i ÖNCE diziye çevir, DEĞERİ SONRA
                     * sıfırla.</b> Sıfırlama gerekli, çünkü aynı dosya ikinci
                     * kez seçilirse `change` hiç tetiklenmez.
                     */
                    const picked = Array.from(e.target.files ?? [])
                    e.target.value = ''
                    void addFiles(picked)
                  }}
                />
              </label>
            )}
          </section>

          {/* --- kimlik --- */}
          <section className="waydee-ai-section">
            <SectionHead label={t('ai.identity')} onShuffle={shuffleIdentity} title={t('ai.shuffle')} disabled={!ready} />
            {!ready ? (
              <>
                <Skeleton kind="seg" className="mb-3" />
                <div className="waydee-ai-duo"><Skeleton /><Skeleton /></div>
              </>
            ) : (
              <>
                <div className="waydee-ai-seg mb-3" role="radiogroup" aria-label={t('ai.gender')}>
                  {cat.gender.map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={gender === code}
                      onClick={() => setGender(code)}
                      className="waydee-ai-seg-item"
                    >
                      {t(optKey('gender', code))}
                    </button>
                  ))}
                </div>
                <div className="waydee-ai-duo">
                  <Dropdown label={t('ai.ethnicity')} value={ethnicity} onChange={setEthnicity} options={options('ethnicity')} />
                  <Dropdown label={t('ai.age')} value={age} onChange={setAge} options={options('age')} />
                </div>
              </>
            )}
          </section>

          {/* --- yüz & ten --- */}
          <section className="waydee-ai-section">
            <SectionHead label={t('ai.faceSkin')} onShuffle={shuffleFace} title={t('ai.shuffle')} disabled={!ready} />
            <div className="waydee-ai-duo">
              {!ready ? (
                <><Skeleton /><Skeleton /><Skeleton /><Skeleton /></>
              ) : (
                <>
                  <Dropdown label={t('ai.skinTone')} value={skinTone} onChange={setSkinTone} options={options('skinTone')} />
                  <Dropdown label={t('ai.faceType')} value={faceType} onChange={setFaceType} options={options('faceType')} />
                  <Dropdown label={t('ai.eyeColor')} value={eyeColor} onChange={setEyeColor} options={options('eyeColor')} />
                  <Dropdown label={t('ai.expression')} value={expression} onChange={setExpression} options={options('expression')} />
                </>
              )}
            </div>
          </section>

          {/* --- saç --- */}
          <section className="waydee-ai-section">
            <SectionHead label={t('ai.hair')} onShuffle={shuffleHair} title={t('ai.shuffle')} disabled={!ready} />
            <div className="waydee-ai-duo">
              {!ready ? (
                <><Skeleton /><Skeleton /></>
              ) : (
                <>
                  <Dropdown label={t('ai.hairColor')} value={hairColor} onChange={setHairColor} options={options('hairColor')} />
                  <Dropdown label={t('ai.hairstyle')} value={hairstyle} onChange={setHairstyle} options={options('hairstyle')} />
                </>
              )}
            </div>
          </section>

          {/* --- vücut --- */}
          <section className="waydee-ai-section">
            <SectionHead label={t('ai.body')} onShuffle={shuffleBody} title={t('ai.shuffle')} disabled={!ready} />
            <div className="waydee-ai-duo mb-4">
              {!ready ? <><Skeleton /><Skeleton /></> : (
                <>
                  <Dropdown label={t('ai.bodySize')} value={bodySize} onChange={setBodySize} options={options('bodySize')} />
                  <Dropdown label={t('ai.shot')} value={shot} onChange={setShot} options={options('shot')} />
                </>
              )}
            </div>
            {/*
              🔴 Boy kaydırıcısı KENDİ TAM GENİŞLİKTEKİ SATIRINDA.
              Önce beden kutusuyla aynı iki sütunlu satırı paylaşıyordu; dar
              ekranda etiket komşu kutunun altına giriyor ve kaydırıcıya
              tutulacak yer kalmıyordu. Genişlik isteyen tek kontrol odur.
            */}
            <div className="waydee-ai-slider-row">
              <span className="waydee-ai-label-inline">{t('ai.height')}</span>
              <span className="waydee-ai-slider-value">{heightCm} cm</span>
            </div>
            <input
              type="range"
              min={150}
              max={200}
              step={1}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              aria-label={t('ai.height')}
              className="waydee-range mt-2 w-full"
            />
          </section>

          {/* --- sahne ---
              ⚠️ Bölüm başlığı YOK: açılır kutu zaten kendi etiketini
              taşıyor ("Arka plan") ve ikisi birden yazılınca aynı kelime
              üst üste iki kez görünüyordu. */}
          <section className="waydee-ai-section">
            {!ready ? <Skeleton /> : (
              <Dropdown label={t('ai.background')} value={background} onChange={setBackground} options={options('background')} />
            )}
          </section>

          {/* --- kalite --- */}
          <section className="waydee-ai-section">
            <span className="waydee-ai-label">{t('ai.quality')}</span>
            <div className="waydee-ai-seg" role="radiogroup" aria-label={t('ai.quality')}>
              <button type="button" role="radio" aria-checked={!highQuality}
                onClick={() => setHighQuality(false)} className="waydee-ai-seg-item">
                {t('ai.quality1k')}
              </button>
              <button type="button" role="radio" aria-checked={highQuality}
                onClick={() => setHighQuality(true)} className="waydee-ai-seg-item">
                {t('ai.quality2k')}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">{t('ai.qualityHint')}</p>
          </section>

          {/* --- oluştur --- */}
          <section className="waydee-ai-section">
            {/* Maliyet ve bakiye YAN YANA: kullanıcı "yeter mi?" sorusunu tek
                bakışta yanıtlasın diye. ⚠️ Rakam SUNUCUDAN. */}
            <div className="waydee-ai-costline mb-2.5">
              <span>{t('ai.cost', { count: cost.toLocaleString(locale) })}</span>
              <span className="waydee-ai-costline-muted">
                {balance.toLocaleString(locale)} {t('ai.credits')}
              </span>
            </div>
            <button type="button" disabled={!canGenerate} onClick={() => generate.mutate()} className="waydee-ai-go">
              {generate.isPending || running ? (
                <Spinner className="border-on-ink/30 border-t-on-ink" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('ai.generate')}
                </>
              )}
            </button>
            {balance < cost && credits?.aiEnabled && (
              <p className="mt-2 text-center text-[12px] font-semibold text-danger">{t('ai.notEnough')}</p>
            )}
          </section>
        </div>

        {/* ============================================== SAĞ: sonuç */}
        <div className="waydee-ai-panel waydee-ai-sticky">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="waydee-ai-label-inline">{t('ai.result')}</span>
            {active?.status === 'SUCCEEDED' && active.imageUrl && (
              <a
                href={active.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
              >
                {t('ai.openFull')}
              </a>
            )}
          </div>

          <div className="waydee-ai-stage">
            {running ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <Spinner />
                <p className="text-[13px] font-semibold">{t('ai.working')}</p>
                <p className="max-w-xs text-[12px] leading-relaxed text-faint">{t('ai.workingHint')}</p>
              </div>
            ) : active?.status === 'SUCCEEDED' && active.imageUrl ? (
              <img src={active.imageUrl} alt={t('ai.result')} />
            ) : active?.status === 'FAILED' ? (
              <div className="text-center">
                <p className="text-[13px] font-semibold text-danger">{active.errorMessage ?? t('ai.failed')}</p>
                <p className="mt-1 text-[12px] text-faint">{t('ai.refunded')}</p>
              </div>
            ) : (
              /*
                🔴 ÖRNEK SONUÇ (99. tur). Boş sahnede "henüz görsel yok" yazmak
                doğruydu ama aracın ne ürettiğini göstermiyordu; soldaki örnek
                ürünlerin karşılığı olan çıktı burada duruyor — ikisi AYNI
                takım, yoksa örnek bir örnek olmaz, iki alakasız fotoğraf olur.
              */
              <div className="waydee-ai-sample waydee-ai-sample-stage">
                <img src="/ai-samples/model-result.webp" alt={t('ai.result')} loading="lazy" />
                <span className="waydee-ai-sample-badge">{t('ai.sample')}</span>
              </div>
            )}
          </div>

          {!active && (
            <p className="mt-3 text-center text-[12px] leading-relaxed text-faint">
              {t('ai.emptyDesc')}
            </p>
          )}

          {/* --- son oluşturulanlar --- */}
          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-2.5 flex items-center gap-2">
              <History className="h-3.5 w-3.5 shrink-0 text-faint" />
              <span className="waydee-ai-label-inline">{t('ai.recent')}</span>
            </div>
            {done.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-faint">{t('ai.noneYet')}</p>
            ) : (
              <div className="waydee-ai-strip">
                {done.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-current={g.id === activeId}
                    onClick={() => { settledRef.current = g.id; setActiveId(g.id) }}
                    className="waydee-ai-thumb"
                  >
                    {g.imageUrl && <img src={g.imageUrl} alt="" />}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-faint">{t('ai.reuseHint')}</p>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ parçalar */

/**
 * Yükleme iskeleti.
 *
 * <p>⚠️ Ölçüsü gerçek kontrolle <b>aynı</b> (kutu 55px, şerit 41px). Farklı
 * olsaydı veri gelince sayfa zıplar ve kullanıcı yanlış yere tıklardı.
 */
function Skeleton({ kind = 'box', className = '' }: { kind?: 'box' | 'seg'; className?: string }) {
  return (
    <div
      aria-hidden
      className={`waydee-ai-skel ${kind === 'seg' ? 'waydee-ai-skel-seg' : 'waydee-ai-skel-box'} ${className}`}
    />
  )
}

function SectionHead({
  label,
  onShuffle,
  title,
  disabled,
}: {
  label: string
  onShuffle: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      {/*
        ⚠️ `waydee-ai-label` + Tailwind `mb-0` İŞE YARAMIYOR — ölçüldü:
        Tailwind v4'te yardımcı sınıflar `@layer utilities` içinde ve
        KATMANSIZ kurallarımız onları yener. Ayrı bir varyant sınıfı gerekti.
      */}
      <span className="waydee-ai-label-inline truncate">{label}</span>
      {/* ⚠️ Seçenekler gelmeden karıştırmak sessizce hiçbir şey yapmazdı;
          düğme o sürede kapalı. */}
      <button
        type="button"
        onClick={onShuffle}
        disabled={disabled}
        title={title}
        aria-label={title}
        className="waydee-ai-shuffle shrink-0 disabled:opacity-40"
      >
        <Shuffle className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/**
 * Kalan kredi hapı.
 *
 * <p>⚠️ Sayı <b>yerelleştirilir</b>: sabit `tr-TR` İngilizce arayüzde
 * `10.000` gösteriyordu, beklenen `10,000` (vault, 88. tur).
 */
export function CreditPill({
  balance,
  perPeriod,
  locale,
}: {
  balance: number
  perPeriod: number
  locale: string
}) {
  const t = useT()
  /* Dönem hakkının %10'unun altı "azalıyor" sayılır. Sabit bir eşik (ör. 200)
     Pro'da uyarı verirken Premium'da hiç görünmezdi. */
  const low = perPeriod > 0 && balance < perPeriod * 0.1
  return (
    <span className="waydee-ai-credit" title={t('ai.creditsTooltip')}>
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet" />
      <span className={`waydee-ai-credit-num ${low ? 'waydee-ai-credit-low' : ''}`}>
        {balance.toLocaleString(locale)}
      </span>
      <span className="text-muted">{t('ai.credits')}</span>
    </span>
  )
}
