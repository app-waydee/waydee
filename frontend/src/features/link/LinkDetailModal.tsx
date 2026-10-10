import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Link2, Loader2, MousePointerClick, Trash2, X } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { lockScroll } from '@/lib/scrollLock'
import { safeHref } from '@/lib/safeHref'
import { useT } from '@/i18n'

interface LinkDetail {
  id: string
  title: string
  url: string
  iconUrl: string | null
  domainLabel: string | null
  clickCount: number
  active: boolean
}

/**
 * <b>Bağlantı detayı — PENCERE</b> (17 Ağu 2026).
 *
 * <h3>🔴 Neden sayfa değil pencere</h3>
 * İlk denemede ayrı bir rota yazdım ({@code /link/:linkId}) ve kullanıcı haklı
 * olarak <i>"saçma url'ler açılıyor"</i> dedi. Bu uygulamanın deseni bu değil:
 * <b>gönderi karosu da bir rotaya gitmez</b>, {@code PostDetailModal}'ı açar.
 * Koleksiyon bir sayfadır çünkü kendi içeriği (gönderi ızgarası) ve
 * paylaşılabilir bir adresi vardır; tek bir bağlantının ise ne ızgarası ne de
 * paylaşılacak bir hâli var — adres çubuğunda UUID bırakmak saf gürültüydü.
 *
 * <p>⚠️ <b>Ders:</b> "post gibi detay olsun" isteği bir ROTA isteği değil,
 * <b>o desenin aynısı</b> isteğiydi. Bir deseni kopyalarken taşınacak şey
 * biçim değil, o biçimi haklı çıkaran gerekçedir (vault, 88. tur).
 */
export function LinkDetailModal({ linkId, onClose }: { linkId: string; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()

  const detail = useQuery({
    queryKey: ['profile-link', linkId],
    queryFn: async () => (await api.get<LinkDetail>(`/profile-links/${linkId}`)).data,
  })

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [onClose])

  /* Alanlar yalnız BİR kez doldurulur; her tazelemede yazsaydı kullanıcının
     yazdığı harfleri ezerdi (koleksiyon/gönderi düzenlemedeki aynı desen). */
  useEffect(() => {
    if (detail.data && title === '' && url === '') {
      setTitle(detail.data.title)
      setUrl(detail.data.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data])

  const save = useMutation({
    mutationFn: async () =>
      (await api.patch(`/profile-links/${linkId}`, { title: title.trim(), url: url.trim() })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['profile-link', linkId] })
      await qc.invalidateQueries({ queryKey: ['profile-links'] })
      toast.success(t('link.saved'))
      onClose()
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('common.failed'))),
  })

  const remove = useMutation({
    mutationFn: async () => api.delete(`/profile-links/${linkId}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['profile-links'] })
      toast.success(t('link.deleted'))
      onClose()
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('common.failed'))),
  })

  const d = detail.data
  const dirty = !!d && (title.trim() !== d.title || url.trim() !== d.url)
  const canSave = dirty && title.trim() !== '' && url.trim() !== '' && !save.isPending

  return createPortal(
    <div
      className="waydee-sheet-scrim"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="waydee-sheet">
        <div className="relative mb-4">
          <h2 className="text-center text-[15px] font-bold text-ink">{t('link.detailTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute end-0 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {detail.isLoading || !d ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-faint" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* --- önizleme + tıklanma --- */}
            <div className="flex items-center gap-3">
              <span className="waydee-link-detail-icon">
                {d.iconUrl ? <img src={d.iconUrl} alt="" /> : <Link2 className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-ink">{d.title}</p>
                {d.domainLabel && (
                  <p className="truncate text-[12px] text-muted">{d.domainLabel}</p>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
                <MousePointerClick className="h-4 w-4 text-violet" />
                {d.clickCount}
              </span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-muted">{t('link.titleLabel')}</span>
              <input
                className="waydee-sheet-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-muted">{t('link.urlLabel')}</span>
              <input
                className="waydee-sheet-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                maxLength={500}
                inputMode="url"
                spellCheck={false}
              />
            </label>

            <div className="mt-2 flex items-center justify-between gap-3">
              {/* ⚠️ Silme SOLDA ve ayrı: kaydetmenin yanına konsaydı yanlış
                  düğmeye basmak çok kolay olurdu. */}
              <button
                type="button"
                className="waydee-danger-text"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(t('link.deleteConfirm'))) remove.mutate()
                }}
              >
                <Trash2 className="me-1 inline h-4 w-4" />
                {t('link.delete')}
              </button>

              <div className="flex items-center gap-3">
                {/* ⚠️ `safeHref`: adres kullanıcı verisidir; güvensizse React
                    `href`i hiç yazmaz ve bağlantı tıklanamaz olur. */}
                <a
                  href={safeHref(d.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="waydee-sheet-cancel inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" /> {t('link.open')}
                </a>
                <button
                  type="button"
                  className="waydee-sheet-submit"
                  disabled={!canSave}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
