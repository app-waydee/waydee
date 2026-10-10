import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Inbox, MessageCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/spinner'
import { getConversations, getMessageRequestCount } from '@/lib/chat'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

/** Sohbet listesi — DM'ler, en son mesaja göre. Üstte mesaj istekleri girişi. */
export function ChatListPage() {
  const t = useT()
  const query = useQuery({ queryKey: ['conversations'], queryFn: getConversations })
  const requestCountQuery = useQuery({
    queryKey: ['message-request-count'],
    queryFn: getMessageRequestCount,
    refetchInterval: 60_000,
  })
  const conversations = query.data ?? []
  const requestCount = requestCountQuery.data ?? 0

  return (
    <div className="min-h-full bg-canvas pb-6">
      <div className="mx-auto max-w-2xl px-4 md:px-6">
        <h1 className="mb-4 mt-2 text-2xl font-semibold tracking-tight">{t('chat.title')}</h1>

        {/* Mesaj istekleri girişi */}
        <Link
          to="/chat/requests"
          className="mb-3 flex items-center gap-3 rounded-card bg-surface p-4 shadow-card transition-colors hover:bg-subtle"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-subtle text-muted">
            <Inbox className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('chat.requests')}</span>
            <span className="block text-[13px] font-medium text-faint">
              {requestCount}
            </span>
          </span>
          {requestCount > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-white">
              {requestCount > 99 ? '99+' : requestCount}
            </span>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </Link>

        {query.isLoading && <PageSpinner label={t('chat.loading')} />}

        {!query.isLoading && conversations.length === 0 && (
          <Card className="p-10 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-sky-soft text-accent">
              <MessageCircle className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold tracking-tight">{t('chat.noConversations')}</p>
            <p className="mt-1.5 text-sm font-medium text-muted">
              {t('chat.noConversationsHint')}
            </p>
          </Card>
        )}

        {conversations.length > 0 && (
          <Card className="divide-y divide-line p-2">
            {conversations.map((c) => (
              <Link
                key={c.id}
                to={`/chat/${c.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-subtle"
              >
                <Avatar src={c.other.avatarUrl} name={c.other.displayName} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{c.other.displayName}</p>
                    {c.lastMessageAt && (
                      <span className="shrink-0 text-xs font-medium text-faint">{timeAgo(c.lastMessageAt)}</span>
                    )}
                  </div>
                  <p
                    className={cn(
                      'truncate text-[13px]',
                      c.unreadCount > 0 ? 'font-semibold text-ink' : 'font-medium text-muted',
                    )}
                  >
                    {c.lastMessagePreview ?? t('chat.emptyHint')}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-white">
                    {c.unreadCount > 99 ? '99+' : c.unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
