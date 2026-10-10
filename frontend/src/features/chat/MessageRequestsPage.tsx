import { Link, useNavigate } from 'react-router-dom'
import { profilePath } from '@/lib/profilePath'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Inbox, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { acceptMessageRequest, getMessageRequests, rejectMessageRequest } from '@/lib/chat'
import { timeAgo } from '@/lib/format'

/** Takip etmeyen birinin attığı ilk mesajlar burada bekler (Instagram "mesaj istekleri"). */
export function MessageRequestsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['message-requests'], queryFn: getMessageRequests })
  const requests = query.data ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['message-requests'] })
    void queryClient.invalidateQueries({ queryKey: ['message-request-count'] })
    void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    void queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
  }

  const accept = useMutation({
    mutationFn: acceptMessageRequest,
    onSuccess: (_d, id) => {
      invalidate()
      navigate(`/chat/${id}`)
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })
  const reject = useMutation({
    mutationFn: rejectMessageRequest,
    onSuccess: () => {
      invalidate()
      toast.info('İstek reddedildi')
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })
  const busy = accept.isPending || reject.isPending

  return (
    <div className="min-h-full bg-canvas pb-6">
      <div className="mx-auto max-w-2xl px-4 md:px-6">
        <div className="mb-4 mt-2 flex items-center gap-2">
          <Link
            to="/chat"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-subtle"
            aria-label="Sohbetlere dön"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Mesaj istekleri</h1>
        </div>

        {query.isLoading && <PageSpinner label="İstekler yükleniyor…" />}

        {!query.isLoading && requests.length === 0 && (
          <Card className="p-10 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-subtle text-muted">
              <Inbox className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold tracking-tight">Bekleyen isteğin yok</p>
            <p className="mt-1.5 text-sm font-medium text-muted">
              Seni takip etmeyen birinin ilk mesajı burada belirir.
            </p>
          </Card>
        )}

        {requests.length > 0 && (
          <Card className="divide-y divide-line p-2">
            {requests.map((c) => (
              <div key={c.id} className="p-3">
                <Link to={profilePath(c.other)} className="flex items-center gap-3">
                  <Avatar src={c.other.avatarUrl} name={c.other.displayName} className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{c.other.displayName}</p>
                      {c.lastMessageAt && (
                        <span className="shrink-0 text-xs font-medium text-faint">{timeAgo(c.lastMessageAt)}</span>
                      )}
                    </div>
                    <p className="truncate text-[13px] font-medium text-muted">@{c.other.username}</p>
                  </div>
                </Link>
                {c.lastMessagePreview && (
                  <p className="mt-2 rounded-xl bg-subtle px-3.5 py-2.5 text-[13px] font-medium text-muted">
                    {c.lastMessagePreview}
                  </p>
                )}
                <div className="mt-2.5 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 justify-center"
                    disabled={busy}
                    onClick={() => accept.mutate(c.id)}
                  >
                    <Check className="h-4 w-4" /> Kabul et
                  </Button>
                  <Button
                    size="sm"
                    variant="subtle"
                    className="flex-1 justify-center"
                    disabled={busy}
                    onClick={() => reject.mutate(c.id)}
                  >
                    <X className="h-4 w-4" /> Sil
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
