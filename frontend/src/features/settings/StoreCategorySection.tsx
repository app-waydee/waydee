import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { StoreCategoryIcon } from '@/components/StoreCategoryIcon'
import { api, apiErrorMessage } from '@/lib/api'
import { useStoreCategories, useStoreCategoryLabel } from '@/lib/storeCategories'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { UserResponse } from '@/types/api'

/**
 * <b>Ayarlar → Mağaza alanım</b> (V52, 24 Ağu 2026).
 *
 * <p>Kullanıcı talimatı: *"o alan değiştirilebilir olsun ayarlar kısmında"*.
 *
 * <h3>⚠️ Burası MAĞAZANIN kategorisini değiştirmez</h3>
 * <p>Değiştirdiği şey kullanıcının <b>cevabıdır</b> — mağaza açılırken
 * tohum olan alan. Mağazası olan kullanıcı mağazasının kategorisini
 * <b>haritadaki düzenleme panelinden</b> değiştirir; ikisi bilerek
 * ayrıdır ve bölümün altındaki not bunu söyler. Tek alana indirilseydi
 * ayarlardan alanını değiştiren kullanıcının haritadaki mağazası da
 * habersizce değişirdi.
 */
export function StoreCategorySection() {
  const t = useT()
  const label = useStoreCategoryLabel()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { data: categories, isLoading } = useStoreCategories()
  const [saving, setSaving] = useState<string | null>(null)

  async function choose(categoryId: string) {
    /* Aynı karoya ikinci dokunuş seçimi KALDIRIR — kullanıcı "hiçbiri"
       diyebilmeli ve bunun için ayrı bir düğme koymak listeyi uzatırdı. */
    const next = user?.storeCategoryId === categoryId ? null : categoryId
    setSaving(categoryId)
    try {
      await api.put('/store-categories/me', { categoryId: next })
      /* 🔴 Oturum görüntüsü sunucudan TAZELENİR, elle yamalanmaz: bu uç
         `needsStoreCategory` bayrağını da düşürüyor ve onu istemcide
         türetmek iki gerçeğin ayrışmasına açık kapı bırakırdı. */
      const { data } = await api.get<UserResponse>('/users/me')
      setUser(data)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success(t('category.saved'))
    } catch (error) {
      toast.error(apiErrorMessage(error, t('common.failed')))
    } finally {
      setSaving(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <p className="text-[13px] font-medium leading-snug text-muted">{t('category.settingsDesc')}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(categories ?? []).map((category) => {
          const active = user?.storeCategoryId === category.id
          return (
            <button
              key={category.id}
              type="button"
              disabled={saving !== null}
              onClick={() => void choose(category.id)}
              aria-pressed={active}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-colors disabled:opacity-60',
                active
                  ? 'border-transparent bg-ink text-on-ink'
                  : 'border-line bg-surface text-ink hover:bg-subtle',
              )}
            >
              {saving === category.id ? (
                <Spinner className="absolute right-2 top-2 h-3.5 w-3.5" />
              ) : active ? (
                <Check className="absolute right-2 top-2 h-3.5 w-3.5" />
              ) : null}
              <span
                className="grid h-10 w-10 place-items-center rounded-full"
                style={{ background: `color-mix(in srgb, ${category.color} 18%, transparent)` }}
              >
                <StoreCategoryIcon name={category.icon} className="h-5 w-5" color={category.color} />
              </span>
              <span className="text-center text-[12.5px] font-bold leading-tight">
                {label(category)}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-[12px] font-medium leading-snug text-faint">
        {t('category.settingsStoreNote')}
      </p>
    </div>
  )
}
