import { useEffect, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { useT } from '@/i18n'
import type { Step } from '@/lib/creators'
import { duration } from './creatorFormat'

/**
 * <b>Şeffaf boru hattı</b> (108. tur) — InfluSense'in "Not another AI wrapper.
 * No black box." bölümündeki adım kartlarının karşılığı.
 *
 * ⚠️ Gösterilen her şey <b>gerçek</b>: süreler sunucunun ölçtüğü değerler,
 * sağlayıcı adı o adımı gerçekten koşan sağlayıcı, sayılar o adımın çıktısı.
 * Süs olsun diye canlandırılmış sahte bir ilerleme çizilmez — kullanıcının
 * güvenini kazanmak için kurulan bir ekran, ilk yalanında onu kaybeder.
 */
export function Pipeline({
  steps,
  locale,
  startedAt,
  running,
}: {
  steps: Step[]
  locale: string
  startedAt: string | null
  running: boolean
}) {
  const t = useT()
  const now = useNow(running)
  const elapsed = startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : null

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="waydee-ai-label-inline">{t('creators.pipelineTitle')}</span>
        {running && elapsed != null && (
          <span className="waydee-cr-elapsed">{t('creators.elapsed', { time: duration(elapsed, locale) ?? '' })}</span>
        )}
      </div>
      <ol className="waydee-cr-steps">
        {steps.map((step) => (
          <li key={step.key} className="waydee-cr-step" data-state={step.state}>
            <span className="waydee-cr-step-icon" aria-hidden>
              {step.state === 'DONE' ? <Check className="h-3.5 w-3.5" />
                : step.state === 'FAILED' ? <X className="h-3.5 w-3.5" />
                  : step.state === 'ACTIVE' ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="waydee-cr-step-title">{t(`creators.step.${step.key}` as never)}</p>
              <p className="waydee-cr-step-desc">
                {t(`creators.stepDesc.${step.key}` as never)}
              </p>
              {Object.keys(step.metrics).length > 0 && (
                <p className="waydee-cr-step-metrics">
                  {Object.entries(step.metrics).map(([k, v]) => (
                    <span key={k}>{t(`creators.metric.${k}` as never, { n: v.toLocaleString(locale) })}</span>
                  ))}
                </p>
              )}
            </div>
            {/* ⚠️ Süre büyük harfe ÇEVRİLMEZ (`data-duration`): durum etiketlerinin
                büyük harf kuralı "142 msn"yi "142 MSN" yapıyordu (108. turda görüldü). */}
            {step.state === 'DONE' && step.durationMs != null ? (
              <span className="waydee-cr-step-state" data-duration="">{duration(step.durationMs, locale)}</span>
            ) : (
              <span className="waydee-cr-step-state">{t(`creators.stepState.${step.state}` as never)}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Süren aramada geçen süre saniyede bir güncellenir; bitince saat durur. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}
