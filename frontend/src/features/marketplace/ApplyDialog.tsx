import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Info, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { CropDialog } from '@/components/media/CropDialog'
import { apiErrorMessage } from '@/lib/api'
import { uploadImage } from '@/lib/media'
import {
  applyToMarketplace,
  getMarketplaceForm,
  marketplaceOptions,
  updateListing,
  type FormFieldCode,
  type ListingInput,
  type ListingResponse,
  type MarketplaceResponse,
  type ResolvedField,
} from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

interface ApplyDialogProps {
  marketplace: MarketplaceResponse
  /** Doluysa düzenleme modu. */
  existing?: ListingResponse | null
  onClose: () => void
}

/* DESC_MIN/DESC_MAX kaldırıldı: açıklama alanı formdan çıktı (15 Ağu 2026). */
const MAX_GALLERY = 8

/* 🔴 16 Ağu 2026 — etiketler sözlüğe taşındı, burada yalnız KOD kalır.
   Vault kuralı: çeviri istemcide, kod alanına göre yapılır; sabit etiket
   listesi beş dilin dördünde Türkçe görünüyordu. */
const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'USED', 'FOR_PARTS'] as const

/**
 * Stant başvuru formu — <b>sunucudan gelen şemadan üretilir</b>.
 *
 * <p>Eskiden form sabitti ve her pazara startup soruları (kuruluş yılı, ekip
 * büyüklüğü, aşama) çıkıyordu; bir yürüyüş etkinliğinde bunlar anlamsız,
 * gereken alanlar (tarih, buluşma noktası, kontenjan) ise hiç yoktu.
 * Artık pazar türü + adminin ayarı hangi alanların çıkacağını belirler ve
 * adminin yazdığı serbest sorular da forma eklenir.
 *
 * <p>⚠️ Zorunluluk kontrolü burada YALNIZCA kullanıcıya yardım içindir; asıl
 * doğrulama sunucudadır (istek doğrudan da atılabilir).
 *
 * <p>Görseller `CropDialog` üzerinden <b>data URL</b> ile alınır —
 * `createObjectURL` StrictMode'da ölü URL üretiyordu (vault tuzağı).
 */
