import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { StoreCategoryIcon } from '@/components/StoreCategoryIcon'
import { api, apiErrorMessage } from '@/lib/api'
import { useStoreCategories, useStoreCategoryLabel } from '@/lib/storeCategories'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * <b>Kayıt sonrası "mağazan hangi alanda?" popup'ı</b> (V52, 24 Ağu 2026).
 *
 * <p>Kullanıcı talimatı: *"kaydolduktan sonra popup şeklinde kategorileri
 * soracağız mağazası için, bu bilgiyi mağazada kullanacağız, tutacağız o
 * bilgiyi"*.
 *
 * <h3>🔴 Popup'ı ne AÇAR — ve neden `storeCategoryId` DEĞİL</h3>
 * <p>Kapı sunucudan gelen {@code needsStoreCategory} bayrağıdır.
 * *"Kategorisi boş olana sor"* kuralı yazılsaydı, **geç** diyen kullanıcıya
 * popup <b>her açılışta</b> yeniden çıkardı: onun da kategorisi boştur.
 * Sorulmuş olmak ile cevaplanmış olmak farklı iki olaydır.
 *
 * <h3>⚠️ Cevap mağazaya değil KULLANICIYA yazılır</h3>
 * <p>Bu an kullanıcının mağazası <b>yoktur</b> — mağaza haritada bir yer
 * seçmeyi gerektirir ve Premium hakkıdır. Cevap kullanıcıda bekler ve mağaza
 * açıldığında oraya <b>tohum</b> olur.
 *
 * <h3>⚠️ "Geç" gerçek bir cevaptır</h3>
 * <p>Kapatmak da sunucuya gider ({@code categoryId: null}) — yalnız yerelde
 * kapatılsaydı sayfa yenilendiğinde geri gelirdi.
 */
interface Props {
  onDone: () => void
}

export function StoreCategoryDialog({ onDone }: Props) {
  const t = useT()
  const label = useStoreCategoryLabel()
  const queryClient = useQueryClient()
  const { data: categories, isLoading } = useStoreCategories()
  const [selected, setSelected] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (categoryId: string | null) => {
      /* ⚠️ PUT: gövde alanın TAMAMIDIR ve `null` burada "dokunma" değil
         "geç" demektir. PATCH sözleşmesinde null "dokunma"dır. */
      await api.put('/store-categories/me', { categoryId })
    },
    onSuccess: async () => {
      /* 🔴 `needsStoreCategory` oturum yanıtında duruyor; tazelenmezse popup
         aynı oturumda yeniden açılırdı. */
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      onDone()
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('common.failed'))),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm md:items-center md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label={t('category.promptTitle')}
        className="waydee-cat-dialog"
      >
        <div className="px-5 pt-5">
          <p className="text-[17px] font-black leading-tight">{t('category.promptTitle')}</p>
          <p className="mt-1 text-[13px] font-medium leading-snug text-muted">
            {t('category.promptBody')}
          </p>
        </div>

        <div className="max-h-[46vh] overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(categories ?? []).map((category) => {
                const active = selected === category.id
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelected(active ? null : category.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border p-3 transition-colors',
                      active
                        ? 'border-transparent bg-ink text-on-ink'
                        : 'border-line bg-surface text-ink hover:bg-subtle',
                    )}
                  >
                    <span
                      className="grid h-10 w-10 place-items-center rounded-full"
                      style={{ background: `color-mix(in srgb, ${category.color} 18%, transparent)` }}
                    >
                      <StoreCategoryIcon
                        name={category.icon}
                        className="h-5 w-5"
                        color={category.color}
                      />
                    </span>
                    <span className="text-center text-[12.5px] font-bold leading-tight">
                      {label(category)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
          <Button
            variant="ghost"
            className="flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(null)}
          >
            {t('category.skip')}
          </Button>
          <Button
            className="flex-1"
            disabled={mutation.isPending || selected === null}
            onClick={() => mutation.mutate(selected)}
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {t('common.save')}
          </Button>
        </footer>
      </motion.div>
    </div>
  )
}
