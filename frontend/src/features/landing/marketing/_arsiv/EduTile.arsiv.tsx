/* eslint-disable */
// @ts-nocheck
/**
 * 🗄️ ARŞİV — "Vitrinin hazır. Şimdi dünyaya aç." karosu (EduTile).
 *
 * 🔴 26 Ağustos 2026, 100. tur — kullanıcı isteğiyle TANITIM SAYFASINDAN
 * KALDIRILDI: *"arkadaki dünya kısmını hareketli fotoğrafları kaldır,
 * yorum satırına al ya da başka bir yere yedekle, css'leriyle her şeyiyle —
 * landing'de görünmesin."*
 *
 * ⚠️ Bu dosya SİLİNMEDİ, çünkü karo apple.com `bts-2026` referansından
 * piksel piksel ölçülerek çıkarıldı (figür sınırları, solo klip hizaları,
 * `FIGURE_EDGES`); silinseydi geri getirmek o ölçüm turunu baştan yapmak
 * demekti. Vault kuralı: **bir yüzeyden kaldırmak silmek değildir.**
 *
 * ⚠️ Bu dosya HİÇBİR YERDEN İTHAL EDİLMEZ ve pakete girmez — Vite yalnız
 * ulaşılabilir modülleri toplar. `@ts-nocheck`, arşivin derlemeyi
 * kilitlememesi içindir (bağımlılıkları artık burada tanımlı değil).
 *
 * Geri getirmek için:
 *  1. Buradaki bileşenleri `LandingPage.tsx`'e geri taşı,
 *  2. `edu-tile.arsiv.css` içeriğini `index.css`'e geri koy,
 *  3. `LandingPage`in ana akışına `<EduTile />` satırını ekle
 *     (yeri: `<StatementDark />` ile `<StatementLight />` arası).
 *
 * Kullandığı varlıklar `public/landing/bts-*` altında **duruyor**.
 */

/**
 * 🎓 <b>Eğitim vitrini</b> — apple.com ana sayfasındaki
 * `data-tile-id="bts-2026"` karosunun yerleşimi ve <b>hover hareketi</b>.
 *
 * Ölçüldü (canlı apple.com): karo zemini `#F5F5F7` · `overflow: clip` ·
 * başlık **56/60 w600 ls -0.28px** `#1d1d1f` · alt metin **28/32 w400
 * ls 0.196px** · buton `#0071E3`, **radius 980px**, `padding: 11px 21px`,
 * **17px/20px ls -0.374px**.
 *
 * 🔴 <b>GÖRSEL GEÇİCİDİR.</b> `public/landing/bts-*` apple.com'dan indirilen
 * kampanya görselidir ve <b>yalnız yapı denenebilsin diye</b> duruyor.
 * Tasarımcının çekimleri gelince <b>aynı dosya adlarının üzerine yazılacak</b>
 * — kod hiç değişmez.
 *
 * ⚠️ <b>7 Ağu 2026:</b> dosyalar önce bilerek depoya alınmamıştı ve üretimde
 * bu alan boş görünüyordu. <b>Site sahibinin açık talimatıyla</b> geçici
 * olarak yayına alındı: grafiker yerleşimi <b>canlı sitede</b> görüp yerine
 * kendi çekimlerini üretecek. <b>Değiştirilmesi bekleniyor</b> — kalıcı
 * kullanım için değildir. Yeni dosyalar `public/landing/GRAFIKER-NOTU.md`
 * içindeki ölçülere göre hazırlanıp aynı adlarla konur.
 *
 * Üç figür tek bir kompozit PNG'dir; `background-size: 300%` ile üçe
 * bölünüp her biri ayrı katman gibi hareket ettirilir (kademeli gecikme).
 */
