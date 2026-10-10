import { useEffect, useState } from 'react'
import { fileFromDataUrl } from '@/lib/media'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { usePlan } from '@/features/plan/PlanBadge'
import { useT } from '@/i18n'

export interface TagSuggestion {
  x: number
  y: number
  score: number
  /**
   * Ürünün adı — <b>yalnız görsel modeli</b> doldurur (10 Ağu 2026).
   * Yerleşik dikkat haritası nesneyi tanımadığı için orada `null` gelir;
   * o durumda balonda ad yazılmaz (uydurma etiket göstermeyiz).
   */
  label?: string | null
}

/**
 * <b>Yapay zekâ etiket önerisi</b> — fotoğrafta etiketin konabileceği noktalar.
 *
 * <p>🔴 <b>Premium kapısı sunucudadır.</b> Burada yalnız hangi kartın
 * çizileceğine karar veriliyor; yetkisiz bir çağrı sunucudan
 * <b>403 PLAN_LIMIT_REACHED</b> ile döner. Düğmeyi gizlemek güvenlik değildir.
 *
 * <p>⚠️ Hak kontrolü <code>canOwnStore</code> ile yapılır, plan adıyla değil —
 * sunucu neyi verdiğini kendi söyler ve ileride bir kampanya planı da bu hakkı
 * verebilir.
 *
 * <p>⚠️ Öneri çıkmazsa <b>bunu söyler</b>. Boş bir sonuçta rastgele noktalar
 * göstermek, kullanıcıya çalışmayan bir zekâ izlenimi verirdi.
 */
export function TagSuggestionBar({
  imageSrc,
  onSuggestions,
  onScanning,
  suggestionCount,
}: {
  /**
   * Analiz edilecek görsel — <b>data URL</b> ya da adres.
   *
   * ⚠️ Medya kimliği DEĞİL: gönderi akışında fotoğraf kaydetme anına kadar
   * yüklenmiyor. Analiz için önce depoya yazmak, vazgeçilen her denemede çöp
   * dosya bırakırdı.
   */
  imageSrc: string | null
  onSuggestions: (points: TagSuggestion[]) => void
  onScanning: (busy: boolean) => void
  suggestionCount: number
}) {
  const t = useT()
  const navigate = useNavigate()
  const { data: plan } = usePlan()
  const canUse = plan?.canOwnStore === true

  const analyze = useMutation({
    mutationFn: async () => {
      /* 🔴 17 Ağu 2026 — `fetch(dataUrl)` KALDIRILDI (aynı hata gönderi
         akışında üretimi durdurmuştu). `fetch`, `data:` adreslerinde de
         `connect-src`'ye tabidir; CSP zorlayıcı moda alınınca engellendi.
         Kendi verimizi kendimize ağ isteğiyle sormak zaten gereksizdi. */
      const file = fileFromDataUrl(imageSrc!, 'photo.jpg')
      const form = new FormData()
      form.append('file', file, 'photo.jpg')
      return (await api.post<TagSuggestion[]>('/media/tag-suggestions', form)).data
    },
    onMutate: () => onScanning(true),
    onSuccess: (points) => {
      onSuggestions(points)
      if (points.length === 0) toast.info(t('tagAi.none'))
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('tagAi.failed'))),
    onSettled: () => onScanning(false),
  })

  if (!imageSrc) return null

  /* --- Premium değil: davet --- */
  if (!canUse) {
    return (
      <div className="waydee-ai-upsell">
        <span className="waydee-ai-spark">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight">{t('tagAi.upsellTitle')}</p>
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-muted">
            {t('tagAi.upsellBody')}
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => navigate('/plan')}>
          {t('tagAi.upsellCta')}
        </Button>
      </div>
    )
  }

  /* --- Premium: tarama --- */
  return (
    <div className="waydee-ai-bar">
      <Button
        size="sm"
        variant="stroke"
        disabled={analyze.isPending}
        onClick={() => analyze.mutate()}
      >
        <Wand2 className="h-4 w-4" />
        {analyze.isPending ? t('tagAi.scanning') : t('tagAi.scan')}
      </Button>
      {suggestionCount > 0 && !analyze.isPending && (
        <span className="text-[12px] font-semibold text-muted">
          {t('tagAi.found', { count: String(suggestionCount) })}
        </span>
      )}
    </div>
  )
}

/**
 * <b>Analiz sırasında görselin üstünde dönen tarama katmanı.</b>
 *
 * <p>⚠️ Yalnız <b>opacity</b> ve <b>transform</b> canlandırılır; ikisi de
 * bileşik katmanda çalışır ve düzeni yeniden hesaplatmaz. Yükseklik/genişlik
 * canlandırmak, altındaki büyüteç katmanını her karede yeniden ölçtürürdü.
 */
