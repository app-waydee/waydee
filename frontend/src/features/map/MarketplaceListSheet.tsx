import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, MapPin, Store, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'
import type { MarketplaceAreaProperties } from '@/lib/marketplace'

/**
 * 🧾 <b>Aktif pazar yerleri listesi</b> — haritadaki "Pazar yerleri"
 * düğmesine basınca açılan yumuşak panel.
 *
 * <h2>105. tur, kullanıcı isteği</h2>
 * <p>*"map kısmında pazar yerlerine tıklayınca soft şekilde aktif pazar
 * yerleri açılsın, güzel bir tasarımla listelensin, listenin sağında da konum
 * işareti olsun, tıklayınca konuma götürsün. Kartın sol tarafında da o pazarın
 * fotoğrafı olsun, ortasında da isim açıklama falan."*
 *
 * <h2>⚠️ Yeni bir uç YOK</h2>
 * <p>Liste, haritanın <b>zaten çektiği</b> alan katmanından besleniyor
 * (`marketplaceAreas`). Ayrı bir istek açmak aynı veriyi ikinci kez indirmek
 * ve iki listenin birbirinden sapması demekti — panelde görünen sayı ile
 * haritadaki rozetin sayısı <b>aynı andan</b> geliyor.
 *
 * <h2>📱 Mobil</h2>
 * <p>Telefonda <b>alt sayfa</b> (bottom sheet), masaüstünde sol kenardaki
 * çubuğun yanında duran bir panel. İkisi de aynı bileşen: kırılım yalnız
 * konumlandırma sınıflarında.
 *
 * <p>⚠️ Masaüstünde <b>`md:left-24`</b>: 80px'lik kenar çubuğu + nefes payı.
 * `left-4` bırakılsaydı panelin sol kenarı çubuğun ARDINDA kalırdı — vault'ta
 * kayıtlı, `MarketplaceMapCard`ta bir kez yaşanmış hata.
 *
 * <p>⚠️ Alt çubuğun üstünde durması için `waydee-above-nav`.
 */
