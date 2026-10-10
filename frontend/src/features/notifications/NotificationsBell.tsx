import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { getUnreadCount } from '@/lib/notifications'
import { NotificationsPanel } from './NotificationsPanel'

/**
 * Bildirim zili — tıklayınca sayfaya gitmek yerine minimal bir popup düşer:
 * bildirimler + takip istekleri (onay/red buradan). Açılınca okundu sayılır.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const query = useQuery({ queryKey: ['notifications-unread'], queryFn: getUnreadCount, refetchInterval: 30_000 })
  const count = query.data ?? 0

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface shadow-card transition-colors hover:bg-subtle"
        aria-label="Bildirimler"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Dış tıklama perdesi */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-16 z-50 rounded-card bg-surface p-4 shadow-float md:absolute md:inset-x-auto md:right-0 md:top-11 md:w-[380px]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">Bildirimler</h3>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="text-[13px] font-semibold text-accent hover:underline"
              >
                Tümünü gör
              </Link>
            </div>
            <NotificationsPanel markOnMount compact onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}
