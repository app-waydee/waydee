import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { follow, unfollow } from '@/lib/follow'
import type { RelationshipResponse } from '@/types/api'

/**
 * <b>Takip et / bırak — TEK KAYNAK</b> (18 Ağu 2026).
 *
 * <h3>🔴 Neden bu dosya var</h3>
 * <p>Takip eylemi <b>üç ayrı yüzeyde</b> ayrı ayrı yazılmıştı
 * ({@code TagProfilePage}, {@code FollowButton}, {@code TerritoryCard}) ve her
 * biri kendi tazeleme listesini tutuyordu. Sonuç ölçüldü ve kullanıcı bildirdi:
 * <i>"takip ediyorum ama profildeki rakamlar güncellenmiyor"</i>.
 *
 * <p>Kök neden basit ve tam olarak beklenen türden: vitrin profilindeki takip
 * düğmesi yalnız {@code relationship} ve {@code story-feed}'i tazeliyordu.
 * Takipçi <b>sayısı</b> ise profil yanıtından geliyor ({@code tag-profile}) ve
 * o sorgu <b>hiç</b> geçersizleştirilmiyordu — düğme "Takiptesin"e dönüyor ama
 * yanındaki sayı eski kalıyordu.
 *
 * <p>Bu, 88. turdaki dersin aynısı: <b>bir işi tek yerde yapmıyorsan tüm
 * yüzeyleri saymak zorundasın</b> — ve er geç biri unutulur. Burada iş tek bir
 * kancaya alındı; dördüncü bir takip düğmesi eklendiğinde tazeleme onunla
 * birlikte <b>bedavaya</b> gelir.
 *
 * <h3>Neyi tazeliyor ve neden</h3>
 * <ul>
 *   <li><b>{@code relationship}</b> — düğmenin kendi durumu.</li>
 *   <li><b>{@code tag-profile}</b> — vitrin profilindeki <b>takipçi sayacı</b>.
 *       Şikâyetin doğrudan sebebi buydu.</li>
 *   <li><b>{@code public-user} / {@code territory-card}</b> — aynı sayıyı
 *       gösteren diğer profil yüzeyleri.</li>
 *   <li><b>{@code relationship}</b> aynı zamanda <b>kendi</b> sayaçlarımı da
 *       besler: {@code /me} ekranı takipçi/takip sayısını
 *       {@code ['relationship', benimId]} sorgusundan okuyor. Ayrı bir
 *       "my-profile" anahtarı YOKTUR — listeye yazılmıştı, diskten
 *       doğrulanınca kaldırıldı (var olmayan bir anahtarı geçersizleştirmek
 *       sessiz bir hiçliktir ve listeyi okuyanı yanıltır).</li>
 *   <li><b>{@code story-feed}</b> — şerit "takip ettiklerim" kapsamıyla beslenir.</li>
 *   <li><b>{@code followers} / {@code following}</b> — açık bir liste varsa.</li>
 * </ul>
 *
 * <p>⚠️ Anahtarlar <b>ön ek</b> olarak verilir: React Query varsayılan olarak
 * ön ekle eşleşir, yani {@code ['tag-profile', tag, viewerId]} gibi uzun
 * anahtarlar da yakalanır. Tam anahtarı burada yeniden kurmaya çalışmak,
 * çağıran ekranın anahtar şemasını bu dosyaya sızdırırdı.
 *
 * <p>⚠️ Sayaç <b>iyimser olarak artırılmaz</b>. Gizli hesapta "takip et" bir
 * <b>istektir</b> ({@code requested}) ve takipçi sayısını <b>değiştirmez</b>;
 * istemcide +1 yazmak, kabul edilene kadar yalan söylemek olurdu. Doğru sayıyı
 * sunucu bilir — biz yalnız yeniden soruyoruz.
 */
const KEYS_TO_REFRESH = [
  ['relationship'],
  ['tag-profile'],
  ['public-user'],
  ['territory-card'],
  ['story-feed'],
  ['followers'],
  ['following'],
] as const

interface Options {
  /** Düğmenin kendi yerel durumunu güncellemesi için (varsa). */
  onChanged?: (relationship: RelationshipResponse) => void
}

export function useFollowMutation(userId: string, isFollowing: boolean, options: Options = {}) {
  const qc = useQueryClient()
  const { onChanged } = options

  return useMutation({
    mutationFn: () => (isFollowing ? unfollow(userId) : follow(userId)),
    onSuccess: (next) => {
      // Düğme anında dönsün: sunucunun döndüğü ilişki doğrudan yazılır.
      qc.setQueryData(['relationship', userId], next)
      onChanged?.(next)
      for (const key of KEYS_TO_REFRESH) {
        void qc.invalidateQueries({ queryKey: key as unknown as string[] })
      }
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'İşlem tamamlanamadı')),
  })
}
