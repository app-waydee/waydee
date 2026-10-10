import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import {
  createPose,
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
 * <b>Poz</b> (99. tur).
 *
 * <p>Var olan bir sahneden aynı model ve kıyafetle yeni açı/poz varyasyonları.
 *
 * <h3>🔴 "3 görsel" ÜÇ AYRI ÜRETİMDİR</h3>
 * <p>Sunucu her görsel için ayrı bir satır açar; bu ekran da onları <b>ayrı
 * ayrı</b> yoklar ve her birinin durumunu kendi karesinde gösterir. Tek bir
 * "üretiliyor" durumu gösterilseydi, ikisi bitip biri başarısız olduğunda
 * kullanıcı ne aldığını ve ne iade edildiğini göremezdi.
 *
 * <h3>⚠️ Kalite anahtarı YOK</h3>
 * <p>Araç var olan bir sahneyi yeniden çerçeveliyor; çözünürlüğü kaynak
 * belirliyor. Bir "2K" düğmesi koymak, karşılığı olmayan bir kredi farkı
 * almak olurdu.
 */
export function PosePanel({
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

  const [scene, setScene] = useState<UploadedImage | null>(null)
  const [creativity, setCreativity] = useState('STANDARD')
  const [count, setCount] = useState(3)
  /** Bu turda başlatılan üretimler — sırası korunur, kareler ona göre çizilir. */
  const [batch, setBatch] = useState<string[]>([])

  const upload = useSingleUpload()
  const maxImages = options?.maxPoseImages ?? 3

  const quoteQuery = useQuery({
    queryKey: ['ai-quote', 'POSE', count],
    queryFn: () => quoteAi('POSE', false, count),
  })
  const galleryQuery = useQuery({ queryKey: ['ai-generations'], queryFn: () => listGenerations(24) })

  const polled = useGenerationPolls(batch)
  useSettleEffects(polled)

  /* ⚠️ Sıra `batch`ten okunur, yoklama sonucundan değil: sorgular farklı
     zamanlarda tamamlanıyor ve kareler her tazelemede yer değiştirirdi. */
  const results = useMemo(
    () => batch.map((id) => polled.find((g) => g.id === id)),
    [batch, polled],
  )

  const generate = useMutation({
    mutationFn: () =>
      createPose({ sceneMediaId: scene!.id, creativity, imageCount: count }),
    onSuccess: (list: AiGeneration[]) => {
      setBatch(list.map((g) => g.id))
      void qc.invalidateQueries({ queryKey: ['credits'] })
      void qc.invalidateQueries({ queryKey: ['ai-generations'] })
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('ai.failed'))),
  })

  const cost = quoteQuery.data?.cost ?? 0
  const running = polled.some((g) => g.status === 'QUEUED' || g.status === 'RUNNING')
  const busy = generate.isPending || running
  const canGenerate = !!scene && !busy && !upload.uploading && balance >= cost && aiEnabled

  const done = useMemo(
    () => (galleryQuery.data ?? []).filter((g) => g.status === 'SUCCEEDED'),
    [galleryQuery.data],
  )

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* ============================================== SOL: ayarlar */}
      <div className="waydee-ai-panel">
        <UploadSlot
          label={t('ai.poseScene')}
          icon={<ImageIcon className="h-3 w-3 shrink-0" />}
          value={scene}
          sample="/ai-samples/pose-input.webp"
          sampleAlt={t('ai.poseScene')}
          cta={t('ai.poseSceneCta')}
          hint={t('ai.poseSceneHint')}
          uploading={upload.uploading}
          onPick={(file) => void upload.pick(file).then((v) => v && setScene(v))}
          onClear={() => setScene(null)}
          height="h-32"
        />

        {/* --- yaratıcılık --- */}
        <section className="waydee-ai-section">
          <span className="waydee-ai-label">{t('ai.creativity')}</span>
          <Segmented
            label={t('ai.creativity')}
            value={creativity}
            onChange={setCreativity}
            options={[
              { value: 'STANDARD', label: t('ai.creativityStandard') },
              { value: 'CREATIVE', label: t('ai.creativityCreative') },
            ]}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            {creativity === 'STANDARD' ? t('ai.creativityStandardHint') : t('ai.creativityCreativeHint')}
          </p>
        </section>

        {/* --- görsel sayısı --- */}
        <section className="waydee-ai-section">
          <span className="waydee-ai-label">{t('ai.poseCount')}</span>
          <Segmented
            label={t('ai.poseCount')}
            value={String(count)}
            onChange={(v) => setCount(Number(v))}
            options={Array.from({ length: maxImages }, (_, i) => ({
              value: String(i + 1),
              label: String(i + 1),
            }))}
          />
          {/* ⚠️ Rakam SUNUCUDAN (`/ai/quote`); burada çarpma yapılmaz. */}
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            {t('ai.poseCountHint', { count: String(count), credits: cost.toLocaleString(locale) })}
          </p>
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

      {/* ============================================== SAĞ: varyasyonlar */}
      <div className="waydee-ai-panel waydee-ai-sticky">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="waydee-ai-label-inline">{t('ai.poseResults')}</span>
        </div>

        {batch.length === 0 ? (
          <div className="waydee-ai-stage">
            <div className="text-center">
              <Sparkles className="mx-auto h-7 w-7 text-faint" />
              <p className="mt-2 text-[13px] font-semibold text-muted">{t('ai.poseEmptyTitle')}</p>
              <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-faint">
                {t('ai.poseEmptyDesc')}
              </p>
            </div>
          </div>
        ) : (
          /* ⚠️ İlk kare GENİŞ, kalanlar yan yana: üç eşit kare dar ekranda üç
             minik görsel demekti ve poz farkı seçilemiyordu. */
          <div className="waydee-ai-poses">
            {results.map((g, i) => (
              <div
                key={batch[i]}
                className={`waydee-ai-pose ${i === 0 ? 'waydee-ai-pose-hero' : ''}`}
              >
                {g?.status === 'SUCCEEDED' && g.imageUrl ? (
                  <a href={g.imageUrl} target="_blank" rel="noreferrer">
                    <img src={g.imageUrl} alt={`${t('ai.poseResults')} ${i + 1}`} />
                  </a>
                ) : g?.status === 'FAILED' ? (
                  <div className="px-3 text-center">
                    <p className="text-[12px] font-semibold text-danger">
                      {g.errorMessage ?? t('ai.failed')}
                    </p>
                    <p className="mt-1 text-[11px] text-faint">{t('ai.refunded')}</p>
                  </div>
                ) : (
                  <Spinner />
                )}
              </div>
            ))}
          </div>
        )}

        <RecentStrip
          items={done}
          activeId={batch[0] ?? null}
          onPick={(g) => setBatch([g.id])}
          hint={t('ai.reuseHint')}
        />
      </div>
    </div>
  )
}
