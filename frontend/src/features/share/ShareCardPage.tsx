import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Download, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { CropDialog } from '@/components/media/CropDialog'
import { Logo } from '@/components/Logo'
import { api, apiErrorMessage } from '@/lib/api'
import { invalidateAvatarQueries, updateMe } from '@/lib/account'
import { uploadImage } from '@/lib/media'
import { renderShareCard } from '@/lib/shareCard'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/i18n'
import type { TerritoryResponse } from '@/types/api'
import { SocialShareRow } from './SocialShareRow'

/**
 * <b>Mağaza duyuru kartı</b> ekranı (`/my-card`).
 *
 * <p>🔴 <b>10 Ağustos 2026 — BU EKRANIN TETİKLEYİCİSİ DEĞİŞTİ.</b> Eskiden
 * <b>kayıt olur olmaz</b> herkese açılan bir "Ben de Waydee'deyim!" karşılama
 * ekranıydı. Kullanıcı bunu kapattı: kayıt sonrası artık <b>ana sayfaya</b>
 * gidiliyor ve kart yalnız <b>Premium'a geçip haritada mağazasını açan</b>
 * kişi için üretiliyor (`StorePanel` → `onCreated` → buraya).
 *
 * <p>Gerekçe: paylaşılmaya değer an "kaydoldum" değil, "haritada bir yerim
 * var"dır. Kayıt anındaki kartın paylaşacak bir içeriği yoktu — ne konum, ne
 * alan, ne gidilecek bir adres.
 *
 * <p>⚠️ <b>Mağazası olmayan buraya giremez</b>: kart mağazayı duyurur, mağaza
 * yoksa duyurulacak bir şey de yok. Adresi elle yazan kullanıcı `/home`'a
 * düşer. Bu kapı istemcidedir çünkü burada korunacak bir veri yok — ekran
 * kullanıcının kendi bilgisinden görsel üretir.
 *
 * <p>Akış: <b>mağaza seçimi → kart üretimi → paylaşım</b>. Kart tarayıcıda
 * üretilir (canvas) — sunucuya iş düşmez ve kullanıcı fotoğrafını değiştirdiği
 * anda önizleme yenilenir.
 */
