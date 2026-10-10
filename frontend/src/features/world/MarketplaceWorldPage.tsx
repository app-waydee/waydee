import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Canvas } from '@react-three/fiber'
import { ArrowLeft, Heart, Loader2, MousePointerClick, Store as StoreIcon } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { getWorld, likeListing, type WorldShelfItem, type WorldStore } from '@/lib/marketplace'
import { reportStoreVisit } from '@/lib/storeStats'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'
import { CANVAS_SETTINGS, WorldScene } from './WorldScene'
import { MoveStick, useLookDrag } from './Controls'
import { SceneBoundary } from './SceneBoundary'
import type { AimTarget } from './Crosshair'

/**
 * <b>3B pazar yeri</b> — onaylanan başvuruların mağazaları, gezilebilir bir
 * cadde olarak.
 *
 * <p>🔴 Sahne <b>tam ekran ve sayfa kaydırması kilitli</b> açılır: WASD ile
 * yürürken sayfanın altına kayması, gezinmeyi ilk saniyede bozuyordu.
 *
 * <p>⚠️ WebGL bağlamı pahalıdır ve sekme başına sınırlıdır. Bu yüzden
 * `<Canvas>` yalnız veri geldikten sonra kurulur ve sayfadan çıkınca React
 * onu söker — R3F bağlamı kendisi serbest bırakır.
 */
