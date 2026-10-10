import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, MapPin, Palette, Sparkles, Store, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { fmtRadius } from '@/lib/format'
import { usePlan, useStoreAccess } from '@/features/plan/PlanBadge'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { DEFAULT_STYLE, TerritoryStylePicker, type TerritoryStyleDraft } from './TerritoryStylePicker'

/**
 * <b>Mağaza kurma paneli</b> (V38) — eski `PurchasePanel`'in yerini alır.
 *
 * <p>🔴 <b>Neden yeniden yazıldı, düzenlenmedi:</b> eski panelin gövdesi
 * fiyatlandırmaydı — yarıçap kaydırıcısı, km² alanı, birim fiyat, süre
 * seçenekleri, kupon kutusu, ödeme sayfasına yönlendirme. Daire artık Premium
 * üyeliğin hakkı olduğu için bunların <b>hiçbirinin</b> karşılığı kalmadı;
 * mevcut panelden tek tek silmek, üç adımlı akışın iskeletini de anlamsız
 * bırakırdı. Kalan tek gerçek seçim <b>görünüm</b>dür — o yüzden panel iki
 * adımlı: Yer → Görünüm.
 *
 * <p>🔴 <b>Yarıçap seçimi YOK:</b> sunucu 100 m uygular. Kaydırıcıyı bırakıp
 * değeri sabitlemek, kullanıcıya değiştirebileceği izlenimi veren ölü bir
 * denetim olurdu.
 *
 * <p>⚠️ <b>KONUMLAMA — bir daha bozulmasın diye:</b> panel eskiden
 * `waydee-above-nav` (yani `bottom: …`) ile birlikte `md:top-1/2
 * md:-translate-y-1/2` kullanıyordu ve masaüstünde eziliyordu (ölçüldü:
 * `top:360px` VE `bottom:100px` → yükseklik 260px). Çözüm: hiçbir
 * transform/`bottom` hilesi yok. Tam ekran bir sarmalayıcı var; masaüstünde
 * `items-center`, mobilde `items-end`.
 *
 * <p>⚠️ Adım geçişleri yalnız `opacity` ile yapılır — konumu kritik öğelerde
 * transform animasyonu bu projede üç kez başlangıç değerinde takıldı (vault).
 */
export interface Selection {
  lng: number
  lat: number
  /** Sunucunun uyguladığı sabit yarıçap; harita önizlemesi bunu çizer. */
  radiusM: number
}

type Step = 'place' | 'style'

interface StorePanelProps {
  selection: Selection
  onClose: () => void
  /** Mağaza kurulunca haritanın kendini tazelemesi için. */
  onCreated?: (territoryId: string) => void
}

export function StorePanel({ selection, onClose, onCreated }: StorePanelProps) {
  const navigate = useNavigate()
  const t = useT()
  const { data: plan } = usePlan()
  /* Önizlemedeki fotoğraf kullanıcının kendi avatarıdır. */
  const me = useAuthStore((state) => state.user)
  const [name, setName] = useState('')
  const [style, setStyle] = useState<TerritoryStyleDraft>(DEFAULT_STYLE)
  const [step, setStep] = useState<Step>('place')
  const [saving, setSaving] = useState(false)

  /* 🔒 Hak sunucunun cevabıdır, plan adı karşılaştırması DEĞİL: ileride bir
     kampanya planı da bu hakkı verebilir ve o gün burayı güncellemeyi kimse
     hatırlamaz.
     🔴 18 Ağu 2026 — kapı artık `canOwnStore` DEĞİL `useStoreAccess()`:
     ücretsiz hesabın harcanmamış 1 aylık denemesi de mağaza açtırır. */
  const storeAccess = useStoreAccess()
  const allowed = storeAccess.canOpen
  const planLoading = plan === undefined

  async function submit() {
    setSaving(true)
    try {
      const { data } = await api.post<{ id: string }>('/territories/store', {
        lng: selection.lng,
        lat: selection.lat,
        name: name.trim() || undefined,
        style,
      })
      toast.success(t('store.created'))
      onCreated?.(data.id)
      onClose()
    } catch (error) {
      toast.error(apiErrorMessage(error, t('store.failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-end justify-center md:items-center md:justify-end md:pe-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="waydee-store-panel pointer-events-auto"
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {step === 'style' && (
              <button
                type="button"
                className="rounded-full p-1 text-muted hover:text-ink"
                onClick={() => setStep('place')}
                aria-label={t('common.back')}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Store className="h-4 w-4 shrink-0 text-muted" />
            <p className="truncate text-[15px] font-bold">{t('store.title')}</p>
          </div>
          <button
            type="button"
            className="rounded-full p-1 text-muted hover:text-ink"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-4 py-4">
          {planLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : !allowed ? (
            /* ⚠️ Kilit ekranı panelin İÇİNDE: kullanıcı haritada seçtiği yeri
               kaybetmeden neden yapamadığını ve ne yapması gerektiğini görür.
               Ayrı bir sayfaya atmak seçimi çöpe atardı. */
            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-subtle">
                <Sparkles className="h-5 w-5 text-muted" />
              </div>
              <p className="mt-3 text-[15px] font-bold">{t('store.premiumOnly')}</p>
              <p className="mt-1 text-[13px] font-medium text-muted">{t('store.premiumOnlyBody')}</p>
              <Button className="mt-4 w-full" onClick={() => navigate('/plan')}>
                {t('store.seePlans')}
              </Button>
            </div>
          ) : step === 'place' ? (
            <>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {selection.lat.toFixed(5)}, {selection.lng.toFixed(5)}
                </span>
              </div>

              {/* 🔴 Yarıçap bir SEÇİM değil, bir BİLGİ — bu yüzden düğme değil
                  satır olarak yazılır. */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-subtle px-3 py-2">
                <span className="text-[13px] font-semibold text-muted">{t('store.radius')}</span>
                <span className="text-[14px] font-bold tabular-nums">
                  {fmtRadius(selection.radiusM)}
                </span>
              </div>

              <div className="mt-3">
                <Label htmlFor="store-name">{t('store.name')}</Label>
                <Input
                  id="store-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('store.namePlaceholder')}
                  maxLength={60}
                />
              </div>

              <Button className="mt-4 w-full" onClick={() => setStep('style')}>
                <Palette className="h-4 w-4" />
                {t('store.next')}
              </Button>
            </>
          ) : (
            <>
              {/* ⚠️ Avatar ve ad ÖNİZLEMEYE geçirilir: kullanıcı seçtiği rengin ve
                  tasarımın KENDİ fotoğrafıyla nasıl duracağını burada görmeli —
                  mağazayı kurduktan sonra değil. */}
              <TerritoryStylePicker
                value={style}
                onChange={setStyle}
                avatarUrl={me?.avatarUrl ?? null}
                name={name}
              />
              <Button className="mt-4 w-full" onClick={submit} disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {t('store.create')}
              </Button>
              <p className={cn('mt-2 text-center text-xs font-medium text-faint')}>
                {t('store.freeWithPremium')}
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
