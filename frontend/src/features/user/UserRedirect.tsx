import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageSpinner } from '@/components/ui/spinner'
import { getPublicUser } from '@/lib/analytics'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/i18n'

/**
 * <b>`/u/:userId` → `/{tag}` köprüsü.</b>
 *
 * <p>🔴 8 Ağu 2026 — kullanıcı uyardı: <i>"bu sayfa tasarımı hâlâ eskisi gibi,
 * onu da kaldırıp gerçek profil kısmı `/mustafa` bu kısım olacak"</i>.
 * Eski <code>UserProfilePage</code> (Instagram düzeni: başlık + sekmeler +
 * ızgara) <b>silindi</b>; tek gerçek profil artık vitrin profilidir
 * (<code>TagProfilePage</code>).
 *
 * <p>🔴 <b>Neden rota silinmedi de YÖNLENDİRMEYE çevrildi:</b> `/u/:id`
 * uygulamanın <b>on beş ayrı yerinde</b> kullanılıyor (bildirimler, arama,
 * takipçi listesi, harita kartı, aktivite akışı, engellenenler, raporlar,
 * trend şeridi…) ve bu çağıranların çoğunun elinde <b>yalnız kullanıcı
 * kimliği</b> var, kullanıcı adı yok. Rota silinseydi on beş yerde ölü
 * bağlantı kalırdı. Köprü kimliği bir kez ada çevirir; çağıranlar aynen
 * çalışmaya devam eder.
 *
 * <p>⚠️ <code>replace</code> ŞART: yönlendirme geçmişe yazılmamalı. Aksi
 * halde profilden geri tuşuna basan kullanıcı köprüye düşer, köprü onu
 * yeniden profile atar ve <b>geri tuşu kilitlenir</b>.
 *
 * <p>⚠️ Kendi profilimiz için sunucuya hiç sorulmaz — kullanıcı adı zaten
 * oturumda. Gereksiz bir istek ve gereksiz bir yükleme ekranı olurdu.
 */
export function UserRedirect() {
  const t = useT()
  const { userId } = useParams<{ userId: string }>()
  const me = useAuthStore((s) => s.user)

  const isMe = !!me && me.id === userId
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-user', userId],
    queryFn: () => getPublicUser(userId as string),
    enabled: !!userId && !isMe,
    staleTime: 5 * 60_000,
  })

  if (isMe) return <Navigate to={`/${me.username}`} replace />
  if (isLoading) return <PageSpinner />
  /*
   * 🔴 17 Ağu 2026 — ARTIK ANA SAYFAYA ATMIYOR.
   *
   * <b>Yaşanan hata:</b> kullanıcı aramadan ya da bildirimden bir profile
   * tıklıyor ve kendini <b>ana sayfada</b> buluyordu. Sebep bu satırdı:
   * profil çözülemeyince sessizce {@code /home}'a yönlendiriliyordu.
   *
   * Asıl kök neden ayrıca düzeltildi (arama ve trend yönetici hesabını
   * listeliyordu, {@code /users/id} ise onu 404 veriyordu) — ama <b>sessiz
   * yönlendirme kendi başına bir hatadır</b>: bir sonraki uyumsuzlukta da
   * kullanıcı sebebini anlamadan başka bir sayfaya savrulurdu.
   * Artık ne olduğu <b>yazıyor</b> ve geri dönüş kullanıcının kararı.
   *
   * ⚠️ Gizli hesap da buraya düşer (sunucu 403 verir); mesaj bilinçli olarak
   * nötr — hesabın var olup olmadığı sızmamalı.
   */
  if (isError || !data?.username) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <h3 className="text-lg font-semibold text-ink">{t('profile.notFound')}</h3>
        <p className="text-sm text-muted">{t('profile.notFoundHint')}</p>
        <Link to="/home" className="waydee-page-btn mt-2">
          {t('nav.home')}
        </Link>
      </div>
    )
  }
  return <Navigate to={`/${data.username}`} replace />
}