export function ApplyDialog({ marketplace, existing, onClose }: ApplyDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()

  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ['marketplace-form', marketplace.id],
    queryFn: () => getMarketplaceForm(marketplace.id),
  })
  const { data: options } = useQuery({
    queryKey: ['marketplace-options'],
    queryFn: marketplaceOptions,
    staleTime: 60 * 60_000,
  })

  const [values, setValues] = useState<ListingInput>({
    title: existing?.title ?? '',
    tagline: existing?.tagline ?? '',
    description: existing?.description ?? '',
    category: existing?.category ?? 'OTHER',
    stage: existing?.stage ?? '',
    website: existing?.website ?? '',
    contactEmail: existing?.contactEmail ?? '',
    contactPhone: existing?.contactPhone ?? '',
    foundedYear: existing?.foundedYear ?? null,
    teamSize: existing?.teamSize ?? null,
    lookingFor: existing?.lookingFor ?? '',
    startsAt: existing?.startsAt ?? '',
    endsAt: existing?.endsAt ?? '',
    locationLabel: existing?.locationLabel ?? '',
    capacity: existing?.capacity ?? null,
    price: existing?.price ?? null,
    currency: existing?.currency ?? 'TRY',
    conditionCode: existing?.conditionCode ?? '',
  })
  const [answers, setAnswers] = useState<Record<string, string>>(existing?.customFields ?? {})
  const [logo, setLogo] = useState<{ id: string | null; preview: string | null }>({
    id: null,
    preview: existing?.logoUrl ?? null,
  })
  const [cover, setCover] = useState<{ id: string | null; preview: string | null }>({
    id: null,
    preview: existing?.coverUrl ?? null,
  })
  const [gallery, setGallery] = useState<{ id: string; preview: string }[]>([])
  const [cropping, setCropping] = useState<{ file: File; kind: 'logo' | 'cover' | 'gallery' } | null>(null)
  const [uploading, setUploading] = useState(false)

  /** Alan açık mı — kapalıysa hiç çizilmez. */
  const enabled = useMemo(() => {
    const map = new Map<FormFieldCode, ResolvedField>()
    form?.fields.forEach((f) => map.set(f.field, f))
    return map
  }, [form])

  const on = (code: FormFieldCode) => enabled.get(code)?.enabled ?? false
  const req = (code: FormFieldCode) => enabled.get(code)?.required ?? false
  const label = (code: FormFieldCode, fallback: string) => enabled.get(code)?.label || fallback
  const help = (code: FormFieldCode) => enabled.get(code)?.help

  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const save = useMutation({
    mutationFn: () => {
      // Kapalı alanlar hiç gönderilmez — sunucu zaten temizler ama gereksiz veri taşımayalım.
      const payload: ListingInput = {
        /*
         * ⚠️ `title` / `description` / `category` GÖNDERİLMİYOR.
         * Sunucu adı kullanıcının görünen adından türetiyor, kategoriyi
         * OTHER'a düşürüyor. Mevcut bir başvuru düzenleniyorsa sunucu
         * eski değerleri KORUYOR (alan gelmediğinde üzerine yazmıyor) —
         * yoksa stüdyodan verilen ad her düzenlemede silinirdi.
         */
        tagline: values.tagline || null,
        stage: on('STAGE') ? values.stage || null : null,
        website: on('WEBSITE') ? values.website || null : null,
        contactEmail: on('CONTACT_EMAIL') ? values.contactEmail || null : null,
        contactPhone: on('CONTACT_PHONE') ? values.contactPhone || null : null,
        foundedYear: on('FOUNDED_YEAR') ? values.foundedYear : null,
        teamSize: on('TEAM_SIZE') ? values.teamSize : null,
        lookingFor: on('LOOKING_FOR') ? values.lookingFor || null : null,
        startsAt: on('STARTS_AT') ? toInstant(values.startsAt) : null,
        endsAt: on('ENDS_AT') ? toInstant(values.endsAt) : null,
        locationLabel: on('LOCATION') ? values.locationLabel || null : null,
        capacity: on('CAPACITY') ? values.capacity : null,
        price: on('PRICE') ? values.price : null,
        currency: on('PRICE') ? values.currency || 'TRY' : null,
        conditionCode: on('CONDITION') ? values.conditionCode || null : null,
        logoMediaId: on('LOGO') ? logo.id : null,
        coverMediaId: on('COVER') ? cover.id : null,
        galleryMediaIds: on('GALLERY') ? gallery.map((g) => g.id) : null,
        customFields: answers,
      }
      return existing ? updateListing(existing.id, payload) : applyToMarketplace(marketplace.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplaces'] })
      queryClient.invalidateQueries({ queryKey: ['marketplace'] })
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success(existing ? t('apply.updated') : t('apply.sent'))
      onClose()
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  const pick = (kind: 'logo' | 'cover' | 'gallery') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setCropping({ file, kind })
  }

  const onCropped = async (file: File, preview: string) => {
    const kind = cropping?.kind
    setCropping(null)
    if (!kind) return
    setUploading(true)
    try {
      const media = await uploadImage(file)
      if (kind === 'logo') setLogo({ id: media.id, preview })
      else if (kind === 'cover') setCover({ id: media.id, preview })
      else setGallery((g) => [...g, { id: media.id, preview }].slice(0, MAX_GALLERY))
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  /*
   * 🔴 Doğrulama da dört alana indi: zorunlu olan tek şey TANITIM.
   * Başlık ve açıklama kontrolleri kaldırıldı — form onları artık sormuyor
   * ve sunucu da istemiyor. Bırakılsalardı düğme hiçbir zaman etkinleşmezdi.
   */
  const missing: string[] = []
  if ((values.tagline ?? '').trim().length < 2) missing.push(t('apply.tagline'))
  if (req('STARTS_AT') && !values.startsAt) missing.push(label('STARTS_AT', t('apply.startsAt')))
  if (req('LOCATION') && !values.locationLabel) missing.push(label('LOCATION', t('apply.location')))
  if (req('CAPACITY') && !values.capacity) missing.push(label('CAPACITY', t('apply.capacity')))
  if (req('PRICE') && values.price == null) missing.push(label('PRICE', t('apply.price')))
  if (req('CONDITION') && !values.conditionCode) missing.push(label('CONDITION', t('apply.condition')))
  form?.questions.forEach((q) => {
    if (q.required && !(answers[q.key] ?? '').trim()) missing.push(q.label)
  })
  const valid = missing.length === 0

  return (
    <>
      <Dialog open onClose={onClose} title={existing ? t('apply.editTitle') : t('apply.newTitle')}>
        {formLoading ? (
          <div className="grid place-items-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-faint" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-subtle px-3.5 py-3">
              <p className="text-[13px] font-medium text-muted">
                <span className="font-semibold text-ink">{marketplace.name}</span>
                {form && <span className="text-faint"> · {form.kindLabel}</span>}
              </p>
              <p className="mt-1 text-[12.5px] text-faint">
                {marketplace.autoApprove
                  ? t('apply.autoApprove')
                  : t('apply.needsReview')}
              </p>
            </div>

            {form?.applicationNote && (
              <p className="flex items-start gap-2 rounded-2xl bg-sky-soft px-3.5 py-3 text-[12.5px] leading-snug text-[#0f78bd]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> {form.applicationNote}
              </p>
            )}

            {/* ---- görseller (yalnız açık olanlar) ---- */}
            {(on('LOGO') || on('COVER')) && (
              <div className="flex gap-3">
                {on('LOGO') && (
                  <div className="shrink-0">
                    <Label>{label('LOGO', t('apply.logo'))}</Label>
                    <label className="mt-1.5 grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-2xl bg-subtle text-muted transition-colors hover:text-ink">
                      {logo.preview ? (
                        <img src={logo.preview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus className="h-5 w-5" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={pick('logo')} />
                    </label>
                  </div>
                )}
                {on('COVER') && (
                  <div className="min-w-0 flex-1">
                    <Label>{label('COVER', t('apply.cover'))}</Label>
                    <label className="mt-1.5 grid h-20 w-full cursor-pointer place-items-center overflow-hidden rounded-2xl bg-subtle text-muted transition-colors hover:text-ink">
                      {cover.preview ? (
                        <img src={cover.preview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex items-center gap-2 text-[13px] font-semibold">
                          <ImagePlus className="h-4 w-4" /> {t('apply.addCover')}
                        </span>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={pick('cover')} />
                    </label>
                  </div>
                )}
              </div>
            )}

            {on('GALLERY') && (
              <div>
                <Label>{label('GALLERY', t('apply.gallery'))}</Label>
                <Hint text={help('GALLERY')} />
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {gallery.map((g, i) => (
                    <span key={g.id} className="relative h-16 w-16 overflow-hidden rounded-xl">
                      <img src={g.preview} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setGallery((list) => list.filter((_, idx) => idx !== i))}
                        className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/80 text-on-ink"
                        aria-label={t('apply.remove')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {gallery.length < MAX_GALLERY && (
                    <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-xl bg-subtle text-muted transition-colors hover:text-ink">
                      <ImagePlus className="h-4 w-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={pick('gallery')} />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/*
              🔴 15 Ağu 2026 — BAŞVURU DÖRT ALANA İNDİ.

              Kullanıcı isteği: "alt kısımdaki formu da sadece tek cümlelik
              tanıtım, logo, website, telefon no olacak şekilde alacağız."

              Kaldırılanlar: Başlık · Açıklama (30-3000 karakter) · Kategori.

              ⚠️ MAĞAZA ADI ARTIK SORULMUYOR ama kaybolmuyor: sunucu onu
              kullanıcının görünen adından türetiyor (3B tabelanın ve liste
              kartının tek kaynağı, boş kalamaz) ve sahibi kabul edildikten
              sonra **stüdyodan** değiştiriyor. Böylece başvuru engeli en aza
              iniyor, isimlendirme ise dükkânı olan kişiye kalıyor.

              ⚠️ `on('TAGLINE')` koşulu KALDIRILDI: tanıtım artık her pazarda
              zorunlu (sunucuda da `@NotBlank`). Koşullu bırakmak, alanın
              gizlendiği bir pazarda formun hiçbir zaman gönderilememesi
              demekti — sunucu onu isterken arayüz sormuyor olurdu.
            */}
            <Field label={t('apply.tagline')} required help={t('apply.taglineHelp')}>
              <Input
                value={values.tagline ?? ''}
                maxLength={140}
                placeholder={t('apply.taglinePlaceholder')}
                onChange={(e) => set('tagline', e.target.value)}
              />
              <p className="mt-1 text-xs font-medium text-faint">
                {(values.tagline ?? '').length}/140
              </p>
            </Field>

            {/* ---- tarih / konum / kontenjan ---- */}
            {(on('STARTS_AT') || on('ENDS_AT')) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {on('STARTS_AT') && (
                  <Field label={label('STARTS_AT', t('apply.startsAt'))} required={req('STARTS_AT')} help={help('STARTS_AT')}>
                    <Input
                      type="datetime-local"
                      value={toLocal(values.startsAt)}
                      onChange={(e) => set('startsAt', e.target.value)}
                    />
                  </Field>
                )}
                {on('ENDS_AT') && (
                  <Field label={label('ENDS_AT', t('apply.endsAt'))} required={req('ENDS_AT')} help={help('ENDS_AT')}>
                    <Input
                      type="datetime-local"
                      value={toLocal(values.endsAt)}
                      onChange={(e) => set('endsAt', e.target.value)}
                    />
                  </Field>
                )}
              </div>
            )}

            {on('LOCATION') && (
              <Field label={label('LOCATION', t('apply.location'))} required={req('LOCATION')} help={help('LOCATION')}>
                <Input
                  value={values.locationLabel ?? ''}
                  maxLength={200}
                  onChange={(e) => set('locationLabel', e.target.value)}
                />
              </Field>
            )}

            {(on('CAPACITY') || on('PRICE')) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {on('CAPACITY') && (
                  <Field label={label('CAPACITY', t('apply.capacity'))} required={req('CAPACITY')} help={help('CAPACITY')}>
                    <Input
                      type="number"
                      min={1}
                      value={values.capacity ?? ''}
                      onChange={(e) => set('capacity', e.target.value ? Number(e.target.value) : null)}
                    />
                  </Field>
                )}
                {on('PRICE') && (
                  <Field label={label('PRICE', t('apply.price'))} required={req('PRICE')} help={help('PRICE')}>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        className="min-w-0 flex-1"
                        value={values.price ?? ''}
                        onChange={(e) => set('price', e.target.value ? Number(e.target.value) : null)}
                      />
                      <Select
                        value={values.currency ?? 'TRY'}
                        onChange={(v) => set('currency', v)}
                        className="w-24 shrink-0"
                      >
                        <option value="TRY">₺ TRY</option>
                        <option value="USD">$ USD</option>
                        <option value="EUR">€ EUR</option>
                      </Select>
                    </div>
                  </Field>
                )}
              </div>
            )}

            {on('CONDITION') && (
              <Field label={label('CONDITION', t('apply.condition'))} required={req('CONDITION')} help={help('CONDITION')}>
                <Select value={values.conditionCode ?? ''} onChange={(v) => set('conditionCode', v)}>
                  <option value="">{t('apply.select')}</option>
                  {CONDITIONS.map((code) => (
                    <option key={code} value={code}>
                      {t(`apply.cond${code}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {/* ---- girişim alanları ---- */}
            {on('STAGE') && (
              <Field label={label('STAGE', t('apply.stage'))} required={req('STAGE')} help={help('STAGE')}>
                <Select value={values.stage ?? ''} onChange={(v) => set('stage', v)}>
                  <option value="">{t('apply.unspecified')}</option>
                  {(options?.stages ?? []).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {(on('FOUNDED_YEAR') || on('TEAM_SIZE')) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {on('FOUNDED_YEAR') && (
                  <Field label={label('FOUNDED_YEAR', t('apply.foundedYear'))} required={req('FOUNDED_YEAR')}>
                    <Input
                      type="number"
                      value={values.foundedYear ?? ''}
                      onChange={(e) => set('foundedYear', e.target.value ? Number(e.target.value) : null)}
                    />
                  </Field>
                )}
                {on('TEAM_SIZE') && (
                  <Field label={label('TEAM_SIZE', t('apply.teamSize'))} required={req('TEAM_SIZE')}>
                    <Input
                      type="number"
                      value={values.teamSize ?? ''}
                      onChange={(e) => set('teamSize', e.target.value ? Number(e.target.value) : null)}
                    />
                  </Field>
                )}
              </div>
            )}

            {on('LOOKING_FOR') && (
              <Field label={label('LOOKING_FOR', t('apply.lookingFor'))} required={req('LOOKING_FOR')}>
                <Input
                  value={values.lookingFor ?? ''}
                  maxLength={300}
                  onChange={(e) => set('lookingFor', e.target.value)}
                />
              </Field>
            )}

            {/* ---- iletişim ---- */}
            {(on('WEBSITE') || on('CONTACT_EMAIL') || on('CONTACT_PHONE')) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {on('WEBSITE') && (
                  <Field label={label('WEBSITE', t('apply.website'))} required={req('WEBSITE')}>
                    <Input
                      value={values.website ?? ''}
                      placeholder="ornek.com"
                      onChange={(e) => set('website', e.target.value)}
                    />
                  </Field>
                )}
                {on('CONTACT_EMAIL') && (
                  <Field label={label('CONTACT_EMAIL', t('apply.contactEmail'))} required={req('CONTACT_EMAIL')}>
                    <Input
                      type="email"
                      value={values.contactEmail ?? ''}
                      onChange={(e) => set('contactEmail', e.target.value)}
                    />
                  </Field>
                )}
                {on('CONTACT_PHONE') && (
                  <Field label={label('CONTACT_PHONE', t('apply.contactPhone'))} required={req('CONTACT_PHONE')}>
                    <Input
                      value={values.contactPhone ?? ''}
                      onChange={(e) => set('contactPhone', e.target.value)}
                    />
                  </Field>
                )}
              </div>
            )}

            {/* ---- adminin ek soruları ---- */}
            {!!form?.questions.length && (
              <div className="space-y-4 rounded-2xl bg-subtle p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">
                  {t('apply.extraQuestions', { name: marketplace.name })}
                </p>
                {form.questions.map((q) => (
                  <Field key={q.key} label={q.label} required={q.required} help={q.help}>
                    {q.type === 'TEXTAREA' ? (
                      <Textarea
                        rows={3}
                        maxLength={q.maxLength ?? 1000}
                        value={answers[q.key] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                      />
                    ) : q.type === 'SELECT' ? (
                      <Select
                        value={answers[q.key] ?? ''}
                        onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))}
                      >
                        <option value="">{t('apply.select')}</option>
                        {(q.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    ) : q.type === 'CHECKBOX' ? (
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={answers[q.key] === 'evet'}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [q.key]: e.target.checked ? 'evet' : '' }))
                          }
                        />
                        <span className="text-[13px] font-medium">{t('apply.yes')}</span>
                      </label>
                    ) : (
                      <Input
                        type={q.type === 'NUMBER' ? 'number' : q.type === 'DATE' ? 'date' : 'text'}
                        maxLength={q.maxLength ?? undefined}
                        value={answers[q.key] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                      />
                    )}
                  </Field>
                ))}
              </div>
            )}

            {/* eksikler — kullanıcı neyin kaldığını görsün */}
            {!valid && (
              <p className="rounded-2xl bg-sand-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-[#b57200]">
                {t('apply.missing', { fields: missing.join(', ') })}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="stroke" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button disabled={!valid || save.isPending || uploading} onClick={() => save.mutate()}>
                {save.isPending || uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : existing ? (
                  t('apply.update')
                ) : (
                  t('apply.submit')
                )}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {cropping && (
        <CropDialog
          file={cropping.file}
          aspect={cropping.kind === 'logo' ? 1 : cropping.kind === 'cover' ? 16 / 9 : 4 / 3}
          title={
            cropping.kind === 'logo'
              ? t('apply.cropLogo')
              : cropping.kind === 'cover'
                ? t('apply.cropCover')
                : t('apply.cropImage')
          }
          onDone={onCropped}
          onCancel={() => setCropping(null)}
        />
      )}
    </>
  )
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string
  required?: boolean
  help?: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      <Hint text={help} />
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Hint({ text }: { text?: string | null }) {
  if (!text) return null
  return <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{text}</p>
}

function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-11 w-full rounded-xl border-2 border-line bg-surface px-3 text-sm font-medium outline-none focus:border-faint/50',
        className,
      )}
    >
      {children}
    </select>
  )
}

/** `datetime-local` girdisi yerel saat verir; sunucuya ISO gider. */
function toInstant(local?: string | null): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** ISO → `datetime-local` girdisinin beklediği biçim. */
function toLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
