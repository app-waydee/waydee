import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Box, ExternalLink, MapPin, Plus, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageSpinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import {
  getMarketplace,
  myListings,
  LISTING_STATUS_META,
  withdrawListing,
  type ListingResponse,
} from '@/lib/marketplace'
import { useT } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'
import { ApplyDialog } from './ApplyDialog'
import { StoreStatsPanel } from './StoreStatsPage'

/**
 * <b>Bir pazar yerinin vitrini</b> (`/market/:slug`) — tanıtım + stant ızgarası
 * + başvuru.
 *
 * <p>🔴 <b>16 Ağu 2026 — ekran yeniden tasarlandı.</b> Önceki sürümde sayfa
 * beyaz bir kart ve onun içinde <b>ölü bir kapak bandı</b> ile açılıyordu:
 * görsel 144px yüksekliğinde bir şeritti, ad/tanıtım/rozetler onun ALTINDA
 * ayrı bir beyaz bloktaydı ve aralarında hiçbir ilişki kurulmuyordu.
 * Artık kapak <b>kahraman bandın kendisidir</b>: ad, tanıtım, rozetler ve
 * istatistikler görselin üstünde, koyudan şeffafa inen bir perdenin üzerinde
 * durur. Eylem düğmeleri kahramanın ALTINA, tema tokenlarını kullanan ayrı
 * bir raya alındı — fotoğrafın üstünde duran bir düğmenin okunurluğu
 * görsele bağlı olurdu.
 *
 * <p>⚠️ Perde ve kahraman rozetleri <b>sabit siyah/beyaz</b>dır, tema ile
 * dönmez: altlarındaki fotoğrafın rengi bilinmiyor. Kahramanın dışındaki her
 * şey `--color-*` tokenlarını kullanır.
 *
 * <p>⚠️ Sayfadaki metinlerin <b>hiçbiri</b> artık sabit Türkçe değil; hepsi
 * sözlüğün `market.*` bölümünden gelir ve beş dile çevrilmiştir.
 */
