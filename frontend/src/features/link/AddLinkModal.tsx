import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { UploadCloud, X } from 'lucide-react'
import { api } from '@/lib/api'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'

/**
 * <b>ADD A NEW LINK</b> — referans ekran görüntüsüyle birebir.
 *
 * ```
 * ┌─────────────────────────────────────┐
 * │        ADD A NEW LINK           ✕   │  ← 15px, bold, UPPERCASE, ortalı
 * │ ┌─────────────────────────────────┐ │
 * │ │ https://…                       │ │  ← 1. alan: ADRES
 * │ ├─────────────────────────────────┤ │
 * │ │ krem                            │ │  ← 2. alan: AD
 * │ ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ │
 * │ │        ☁  Click to upload…      │ │  ← kesikli çerçeve, ikon üstte
 * │ │             PNG, JPG            │ │
 * │ └─────────────────────────────────┘ │
 * │                  Cancel   [ Create ]│  ← Cancel PEMBE metin, Create SİYAH
 * └─────────────────────────────────────┘
 * ```
 *
 * Ölçüler referanstan: alanlar `rounded-lg` + `#f4f4f5` zemin (odakta beyaz +
 * çerçeve), yükleme alanı <b>kesikli</b> çerçeve, gönder düğmesi siyah dolgulu.
 *
 * ⚠️ <b>Adres ilk alandır, ad ikinci</b> — ekran görüntüsündeki sıra budur.
 * ⚠️ Görsel <b>opsiyoneldir</b>: referansta da zorunlu değil; seçilmezse kart
 * alan adı etiketiyle çizilir.
 */
export function AddLinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  // Açılışta formu sıfırla — kapatıp tekrar açan kullanıcı eski değerleri görmemeli.
  useEffect(() => {
    if (open) {
      setUrl(''); setTitle(''); setFile(null); setPreview(null); setError(null)
    }
  }, [open])

  if (!open) return null

  const pick = (f: File | null) => {
    if (!f) return
    setFile(f)
    // ⚠️ `URL.createObjectURL` + cleanup React 19 StrictMode'da ölü URL üretiyor
    // (vault'ta kayıtlı tuzak) → FileReader ile data URL.
    const reader = new FileReader()
    reader.onload = () => setPreview(String(reader.result))
    reader.readAsDataURL(f)
  }

  const submit = async () => {
    if (!url.trim() || !title.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      // Görsel varsa önce yüklenir: bağlantı kaydı ikonun kimliğini ister.
      let iconMediaId: string | undefined
      if (file) {
        const form = new FormData()
        form.append('file', file)
        const media = await api.post<{ id: string }>('/media', form)
        iconMediaId = media.data.id
      }
      await api.post('/profile-links', { url: url.trim(), title: title.trim(), iconMediaId })
      // Liste ve sayfalama tazelensin.
      await qc.invalidateQueries({ queryKey: ['profile-links'] })
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || t('link.createFailed'))
    } finally {
      setBusy(false)
    }
  }

  const canCreate = url.trim().length > 0 && title.trim().length > 0 && !busy

  return createPortal(
    <div
      className="waydee-sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t('link.addTitle')}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="waydee-sheet">
        <div className="relative mb-5">
          <h2 className="waydee-sheet-title">{t('link.addTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute end-0 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            className="waydee-sheet-input"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            inputMode="url"
          />
          <input
            className="waydee-sheet-input"
            placeholder={t('link.namePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />

          <button
            type="button"
            className="waydee-drop"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              pick(e.dataTransfer.files?.[0] ?? null)
            }}
          >
            {preview ? (
              <img src={preview} alt="" className="mx-auto max-h-24 rounded-lg object-contain" />
            ) : (
              <>
                <UploadCloud className="mx-auto h-6 w-6 text-muted" strokeWidth={1.7} />
                <span className="mt-2 block text-[13px] text-muted">{t('link.uploadHint')}</span>
                <span className="mt-1 block text-[12px] text-faint">PNG, JPG</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />

          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-end gap-4">
          <button type="button" onClick={onClose} className="waydee-sheet-cancel">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={!canCreate} className="waydee-sheet-submit">
            {t('common.create')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