export function ShareCardPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const t = useT()

  const [cropFile, setCropFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [rendering, setRendering] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: territories, isLoading: loadingTerritories } = useQuery({
    queryKey: ['my-territories'],
    queryFn: async () => (await api.get<TerritoryResponse[]>('/territories/my')).data,
    staleTime: 60_000,
  })

  /*
   * ⚠️ `?t=<id>` ile gelinir (mağaza az önce açıldı) — o daire seçilir.
   * Parametre yoksa kullanıcının etkin mağazasına düşülür: kartı sonradan
   * tekrar açmak isteyen kişi adres parametresi taşımıyor.
   */
  const [searchParams] = useSearchParams()
  const wantedId = searchParams.get('t')
  const store = useMemo(() => {
    if (!territories) return null
    if (wantedId) {
      const exact = territories.find((x) => String(x.id) === wantedId)
      if (exact) return exact
    }
    return territories.find((x) => x.status === 'ACTIVE') ?? territories[0] ?? null
  }, [territories, wantedId])

  const draw = useCallback(async () => {
    if (!user || !store) return
    setRendering(true)
    try {
      const png = await renderShareCard({
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        // Mağaza adı boşsa bölge etiketine düş — başlıksız bir duyuru olmaz.
        storeName: store.name || store.regionLabel || user.displayName,
        lng: store.lng,
        lat: store.lat,
        areaM2: store.areaKm2 * 1_000_000,
        locationLabel: store.regionLabel ?? store.name,
        /*
         * ⚠️ QR **mağazaya** gider: kartı gören kişi kodu okutunca haritada o
         * daire ortalanır ve kartı açılır. Adres bilinçli olarak `/map?t=` —
         * `/t/:id` oturum ister ve kodu okutan yabancı giriş ekranına düşerdi.
         */
        qrUrl: `${window.location.origin}/map?t=${store.id}`,
      })
      setBlob(png)
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(png)
      })
    } catch (error) {
      toast.error(apiErrorMessage(error, t('share.failed')))
    } finally {
      setRendering(false)
    }
    // `store` ve kullanıcı alanları değiştikçe kart yeniden çizilir.
  }, [user, store, t])

  useEffect(() => {
    void draw()
  }, [draw])

  // Blob URL'i sayfa kapanırken bırak (bellekte kalmasın).
  useEffect(() => () => setPreview((old) => (old ? (URL.revokeObjectURL(old), null) : null)), [])

  const pickPhoto = () => fileRef.current?.click()

  const savePhoto = async (file: File) => {
    setUploading(true)
    try {
      const media = await uploadImage(file)
      const updated = await updateMe({ avatarMediaId: media.id })
      setUser(updated)
      invalidateAvatarQueries(queryClient)
      toast.success(t('share.photoSaved'))
    } catch (error) {
      toast.error(apiErrorMessage(error, t('share.photoFailed')))
    } finally {
      setUploading(false)
      setCropFile(null)
    }
  }

  const download = () => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `waydee-${user?.username ?? 'kart'}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!user) return null
  // ⚠️ Veri gelmeden yönlendirme YAPILMAZ: mağazası olan kullanıcı ilk karede
  // `territories === undefined` görür ve haksız yere `/home`'a atılırdı.
  if (loadingTerritories) {
    return (
      <div className="grid min-h-full place-items-center bg-canvas">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }
  if (!store) return <Navigate to="/home" replace />

  const hasPhoto = Boolean(user.avatarUrl)

  return (
    <div className="min-h-full bg-canvas px-5 py-10">
      <div className="mx-auto flex min-w-0 max-w-[560px] flex-col items-center">
        <Logo imgClassName="h-8" />

        <span className="mt-7 inline-flex items-center gap-1.5 rounded-full border border-violet/30 bg-violet/10 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-violet">
          <Store className="h-3.5 w-3.5" /> {t('share.storeBadge')}
        </span>

        <h1 className="mt-3 text-center text-[28px] font-semibold leading-tight tracking-tight">
          {t('share.title')}
        </h1>
        <p className="mt-2 max-w-[400px] text-center text-sm font-medium text-muted">
          {t('share.subtitle')}
        </p>

        {/* --- fotoğraf önerisi: yalnız fotoğrafı olmayanlara --- */}
        {!hasPhoto && (
          <Card className="mt-6 w-full p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet/15">
                <Camera className="h-5 w-5 text-violet" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t('share.photoTitle')}</p>
                <p className="text-xs font-medium text-muted">{t('share.photoBody')}</p>
              </div>
              <Button size="sm" onClick={pickPhoto} disabled={uploading}>
                {uploading ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : t('share.photoAdd')}
              </Button>
            </div>
          </Card>
        )}

        {/* --- kart önizlemesi --- */}
        <div className="mt-6 w-full">
          <div className="relative overflow-hidden rounded-[28px] bg-surface shadow-[0_18px_60px_rgba(20,27,52,0.18)]">
            {preview ? (
              <img src={preview} alt={t('share.title')} className="block w-full" />
            ) : (
              <div className="aspect-square w-full" />
            )}
            {rendering && (
              <div className="absolute inset-0 grid place-items-center bg-surface/70 backdrop-blur-sm">
                <Spinner className="h-7 w-7" />
              </div>
            )}
          </div>
        </div>

        {hasPhoto && (
          <button
            type="button"
            onClick={pickPhoto}
            disabled={uploading}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-accent"
          >
            <Camera className="h-3.5 w-3.5" /> {t('share.photoChange')}
          </button>
        )}

        <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
          <Button size="lg" variant="stroke" onClick={download} disabled={!blob}>
            <Download className="h-4 w-4" /> {t('share.download')}
          </Button>
          <Button size="lg" onClick={() => navigate(`/map?t=${store.id}`)}>
            {t('share.goMap')}
          </Button>
        </div>

        {/* --- sosyal medyalar: kart hazır olunca YUMUŞAKÇA belirir --- */}
        <SocialShareRow
          ready={Boolean(blob) && !rendering}
          blob={blob}
          /* ⚠️ Paylaşılan adres MAĞAZAdır, profil değil: kart mağazayı duyuruyor
             ve bağlantıya tıklayan kişi onu haritada görmeli. */
          shareUrl={`${window.location.origin}/map?t=${store.id}`}
          text={t('share.shareText')}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) setCropFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {cropFile && (
        <CropDialog
          file={cropFile}
          aspect={1}
          title={t('share.photoTitle')}
          onCancel={() => setCropFile(null)}
          onDone={(file) => void savePhoto(file)}
        />
      )}
    </div>
  )
}
