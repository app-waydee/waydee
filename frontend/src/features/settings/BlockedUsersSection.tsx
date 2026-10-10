import { Link } from 'react-router-dom'
import { profilePath } from '@/lib/profilePath'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldOff } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { getMyBlocks, unblockUser } from '@/lib/blocks'
import { fmtDate } from '@/lib/format'

/**
 * Engellenen kullanıcılar — ayarlar bölümü.
 *
 * Engel kaldırıldığında takip ilişkisi **geri gelmez** (engellerken iki yönde de
 * silinir); kullanıcılar yeniden takip etmek zorundadır. Bu bilinçlidir ve
 * kullanıcıya açıkça yazılır.
 */
export function BlockedUsersSection() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['my-blocks'], queryFn: getMyBlocks })

  const remove = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-blocks'] })
      // Profil düğmeleri ve ilişki durumları da tazelenmeli.
      void queryClient.invalidateQueries({ queryKey: ['relationship'] })
      toast.success('Engel kaldırıldı')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Engel kaldırılamadı')),
  })

  if (isLoading) return <Spinner />

  const blocks = data ?? []

  if (blocks.length === 0) {
    return (
      <div className="rounded-xl bg-subtle p-5 text-center">
        <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-surface text-faint">
          <ShieldOff className="h-4 w-4" />
        </span>
        <p className="text-[13px] font-semibold">Engellediğin kimse yok</p>
        <p className="mt-0.5 text-xs font-medium text-faint">
          Bir profildeki “…” menüsünden kullanıcıyı engelleyebilirsin.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="divide-y divide-line">
        {blocks.map((row) => (
          <div key={row.user.id} className="flex items-center gap-2.5 py-2.5">
            <Link to={profilePath(row.user)}>
              <Avatar src={row.user.avatarUrl} name={row.user.displayName} className="h-9 w-9" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={profilePath(row.user)} className="block truncate text-[13px] font-semibold hover:underline">
                {row.user.displayName}
              </Link>
              <p className="truncate text-[11px] font-medium text-faint">
                @{row.user.username} · {fmtDate(row.blockedAt)}
                {row.reason ? ` · ${row.reason}` : ''}
              </p>
            </div>
            <Button
              variant="stroke"
              size="sm"
              disabled={remove.isPending}
              onClick={() => remove.mutate(row.user.id)}
            >
              Kaldır
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs font-medium leading-snug text-faint">
        Engellediğin kişiler seni takip edemez, mesaj atamaz ve içeriğini göremez. Engeli kaldırsan
        da eski takip ilişkisi geri gelmez.
      </p>
    </div>
  )
}
