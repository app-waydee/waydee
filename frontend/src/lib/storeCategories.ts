import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { publicApi } from '@/lib/publicApi'
import type { StoreCategory } from '@/types/api'
import { useT } from '@/i18n'

/**
 * <b>Mağaza kategorileri</b> (V52) — tek veri kaynağı.
 *
 * <p>🔴 Kategoriler <b>veritabanında</b> durur ve yönetici ekleyip
 * çıkarabilir; bu yüzden istemcide sabit bir dizi <b>yoktur</b>. Sabit dizi
 * yazmak, "eklenip çıkarılabilir olsun" isteğini yarım bırakırdı: yönetici
 * kategori eklerdi ama haritada çıkmazdı.
 *
 * <p>⚠️ Liste uzun süre taze sayılır (`staleTime`). Kategoriler yılda birkaç
 * kez değişir; her ekran açılışında yeniden istemek, hiç değişmeyen 11 satır
 * için ağ trafiği üretmekten başka bir şey yapmazdı.
 */
const STALE = 10 * 60 * 1000

export function useStoreCategories() {
  return useQuery({
    queryKey: ['store-categories'],
    queryFn: async (): Promise<StoreCategory[]> => {
      const { data } = await api.get<StoreCategory[]>('/store-categories')
      return data
    },
    staleTime: STALE,
  })
}

/**
 * Vitrin (kimliksiz) haritasının kategori şeridi.
 *
 * ⚠️ Ayrı bir uç: `/public/**` yalnız GET için açıktır ve oturumlu istemci
 * her isteğe Authorization ekler — ziyaretçide oturum yoktur.
 */
export function usePublicStoreCategories() {
  return useQuery({
    queryKey: ['store-categories', 'public'],
    queryFn: async (): Promise<StoreCategory[]> => {
      const { data } = await publicApi.get<StoreCategory[]>('/store-categories')
      return data
    },
    staleTime: STALE,
  })
}

/**
 * Kategorinin GÖSTERİLECEK adı.
 *
 * 🔴 Sunucudaki `name` bir <b>yedektir</b>, gösterilecek ad değildir. Çekirdek
 * kategorilerin adı beş dilde sözlükte durur (`storeCategory.FASHION`);
 * yöneticinin sonradan eklediği kategorinin sözlükte karşılığı olmaz ve
 * `name`e düşer. Sunucudan beş dil göndermek sözlüğü ikiye bölmek olurdu.
 */
export function useStoreCategoryLabel() {
  const t = useT()
  return (category: Pick<StoreCategory, 'code' | 'name'> | null | undefined): string => {
    if (!category) return ''
    const key = `storeCategory.${category.code}`
    const translated = t(key as never)
    /* ⚠️ `t()` bilinmeyen anahtarda anahtarın KENDİSİNİ döndürür; eşitlik
       kontrolü "sözlükte yok" demenin tek güvenilir yolu. */
    return translated === key ? category.name : translated
  }
}
