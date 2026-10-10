import { useEffect, useState, type ReactNode } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { History, ImagePlus, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { looksLikeImage, prepareImageForUpload, uploadImage } from '@/lib/media'
import { getGeneration, type AiGeneration } from '@/lib/aiStudio'
import { useT } from '@/i18n'

/**
 * <b>Stüdyonun üç aracının ortak parçaları</b> (99. tur).
 *
 * <h3>🔴 Neden ortak bir dosya</h3>
 * <p>Editoryal ve Poz açılırken yükleme kutusu, yoklama ve galeri şeridi
 * kopyalanabilirdi — ve o kopyalar, manken ekranında <b>zaten ölçülmüş</b> iki
 * tuzağı yeniden doğururdu:
 * <ul>
 *   <li><b>Canlı `FileList`</b> — `input.value = ''` elimizdeki listeyi de
 *       boşaltır, `addFiles` sıfır dosya alır ve <b>sessizce</b> döner
 *       ("yükleme çalışmıyor" şikâyeti tam olarak buydu);</li>
 *   <li><b>Sessiz eleme</b> — tür tutmuyorsa ya da tarayıcı çözemiyorsa
 *       kullanıcıya <b>söylenir</b>.</li>
 * </ul>
 * Üç ekranın da aynı davranışı göstermesi, bu iki dersin tek yerde durmasıyla
 * mümkün.
 */

/* ─────────────────────────────────────────────────────────────── yükleme */

export interface UploadedImage {
  id: string
  url: string
}

/**
 * Tek görsellik yükleme.
 *
 * <p>⚠️ Parametre <b>`File`</b>, `FileList` değil — gerekçe yukarıda.
 */
export function useSingleUpload() {
  const t = useT()
  const [uploading, setUploading] = useState(false)

  const pick = async (file: File | undefined): Promise<UploadedImage | null> => {
    // ⚠️ İkinci bir seçim, süren yüklemenin bayrağını ezerdi.
    if (!file || uploading) return null
    /* ⚠️ `type.startsWith('image/')` TEK BAŞINA YETMEZ: bazı dosyalar
       `type: ""` ile geliyor (`.jfif`, bazı uygulamalardan sürükleme). */
    if (!looksLikeImage(file)) {
      toast.error(t('ai.onlyImages'))
      return null
    }
    setUploading(true)
    try {
      let ready: File
      try {
        /* 🔴 Büyük fotoğraflar İSTEMCİDE küçültülür: sunucunun tavanı 10 MB ve
           sıradan bir telefon fotoğrafı bunu aşıyor (ölçüldü: 4000×3000 JPEG
           = 11,6 MB → 413). */
        ready = await prepareImageForUpload(file)
      } catch {
        // Tarayıcı çözemedi (çoğunlukla HEIC) — net bir mesaj ver.
        toast.error(t('ai.unsupportedImage'))
        return null
      }
      const media = await uploadImage(ready)
      return { id: media.id, url: media.url }
    } catch (e) {
      // 🔴 Yakalanmamış bir `await`, düğmenin sessizce çalışmaması demekti.
      toast.error(apiErrorMessage(e, t('ai.uploadFailed')))
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploading, pick }
}

/**
 * Tek görsellik yükleme kutusu — <b>boşken örnek görseli</b> gösterir.
 *
 * <h3>🔴 Örnek görsel bir SÜSLEME DEĞİL</h3>
 * <p>Kullanıcı buraya ne koyacağını çoğu zaman bilmiyor ("stil referansı" ne
 * demek?). Boş bir kesikli kutu bunu anlatmıyor; <b>o kutuya ait örnek</b>
 * anlatıyor. Bu yüzden örnek <b>ÖRNEK rozetiyle</b> çizilir — rozetsiz bir
 * görsel "bu yüklenmiş" diye okunur ve kullanıcı kendi dosyasını hiç seçmezdi.
 *
 * <p>⚠️ Örnek görsel <b>tıklanınca yüklenmez</b>: gerçek bir medya kimliği
 * yok, yalnız bir resim. Tıklama her hâlükârda dosya seçiciyi açar.
 */
export function UploadSlot({
  label,
  icon,
  value,
  sample,
  sampleAlt,
  cta,
  hint,
  uploading,
  onPick,
  onClear,
  height = 'h-28',
  action,
}: {
  label: string
  icon?: ReactNode
  value: UploadedImage | null
  sample: string
  sampleAlt: string
  cta: string
  hint?: string
  uploading: boolean
  onPick: (file: File) => void
  onClear: () => void
  /** Kutunun görsel yüksekliği — sahne referansı manken ürününden büyüktür. */
  height?: string
  /** Etiketin sağındaki isteğe bağlı düğme (ör. Pinterest bağlantısı). */
  action?: ReactNode
}) {
  const t = useT()
  const [over, setOver] = useState(false)

  return (
    <section className="waydee-ai-section">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="waydee-ai-label-inline flex min-w-0 items-center gap-1.5 truncate">
          {icon}
          {label}
        </span>
        {action}
      </div>

      {value ? (
        <div className="waydee-ai-slot">
          <img src={value.url} alt="" />
          <button
            type="button"
            onClick={onClear}
            aria-label={t('common.clear')}
            className="waydee-ai-product-x"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label
          className="waydee-ai-drop waydee-ai-drop-sample"
          data-over={over}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) onPick(file)
          }}
        >
          <div className={`waydee-ai-sample ${height}`}>
            <img src={sample} alt={sampleAlt} loading="lazy" />
            <span className="waydee-ai-sample-badge">{t('ai.sample')}</span>
            <div className="waydee-ai-sample-veil">
              {uploading ? <Spinner /> : <ImagePlus className="h-5 w-5" />}
              <span className="text-[11px] font-semibold">{cta}</span>
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              /*
               * 🔴 FileList CANLIDIR: değeri sıfırlamak elimizdeki listeyi de
               * boşaltır. Önce diziye çevir, DEĞERİ SONRA sıfırla — sıfırlama
               * gerekli, çünkü aynı dosya ikinci kez seçilirse `change` hiç
               * tetiklenmez.
               */
              const picked = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (picked[0]) onPick(picked[0])
            }}
          />
        </label>
      )}

      {hint && <p className="mt-2.5 text-[11px] leading-snug text-faint">{hint}</p>}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────── yoklama */

