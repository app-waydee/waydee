import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'

/**
 * <b>CREATE A NEW COLLECTION</b> — referans ekran görüntüsüyle birebir.
 *
 * ```
 * ┌─────────────────────────────────────┐
 * │   CREATE A NEW COLLECTION       ✕   │
 * │ ┌─────────────────────────────────┐ │
 * │ │ Collection name                 │ │  ← tek alan
 * │ └─────────────────────────────────┘ │
 * │                  Cancel   [ Create ]│  ← ad boşken Create GRİ/pasif
 * └─────────────────────────────────────┘
 * ```
 *
 * ⚠️ Ekran görüntüsünde <b>Create düğmesi gri</b> — alan boş olduğu için
 * pasif. Bu bilinçli kopyalanıyor: boş adla koleksiyon açılamaz.
 */
export function CreateCollectionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  /** Oluşan koleksiyonun kimliği — çağıran isterse detayına gider. */
  onCreated?: (id: string) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) { setTitle(''); setError(null) }
  }, [open])

  if (!open) return null

  const submit = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<{ id: string }>('/collections', { title: title.trim() })
      await qc.invalidateQueries({ queryKey: ['collections'] })
      onCreated?.(res.data.id)
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || t('collection.createFailed'))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="waydee-sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t('collection.createTitle')}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="waydee-sheet">
        <div className="relative mb-5">
          <h2 className="waydee-sheet-title">{t('collection.createTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute end-0 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <input
          className="waydee-sheet-input"
          placeholder={t('collection.namePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={120}
          autoFocus
        />
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-4">
          <button type="button" onClick={onClose} className="waydee-sheet-cancel">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || busy}
            className="waydee-sheet-submit"
          >
            {t('common.create')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