export function MarketplaceWorldPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const t = useT()

  const { data: world, isLoading, isError } = useQuery({
    queryKey: ['marketplace-world', slug],
    queryFn: () => getWorld(slug),
    enabled: !!slug,
    /* Sahne kurulduktan sonra arka planda yeniden veri çekmek, bütün rafların
       dokularını yeniden yükletiyordu — pencere odağında yenileme kapalı. */
    refetchOnWindowFocus: false,
  })

  /** İçinde bulunulan mağaza — üst şeritte adı yazar. */
  const [inside, setInside] = useState<WorldStore | null>(null)
  /** Rafta tıklanan gönderi. */
  const [picked, setPicked] = useState<{ item: WorldShelfItem; store: WorldStore } | null>(null)

  /* Yön çubuğunun ve bakış sürüklemesinin çıktıları — ref, çünkü her karede
     okunuyorlar ve state olsaydı saniyede 60 render tetiklerlerdi. */
  const moveRef = useRef({ x: 0, y: 0 })
  const lookRef = useRef({ dx: 0, dy: 0 })
  const lookHandlers = useLookDrag(lookRef)

  /*
   * 🔴 Nişangâhın hedefi (11 Ağu 2026). Ref, çünkü her karede yazılıyor.
   * `aiming` ise yalnız "hedef var/yok" ve YALNIZ değişince güncellenir —
   * nişangâhın yeşile dönmesi için o yeterli, her kare render değil.
   */
  const targetRef = useRef<AimTarget | null>(null)
  /* ⚠️ `toggleLike` bağımlılıksız kalsın diye durum bir ref'ten okunur:
     bağımlılığa `likes` konsaydı her beğenide yeni bir fonksiyon üretilir ve
     sahnedeki bütün mağazalar yeniden çizilirdi. */
  const likesRef = useRef<Record<string, { liked: boolean; count: number }>>({})
  const [aiming, setAiming] = useState(false)
  /** Tuval — kart kapanınca fare kilidi buna geri istenir. */
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  /*
   * ══ WebGL BAĞLAM KAYBI — GERİ DÖNÜŞ (97. tur, 2. bölüm) ══
   *
   * 🔴 Bildirilen hata: *"bazen 3B evreni yüklenmiyor, ya bembeyaz ya mavi
   * kalıyor"*; konsolda `THREE.WebGLRenderer: Context Lost`.
   *
   * Asıl sebep ışık ve video sayısıydı ve orada kalıcı olarak çözüldü
   * ({@link useNearby}). Ama bağlam kaybı **her zaman mümkündür** — sürücü
   * uykuya alır, işletim sistemi GPU'yu geri alır, sekme arka plana düşer.
   * Eski kod bunu yalnız **konsola yazıyordu**: tuval o andan sonra
   * donuyordu. Kullanıcının gördüğü iki belirti bunun ta kendisi:
   *  • **mavi kalıyor** → gökyüzü çizilmiş, bağlam sonra düşmüş;
   *  • **bembeyaz** → bağlam ilk karede düşmüş, hiç çizilememiş.
   *
   * 🔴 Kurtarma **tuvali yeniden kurmaktır** (`glKey`). `webglcontextrestored`
   * olayı geldiğinde three'nin bütün GPU kaynakları (doku, tampon, program)
   * çoktan yok olmuştur; aynı renderer'la devam etmek boş bir sahne çizer.
   *
   * ⚠️ `preventDefault()` ŞART: çağrılmazsa tarayıcı `contextrestored`
   * olayını **hiç göndermez** ve kurtarma imkânsız hâle gelir.
   *
   * ══ 100. tur — "İLK GİRİŞTE AÇILMIYOR, İKİNCİDE AÇILIYOR" ══
   *
   * 🔴 Yukarıdaki kurtarma **çalışmıyordu** ve sebebi üç ayrı kusurdu:
   *
   * ① **Sökülen tuval de `webglcontextlost` yayar.** Bir `<canvas>` DOM'dan
   *    çıkarken (ya da R3F `gl.forceContextLoss()` çağırırken) tarayıcı aynı
   *    olayı gönderir. Eski kod "bağlam kaybı" ile "biz bu tuvali bilerek
   *    yıkıyoruz"u **ayırt etmiyordu**: `glKey` her arttığında ölen eski tuval
   *    hemen `setGlLost(true)` diyor, YENİ ve sapasağlam sahnenin üstüne hata
   *    perdesi açıyordu. Konsoldaki **çift** "bağlamı kayboldu" satırı bu.
   *    ⚠️ Geliştirmede `StrictMode` her bileşeni iki kez kurup söktüğü için
   *    bu **ilk girişte garanti** oluyordu — bildirilen belirtinin ta kendisi.
   *    ✅ Her tuval kurulduğu `glKey`i **taşır**; artık güncel olmayan bir
   *    tuvalden gelen olay **yok sayılır**. Dinleyiciler ayrıca **sökülürken
   *    kaldırılır** (eskiden hiç kaldırılmıyordu, ölü tuvaller canlı state'e
   *    yazmaya devam ediyordu).
   *
   * ② **`webglcontextrestored` çoğu zaman HİÇ GELMEZ.** Zorla kaybettirilmiş
   *    (`forceContextLoss`) ya da sürücünün geri vermediği bir bağlam için
   *    tarayıcı o olayı göndermez. Eski kod sonsuza kadar bekliyordu; ekranda
   *    kalan tek şey "yeniden dene" düğmesiydi — kullanıcının *"yenileyince
   *    açılıyor"* dediği yer. ✅ Artık **kendi kendine** yeniden kurulur:
   *    olaydan {@link GL_RESTORE_WAIT_MS} sonra geri dönüş gelmediyse tuval
   *    zaten yeniden kuruluyor.
   *
   * ③ **Perde, kurtarma denenmeden açılıyordu.** Bir kayıp saniyenin altında
   *    kapanıyorsa bu bir hata değil bir **takılmadır**; kullanıcıya hata
   *    metni değil kısa bir "yeniden kuruluyor" gösterilir. Hata metni yalnız
   *    {@link GL_MAX_AUTO_RETRY} otomatik deneme tükendiğinde çıkar.
   */
  /** Geri dönüş olayı için beklenen süre; sonrasında tuval kendi kurulur. */
  const GL_RESTORE_WAIT_MS = 900
  /** Bu kadar otomatik deneme sonrası kullanıcıya elle kurma düğmesi çıkar. */
  const GL_MAX_AUTO_RETRY = 3
  /**
   * Tuval bu kadar süre ayakta kaldıysa kurtarma **başarılıdır** ve sayaç
   * sıfırlanır. Olmasaydı bir oturumda üç kayıp yaşayan (ör. sekmeyi arka
   * plana alıp geri gelen) kullanıcı, dördüncüsünde kalıcı hata perdesi
   * görürdü — oysa üçü de kendiliğinden düzelmişti.
   */
  const GL_STABLE_MS = 15_000

  const [glKey, setGlKey] = useState(0)
  /** `null` = sağlam · `recovering` = sessizce kuruluyor · `failed` = perde. */
  const [glState, setGlState] = useState<null | 'recovering' | 'failed'>(null)
  /* Olay işleyicileri render'dan sonra koşar; `glKey`i state'ten okusalar
     kapanışa (closure) sıkışmış eski değeri görürlerdi. */
  const glKeyRef = useRef(0)
  glKeyRef.current = glKey
  const glTriesRef = useRef(0)
  const glTimerRef = useRef<number | null>(null)

  const clearGlTimer = useCallback(() => {
    if (glTimerRef.current !== null) {
      window.clearTimeout(glTimerRef.current)
      glTimerRef.current = null
    }
  }, [])

  /** Tuvali baştan kurar — kurtarmanın tek yolu (gerekçe yukarıda). */
  const rebuildCanvas = useCallback(() => {
    clearGlTimer()
    setGlState(null)
    setGlKey((k) => k + 1)
  }, [clearGlTimer])

  useEffect(() => clearGlTimer, [clearGlTimer])

  useEffect(() => lockScroll(), [])

  /*
   * 🔴 TUVAL BİR KARE GECİKMEYLE KURULUR (100. tur).
   *
   * Bu sayfaya gelinen yerlerin hepsinde (harita, pazar vitrini) ekranda bir
   * **Mapbox tuvali** vardır ve o da bir WebGL bağlamı tutar. Tarayıcı bağlam
   * sayısını sınırlar; eskisinin serbest bırakılması ise `map.remove()`
   * çağrısıyla **aynı anda bitmez**. Yeni bağlamı aynı tikte istemek, sekme
   * tavana dayanmışsa bağlamın doğar doğmaz kaybedilmesi demekti — yine
   * *"ilk girişte açılmıyor"*. Bir kare beklemek eski bağlamın gerçekten
   * bırakılmasına yetiyor ve kullanıcı için görünmez.
   */
  const [canDraw, setCanDraw] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setCanDraw(true))
    return () => cancelAnimationFrame(id)
  }, [])

  /*
   * ══ MAĞAZA BEĞENİSİ (97. tur) ══
   *
   * 🔴 İYİMSER: kalp basıldığı anda dolar ve sayı artar. Sunucunun cevabını
   * beklemek, 3B sahnede fark edilir bir gecikme demekti ve kullanıcı düğmeye
   * ikinci kez basardı — ikinci basış beğeniyi geri alır, yani "çalışmıyor"
   * hissinin en kısa yolu budur.
   *
   * ⚠️ Hata gelirse durum GERİ ALINIR. Sunucudan dönen gerçek sayı yazılır:
   * bu arada başka biri de beğenmiş olabilir.
   */
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>({})
  /* Ref her çizimde tazelenir — `toggleLike` güncel durumu bağımlılık
     eklemeden okur (gerekçe ref'in tanımında). */
  likesRef.current = likes

  const toggleLike = useCallback((store: WorldStore) => {
    const current = likesRef.current[store.id] ?? { liked: store.likedByMe, count: store.likeCount }
    const next = { liked: !current.liked, count: Math.max(0, current.count + (current.liked ? -1 : 1)) }
    setLikes((prev) => ({ ...prev, [store.id]: next }))
    likeListing(store.id, next.liked)
      .then((res) => setLikes((prev) => ({ ...prev, [store.id]: { liked: res.likedByMe, count: res.likeCount } })))
      .catch(() => setLikes((prev) => ({ ...prev, [store.id]: current })))
  }, [])

  /*
   * ══ ZİYARET ÖLÇÜMÜ — kapıdan geçiş ve içeride kalış (97. tur) ══
   *
   * 🔴 Vault'un 91. tur dersi (*"gösterilen ama artmayan sayaç"*) tersinden
   * uygulanıyor: rapor ekranındaki her sayı BURADAN besleniyor.
   *
   * ⚠️ Giriş anı `Date.now()` ile tutuluyor, `performance.now()` ile değil:
   * ikisi de olurdu ama süre sunucuya saniye olarak gidiyor ve tek kaynak
   * yeterli.
   *
   * ⚠️ Çıkış üç yerde tetiklenir ve üçü de gerekli:
   *  ① başka bir mağazaya geçiş / caddeye çıkış (`inside` değişimi),
   *  ② sayfadan ayrılma (bileşen sökülürken),
   *  ③ sekmenin kapanması (`pagehide`) — sekme kapanınca React'in temizliği
   *    KOŞMAZ ve o ziyaretin bütün süresi kaybolurdu.
   */
  const visitRef = useRef<{ id: string; at: number } | null>(null)

  const closeVisit = useCallback(() => {
    const open = visitRef.current
    if (!open) return
    visitRef.current = null
    reportStoreVisit(open.id, false, Math.round((Date.now() - open.at) / 1000))
  }, [])

  const handleInside = useCallback(
    (store: WorldStore | null) => {
      setInside(store)
      if (visitRef.current?.id === store?.id) return
      closeVisit()
      if (store) {
        visitRef.current = { id: store.id, at: Date.now() }
        reportStoreVisit(store.id, true)
      }
    },
    [closeVisit],
  )

  useEffect(() => {
    const onHide = () => closeVisit()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      closeVisit()
    }
  }, [closeVisit])

  /**
   * Rafta bir ürün seçildi.
   *
   * <p>🔴 11 Ağu 2026 — kart açılırken <b>fare kilidi bırakılır</b>. Önceden
   * kilit açık kalıyordu: imleç görünmüyor, fare hareketi hâlâ kamerayı
   * çeviriyor ve karta tıklamak için önce <b>Esc</b>'ye basmak gerekiyordu
   * (bildirilen hata). Kilidi bırakmak imleci geri verir ve sahneyi durdurur.
   */
  const openPost = useCallback((item: WorldShelfItem, store: WorldStore) => {
    document.exitPointerLock?.()
    setPicked({ item, store })
  }, [])

  /**
   * Kart kapandı — gezinti kaldığı yerden sürer.
   *
   * <p>🔴 Kilit <b>burada</b>, kapatma tıklamasının içinde yeniden istenir.
   * Bir `useEffect`'ten istemek çalışmaz: tarayıcı `requestPointerLock`'u
   * yalnız bir <b>kullanıcı hareketinin</b> içinde kabul eder, aksi hâlde
   * sessizce reddeder ve kullanıcı bir daha etrafına bakamazdı.
   *
   * <p>⚠️ Yalnız FARE kullanılıyorsa istenir. Dokunmatikte fare kilidi yoktur
   * ve istemek ya boşa gider ya kaydırmayı bozar; orada bakış zaten parmakla.
   */
  const closePicked = useCallback(() => {
    setPicked(null)
    if (window.matchMedia('(pointer: fine)').matches) {
      canvasRef.current?.requestPointerLock?.()
    }
  }, [])

  if (isLoading) return <PageSpinner />

  if (isError || !world) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <p className="text-[15px] font-bold text-ink">{t('world.notFound')}</p>
          <button
            type="button"
            className="waydee-pill mt-4"
            onClick={() => navigate(`/market/${slug}`)}
          >
            {t('world.backToMarket')}
          </button>
        </div>
      </div>
    )
  }

  const empty = world.stores.length === 0

  return (
    /*
     * 🔴 Bakış işleyicileri KABA bağlı, tuvalin üstündeki bir katmana değil:
     * olaylar tuvalden yukarı kabarıyor, böylece R3F kendi ışın testini
     * (raflara tıklama) yapmaya devam ediyor.
     */
    <div
      className="waydee-world"
      {...lookHandlers}
      /*
       * 🔴 Nişangâh tıklaması. Masaüstünde fare kilidi devrede olduğu için
       * R3F'in kendi `onClick`i hiç tetiklenmez (ışın testi imlecin konumuna
       * bakar, imleç ise yerinde durur) — bildirilen "tıklama sorunu" buydu.
       * Ekranın ortasının hedeflediği ürün burada açılıyor.
       *
       * ⚠️ Yalnız hedef TUVAL iken: üst şeritteki geri düğmesine ya da
       * karttaki düğmelere basmak da ürün açıyordu.
       */
      onClick={(e) => {
        if (!(e.target instanceof HTMLCanvasElement)) return
        /* Kart açıkken tuval zaten örtülü; yine de erken çıkılır — kartın
           arkasına düşen bir tıklama ikinci bir ürün açıyordu. */
        if (picked) return
        const hit = targetRef.current
        if (!hit) return
        /* 🔴 Nişangâh artık iki şey hedefleyebiliyor (97. tur): raf ürünü ve
           mağazanın kalbi. Etiket olmasaydı burada "shelfItem var mı" diye
           bakmak gerekirdi ve hedef türü örtük kalırdı. */
        if (hit.kind === 'like') {
          toggleLike(hit.store)
          return
        }
        openPost(hit.shelfItem, hit.store)
      }}
    >
      <SceneBoundary
        fallback={(retry) => (
          <div className="waydee-world-fallback">
            <p className="text-[15px] font-bold">{t('world.sceneFailed')}</p>
            <button type="button" className="waydee-pill mt-4" onClick={retry}>
              {t('world.retry')}
            </button>
          </div>
        )}
      >
        {/* 🔴 Bir kare bekle — gerekçe `canDraw`ın tanımında. */}
        {canDraw && (
        <Canvas
          {...CANVAS_SETTINGS}
          /* 🔴 WebGL bağlamı kaybı SESSİZ olmasın. Telefonlarda sekme arka
             plana düşünce sürücü bağlamı geri alabiliyor; varsayılan davranış
             tuvalin donması, yani tam olarak bildirilen "gri ekran". */
          key={glKey}
          onCreated={({ gl }) => {
            const canvas = gl.domElement
            canvasRef.current = canvas
            /* 🔴 Bu tuvalin kimliği. Olaylar bunu güncel `glKey` ile
               karşılaştırır; eşit değilse olay ÖLÜ bir tuvalden geliyordur
               (sökülme ya da StrictMode ikizi) ve canlı sahneyi ilgilendirmez. */
            const mine = glKeyRef.current

            /* Tuval bir süre ayakta kaldıysa kurtarma tuttu → sayaç sıfır. */
            const stable = window.setTimeout(() => {
              if (mine === glKeyRef.current) glTriesRef.current = 0
            }, GL_STABLE_MS)

            const onLost = (e: Event) => {
              /* ⚠️ Olmadan `contextrestored` HİÇ gelmez (gerekçe yukarıda). */
              e.preventDefault()
              if (mine !== glKeyRef.current) return // ölü tuval — sessizce geç
              clearGlTimer()

              if (glTriesRef.current >= GL_MAX_AUTO_RETRY) {
                console.warn('[3B evren] WebGL bağlamı yeniden kurulamadı, perde açılıyor')
                setGlState('failed')
                return
              }
              glTriesRef.current += 1
              setGlState('recovering')
              /* Geri dönüş olayı gelirse aşağıdaki dinleyici bu zamanlayıcıyı
                 iptal eder; gelmezse (çoğu durum) kurtarmayı biz yaparız. */
              glTimerRef.current = window.setTimeout(rebuildCanvas, GL_RESTORE_WAIT_MS)
            }

            const onRestored = () => {
              if (mine !== glKeyRef.current) return
              rebuildCanvas()
            }

            /* ⚠️ Dinleyiciler TUVALİN KENDİSİNE bağlı; tuval sökülünce ikisi
               de onunla birlikte çöpe gider. Ayrıca kaldırmaya gerek yok —
               ama `onCreated` bir efekt DEĞİLDİR, temizlik döndürülemez;
               ölü tuvalin canlı state'e yazmasını engelleyen şey yukarıdaki
               `mine !== glKeyRef.current` kapısıdır. */
            canvas.addEventListener('webglcontextlost', onLost)
            canvas.addEventListener('webglcontextrestored', onRestored)
            /* `stable` zamanlayıcısı yalnız sayaç sıfırlar; sayfa kapanırsa
               tetiklense de kapıdan geçemez (kimlik artık eşleşmez). */
            void stable
          }}
        >
          <WorldScene
            world={world}
            onOpenPost={openPost}
            onStoreChange={handleInside}
            likes={likes}
            onToggleLike={toggleLike}
            moveRef={moveRef}
            lookRef={lookRef}
            targetRef={targetRef}
            onAimChange={setAiming}
            /* Kart açıkken yürüme, bakış ve hedefleme durur: arkada sessizce
               hareket eden bir sahne, kart kapanınca kullanıcıyı bambaşka bir
               yerde bırakıyordu. */
            paused={picked !== null}
          />
        </Canvas>
        )}
      </SceneBoundary>

      {/*
        --- bağlam kaybı katmanı ---
        🔴 Donmuş bir tuvalin üstünde HİÇBİR ŞEY yazmamak, kullanıcıya
        "uygulama bozuldu" dedirtiyordu. Tarayıcı bağlamı kendiliğinden geri
        vermezse (bazı sürücüler vermez) elle yeniden kurma yolu burada.
      */}
      {glState === 'recovering' && (
        <div className="waydee-world-fallback">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p className="mt-3 text-[15px] font-bold">{t('world.glRecovering')}</p>
        </div>
      )}
      {glState === 'failed' && (
        <div className="waydee-world-fallback">
          <p className="text-[15px] font-bold">{t('world.glLost')}</p>
          <button
            type="button"
            className="waydee-pill mt-4"
            onClick={() => {
              /* Elle deneme sayacı sıfırlar: kullanıcı bir kez daha şans
                 vermek istiyorsa otomatik kurtarma da yeniden devrededir. */
              glTriesRef.current = 0
              rebuildCanvas()
            }}
          >
            {t('world.retry')}
          </button>
        </div>
      )}

      {/* --- nişangâh: bir ürünü hedeflerken YEŞİL ve biraz büyük --- */}
      <span
        className={`waydee-world-cross ${aiming ? 'waydee-world-cross-aim' : ''}`}
        aria-hidden
      />

      {/* --- üst şerit --- */}
      <div className="waydee-world-top">
        <button
          type="button"
          className="waydee-world-back"
          onClick={() => navigate(`/market/${slug}`)}
          aria-label={t('world.backToMarket')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="waydee-world-title">{inside ? inside.title : world.name}</p>
          <p className="waydee-world-sub">
            {inside
              ? t('world.insideStore', { user: inside.ownerUsername })
              : t('world.storeCount', { count: String(world.stores.length) })}
          </p>
        </div>
      </div>

      {/* --- yardım: yalnız ilk anlarda --- */}
      <Hints empty={empty} />

      {/* --- yön çubuğu: ARTIK MASAÜSTÜNDE DE (kullanıcı isteği) --- */}
      <MoveStick moveRef={moveRef} />

      {/* --- rafta tıklanan gönderi --- */}
      {picked && (
        <div
          className="waydee-world-sheet-scrim"
          role="dialog"
          aria-modal="true"
          onClick={closePicked}
        >
          <div className="waydee-world-sheet" onClick={(e) => e.stopPropagation()}>
            <img src={picked.item.imageUrl} alt="" className="waydee-world-sheet-img" />
            <div className="p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                <StoreIcon className="h-3.5 w-3.5" />
                {picked.store.title}
              </p>
              {picked.item.caption && (
                <p className="mt-1.5 text-[14px] font-medium text-ink">{picked.item.caption}</p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                <Heart className="h-3.5 w-3.5" />
                {picked.item.likeCount}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  className="waydee-pill flex-1"
                  onClick={closePicked}
                >
                  {t('common.close')}
                </button>
                <button
                  type="button"
                  className="waydee-pill waydee-pill-primary flex-1"
                  onClick={() => navigate(`/post/${picked.item.postId}`)}
                >
                  {t('world.openPost')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Gezinme ipuçları — <b>ilk etkileşimde kaybolur</b>.
 *
 * <p>⚠️ Kalıcı bir yardım katmanı, ekranın üçte birini sürekli kaplıyordu.
 * Kullanıcı bir kez tıkladıysa fare kilidini bulmuş demektir.
 */
function Hints({ empty }: { empty: boolean }) {
  const t = useT()
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const off = () => setGone(true)
    window.addEventListener('pointerdown', off, { once: true })
    window.addEventListener('keydown', off, { once: true })
    return () => {
      window.removeEventListener('pointerdown', off)
      window.removeEventListener('keydown', off)
    }
  }, [])

  if (empty) {
    return (
      <div className="waydee-world-hint">
        <Loader2 className="h-4 w-4" />
        <p>{t('world.emptyStreet')}</p>
      </div>
    )
  }

  if (gone) return null

  return (
    <div className="waydee-world-hint">
      <MousePointerClick className="h-4 w-4 shrink-0" />
      <p>{t('world.hint')}</p>
    </div>
  )
}
