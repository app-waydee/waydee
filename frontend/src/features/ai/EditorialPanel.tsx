import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Palette, Sparkles, User } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import {
  createEditorial,
  listGenerations,
  quoteAi,
  type AiGeneration,
  type AiOptions,
} from '@/lib/aiStudio'
import { useT } from '@/i18n'
import {
  GenerateBox,
  RecentStrip,
  Segmented,
  UploadSlot,
  useGenerationPolls,
  useSettleEffects,
  useSingleUpload,
  type UploadedImage,
} from './aiShared'

/**
 * <b>Editoryal / Değişim</b> (99. tur).
 *
 * <p>Özne (model ya da ürün) + stil referansı → referansın sahnesinde tek bir
 * editoryal kare.
 *
 * <h3>🔴 "Editoryal mi, değişim mi" SORULMAZ</h3>
 * <p>Referans üründe bu bir moddur; burada değil. Fark, birinci görselde bir
 * insan olup olmamasıdır — yani modelin <b>gördüğü</b> bir şey, kullanıcının
 * bildiği bir şey değil. Sorsaydık yanlış cevap sessizce kötü bir çıktı
 * üretirdi ve kullanıcı sebebini asla anlayamazdı.
 *
 * <h3>⚠️ En-boy oranı SUNUCUNUN listesinden</h3>
 * <p>Kodlar {@code GET /ai/options → scene.aspectRatio} ile gelir. İstemciye
 * yazılsaydı sağlayıcının kabul etmediği bir oran seçilebilir ve hata
 * kullanıcıya "üretim başarısız" olarak dönerdi.
 *
 * <h3>⚠️ Seçenekler gelmeden kontrol ÇİZİLMEZ</h3>
 * <p>90. turun dersi: verisi olmayan bir açılır kutu, etiketi olan ama değeri
 * olmayan bir kutuya dönüşüyordu. Oran ızgarası da veri gelene kadar doğmaz.
 */
export function EditorialPanel({
  options,
  locale,
  aiEnabled,
  balance,
}: {
  options: AiOptions | undefined
  locale: string
  aiEnabled: boolean
  balance: number
}) {
  const t = useT()
  const qc = useQueryClient()

  const [subject, setSubject] = useState<UploadedImage | null>(null)
  const [style, setStyle] = useState<UploadedImage | null>(null)
  const [aspectRatio, setAspectRatio] = useState('3:4')
  const [highQuality, setHighQuality] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  const subjectUpload = useSingleUpload()
  const styleUpload = useSingleUpload()

  const ratios = options?.scene?.aspectRatio ?? []

  const quoteQuery = useQuery({
    queryKey: ['ai-quote', 'EDITORIAL', highQuality],
    queryFn: () => quoteAi('EDITORIAL', highQuality, 1),
  })
  const galleryQuery = useQuery({ queryKey: ['ai-generations'], queryFn: () => listGenerations(24) })

  const polled = useGenerationPolls(activeId ? [activeId] : [])
  useSettleEffects(polled)
  const active = polled[0]

  const generate = useMutation({
    mutationFn: () =>
      createEditorial({
        subjectMediaId: subject!.id,
        styleMediaId: style!.id,
        aspectRatio,
        highQuality,
      }),
    onSuccess: (g: AiGeneration) => {
      setActiveId(g.id)
      void qc.invalidateQueries({ queryKey: ['credits'] })
      void qc.invalidateQueries({ queryKey: ['ai-generations'] })
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('ai.failed'))),
  })

  const cost = quoteQuery.data?.cost ?? 0
  const running = active?.status === 'QUEUED' || active?.status === 'RUNNING'
  const busy = generate.isPending || running
  const canGenerate =
    !!subject && !!style && !!options && !busy && balance >= cost && aiEnabled
    && !subjectUpload.uploading && !styleUpload.uploading

  const done = useMemo(
    () => (galleryQuery.data ?? []).filter((g) => g.status === 'SUCCEEDED'),
    [galleryQuery.data],
  )

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* ============================================== SOL: ayarlar */}
      <div className="waydee-ai-panel">
        <UploadSlot
          label={t('ai.edSubject')}
          icon={<User className="h-3 w-3 shrink-0" />}
          value={subject}
          sample="/ai-samples/editorial-subject.webp"
          sampleAlt={t('ai.edSubject')}
          cta={t('ai.edSubjectCta')}
          hint={t('ai.edSubjectHint')}
          uploading={subjectUpload.uploading}
          onPick={(file) => void subjectUpload.pick(file).then((v) => v && setSubject(v))}
          onClear={() => setSubject(null)}
        />

        <UploadSlot
          label={t('ai.edStyle')}
          icon={<Palette className="h-3 w-3 shrink-0" />}
          value={style}
          sample="/ai-samples/editorial-style.webp"
          sampleAlt={t('ai.edStyle')}
          cta={t('ai.edStyleCta')}
          hint={t('ai.edStyleHint')}
          uploading={styleUpload.uploading}
          onPick={(file) => void styleUpload.pick(file).then((v) => v && setStyle(v))}
          onClear={() => setStyle(null)}
        />

        {/* --- kalite --- */}
        <section className="waydee-ai-section">
          <span className="waydee-ai-label">{t('ai.quality')}</span>
          <Segmented
            label={t('ai.quality')}
            value={highQuality ? 'HIGH' : 'STD'}
            onChange={(v) => setHighQuality(v === 'HIGH')}
            options={[
              { value: 'HIGH', label: t('ai.quality2k') },
              { value: 'STD', label: t('ai.quality1k') },
            ]}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-faint">{t('ai.qualityHint')}</p>
        </section>

        {/* --- en-boy oranı --- */}
        <section className="waydee-ai-section">
          <span className="waydee-ai-label">{t('ai.aspect')}</span>
          {ratios.length === 0 ? (
            <div className="waydee-ai-skel waydee-ai-skel-seg" aria-hidden />
          ) : (
            <div className="waydee-ai-ratios">
              {ratios.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={aspectRatio === r}
                  onClick={() => setAspectRatio(r)}
                  className="waydee-ai-ratio"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-faint">{t('ai.aspectHint')}</p>
        </section>

        <GenerateBox
          cost={cost}
          balance={balance}
          locale={locale}
          disabled={!canGenerate}
          busy={busy}
          onClick={() => generate.mutate()}
          notEnough={balance < cost && aiEnabled}
        />
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
              <p className="text-[13px] font-semibold text-danger">
                {active.errorMessage ?? t('ai.failed')}
              </p>
              <p className="mt-1 text-[12px] text-faint">{t('ai.refunded')}</p>
            </div>
          ) : (
            /* ⚠️ Boş durumda ÖRNEK sonuç: "buradan ne çıkacak" sorusunun tek
               dürüst yanıtı bir örnektir. Rozet şart — rozetsiz görsel
               "üretildi" diye okunurdu. */
            <div className="waydee-ai-sample waydee-ai-sample-stage">
              <img src="/ai-samples/editorial-result.webp" alt={t('ai.result')} loading="lazy" />
              <span className="waydee-ai-sample-badge">{t('ai.sample')}</span>
            </div>
          )}
        </div>

        {!active && (
          <p className="mt-3 text-center text-[12px] leading-relaxed text-faint">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-violet" />
            {t('ai.edEmptyDesc')}
          </p>
        )}

        <RecentStrip
          items={done}
          activeId={activeId}
          onPick={(g) => setActiveId(g.id)}
          hint={t('ai.reuseHint')}
        />
      </div>
    </div>
  )
}