export function MarketplaceListSheet({
  open,
  areas,
  onClose,
  onGoto,
  layerOn,
  onToggleLayer,
}: {
  open: boolean
  areas: MarketplaceAreaProperties[]
  onClose: () => void
  /** Konum işaretine basıldı — harita oraya uçsun. */
  onGoto: (area: MarketplaceAreaProperties) => void
  /** Pazar katmanı haritada görünür mü (poligonlar + rozetler). */
  layerOn: boolean
  onToggleLayer: (next: boolean) => void
}) {
  const t = useT()
  const navigate = useNavigate()
  /* Sayı biçimi dile bağlı: sabit 'tr-TR' İngilizce arayüzde "37.909" gibi
     Türkçe ayraçlı bir sayı gösteriyordu (kayıtlı hata). */
  const locale = useI18nStore((s) => s.locale)
  const nf = new Intl.NumberFormat(locale)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/*
            Perde. 🔴 `createPortal` GEREKMİYOR çünkü bu panel harita
            kabuğunun İÇİNDE değil, sayfanın en dışında `fixed` duruyor —
            97. turdaki "perde yığın bağlamının içinde kaldı" hatası burada
            oluşamaz. Yine de z düzeyi üst çubuktan (z-40) yüksek seçildi.
          */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[3px] md:bg-ink/8"
            onClick={onClose}
            aria-hidden
          />

          <motion.aside
            role="dialog"
            aria-label={t('map.mpList.title')}
            /*
              🔴 "Gerçekten soft" (kullanıcı isteği): sert bir açılış yerine
              yaylı bir geçiş. Mobilde aşağıdan yukarı, masaüstünde soldan
              içeri — ikisi de kısa bir yol kat eder, çünkü uzun yol "soft"
              değil "yavaş" hissettiriyor.

              ⚠️ Burada `transform` animasyonu SERBEST: vault'un yasağı
              haritaya çivilenmiş (konum kritik) öğeler için — bu panel
              viewport'a sabit, bir koordinata değil.
            */
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.7 }}
            className="waydee-glass waydee-above-nav pointer-events-auto fixed inset-x-3 bottom-3 z-50 max-h-[68vh] overflow-hidden rounded-[26px] md:inset-x-auto md:bottom-6 md:left-24 md:top-24 md:w-[380px] md:max-h-none"
          >
            <header className="waydee-glass-head flex items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
                  <Store className="h-4 w-4 shrink-0" />
                  {t('map.mpList.title')}
                </h2>
                <p className="mt-0.5 truncate text-[12.5px] text-muted">
                  {t('map.mpList.subtitle').replace('{count}', nf.format(areas.length))}
                </p>
              </div>
              {/* 🔴 Katman anahtarı BURAYA taşındı: düğme artık listeyi
                  açıyor ama haritayı sadeleştirmek için katmanı kapatan
                  kullanıcılar var ve tercihleri saklı. Yeteneği silmek
                  yerine yerini değiştirmek — vault kuralı: bir yüzeyden
                  kaldırmak silmek değildir. */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleLayer(!layerOn)}
                  aria-pressed={layerOn}
                  title={t('map.mpList.showLayer')}
                  aria-label={t('map.mpList.showLayer')}
                  className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
                    layerOn ? 'bg-ink text-on-ink' : 'bg-surface-2 text-muted hover:text-ink'
                  }`}
                >
                  {layerOn ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                /* ⚠️ 40×40: dokunma hedefi minimum 40px — 24px'lik bir X'e
                   telefonda isabet ettirmek zor. */
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
              </div>
            </header>

            {/* ⚠️ `overscroll-contain`: liste sonuna gelince kaydırma
                ARKADAKİ haritaya geçiyordu ve panel açıkken harita kayıyordu. */}
            <div className="max-h-[calc(68vh-72px)] overflow-y-auto overscroll-contain p-3 md:max-h-[calc(100vh-13rem)]">
              {areas.length === 0 ? (
                <p className="px-2 py-10 text-center text-[13.5px] text-muted">
                  {t('map.mpList.empty')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {areas.map((a, i) => (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      /* Kademeli giriş — hepsi birden belirince liste
                         "açıldı" değil "yapıştı" gibi duruyordu.
                         ⚠️ Gecikme SINIRLI: otuz pazarda son kart 1,5 sn
                         sonra gelirdi. */
                      transition={{ delay: Math.min(i * 0.035, 0.28), duration: 0.24 }}
                      className="waydee-glass-row group flex items-center gap-3 rounded-2xl p-2.5"
                    >
                      {/* --- sol: pazarın fotoğrafı --- */}
                      <button
                        type="button"
                        onClick={() => navigate(`/market/${a.slug}`)}
                        aria-label={t('map.mpList.open')}
                        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2"
                        style={{ boxShadow: `inset 0 0 0 1.5px ${a.accentColor}22` }}
                      >
                        {a.coverUrl ? (
                          <img
                            src={a.coverUrl}
                            alt=""
                            aria-hidden
                            loading="lazy"
                            draggable={false}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          /* Görsel yoksa pazarın rengiyle bir mağaza ikonu:
                             boş gri bir kutu "yüklenmedi" gibi okunuyordu. */
                          <Store className="h-5 w-5" style={{ color: a.accentColor }} />
                        )}
                      </button>

                      {/* --- orta: ad + açıklama + sayaç --- */}
                      <button
                        type="button"
                        onClick={() => navigate(`/market/${a.slug}`)}
                        className="min-w-0 flex-1 text-start"
                      >
                        <p className="truncate text-[14px] font-bold text-ink">{a.name}</p>
                        {a.tagline && (
                          <p className="line-clamp-2 text-[12.5px] leading-snug text-muted">
                            {a.tagline}
                          </p>
                        )}
                        <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                          <i
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: a.accentColor }}
                            aria-hidden
                          />
                          {t('map.mpList.stalls').replace('{count}', nf.format(a.listingCount))}
                        </span>
                      </button>

                      {/* --- sağ: konum işareti --- */}
                      <button
                        type="button"
                        onClick={() => onGoto(a)}
                        aria-label={t('map.mpList.goto')}
                        title={t('map.mpList.goto')}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[0.055] text-muted transition-colors hover:bg-ink hover:text-on-ink"
                      >
                        <MapPin className="h-4 w-4" />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