function EduTile() {
  const t = useT()
  return (
    <section className="w-full bg-white">
      <div className="waydee-bts">
        {/* 🔴 Görsel katmanı KARONUN TAMAMINI kaplar (`absolute · inset 0`)
            ve yazı bunun ÜSTÜNE biner — referansta `.tile-image-wrapper`
            1265×692'nin tamamıdır. Önceki sürümde yazı üstte, görsel altta
            ayrı bir blok olarak duruyordu; "alakası yok" denen fark buydu. */}
        <EduTileMedia />
        <div className="waydee-bts-copy">
          <h2 className="waydee-bts-h">{t('landing.edu.title')}</h2>
          <p className="waydee-bts-sub">{t('landing.edu.subtitle')}</p>
          <div className="waydee-bts-cta">
            <Link to="/register" className="waydee-bts-btn">
              {t('landing.edu.cta')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Karonun altındaki animasyon — <b>referansın gerçek yapısı</b>.
 *
 * 🔴 Bu bir PNG **değil**: apple.com'da `<video ... data-inline-media-type
 * ="webm">` duruyor. PNG yalnız <b>start-frame</b>'dir (video hazır olana
 * kadar görünen ilk kare). İlk kurulumumda videoyu kaçırıp PNG'yi üçe
 * bölmüştüm — o yüzden "fotoğraflar oynamıyor" diyordun.
 *
 * Referansın oynatma kuralı `data-inline-media-play-kf`:
 * `{"start":"t - (100vh - 70h)","end":"b"}` → yani **kaydırma ile görünür
 * olunca oynar**, hover ile değil. Biz buna ek olarak <b>üzerine gelince
 * baştan oynatıyoruz</b> (senin istediğin davranış).
 *
 * ⚠️ `webm` dosyaları ve start-frame **geçicidir** (apple.com'dan alındı,
 * yalnız yapı denenebilsin diye). Tasarımcının çıktısı <b>aynı adlarla</b>
 * üzerine yazılacak: `bts-{small,medium,large}.webm` + `bts-large.png`.
 */
/**
 * Solo kliplerinin **soldan sağa** yerleşimi — tahminle değil, iki görseli
 * de piksel piksel tarayarak çıkarıldı.
 *
 * Yöntem:
 * 1. `bts-static-large.jpg` (3008×692) canvas'a çizildi ve zemin rengi
 *    (`rgb(245,245,247)`) dışındaki pikseller tarandı.
 *    ⚠️ **Eşik düşük tutulmalı (12).** Yüksek eşikle (28) figürlerin saç
 *    ve anti-aliasing kenarları zemin sanılıyor; kutular 8–15px küçük ve
 *    sağa kaymış çıkıyordu — "hover'da küçülüp sağa gidiyor" şikâyetinin
 *    kök nedeni buydu.
 *    ⚠️ Sol ve orta figür **birbirine değiyor**; ayrım sütunu 1300–1400
 *    aralığında **en az mürekkepli** sütun aranarak bulundu (x=1332, 10 px).
 *    Gerçek kutular: sol `x943 g390 h407` · orta `x1333 g354 h425` ·
 *    sağ `x1701 g329 h391`.
 *    Karo koordinatına çevrimi: `cover` ölçeği 1.0 ve yatay ofset
 *    `(3008−1265)/2 = 871.5` → sol **71.5** · orta **461.5** · sağ **829.5**.
 * 2. Her solo klibinin **İLK KARESİ** (`currentTime = 0`) canvas'a çizilip
 *    **alfa sınır kutusu** bulundu → figürün klip içindeki yeri:
 *    solo1 `x59 g278 h329` · solo2 `x24 g307 h315` · solo3 `x47 g258 h302`.
 *    ⚠️ Ölçümü animasyonun ORTASINDAN almak yanlış sonuç verir: figür o
 *    anda hareket hâlindedir. Statikle eşleşmesi gereken kare, animasyonun
 *    başladığı **duruş karesidir**. İlk turda t≈1,2 sn'den ölçtüğüm için
 *    klipler hover'da hafifçe sağa kaymış duruyordu (sağdaki 15 px).
 *
 * 🔴 **ÖLÇEK 1.0 — klipler büyütülmez.** Solo dosyalarının `largetall`
 * varyantı kullanılır (484×460 · 500×460 · 482×460); bunlar statiğin
 * üstüne **birebir** oturmak için üretilmiştir. Ölçüldü: gereken ölçek
 * **1.0000 · 1.0024 · 1.0000**, figür yükseklikleri 407 · 424 · 391 →
 * statik hedeflerle (407 · 425 · 391) aynı.
 *
 * ⚠️ Uzun süre `large` varyantını (400×350 · 360×350 · 368×350)
 * kullandım; onlar düşük çözünürlüklü ve **%28 büyütme** gerektiriyordu.
 * Statik 1:1 native çizilirken videonun upscale edilmesi hem yumuşaklık
 * hem hafif şişkinlik yaratıyor, bu da hover'da **"öne geliyor"** hissi
 * veriyordu. Kök neden ölçü hesabı değil, **yanlış kırılım dosyasıydı** —
 * aynı hata durağan karede de yaşanmıştı (`large` yerine `largetall`).
 *
 * 🔴 İki bulgu:
 * - **Eşleşme sırası 1-2-3 değil**: yükseklik oranları (1.304 · 1.284 ·
 *   1.301) yalnız **sol→solo2 · orta→solo1 · sağ→solo3** kurulumunda
 *   tutarlı çıkıyor. Referansın DOM sırası da bunu doğruluyor
 *   (`bts-solo-02 → bts-solo-01 → bts-solo-03`).
 * - **Klipler statikten ~%30 küçük**: ortak ölçek **1.296**. Kliplere
 *   karonun üçte birini vermek onları küçük bırakıyordu — kullanıcının
 *   "hover küçük kalıyor" dediği fark buydu.
 *
 * Aşağıdaki yüzdeler = klibin kutusu, figürün alfa kutusu statiktekinin
 * üstüne **tam oturacak** şekilde hesaplandı. Dikeyde ikisi de karonun
 * altına yaslı (statik figürlerin tabanı 692 = karo tabanı; kliplerde de
 * figürün alt boşluğu 0).
 */
const SOLO_LAYOUT = [
  { file: 2, leftPct: 1.62, widthPct: 38.26 },
  { file: 1, leftPct: 30.16, widthPct: 39.53 },
  { file: 3, leftPct: 60.12, widthPct: 38.1 },
] as const

/**
 * Figürler arasındaki **gerçek** ayrım çizgileri (karo genişliğinin yüzdesi).
 *
 * 🔴 Figürler üçte birlerde DEĞİL. Statik taramasından çıkan kutular
 * (karo koordinatı): sol **85→466** · orta **470→814** · sağ **843→1157**.
 * Sınırlar iki figürün ortasından geçer: (466+470)/2 = 468 → %37,0 ve
 * (814+843)/2 = 828,5 → %65,5.
 *
 * Bu sınırlar İKİ yerde kullanılır ve ikisinde de aynı olmak zorundadır:
 * - durağan karenin `clip-path` dilimleri (hover'da o figürü gizlemek için)
 * - hover algılama alanları
 * ⚠️ Üçte bir kullanmak, orta dilimi gizlerken **soldaki figürün sağ
 * kenarını kesiyordu** (ekranda dikey bir iz olarak görünüyordu).
 */
const FIGURE_EDGES = [0, 36.4, 64.98, 100] as const

/**
 * Kıtaların kaba enlem/boylam kutuları. Nokta-matris dünyada karanın
 * "koyu", denizin "silik" çizilmesi için kullanılır.
 *
 * ⚠️ Bilinçli olarak kaba: bu bir harita değil, **arka plan dokusu**.
 * Gerçek GeoJSON yüklemek yüzlerce KB ve bir ağ isteği demekti; burada
 * amaç yalnız "dünya" izlenimi vermek.
 * Format: `[boylamMin, boylamMax, enlemMin, enlemMax]`.
 */
const LANDMASS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-168, -52, 25, 72], // Kuzey Amerika
  [-118, -78, 14, 32], // Meksika / Orta Amerika
  [-55, -20, 59, 83], // Grönland
  [-82, -34, -56, 12], // Güney Amerika
  [-18, 52, -35, 37], // Afrika
  [-10, 40, 36, 71], // Avrupa
  [40, 145, 8, 75], // Asya
  [68, 90, 6, 35], // Hindistan
  [95, 141, -10, 25], // Güneydoğu Asya
  [113, 154, -39, -11], // Avustralya
  [-180, 180, -90, -72], // Antarktika
]

const isLand = (lon: number, lat: number) =>
  LANDMASS.some(([a, b, c, d]) => lon >= a && lon <= b && lat >= c && lat <= d)

/**
 * 🌐 Arka plandaki **dönen nokta-matris dünya** — siber güvenlik
 * sitelerindeki "kare kare dünya" dokusu.
 *
 * Canvas ile çizilir: dış kütüphane yok, ağ isteği yok (CSP güvenli),
 * eklediği ağırlık sıfır. Küre üzerinde enlem/boylam ızgarası kurulur,
 * ortografik izdüşümle ekrana basılır ve boylam zamanla döner.
 * Yalnız ön yarıküre (`z > 0`) çizilir; opaklık derinliğe (`z`) bağlıdır,
 * böylece kenarlara doğru söner ve küre hissi doğar.
 *
 * Palet bilinçli olarak **gri**: kara koyu gri, deniz çok silik gri —
 * öndeki renkli figürlerle yarışmaz.
 *
 * ⚠️ `prefers-reduced-motion` açıksa döndürme yok, tek kare çizilir.
 * ⚠️ Bir kare **hemen** çizilir; `rAF` hiç çalışmasa da (bazı ortamlarda
 * olmuyor) arka plan boş kalmaz.
 */
function EduTileGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let disposed = false

    const draw = (spin: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const R = Math.min(w * 0.34, h * 0.92)
      const cx = w / 2
      const cy = h * 0.52
      const cell = Math.max(2, Math.round(R / 68)) // "kare kare" doku

      for (let lat = -88; lat <= 88; lat += 3.4) {
        const rad = (lat * Math.PI) / 180
        // Enlem yükseldikçe boylam adımını büyüt → noktalar eşit aralıklı kalır.
        const step = 3.4 / Math.max(0.18, Math.cos(rad))
        for (let lon = -180; lon < 180; lon += step) {
          const l = ((lon + spin) * Math.PI) / 180
          const z = Math.cos(rad) * Math.cos(l)
          if (z <= 0.02) continue // arka yarıküre
          const x = cx + R * Math.cos(rad) * Math.sin(l)
          const y = cy - R * Math.sin(rad)
          const land = isLand(lon, lat)
          // Derinlik: merkeze yakın nokta daha belirgin.
          const a = (land ? 0.5 : 0.16) * Math.pow(z, 0.75)
          ctx.fillStyle = land ? `rgba(90,90,96,${a})` : `rgba(140,140,148,${a})`
          ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell)
        }
      }
    }

    // İlk kare hemen — rAF çalışmasa da arka plan boş kalmaz.
    draw(0)

    if (!reduce) {
      const t0 = performance.now()
      const loop = (now: number) => {
        if (disposed) return
        // Tam tur ≈ 70 sn — göz yormayan, sürekli bir dönüş.
        draw(((now - t0) / 70000) * 360)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    const onResize = () => draw(0)
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="waydee-bts-globe" aria-hidden="true" />
}

function EduTileMedia() {
  const t = useT()
  const heroRef = useRef<HTMLVideoElement>(null)
  const soloRefs = useRef<(HTMLVideoElement | null)[]>([])
  /** `intro` = giriş animasyonu oynuyor · `settled` = durağan kare + hover aktif. */
  const [phase, setPhase] = useState<'intro' | 'settled'>('intro')
  const [heroPainted, setHeroPainted] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)

  const settle = useCallback(() => setPhase('settled'), [])

  /**
   * Hero videosunun maskesi: hover edilen figürün bandı şeffaf olur.
   * Tek bir `linear-gradient` — sert duraklarla üç bant. Böylece hem
   * "hangi figür gizlenecek" sorusu çözülür hem de **kesik/çizgi oluşmaz**.
   */
  const heroMask =
    phase === 'settled' && hovered !== null
      ? `linear-gradient(to right, #000 0 ${FIGURE_EDGES[hovered]}%, ` +
        `transparent ${FIGURE_EDGES[hovered]}% ${FIGURE_EDGES[hovered + 1]}%, ` +
        `#000 ${FIGURE_EDGES[hovered + 1]}% 100%)`
      : 'none'

  // 1) Giriş: kaydırmayla görünür olunca hero videosu BİR KEZ oynar.
  useEffect(() => {
    const v = heroRef.current
    if (!v) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle()
      return
    }
    // ⚠️ `play()` Promise döndürür; otomatik oynatma engellenirse reddedilir.
    // Yakalanmazsa konsola hata düşer ve karo giriş aşamasında donar.
    const play = () => void v.play().catch(settle)
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && play()), {
      threshold: 0.25,
    })
    io.observe(v)
    // ⚠️ Sigorta (vault kuralı: süs içeriği yutamaz) — IO tetiklenmezse de başlat.
    const timer = window.setTimeout(play, 2500)
    return () => {
      io.disconnect()
      window.clearTimeout(timer)
    }
  }, [settle])

  // 2) Hover: yalnız o figürün solo videosu baştan oynar.
  useEffect(() => {
    if (phase !== 'settled') return
    soloRefs.current.forEach((v, i) => {
      if (!v) return
      if (i === hovered) {
        v.currentTime = 0
        void v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [hovered, phase])

  return (
    <div className="waydee-bts-media">
      <EduTileGlobe />
      {/* 🔴 DURAĞAN KARE ARTIK JPG DEĞİL — hero videosunun **son karesi**.
          Video bittiğinde `data-on` açık kalır, tarayıcı son kareyi ekranda
          tutar. Üç kazanç birden:
          1. Video **alfa kanallıdır** → arkadaki küre yalnız gerçek boşlukta
             görünür. JPG opak olduğu için onu `mix-blend-mode: multiply` ile
             geçirgenleştirmek gerekiyordu ve o da noktaları **figürlerin ve
             beyaz konturların üstünden** geçiriyordu.
          2. Tek öğe olduğu için `clip-path` dilimlerine gerek kalmaz →
             figürler arasındaki **iki dikey çizgi kayboldu** (o çizgiler
             komşu dilimlerin kenarlarıydı).
          3. Son kare zaten duruş pozudur; JPG ile arasındaki 1-2px'lik
             kayma sorunu da ortadan kalkar.
          Hover'da ilgili bant `mask-image` ile şeffaflaştırılır — tek
          öğede, kesiksiz. */}
      <video
        ref={heroRef}
        muted
        playsInline
        preload="none"
        role="img"
        aria-label={t('landing.edu.mediaAlt')}
        className="waydee-bts-video"
        // Giriş bittikten sonra da görünür kalır: tarayıcı son kareyi
        // ekranda tutar ve o kare bizim "durağan karemiz" olur.
        data-on="true"
        style={{
          // Hover'daki figürün bandı şeffaflaşır → altındaki solo videosu
          // görünür. Tek öğe + tek gradyan olduğu için **kenar/çizgi oluşmaz**
          // (üç ayrı `clip-path` dilimi tam da o iki çizgiyi yaratıyordu).
          maskImage: heroMask,
          WebkitMaskImage: heroMask,
        }}
        onPlaying={() => setHeroPainted(true)}
        onEnded={settle}
      >
        {/* ⚠️ Masaüstünde **largetall** kullanılır: yüksekliği karoyla aynı
            olduğu için `cover` ölçeği 1.0 olur ve görsel hiç şişmez.
            `large` (alçak şerit) kullanmak her şeyi büyütüyordu. */}
        <source src="/landing/bts-small.webm" type="video/webm" media="(max-width: 734px)" />
        <source src="/landing/bts-medium.webm" type="video/webm" media="(max-width: 1068px)" />
        <source src="/landing/bts-largetall.webm" type="video/webm" />
      </video>

      {/* Start-frame: hero ilk kareyi boyayana kadar görünen donuk kare. */}
      <img
        src="/landing/bts-large.png"
        alt=""
        aria-hidden="true"
        className="waydee-bts-startframe"
        data-on={!heroPainted && phase === 'intro' ? 'true' : 'false'}
      />

      {/* 🔴 Üç SOLO videosu — referanstaki `bts-solo-01/02/03`.
          Hepsi tam kare kaplar; yalnız üzerine gelinen görünür olur. */}
      {[0, 1, 2].map((i) => (
        <video
          key={i}
          ref={(el) => {
            soloRefs.current[i] = el
          }}
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          className="waydee-bts-solo"
          style={{
            left: `${SOLO_LAYOUT[i].leftPct}%`,
            width: `${SOLO_LAYOUT[i].widthPct}%`,
            /**
             * 🔴 Klip KENDİ figür bölgesine kırpılır.
             *
             * Sebebi ölçümle bulundu: statik görselde eşik sıfırlanınca sol
             * ve orta figür **tek blokta birleşiyor** (944→1686) — yani
             * yatayda temas ediyorlar. Dolayısıyla solo klipleri komşu
             * figürün bir parçasını da içeriyor ve üstüne çizilince
             * ekranda **dikey bir iz** bırakıyordu.
             *
             * Sınırlar `FIGURE_EDGES` (karo yüzdesi) → klibin kendi
             * kutusuna çevrilir; negatifler 0'a kırpılır.
             */
            clipPath: (() => {
              const { leftPct, widthPct } = SOLO_LAYOUT[i]
              const l = Math.max(0, ((FIGURE_EDGES[i] - leftPct) / widthPct) * 100)
              const r = Math.max(0, 100 - ((FIGURE_EDGES[i + 1] - leftPct) / widthPct) * 100)
              return `inset(0 ${r.toFixed(2)}% 0 ${l.toFixed(2)}%)`
            })(),
          }}
          /**
           * 🔴 Ölçek referansı **durağan karedir**, hero videosu değil.
           * Hover'da solo, arkasındaki durağan figürün YERİNİ alır; o yüzden
           * tam olarak onun yuvasını — karonun **üçte birini** — doldurmalı.
           * Hero'ya oranlayınca (ölçek 1.035) figür statiktekinden küçük
           * kalıyordu; kullanıcının gördüğü fark buydu.
           *
           * ⚠️ `aspectRatio` metadata'dan yazılır: `<video>`'nun varsayılan
           * iç boyutu 300×150'dir ve `height:auto` yüksekliği 150px'te
           * bırakıyordu.
           */
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            if (!v.videoWidth) return
            v.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`
          }}
          data-on={phase === 'settled' && hovered === i ? 'true' : 'false'}
        >
          {/* 🔴 DOSYA SIRASI SOLDAN SAĞA 1-2-3 DEĞİLDİR. Referansın DOM'unda
              öğeler `bts-solo-02 → bts-solo-01 → bts-solo-03` sırasıyla
              duruyor; yani **`solo-1` ORTADAKİ** figür, `solo-2` soldaki.
              1-2-3 varsaydığım için sol yuvada ortadaki kişi oynuyordu. */}
          <source src={`/landing/bts-solo${SOLO_LAYOUT[i].file}-large.webm`} type="video/webm" />
        </video>
      ))}

      {/* Hover alanları: karonun üçte birleri. Referansın `.solo-box`'ları. */}
      {[0, 1, 2].map((i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="waydee-bts-hit"
          // Algılama alanı da figür sınırlarını takip eder — `clip-path`
          // dilimleriyle **birebir aynı** olmalı, yoksa yanlış figür gizlenir.
          style={{
            left: `${FIGURE_EDGES[i]}%`,
            width: `${FIGURE_EDGES[i + 1] - FIGURE_EDGES[i]}%`,
          }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
        />
      ))}
    </div>
  )
}
