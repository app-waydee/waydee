import { useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Music, Plus, Trash2, Tv, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import {
  MAX_AUDIO_BYTES,
  MAX_VIDEO_BYTES,
  addStoreProduct,
  clearStudioMusic,
  clearStudioVideo,
  getStudio,
  removeStoreProduct,
  updateStudioSettings,
  uploadAudio,
  uploadStudioImage,
  uploadVideo,
  type StudioSettingsInput,
} from '@/lib/storeStudio'
import { useSeo } from '@/lib/seo'
import { useT } from '@/i18n'

/**
 * <b>Mağaza stüdyosu</b> (`/market/:slug/my-store/:listingId`) — kabul edilen
 * stant sahibinin 3B dükkânını döşediği panel.
 *
 * <p>Dört bölüm: <b>tabela</b> (ad) · <b>televizyon</b> (kasa arkasındaki
 * ekranda oynayan video) · <b>müzik</b> · <b>ışık ve renkler</b> · ve
 * <b>raf</b> (ürünler).
 *
 * <p>⚠️ Sayfa yalnız <b>onaylı</b> stantlar için açılır; kapı sunucuda
 * (`StoreStudioService.requireOwned`). İstemci tarafındaki gizleme güvenlik
 * sayılmaz — vault kuralı.
 */
export function StoreStudioPage() {
  const t = useT()
  const { listingId = '' } = useParams()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const studioQuery = useQuery({
    queryKey: ['studio', listingId],
    queryFn: () => getStudio(listingId),
    enabled: !!listingId,
  })

  const studio = studioQuery.data
  useSeo(studio ? { title: `${studio.listingTitle} · ${t('studio.title')}`, noindex: true } : null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['studio', listingId] })

  /**
   * Ayar kaydetme.
   *
   * ⚠️ Her değişiklikte TEK alan gönderilir (`PATCH`). Formun tamamını
   * göndermek, iki sekmede açık bir stüdyoda birinin diğerinin değişikliğini
   * ezmesi demekti.
   */
  const saveSettings = useMutation({
    mutationFn: (input: StudioSettingsInput) => updateStudioSettings(listingId, input),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => toast.error(errorText(e, t('studio.saveFailed'))),
  })

  /**
   * Dosya yükleme.
   *
   * 🔴 Boyut İSTEMCİDE de kontrol edilir. Gerçek kapı sunucuda ama 60 MB'lık
   * bir videoyu tamamen yükleyip sonunda hata görmek kabul edilemez bir
   * bekleyiş; erken uyarı kullanıcıyı o bekleyişten kurtarır.
   */
  const pickMedia = (kind: 'video' | 'audio') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const max = kind === 'video' ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES
    if (file.size > max) {
      toast.error(t('studio.tooLarge').replace('{n}', String(Math.round(max / 1024 / 1024))))
      return
    }
    setBusy(kind)
    try {
      const media = kind === 'video' ? await uploadVideo(file) : await uploadAudio(file)
      await saveSettings.mutateAsync(
        kind === 'video'
          ? { videoMediaId: media.id, tvEnabled: true }
          : { musicMediaId: media.id, musicEnabled: true },
      )
      toast.success(kind === 'video' ? t('studio.videoUploaded') : t('studio.musicUploaded'))
    } catch (err) {
      /* 🔴 try/catch ŞART: yakalanmayan bir await'te istek 4xx dönünce
         ekranda hiçbir iz kalmaz ("hiçbir şey olmuyor" tuzağı). */
      toast.error(errorText(err, t('studio.uploadFailed')))
    } finally {
      setBusy(null)
    }
  }

  const clearMedia = async (kind: 'video' | 'audio') => {
    setBusy(kind)
    try {
      if (kind === 'video') await clearStudioVideo(listingId)
      else await clearStudioMusic(listingId)
      await invalidate()
    } catch (err) {
      toast.error(errorText(err, t('studio.removeFailed')))
    } finally {
      setBusy(null)
    }
  }

  if (studioQuery.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-faint" />
      </div>
    )
  }

  if (studioQuery.isError || !studio) {
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">{t('studio.notOpen')}</h1>
        <p className="mt-2 text-sm font-medium text-muted">
          {t('studio.notOpenHelp')}
        </p>
      </Card>
    )
  }

  const s = studio.settings
  const shelfFull = studio.products.length >= studio.shelfCapacity

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-4 md:px-0">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{t('studio.title')}</h1>
          <p className="text-[13px] font-medium text-muted">
            {studio.marketplaceName} · {studio.listingTitle}
          </p>
        </div>
        {studio.marketplaceSlug && (
          <Link to={`/market/${studio.marketplaceSlug}/3d`}>
            <Button variant="stroke">{t('studio.openStreet')}</Button>
          </Link>
        )}
      </header>

      {/* ---------------------------------------------------------- tabela */}
      <Card className="space-y-3 p-4 md:p-5">
        <SectionTitle>{t('studio.signboard')}</SectionTitle>
        <div>
          <label htmlFor="st-name" className="mb-1 block text-[13px] font-semibold">
            {t('studio.storeName')}
          </label>
          <Input
            id="st-name"
            defaultValue={s.displayName ?? studio.listingTitle}
            maxLength={90}
            /* ⚠️ `onBlur` — her tuşta istek atmak sunucuyu döverdi. */
            onBlur={(e) => {
              const next = e.target.value.trim()
              if (next !== (s.displayName ?? studio.listingTitle)) {
                saveSettings.mutate({ displayName: next || null })
              }
            }}
          />
          <p className="mt-1 text-xs font-medium text-faint">
            {t('studio.storeNameHelp')}
          </p>
        </div>

        {/*
          🔴 15 Ağu 2026 — LOGO BURADAN KALDIRILDI (kullanıcı isteği:
          "bu kısım mağaza stüdyosunda çalışıyor, düzenle kısmında çalışsın,
          mağaza stüdyosunda kaldır").

          Logo artık yalnız **başvuru/düzenle** ekranında değiştirilir ve
          admin onayından geçer. Bir turdur çalışmamasının sebebi stüdyo
          değildi: `updateMine` içinde `adjustListingCount` persistence
          context'i temizleyip nesneyi detach ediyordu, dolayısıyla logo
          hiç kaydedilmiyordu (gerekçe `ListingService.updateMine`).
        */}
      </Card>

      {/* ----------------------------------------------------- televizyon */}
      <Card className="space-y-3 p-4 md:p-5">
        <SectionTitle icon={<Tv className="h-4 w-4" />}>{t('studio.tv')}</SectionTitle>
        {s.videoUrl ? (
          <>
            {/*
              ⚠️ `muted` + `playsInline`: tarayıcılar sesli otomatik oynatmayı
              engeller ve önizleme sessizce hiç başlamazdı.
            */}
            <video
              src={s.videoUrl}
              className="aspect-video w-full rounded-xl bg-black"
              controls
              muted
              playsInline
            />
            <div className="flex flex-wrap gap-2">
              <Toggle
                checked={s.tvEnabled}
                onChange={(v) => saveSettings.mutate({ tvEnabled: v })}
                label={t('studio.tvOn')}
              />
              <Toggle
                checked={!s.tvMuted}
                onChange={(v) => saveSettings.mutate({ tvMuted: !v })}
                label={t('studio.tvSound')}
              />
              <Button variant="stroke" onClick={() => clearMedia('video')} disabled={busy === 'video'}>
                <Trash2 className="h-4 w-4" /> {t('studio.tvRemove')}
              </Button>
            </div>
            <p className="text-xs font-medium text-faint">
              {t('studio.tvHelp')}
            </p>
          </>
        ) : (
          <UploadSlot
            busy={busy === 'video'}
            accept="video/mp4,video/webm"
            onPick={pickMedia('video')}
            title={t('studio.tvUpload')}
            hint={`MP4 veya WebM · en fazla ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB`}
          />
        )}
      </Card>

      {/* ---------------------------------------------------------- müzik */}
      <Card className="space-y-3 p-4 md:p-5">
        <SectionTitle icon={<Music className="h-4 w-4" />}>{t('studio.music')}</SectionTitle>
        {s.musicUrl ? (
          <>
            <audio src={s.musicUrl} className="w-full" controls />
            <Toggle
              checked={s.musicEnabled}
              onChange={(v) => saveSettings.mutate({ musicEnabled: v })}
              label={t('studio.musicOn')}
            />
            <div>
              <label htmlFor="st-vol" className="mb-1 block text-[13px] font-semibold">
                {t('studio.volume')}: {s.musicVolume}%
              </label>
              <input
                id="st-vol"
                type="range"
                min={0}
                max={100}
                defaultValue={s.musicVolume}
                className="w-full"
                /* ⚠️ `onChange` DEĞİL `onMouseUp`/`onTouchEnd` gibi bitiş olayı:
                   sürüklerken her adımda istek atmak yüzlerce çağrı üretirdi. */
                onPointerUp={(e) =>
                  saveSettings.mutate({ musicVolume: Number((e.target as HTMLInputElement).value) })
                }
              />
            </div>
            <Button variant="stroke" onClick={() => clearMedia('audio')} disabled={busy === 'audio'}>
              <Trash2 className="h-4 w-4" /> {t('studio.musicRemove')}
            </Button>
          </>
        ) : (
          <UploadSlot
            busy={busy === 'audio'}
            accept="audio/mpeg,audio/ogg,audio/wav,audio/webm"
            onPick={pickMedia('audio')}
            title={t('studio.musicUpload')}
            hint={`MP3, OGG, WAV veya WebM · en fazla ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB`}
          />
        )}
      </Card>

      {/* --------------------------------------------------- ışık ve renk */}
      <Card className="space-y-4 p-4 md:p-5">
        <SectionTitle>{t('studio.lights')}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <ColorField
            label={t('studio.lightColor')}
            value={s.lightColor}
            onChange={(v) => saveSettings.mutate({ lightColor: v })}
          />
          <ColorField
            label={t('studio.accentColor')}
            value={s.accentColor}
            onChange={(v) => saveSettings.mutate({ accentColor: v })}
          />
          <ColorField
            label={t('studio.facadeColor')}
            value={s.facadeColor}
            onChange={(v) => saveSettings.mutate({ facadeColor: v })}
          />
        </div>
        <div>
          <label htmlFor="st-int" className="mb-1 block text-[13px] font-semibold">
            {t('studio.intensity')}: {s.lightIntensity}%
          </label>
          <input
            id="st-int"
            type="range"
            min={0}
            max={200}
            defaultValue={s.lightIntensity}
            className="w-full"
            onPointerUp={(e) =>
              saveSettings.mutate({ lightIntensity: Number((e.target as HTMLInputElement).value) })
            }
          />
        </div>
      </Card>

      {/* ----------------------------------------------------------- raf */}
      <ShelfSection
        studio={studio}
        shelfFull={shelfFull}
        listingId={listingId}
        onChanged={invalidate}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════ raf bölümü

