import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageSpinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { useT } from '@/i18n'
import type { TerritoryResponse } from '@/types/api'

/**
 * <b>`/t/:territoryId` → sahibinin profili.</b>
 *
 * <p>🔴 <b>Neden koca bir sayfa silinip yerine bu kondu:</b> daireye tıklayınca
 * açılan ekran <b>bölgenin kendi mini sitesiydi</b> — kiralama bilgisi, alan,
 * bölge etiketi, gömülü web sitesi / kullanıcı HTML'i seçenekleri, anket ve
 * etkinlik gönderileri, bölgeye özel gönderi yazma kutusu. Daire artık km²
 * ile satılan bir "yer" değil, <b>Premium üyenin mağazası</b>; arkasında
 * duran şey bir <b>kişi</b>. Kullanıcının söylediği buydu: "dairelerde kişi
 * profili olacak".
 *
 * <p>Kişi profili zaten var ve olgun: vitrin profili (<code>/{'{'}tag{'}'}</code>) —
 * gönderiler, koleksiyonlar, bağlantılar, sosyal ikonlar, takip. İkinci bir
 * profil ekranı yazmak, aynı şeyin bakımı zor bir kopyasını üretmek olurdu.
 * Bu yüzden burada <b>yönlendirme</b> var, yeni bir ekran değil.
 *
 * <p>⚠️ <code>replace</code>: kullanıcı profilden geri tuşuna basınca haritaya
 * dönmeli, aradaki yönlendirme adımına değil (yoksa geri tuşu sonsuz döngüye
 * benzer bir zıplama üretir).
 *
 * <p>⚠️ Bölge bulunamazsa haritaya düşülür — 404 ekranı basmak, elinde eski
 * bir bağlantı olan kullanıcıyı çıkmaza sokardı.
 */
export function StoreRedirect() {
  const { territoryId } = useParams<{ territoryId: string }>()
  const t = useT()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['territory-owner', territoryId],
    queryFn: async () =>
      (await api.get<TerritoryResponse>(`/territories/${territoryId}`)).data,
    enabled: !!territoryId,
    retry: false,
  })

  if (isLoading) return <PageSpinner label={t('feed.loading')} />
  if (isError || !data?.ownerUsername) return <Navigate to="/map" replace />
  return <Navigate to={`/${data.ownerUsername}`} replace />
}
