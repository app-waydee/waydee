import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { acceptRequest, getFollowRequests, rejectRequest } from '@/lib/follow'

/** Bekleyen takip istekleri (gizli hesap). İstek yoksa hiçbir şey göstermez. */
export function FollowRequests() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['follow-requests'], queryFn: getFollowRequests })
  const requests = query.data ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['follow-requests'] })
  }

  const accept = useMutation({
    mutationFn: acceptRequest,
    onSuccess: invalidate,
    onError: (e) => toast.error(apiErrorMessage(e)),
  })
  const reject = useMutation({
    mutationFn: rejectRequest,
    onSuccess: invalidate,
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  if (requests.length === 0) return null

  return (
    <Card className="p-5 md:p-6">
      <CardTitle>Takip istekleri</CardTitle>
      <div className="space-y-2">
        {requests.map((u) => (
          <div key={u.id} className="flex items-center gap-3">
            <Avatar src={u.avatarUrl} name={u.displayName} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{u.displayName}</p>
              <p className="truncate text-[13px] font-medium text-faint">@{u.username}</p>
            </div>
            <button
              onClick={() => accept.mutate(u.id)}
              disabled={accept.isPending || reject.isPending}
              className="grid h-9 w-9 place-items-center rounded-full bg-success text-white transition-transform hover:scale-105 disabled:opacity-60"
              aria-label="Onayla"
            >
              <Check className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => reject.mutate(u.id)}
              disabled={accept.isPending || reject.isPending}
              className="grid h-9 w-9 place-items-center rounded-full bg-subtle text-muted transition-colors hover:text-danger disabled:opacity-60"
              aria-label="Reddet"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  )
}
