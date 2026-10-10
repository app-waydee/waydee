import { useEffect } from 'react'
import { profilePath } from '@/lib/profilePath'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellOff, Check, Eye, Trash2, UserPlus, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { acceptRequest, getFollowRequests, rejectRequest } from '@/lib/follow'
import {
  deleteAllNotifications,
  deleteNotification,
  getNotifications,
  markAllRead,
} from '@/lib/notifications'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { NotificationResponse } from '@/types/api'

interface NotificationsPanelProps {
  /** Panel açılınca tümünü okundu işaretle (zil rozetini sıfırlar). */
  markOnMount?: boolean
  /** Bir bağlantıya gidilince çağrılır (popup'ı kapatmak için). */
  onNavigate?: () => void
  /** Liste yüksekliği sınırı (popup'ta scroll, sayfada serbest). */
  compact?: boolean
}

/**
 * Bildirimler + takip istekleri — zil popup'ında ve /me panelinde aynı bileşen.
 * Takip istekleri buradan onaylanır/reddedilir.
 */
export function NotificationsPanel({ markOnMount = false, onNavigate, compact = false }: NotificationsPanelProps) {
  const queryClient = useQueryClient()

  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: getNotifications })
  const requestsQuery = useQuery({ queryKey: ['follow-requests'], queryFn: getFollowRequests })

  useEffect(() => {
    if (!markOnMount) return
    void markAllRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markOnMount])

  const invalidateFollow = () => {
    void queryClient.invalidateQueries({ queryKey: ['follow-requests'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }
  const accept = useMutation({
    mutationFn: acceptRequest,
    onSuccess: invalidateFollow,
    onError: (e) => toast.error(apiErrorMessage(e)),
  })
  const reject = useMutation({
    mutationFn: rejectRequest,
    onSuccess: invalidateFollow,
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  /*
   * 🔴 21 Ağu 2026 — BİLDİRİM SİLME (kullanıcı: *"bildirimlerin sağına X
   * işareti koy silebilesin veya tamamen hepsini silsin"*).
   *
   * ⚠️ <b>İyimser güncelleme</b>: satır sunucudan cevap beklemeden listeden
   * düşer. X'e basıp bir şeyin olmasını beklemek, silmenin çalışmadığı hissi
   * verirdi. Hata olursa liste geçersizleştirilir ve satır geri gelir — yani
   * yalan söylemiyoruz, yalnız sırayı tersine çeviriyoruz.
   * ⚠️ Okunmamış sayacı da tazelenir: silinen bildirim okunmamışsa zilin
   * rozeti fazladan sayardı.
   */
  const refreshBadges = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
  }
  const remove = useMutation({
    mutationFn: deleteNotification,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const previous = queryClient.getQueryData<NotificationResponse[]>(['notifications'])
      queryClient.setQueryData<NotificationResponse[]>(['notifications'], (old) =>
        (old ?? []).filter((n) => n.id !== id),
      )
      return { previous }
    },
    onError: (e, _id, context) => {
      /* Sunucu reddetti: listeyi ELDEKİ kopyayla geri al — geçersizleştirmek
         yeterli değil, kullanıcı satırın kaybolup geri gelmesini görürdü. */
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous)
      toast.error(apiErrorMessage(e))
    },
    onSettled: refreshBadges,
  })
  const removeAll = useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      queryClient.setQueryData<NotificationResponse[]>(['notifications'], [])
      refreshBadges()
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  const requests = requestsQuery.data ?? []
  const notifications = notificationsQuery.data ?? []
  const busy = accept.isPending || reject.isPending

  return (
    <div className={cn('space-y-4', compact && 'max-h-[60vh] overflow-y-auto overscroll-contain pr-1')}>
      {/* Takip istekleri — buradan onaylanır */}
      {requests.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Takip istekleri</p>
          <div className="space-y-2">
            {requests.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5">
                <Link to={profilePath(u)} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Avatar src={u.avatarUrl} name={u.displayName} className="h-9 w-9" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{u.displayName}</span>
                    <span className="block truncate text-xs font-medium text-faint">@{u.username}</span>
                  </span>
                </Link>
                <button
                  onClick={() => accept.mutate(u.id)}
                  disabled={busy}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success text-white transition-transform hover:scale-105 disabled:opacity-60"
                  aria-label="Onayla"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => reject.mutate(u.id)}
                  disabled={busy}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-subtle text-muted transition-colors hover:text-danger disabled:opacity-60"
                  aria-label="Reddet"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bildirimler */}
      <div>
        {/* ⚠️ Başlık satırı artık HER ZAMAN var (eskiden yalnız takip isteği
            varsa çıkıyordu): "Tümünü sil" düğmesinin duracağı bir yer gerekiyor
            ve o düğme yalnız silinecek bir şey varken görünmeli. */}
        {(requests.length > 0 || notifications.length > 0) && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Bildirimler</p>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => removeAll.mutate()}
                disabled={removeAll.isPending}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-faint transition-colors hover:bg-subtle hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Tümünü sil
              </button>
            )}
          </div>
        )}
        {notificationsQuery.isLoading && <Spinner className="mx-auto my-4" />}
        {!notificationsQuery.isLoading && notifications.length === 0 && (
          <div className="flex items-center gap-2.5 rounded-xl bg-subtle px-4 py-3.5 text-[13px] font-medium text-muted">
            <BellOff className="h-4 w-4 shrink-0" /> Henüz bildirimin yok.
          </div>
        )}
        <div className="space-y-1">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onNavigate={onNavigate}
              onDelete={() => remove.mutate(n.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificationRow({
  notification: n,
  onNavigate,
  onDelete,
}: {
  notification: NotificationResponse
  onNavigate?: () => void
  onDelete: () => void
}) {
  /* 🔴 24 Ağu 2026 — profil görüntüleme bildirimi KALDIRILDI (sunucu artık
     üretmiyor, eskiler V54 ile silindi). Yol seçimi yine de bu türü
     tanımaya devam ediyor: sunucunun geçmişine güvenip artık bir satırı
     tıklanamaz bırakmak, kullanıcı için "bozuk bildirim" demekti. */
  const isView = n.type === 'PROFILE_VIEW'
  /* Gönderi bildirimi gönderiye gider; kişi profiline değil. Kullanıcı
     "kim" değil "hangi gönderim" sorusunun peşinde. */
  /*
   * ⚠️ Görüntüleme bildirimi RAPORA yalnız sayılacak bir bölge varsa gider.
   * Bölgesi olmayan kullanıcı raporda 0 görür ve *"hani görüntüleme?"* der —
   * yaşanmış bir şikâyet. O durumda bakan kişinin profiline gitmek, bildirimin
   * gerçekten cevapladığı soruya ("kim baktı?") götürür.
   */
  const to = n.postId
    ? `/posts/${n.postId}`
    : isView
      ? n.territoryId
        ? '/reports'
        : n.actor
          ? profilePath(n.actor)
          : '/reports'
      : n.actor
        ? profilePath(n.actor)
        : '/notifications'
  const text =
    n.type === 'FOLLOW'
      ? 'seni takip etmeye başladı'
      : n.type === 'FOLLOW_REQUEST'
        ? 'sana takip isteği gönderdi'
        : n.type === 'FOLLOW_ACCEPTED'
          ? 'takip isteğini kabul etti'
          : n.type === 'POST_LIKE'
            ? 'gönderini beğendi'
            : n.type === 'POST_SAVE'
              ? 'gönderini kaydetti'
              : n.territoryName
                ? `${n.territoryName} mağazanı görüntüledi`
                : /* 🔴 Bölgesi olmayan kullanıcıya "bölgeni görüntüledi" demek
                     YANLIŞTI: ziyaret edilen şey profilidir ve raporda
                     sayılacak bir bölge yoktur. Cümle artık gerçeği söylüyor. */
                  'profilini görüntüledi'

  return (
    /* ⚠️ X, `Link`in İÇİNDE olamaz: iç içe tıklanabilir öğe hem erişilebilirlik
       hatasıdır hem de silmeye basınca gezinme tetiklenirdi. Satır bir kapsayıcı,
       bağlantı ve düğme kardeştir. */
    <div
      className={cn(
        'group flex items-center gap-1 rounded-xl transition-colors hover:bg-subtle',
        !n.read && 'bg-sky-soft/50',
      )}
    >
      <Link
        to={to}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2"
      >
        {n.actor ? (
          <Avatar src={n.actor.avatarUrl} name={n.actor.displayName} className="h-9 w-9 shrink-0" />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-subtle text-muted">
            {isView ? <Eye className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          </span>
        )}
        <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug">
          {n.actor && <b className="font-semibold">{n.actor.displayName}</b>} {text}
          <span className="block text-xs text-faint">{timeAgo(n.createdAt)}</span>
        </span>
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
      </Link>
      {/* ⚠️ Dokunmatikte `group-hover` yoktur; düğme MOBİLDE HER ZAMAN görünür,
          masaüstünde satırın üstüne gelince belirginleşir. Yalnız hover'a
          bağlamak, telefonda silmeyi imkânsız kılardı. */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Bildirimi sil"
        className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-danger/10 hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