export function ScanOverlay({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="waydee-ai-scan"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden
        >
          <motion.span
            className="waydee-ai-scanline"
            animate={{ y: ['-10%', '110%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="waydee-ai-scanlabel">
            <Sparkles className="h-3.5 w-3.5" />
            <ScanCaption />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Sırayla değişen kısa açıklamalar — bekleme hissi kısalsın. */
function ScanCaption() {
  const t = useT()
  const steps = [t('tagAi.step1'), t('tagAi.step2'), t('tagAi.step3')]
  const [i, setI] = useState(0)
  /* ⚠️ Zamanlayıcı `useEffect` içinde kurulur ve sökülürken temizlenir.
     `useState` başlatıcısında kurmak StrictMode'da iki zamanlayıcı bırakır ve
     ikincisi hiç temizlenmez. */
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % steps.length), 1100)
    return () => window.clearInterval(id)
  }, [steps.length])
  return <span>{steps[i]}</span>
}

/**
 * Önerilen noktalar — görselin üstünde nabız gibi atan halkalar.
 *
 * <p>⚠️ Öneriler <b>tıklanabilir</b>: kullanıcı noktaya dokununca etiket
 * formu tam o koordinatta açılır. Yalnız göstermek, kullanıcıyı "gördüm ama
 * yine de elle tıklamam gerekiyor" durumuna sokardı.
 */
export function SuggestionMarkers<TFilled extends { key: string; productName?: string | null }>({
  points,
  onPick,
  resolveFilled,
  onOpenFilled,
  openKey,
}: {
  points: TagSuggestion[]
  onPick: (p: { x: number; y: number; label?: string | null }) => void
  /**
   * Öneriyi <b>tüketen</b> kaydedilmiş etiketi döndürür — yoksa `null`.
   *
   * <p>🔴 11 Ağu 2026. Eşleştirme <b>konum yakınlığıyla</b> yapılır, kimlikle
   * değil: öneri sunucudan gelir ve kaydedilen etiketin onunla bir bağı yoktur.
   * Karar {@link TagComposer}'da (yarıçap orada tanımlı) — bu bileşen yalnız
   * <i>çizer</i>.
   */
  resolveFilled?: (s: TagSuggestion) => TFilled | null
  /** Doldurulmuş bir öneriye dokunulunca: o etiketin bilgi kartını aç/kapat. */
  onOpenFilled?: (p: TFilled) => void
  /** Şu an kartı açık olan etiketin anahtarı — işaret basılı görünür. */
  openKey?: string | null
}) {
  const t = useT()
  return (
    <>
      {points.map((p, i) => {
        const filled = resolveFilled?.(p) ?? null
        /* Doldurulmuş öneride modelin tahmini DEĞİL, kullanıcının yazdığı ad
           gösterilir: ikisi farklıysa doğru olan kullanıcınınkidir. */
        const label = filled ? filled.productName || p.label : p.label
        const hint = filled ? t('tagAi.hintFilled') : t('tagAi.hintTitle')

        return (
          <button
            key={`${p.x}-${p.y}`}
            type="button"
            className={`waydee-ai-hint ${filled ? 'waydee-ai-hint-filled' : ''} ${
              filled && openKey === filled.key ? 'waydee-ai-hint-open' : ''
            }`}
            style={{
              insetInlineStart: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              animationDelay: `${i * 0.18}s`,
            }}
            title={label || hint}
            aria-label={label || hint}
            aria-expanded={filled ? openKey === filled.key : undefined}
            onClick={(e) => {
              e.stopPropagation()
              /* 🔴 Dolu öneri formu TEKRAR AÇMAZ — aynı ürüne ikinci bir etiket
                 koyulmasının en kolay yolu buydu. Bilgi kartını açar. */
              if (filled) onOpenFilled?.(filled)
              else onPick({ x: p.x, y: p.y, label: p.label })
            }}
          >
            {/* Nabız yalnız BOŞ öneride atar: dolu bir nokta artık "buraya bak"
                demiyor, "burada şu var" diyor. */}
            {!filled && <span className="waydee-ai-hint-ring" />}
            {filled ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3 w-3" />}
            {/* 🔴 Ürün adı balonun yanında yazar: kullanıcı noktaya dokunmadan
                önce modelin NE bulduğunu görmeli. Ad yoksa (yerleşik analiz)
                hiçbir şey çizilmez — boş bir balon yazmak uydurma olurdu. */}
            {label && <span className="waydee-ai-hint-label">{label}</span>}
          </button>
        )
      })}
    </>
  )
}
