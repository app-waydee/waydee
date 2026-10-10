import { Link } from 'react-router-dom'
import { profilePath } from '@/lib/profilePath'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@/components/ui/avatar'
import { Dialog } from '@/components/ui/dialog'
import { PageSpinner } from '@/components/ui/spinner'
import { getFollowers, getFollowing } from '@/lib/follow'

interface FollowListDialogProps {
  userId: string
  mode: 'followers' | 'following'
  onClose: () => void
}

export function FollowListDialog({ userId, mode, onClose }: FollowListDialogProps) {
  const query = useQuery({
    queryKey: ['follow-list', userId, mode],
    queryFn: () => (mode === 'followers' ? getFollowers(userId) : getFollowing(userId)),
  })
  const people = query.data ?? []

  return (
    <Dialog open onClose={onClose} title={mode === 'followers' ? 'Takipçiler' : 'Takip edilenler'}>
      <div className="max-h-[60vh] space-y-1 overflow-y-auto">
        {query.isLoading && <PageSpinner label="Yükleniyor…" />}
        {people.map((u) => (
          <Link
            key={u.id}
            to={profilePath(u)}
            onClick={onClose}
            className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-subtle"
          >
            <Avatar src={u.avatarUrl} name={u.displayName} className="h-11 w-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{u.displayName}</p>
              <p className="truncate text-[13px] font-medium text-faint">@{u.username}</p>
            </div>
          </Link>
        ))}
        {!query.isLoading && people.length === 0 && (
          <p className="py-8 text-center text-[13px] font-medium text-muted">
            {mode === 'followers' ? 'Henüz takipçi yok.' : 'Henüz kimseyi takip etmiyor.'}
          </p>
        )}
      </div>
    </Dialog>
  )
}