/**
 * Bir ya da daha çok üretimi yoklar.
 *
 * <p>⚠️ Yoklama <b>iş bitince durur</b>: sabit bir aralık, sekme açık kaldıkça
 * sonsuza kadar istek atardı.
 *
 * <p>⚠️ Poz aracı bir istekte üç satır açıyor; her satır <b>kendi</b> sorgusunda
 * yoklanır. Tek bir sorguda toplamak, biri biterken diğerlerini de gereksiz
 * yere tazelemek demekti.
 */
export function useGenerationPolls(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['ai-generation', id],
      queryFn: () => getGeneration(id),
      refetchInterval: (query: { state: { data?: AiGeneration } }) => {
        const s = query.state.data?.status
        return s === 'QUEUED' || s === 'RUNNING' ? 2000 : (false as const)
      },
    })),
    combine: (results) => results.map((r) => r.data).filter((g): g is AiGeneration => !!g),
  })
}

/**
 * İş bittiğinde galeri, bakiye ve fiyat <b>tazelenir</b> — üçü de değişmiştir.
 *
 * <p>⚠️ Bir kez: `settled` kümesi olmasaydı yoklama duran sorgu her yeniden
 * çiziminde aynı tazelemeyi tetiklerdi.
 */
export function useSettleEffects(generations: AiGeneration[]) {
  const qc = useQueryClient()
  const t = useT()
  /* ⚠️ Kayıt bir `useRef` DEĞİL `useState` başlangıcı: her çizimde yeni bir
     küme kurulsaydı aynı iş defalarca "yeni bitmiş" sayılırdı. */
  const [settled] = useState(() => new Set<string>())

  useEffect(() => {
    /* 🔴 Yan etki ÇİZİM SIRASINDA değil, efekt içinde: `toast` ve
       `invalidateQueries` çizim sırasında çağrılsaydı React aynı turda yeni bir
       çizim tetikler ve sonsuz döngüye en yakın yerde dururduk. */
    let changed = false
    for (const g of generations) {
      if (g.status !== 'SUCCEEDED' && g.status !== 'FAILED') continue
      if (settled.has(g.id)) continue
      settled.add(g.id)
      changed = true
      if (g.status === 'FAILED') {
        // ⚠️ İade sunucuda otomatik; kullanıcıya da SÖYLENİR.
        toast.error(`${g.errorMessage ?? t('ai.failed')} — ${t('ai.refunded')}`)
      }
    }
    if (changed) {
      void qc.invalidateQueries({ queryKey: ['ai-generations'] })
      void qc.invalidateQueries({ queryKey: ['credits'] })
      void qc.invalidateQueries({ queryKey: ['ai-quote'] })
    }
  }, [generations, qc, settled, t])
}

/* ─────────────────────────────────────────────────────────── küçük parçalar */

/** Bölünmüş seçim — cinsiyet/kalite şeridiyle aynı dil. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="waydee-ai-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="waydee-ai-seg-item"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** "Son oluşturulanlar" şeridi. */
export function RecentStrip({
  items,
  activeId,
  onPick,
  hint,
}: {
  items: AiGeneration[]
  activeId: string | null
  onPick: (g: AiGeneration) => void
  hint?: string
}) {
  const t = useT()
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-2.5 flex items-center gap-2">
        <History className="h-3.5 w-3.5 shrink-0 text-faint" />
        <span className="waydee-ai-label-inline">{t('ai.recent')}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-center text-[12px] text-faint">{t('ai.noneYet')}</p>
      ) : (
        <div className="waydee-ai-strip">
          {items.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-current={g.id === activeId}
              onClick={() => onPick(g)}
              className="waydee-ai-thumb"
            >
              {g.imageUrl && <img src={g.imageUrl} alt="" />}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="mt-3 text-[11px] leading-relaxed text-faint">{hint}</p>}
    </div>
  )
}

/**
 * Maliyet + bakiye satırı ve "Oluştur" düğmesi.
 *
 * <p>⚠️ Rakam <b>sunucudan</b> gelir; burada hiçbir formül yok.
 */
export function GenerateBox({
  cost,
  balance,
  locale,
  disabled,
  busy,
  onClick,
  notEnough,
}: {
  cost: number
  balance: number
  locale: string
  disabled: boolean
  busy: boolean
  onClick: () => void
  notEnough: boolean
}) {
  const t = useT()
  return (
    <section className="waydee-ai-section">
      <div className="waydee-ai-costline mb-2.5">
        <span>{t('ai.cost', { count: cost.toLocaleString(locale) })}</span>
        <span className="waydee-ai-costline-muted">
          {balance.toLocaleString(locale)} {t('ai.credits')}
        </span>
      </div>
      <button type="button" disabled={disabled} onClick={onClick} className="waydee-ai-go">
        {busy ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : t('ai.generate')}
      </button>
      {notEnough && (
        <p className="mt-2 text-center text-[12px] font-semibold text-danger">{t('ai.notEnough')}</p>
      )}
    </section>
  )
}
