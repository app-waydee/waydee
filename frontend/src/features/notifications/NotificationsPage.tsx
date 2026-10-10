import { useEffect, type ReactNode } from 'react'
import { profilePath } from '@/lib/profilePath'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, UserPlus, Heart } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/spinner'
import { getNotifications, markAllRead } from '@/lib/notifications'
import { timeAgo } from '@/lib/format'
import type { NotificationResponse } from '@/types/api'

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['notifications'], queryFn: getNotifications })
  const items = query.data ?? []

  useEffect(() => {
    markAllRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }))
      .catch(() => {})
  }, [queryClient])

  /* ⚠️ İKİ öbek: ilişki · gönderi. Gönderi bildirimlerini "takip" kutusuna
     koymak, iki farklı olay ailesini aynı başlık altında karıştırırdı.

     🔴 24 Ağu 2026 — "Görüntülemeler" öbeği KALDIRILDI: profil görüntüleme
     artık bildirim üretmiyor (kullanıcı isteği), yalnız raporda görünüyor.
     Öbeği bırakmak, hiçbir zaman dolmayacak bir başlık olurdu.

     ⚠️ Süzgeç yine de `PROFILE_VIEW`'i ELER: sunucu yenisini üretmiyor ve
     eskiler V54 ile silindi, ama istemci sunucunun geçmişine güvenmemeli —
     tek bir artık satır "Takip" başlığı altında görünürdü. */
  const posts = items.filter((n) => n.type === 'POST_LIKE' || n.type === 'POST_SAVE')
  const follows = items.filter((n) => n.type !== 'PROFILE_VIEW' && !posts.includes(n))

  return (
    <div className="min-h-full bg-canvas pb-16">
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight md:text-3xl">Bildirimler</h1>

        {query.isLoading && <PageSpinner label="Yükleniyor…" />}

        {!query.isLoading && items.length === 0 && (
          <Card className="p-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-faint" />
            <p className="mt-3 text-lg font-semibold tracking-tight">Henüz bildirim yok</p>
            <p className="mt-1 text-sm font-medium text-muted">Beğeniler, kaydetmeler ve takipler burada görünecek.</p>
          </Card>
        )}

        {follows.length > 0 && (
          <Section icon={<UserPlus className="h-4 w-4" />} title="Takip">
            {follows.map((n) => <Row key={n.id} n={n} />)}
          </Section>
        )}
        {posts.length > 0 && (
          <Section icon={<Heart className="h-4 w-4" />} title="Gönderilerin">
            {posts.map((n) => <Row key={n.id} n={n} />)}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="mb-5 p-4 md:p-5">
      <div className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-faint">
        {icon} {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </Card>
  )
}

function Row({ n }: { n: NotificationResponse }) {
  const name = n.actor?.displayName ?? 'Biri'
  const suffix =
    n.type === 'FOLLOW'
      ? ' seni takip etmeye başladı'
      : n.type === 'FOLLOW_REQUEST'
        ? ' seni takip etmek istiyor'
        : n.type === 'FOLLOW_ACCEPTED'
          ? ' takip isteğini kabul etti'
          : n.type === 'POST_LIKE'
            ? ' gönderini beğendi'
            : n.type === 'POST_SAVE'
              ? ' gönderini kaydetti'
              : `, ${n.territoryName ?? 'bir bölgeni'} görüntüledi`

  const avatar = <Avatar src={n.actor?.avatarUrl ?? null} name={name} className="h-11 w-11" />

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-subtle ${n.read ? '' : 'bg-sky-soft/40'}`}>
      {n.actor ? <Link to={profilePath(n.actor)}>{avatar}</Link> : avatar}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {n.actor ? (
            <Link to={profilePath(n.actor)} className="font-semibold hover:underline">
              {name}
            </Link>
          ) : (
            <span className="font-semibold">{name}</span>
          )}
          <span className="font-medium text-muted">{suffix}</span>
        </p>
        <p className="text-xs font-medium text-faint">{timeAgo(n.createdAt)}</p>
      </div>
      {/* Gönderi bildirimi doğrudan o gönderiye götürür — "hangi fotoğrafım"
          sorusunun cevabı bir tık ötede olmalı. */}
      {n.postId && (
        <Link to={`/posts/${n.postId}`} className="shrink-0 text-[13px] font-semibold text-accent hover:underline">
          Gönderi
        </Link>
      )}
      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
    </div>
  )
}