export function MarketplaceDetailPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const [applying, setApplying] = useState(false)
  const [editing, setEditing] = useState<ListingResponse | null>(null)

  const { data: marketplace, isLoading } = useQuery({
    queryKey: ['marketplace', slug],
    queryFn: () => getMarketplace(slug),
    enabled: !!slug,
  })
  /*
   * 🔴 25 Ağu 2026 — ARTIK PAZARIN TÜM STANTLARI ÇEKİLMİYOR.
   *
   * Kullanıcı: *"stant sahipleri diğer stant bilgilerini şimdilik görmesin"*.
   * Listeyi yalnız ekrandan kaldırmak YETMEZDİ: veri hâlâ tarayıcıya iniyor
   * ve ağ sekmesinde komşuların başvuru bilgileri okunabiliyordu. Gizlemek
   * güvenlik değildir — vault altın kuralı.
   *
   * Bu ekranın tek ihtiyacı **kendi** başvurusu; `/listings/my` onu döndürür.
   */
  const { data: mineList } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => myListings(),
    enabled: !!marketplace,
  })
  const listings = mineList?.filter((l) => l.marketplaceId === marketplace?.id)

  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] })
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] })
      toast.success(t('market.withdrawn'))
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  if (isLoading) return <PageSpinner />
  if (!marketplace) return null

  const mine = marketplace.myListingStatus ? LISTING_STATUS_META[marketplace.myListingStatus] : null
  const myListing = listings?.find((l) => l.mine) ?? null
  const state = marketplace.acceptingApplications ? 'open' : marketplace.full ? 'full' : 'closed'

  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full max-w-screen-xl">
        <button
          onClick={() => navigate('/market')}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {t('market.back')}
        </button>

        {/* ---------------- başlık ----------------
            🔴 KAHRAMAN BANT KALDIRILDI (ikinci geçiş). Sayfanın tepesinde
            tam genişlikte bir kapak fotoğrafı ve üstünde beyaz yazılar vardı;
            kapağı olmayan pazarda (çoğu) yerine vurgu renginden bir degrade
            geliyordu, yani ilk ~300 piksel boş renkti. Artık detay sayfası da
            listeyle ve ana sayfayla AYNI başlığı kullanıyor: ortalı işaret,
            ad, tanıtım, ince meta satırı. İlk ekran artık stantları gösteriyor.
        */}
        <header className="waydee-market-detail-head">
          <span className="waydee-market-detail-mark">
            {marketplace.name.charAt(0).toUpperCase()}
          </span>
          <h1 className="waydee-market-title">{marketplace.name}</h1>
          {marketplace.tagline && <p className="waydee-market-sub">{marketplace.tagline}</p>}

          <div className="waydee-market-meta">
            <span className="waydee-market-state" data-tone={state}>
              <span className="waydee-market-dot" aria-hidden />
              {state === 'open'
                ? t('market.open')
                : state === 'full'
                  ? t('market.full')
                  : t('market.closed')}
            </span>
            {marketplace.autoApprove && (
              <span>
                <Zap className="h-3 w-3" /> {t('market.instant')}
              </span>
            )}
            <span>
              <Users className="h-3 w-3" />
              {marketplace.maxListings
                ? t('market.stallsOf', {
                    n: marketplace.listingCount,
                    max: marketplace.maxListings,
                  })
                : t('market.stalls', { n: marketplace.listingCount })}
            </span>
            <span>
              <MapPin className="h-3 w-3" />
              {t('market.area', {
                n: marketplace.areaKm2.toLocaleString(locale, { maximumFractionDigits: 0 }),
              })}
            </span>
            <span>
              <button
                onClick={() => navigate(`/map?market=${marketplace.slug}`)}
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                {t('market.seeOnMap')} <ExternalLink className="h-3 w-3" />
              </button>
            </span>
          </div>
        </header>

        {/* ---------------- eylem rayı ---------------- */}
        <div className="waydee-market-actions">
          {/* 🔴 3B evren — gezmek herkese açık, stant açmak yalnız pencere
              açıkken mümkün; bu yüzden başvuru düğmesinden ÖNCE duruyor. */}
          <Button variant="stroke" onClick={() => navigate(`/market/${slug}/3d`)}>
            <Box className="h-4 w-4" /> {t('world.enter')}
          </Button>
          {!mine && marketplace.acceptingApplications && (
            <Button onClick={() => setApplying(true)}>
              <Plus className="h-4 w-4" /> {t('market.apply')}
            </Button>
          )}
          {mine && (
            <>
              <span className="waydee-market-applied">
                {t('market.yourApplication')}: <b>{t(mine.labelKey)}</b>
              </span>
              {/*
                🔴 MAĞAZA STÜDYOSUNA GİRİŞ — yalnız ONAYLI stantta.
                Panelin başka bir girişi yok; bu bağlantı olmadan kabul edilen
                kişi dükkânını hiç döşeyemezdi (rota var ama kimse adresi
                bilmiyor). Onaysızda gizli: sunucu zaten 400 döndürür.
              */}
              {marketplace.myListingStatus === 'APPROVED' && marketplace.myListingId && (
                <>
                  <Link to={`/market/${marketplace.slug}/my-store/${marketplace.myListingId}`}>
                    <Button>{t('market.studio')}</Button>
                  </Link>
                </>
              )}
              {(marketplace.myListingStatus === 'REJECTED' ||
                marketplace.myListingStatus === 'APPROVED' ||
                marketplace.myListingStatus === 'PENDING') && (
                <Button
                  variant="stroke"
                  onClick={() => setEditing(myListing ?? ({ id: marketplace.myListingId } as ListingResponse))}
                  disabled={!myListing && !marketplace.myListingId}
                >
                  {t('market.edit')}
                </Button>
              )}
              {marketplace.myListingId && marketplace.myListingStatus !== 'WITHDRAWN' && (
                <Button
                  variant="stroke"
                  onClick={() => withdraw.mutate(marketplace.myListingId!)}
                  disabled={withdraw.isPending}
                >
                  {t('market.withdraw')}
                </Button>
              )}
            </>
          )}
        </div>

        {marketplace.description && <p className="waydee-market-about">{marketplace.description}</p>}

        {/*
          ---------------- alt bölüm: KENDİ İSTATİSTİKLERİN ----------------

          🔴 25 Ağu 2026 — <b>STANT LİSTESİ BURADAN KALDIRILDI</b> (kullanıcı
          talimatı: *"alt kısımda diğer stantlar görünüyor, onu oradan kaldır,
          alt kısma istatistikler gelsin; stant sahipleri diğer stant
          bilgilerini şimdilik görmesin"*).

          ⚠️ Kaldırılan yalnız bu sayfadaki <b>liste</b>dir. Stantlar
          **3B caddede** duruyor ve kimse oradan silinmedi; kaldırılan şey,
          bir stant sahibinin komşularının başvuru kartlarını (beğeni, ilgi,
          sahip bilgisi) tek ekranda taraması.

          ⚠️ Onaylı stantı olmayan ziyaretçi burada <b>hiçbir şey</b> görmez:
          boş bir "istatistik" başlığı, kendisine ait olmayan bir ölçüm
          varmış hissi verirdi. Onun için sayfa üstteki eylem rayında biter.
        */}
        {marketplace.myListingStatus === 'APPROVED' && marketplace.myListingId && (
          <>
            <h2 className="waydee-market-section">{t('storeStats.title')}</h2>
            <p className="mb-3 text-[13px] font-medium text-muted">{t('storeStats.sub')}</p>
            <StoreStatsPanel listingId={marketplace.myListingId} />
          </>
        )}
      </div>

      {applying && <ApplyDialog marketplace={marketplace} onClose={() => setApplying(false)} />}
      {editing && (
        <ApplyDialog
          marketplace={marketplace}
          existing={myListing ?? editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
