import { useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useT } from '@/i18n'
import { DEFAULT_WEIGHTS, SIGNALS, type Signal, type Weights } from '@/lib/creators'

/**
 * <b>Sıralama ağırlıkları — sürüklenebilir radar</b> (108. tur).
 *
 * InfluSense'in "Measure · drag to adjust" ekranının karşılığı. Sekiz eksen,
 * her köşe sürüklenerek 0–100 arası ayarlanır; sıralama <b>anında</b> ve
 * istemcide değişir (kredi harcanmaz, sunucuya yalnız kalıcılık için gidilir).
 *
 * ⚠️ Erişilebilirlik: her köşe bir `role="slider"` — klavyeyle odaklanıp ok
 * tuşlarıyla ayarlanır. Ayrıca altta sekiz kaydırıcılık bir liste var:
 * dokunmatikte küçük bir köşeyi sürüklemek zor, kaydırıcı kesin.
 *
 * ⚠️ Kullanıcının bu aramada <b>istemediği</b> boyut (ör. bütçe girilmediyse
 * "Bütçe") soluk çizilir: ağırlığı değişse de sıralamayı etkilemez ve bunu
 * göstermemek "kaydırdım ama hiçbir şey olmadı" şikâyetini doğururdu.
 */
/*
 * Tuval geometrisi. ⚠️ Yatayda bilinçli olarak geniş (380 × 330): sol ve sağ
 * eksenin etiketi yatay yazılıyor ve en uzun dil Almanca ("Reichweite").
 * 108. turdaki ilk sürümde tuval 400 × 400'dü ve radar küçük kalıyordu —
 * etiketler ekranda ~8px'e düşüyordu.
 */
const WIDTH = 380
const HEIGHT = 330
const CX = WIDTH / 2
const CY = HEIGHT / 2
const RADIUS = 100
const LABEL_RADIUS = 117

function angleOf(i: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / SIGNALS.length
}

function point(i: number, value: number): [number, number] {
  const a = angleOf(i)
  const r = (RADIUS * value) / 100
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

export function WeightsRadar({
  weights,
  onChange,
  applicable,
}: {
  weights: Weights
  onChange: (next: Weights) => void
  /** Bu aramada hesaba katılan sinyaller. */
  applicable: Set<Signal>
}) {
  const t = useT()
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<Signal | null>(null)
  /*
   * 🔴 108. turda ÖLÇÜLEREK BULUNDU: `set` doğrudan `weights` prop'unu
   * kullanıyordu. Yeniden çizimden önce gelen iki değişiklik (hızlı sürükleme,
   * tuş tekrarı, iki köşeye art arda dokunma) aynı ESKİ nesneden hesaplanıyor
   * ve ikincisi birincisini siliyordu — ölçümde Bütçe→100 ve İçerik→0 kayboldu,
   * yalnız son değişiklik kaldı. En son değer artık bu ref'te tutuluyor ve her
   * değişiklik bir öncekinin ÜSTÜNE kuruluyor.
   */
  const latest = useRef(weights)
  latest.current = weights

  const set = (signal: Signal, value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)))
    if (v === latest.current[signal]) return
    const next = { ...latest.current, [signal]: v }
    latest.current = next
    onChange(next)
  }

  /** İmlecin eksen üzerindeki izdüşümü → 0..100. */
  const valueFromPointer = (i: number, clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const scale = WIDTH / rect.width
    const x = (clientX - rect.left) * scale - CX
    const y = (clientY - rect.top) * scale - CY
    const a = angleOf(i)
    const projected = x * Math.cos(a) + y * Math.sin(a)
    return (projected / RADIUS) * 100
  }

  const polygon = SIGNALS.map((s, i) => point(i, weights[s]).join(',')).join(' ')

  return (
    <div className="waydee-cr-radar">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="waydee-cr-radar-svg"
        // ⚠️ Sürüklerken sayfa kaymasın (dokunmatik): yalnız tuval üzerinde.
        style={{ touchAction: dragging ? 'none' : 'manipulation' }}
        onPointerMove={(e) => {
          if (!dragging) return
          const v = valueFromPointer(SIGNALS.indexOf(dragging), e.clientX, e.clientY)
          if (v != null) set(dragging, v)
        }}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        {/* Izgara: %25'lik halkalar */}
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={SIGNALS.map((_, i) => point(i, ring).join(',')).join(' ')}
            className="waydee-cr-radar-ring"
          />
        ))}
        {SIGNALS.map((s, i) => {
          const [x, y] = point(i, 100)
          return (
            <line key={s} x1={CX} y1={CY} x2={x} y2={y}
              className={applicable.has(s) ? 'waydee-cr-radar-axis' : 'waydee-cr-radar-axis-off'} />
          )
        })}

        <polygon points={polygon} className="waydee-cr-radar-shape" />

        {SIGNALS.map((s, i) => {
          const a = angleOf(i)
          const lx = CX + LABEL_RADIUS * Math.cos(a)
          const ly = CY + LABEL_RADIUS * Math.sin(a)
          const cos = Math.cos(a)
          const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'
          const dy = Math.sin(a) > 0.5 ? 12 : Math.sin(a) < -0.5 ? -4 : 4
          return (
            <text key={s} x={lx} y={ly + dy} textAnchor={anchor}
              className={applicable.has(s) ? 'waydee-cr-radar-label' : 'waydee-cr-radar-label-off'}>
              {t(`creators.signal.${s}` as never)}
            </text>
          )
        })}

        {SIGNALS.map((s, i) => {
          const [x, y] = point(i, weights[s])
          const label = t(`creators.signal.${s}` as never)
          return (
            <circle
              key={s}
              cx={x}
              cy={y}
              r={dragging === s ? 9 : 7}
              role="slider"
              tabIndex={0}
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={weights[s]}
              className={applicable.has(s) ? 'waydee-cr-radar-handle' : 'waydee-cr-radar-handle-off'}
              onPointerDown={(e) => {
                e.preventDefault()
                ;(e.target as Element).setPointerCapture?.(e.pointerId)
                setDragging(s)
              }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 10 : 5
                if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  set(s, weights[s] + step)
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  set(s, weights[s] - step)
                } else if (e.key === 'Home') {
                  e.preventDefault()
                  set(s, 0)
                } else if (e.key === 'End') {
                  e.preventDefault()
                  set(s, 100)
                }
              }}
            >
              <title>{`${label}: ${weights[s]}`}</title>
            </circle>
          )
        })}
      </svg>

      <div className="waydee-cr-weights">
        {SIGNALS.map((s) => (
          <label key={s} className="waydee-cr-weight" data-off={!applicable.has(s) || undefined}
            title={applicable.has(s) ? t(`creators.signalDesc.${s}` as never) : t('creators.notApplicable')}>
            <span className="waydee-cr-weight-name">{t(`creators.signal.${s}` as never)}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={weights[s]}
              onChange={(e) => set(s, Number(e.target.value))}
              className="waydee-range"
              style={{ ['--fill' as string]: `${weights[s]}%` }}
              aria-label={t(`creators.signal.${s}` as never)}
            />
            <span className="waydee-cr-weight-value">{weights[s]}</span>
          </label>
        ))}
      </div>

      <button type="button" className="waydee-cr-link" onClick={() => onChange({ ...DEFAULT_WEIGHTS })}>
        <RotateCcw className="h-3.5 w-3.5" />
        {t('creators.resetWeights')}
      </button>
    </div>
  )
}
