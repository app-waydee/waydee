import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FolderPlus, Plus, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'

interface CollectionRow {
  id: string
  title: string
  itemCount: number
}

/**
 * <b>"Koleksiyona ekle" — gönderi düzenleme ekranından</b>.
 *
 * <h3>🔴 Neden yazıldı</h3>
 * <p>Kullanıcı: <i>"edit sayfasındaki add collection çalışmıyor, home dönüyor,
 * buga giriyor."</i> Ölçüldü ve doğruydu: düğme
 * {@code navigate('/home?tab=posts&add=' + postId)} çağırıyordu, ama
 * {@code HomePage} yalnız {@code ?create=1} parametresini tanıyor —
 * <b>{@code add} hiçbir yerde işlenmiyordu</b>. Yani düğme kullanıcıyı ana
 * sayfaya atıyor ve orada hiçbir şey olmuyordu.
 *
 * <p><b>Çözüm sayfayı hiç terk etmemek.</b> {@code HomePage}'e bir
 * {@code add} işleyicisi eklemek de mümkündü ama yanlış olurdu: kullanıcı
 * düzenlediği gönderiden koparılır, işi bitince geri dönmek zorunda kalırdı.
 * Koleksiyon seçimi bir <b>karardır</b>, bir sayfa değil.
 *
 * <p>⚠️ Sunucu ucu zaten vardı ({@code POST /collections/{id}/posts}) ve
 * <b>idempotent</b>: aynı gönderi iki kez eklenirse sayaç şişmiyor. Bu yüzden
 * "zaten ekli mi" diye ayrıca sormuyoruz — ikinci tıklama zararsız.
 */
export function AddToCollectionDialog({
  postId,
  onClose,
}: {
  postId: string
  onClose: () => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [added, setAdded] = useState<string[]>([])

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [onClose])

  /* ⚠️ Sayfalama yok, tavan 100: koleksiyon listesi seçim için okunuyor ve
     yüzlerce koleksiyonu olan bir hesapta bile kaydırma yeterli. */
  const list = useQuery({
    queryKey: ['collections', 'picker'],
    queryFn: async () =>
      (await api.get<{ content: CollectionRow[] }>('/collections?page=0&size=100')).data.content,
  })

  const add = useMutation({
    mutationFn: async (collectionId: string) => {
      await api.post(`/collections/${collectionId}/posts`, { postId })
      return collectionId
    },
    onSuccess: (collectionId) => {
      setAdded((prev) => [...prev, collectionId])
      void qc.invalidateQueries({ queryKey: ['collections'] })
      void qc.invalidateQueries({ queryKey: ['collection-posts', collectionId] })
      toast.success(t('collection.added'))
    },
    // 🔴 Hata GÖRÜNÜR olmalı: yakalanmamış bir `await`, sessizce çalışmayan
    // bir düğme demekti (vault, 73. tur) — bu ekranın ilk hâlindeki hata da
    // tam olarak "hiçbir şey olmuyor" idi.
    onError: (e) => toast.error(apiErrorMessage(e, t('collection.addFailed'))),
  })

  const createAndAdd = useMutation({
    mutationFn: async (title: string) => {
      const res = await api.post<{ id: string }>('/collections', { title })
      await api.post(`/collections/${res.data.id}/posts`, { postId })
      return res.data.id
    },
    onSuccess: (id) => {
      setAdded((prev) => [...prev, id])
      setCreating(false)
      setNewTitle('')
      void qc.invalidateQueries({ queryKey: ['collections'] })
      toast.success(t('collection.added'))
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('collection.addFailed'))),
  })

  const rows = list.data ?? []
  const busy = add.isPending || createAndAdd.isPending

  return createPortal(
    <div
      className="waydee-sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t('post.addToCollection')}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="waydee-sheet">
        <div className="relative mb-5">
          <h2 className="waydee-sheet-title">{t('post.addToCollection')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute end-0 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {list.isLoading ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            {rows.length === 0 && !creating && (
              <p className="py-4 text-center text-[13px] text-muted">{t('home.noCollections')}</p>
            )}

            {rows.length > 0 && (
              <div className="max-h-[46vh] overflow-y-auto">
                {rows.map((c) => {
                  const done = added.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={busy || done}
                      onClick={() => add.mutate(c.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start transition-colors hover:bg-subtle disabled:opacity-60"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-subtle text-muted">
                        <FolderPlus className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{c.title}</span>
                        <span className="block text-[11px] font-medium text-faint">
                          {t('collection.itemCount', { count: c.itemCount })}
                        </span>
                      </span>
                      {done && <Check className="h-4 w-4 shrink-0 text-success" />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Yeni koleksiyon — akıştan çıkmadan. */}
            {creating ? (
              <div className="mt-3">
                <input
                  className="waydee-sheet-input"
                  placeholder={t('collection.namePlaceholder')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && createAndAdd.mutate(newTitle.trim())}
                  maxLength={120}
                  autoFocus
                />
                <div className="mt-3 flex items-center justify-end gap-4">
                  <button type="button" onClick={() => setCreating(false)} className="waydee-sheet-cancel">
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={!newTitle.trim() || busy}
                    onClick={() => createAndAdd.mutate(newTitle.trim())}
                    className="waydee-sheet-submit"
                  >
                    {t('common.create')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-subtle"
              >
                <Plus className="h-4 w-4" />
                {t('collection.createTitle')}
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