function ShelfSection({
  studio,
  shelfFull,
  listingId,
  onChanged,
}: {
  studio: NonNullable<ReturnType<typeof useQuery<Awaited<ReturnType<typeof getStudio>>>>['data']>
  shelfFull: boolean
  listingId: string
  onChanged: () => void
}) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customImage, setCustomImage] = useState<{ id: string; preview: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (fn: () => Promise<unknown>, okMessage?: string) => {
    try {
      await fn()
      onChanged()
      if (okMessage) toast.success(okMessage)
    } catch (err) {
      toast.error(errorText(err, t('studio.actionFailed')))
    }
  }

  /**
   * 🔴 Fiyat virgülle yazılabilir. `Number("199,90")` → NaN → sunucuya `null`
   * gider ve fiyat sessizce kaybolur. Vault'ta bu hata bir kez yaşandı.
   */
  const parsePrice = (raw: string): number | null => {
    const v = raw.trim().replace(',', '.')
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return (
    <Card className="space-y-4 p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>
          {t('studio.shelf')} ({studio.products.length}/{studio.shelfCapacity})
        </SectionTitle>
        {!shelfFull && (
          <Button variant="stroke" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4" /> {t('studio.addProduct')}
          </Button>
        )}
      </div>

      {shelfFull && (
        <p className="rounded-xl bg-subtle px-3 py-2 text-[13px] font-medium text-muted">
          {t('studio.shelfFull')}
        </p>
      )}

      {/* ---- mevcut ürünler ---- */}
      {studio.products.length === 0 ? (
        <p className="text-sm font-medium text-muted">
          {t('studio.shelfEmpty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {studio.products.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border-2 border-line p-2">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-subtle">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-semibold text-faint">{t('studio.noImage')}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.title}</span>
                <span className="block truncate text-[12px] font-medium text-faint">
                  {p.source === 'POST' ? t('studio.fromProfile') : t('studio.customProduct')}
                  {p.price != null && ` · ${p.price} ${p.currency ?? ''}`}
                </span>
              </span>
              <button
                type="button"
                aria-label={t('studio.remove')}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:text-danger"
                onClick={() => run(() => removeStoreProduct(listingId, p.id))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---- ekleme ---- */}
      {adding && !shelfFull && (
        <div className="space-y-4 rounded-xl bg-subtle p-3">
          {/*
            🔴 İKİ KAYNAK BİR ARADA (kullanıcı isteği): profildeki gönderiler
            tek tıkla rafa eklenir, ayrıca yalnız mağazaya özel ürün açılabilir.
          */}
          <div>
            <p className="mb-2 text-[13px] font-semibold">{t('studio.fromProfile')}</p>
            {studio.candidates.length === 0 ? (
              <p className="text-[13px] font-medium text-muted">
                {t('studio.noCandidates')}
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {studio.candidates.map((c) => (
                  <button
                    key={c.postId}
                    type="button"
                    title={c.caption ?? 'Rafa ekle'}
                    className="aspect-square overflow-hidden rounded-lg border-2 border-line transition-opacity hover:opacity-70"
                    onClick={() =>
                      run(
                        () =>
                          addStoreProduct(listingId, {
                            source: 'POST',
                            postId: c.postId,
                            title: (c.caption ?? t('studio.productName')).slice(0, 140),
                          }),
                        t('studio.added'),
                      )
                    }
                  >
                    <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t-2 border-line pt-3">
            <p className="mb-2 text-[13px] font-semibold">{t('studio.customProduct')}</p>
            <div className="space-y-2">
              <Input
                placeholder={t('studio.productName')}
                maxLength={140}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  placeholder={t('studio.productPrice')}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
                <Input
                  placeholder={t('studio.productUrl')}
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    try {
                      const m = await uploadStudioImage(f)
                      setCustomImage({ id: m.id, preview: URL.createObjectURL(f) })
                    } catch (err) {
                      toast.error(errorText(err, t('studio.imageFailed')))
                    }
                  }}
                />
                <Button variant="stroke" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> {t('studio.productImage')}
                </Button>
                {customImage && (
                  <span className="flex items-center gap-1">
                    <img src={customImage.preview} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    <button
                      type="button"
                      aria-label="Görseli kaldır"
                      onClick={() => setCustomImage(null)}
                      className="text-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
              <Button
                disabled={customTitle.trim().length < 2}
                onClick={() =>
                  run(async () => {
                    await addStoreProduct(listingId, {
                      source: 'CUSTOM',
                      title: customTitle.trim(),
                      price: parsePrice(customPrice),
                      currency: customPrice.trim() ? 'TRY' : null,
                      productUrl: customUrl.trim() || null,
                      imageMediaId: customImage?.id ?? null,
                    })
                    setCustomTitle('')
                    setCustomPrice('')
                    setCustomUrl('')
                    setCustomImage(null)
                  }, t('studio.productAdded'))
                }
              >
                {t('studio.addToShelf')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════ küçük parçalar

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[15px] font-semibold">
      {icon}
      {children}
    </h2>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const id = useMemo(() => `c-${label.replace(/\s/g, '')}`, [label])
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="color"
        defaultValue={value}
        /* ⚠️ Renk seçicide `onChange` sürüklerken sürekli ateşlenir; `onBlur`
           tek istek atar. */
        onBlur={(e) => e.target.value !== value && onChange(e.target.value)}
        className="h-11 w-full cursor-pointer rounded-xl border-2 border-line bg-surface px-1"
      />
    </div>
  )
}

function UploadSlot({
  busy,
  accept,
  onPick,
  title,
  hint,
}: {
  busy: boolean
  accept: string
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void
  title: string
  hint: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-xl border-2 border-dashed border-line p-5 text-center">
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={onPick} />
      <Button variant="stroke" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {title}
      </Button>
      <p className="mt-2 text-xs font-medium text-faint">{hint}</p>
    </div>
  )
}

/** Sunucunun anlamlı hata mesajını göster; yoksa yedek metin. */
function errorText(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || fallback
}
