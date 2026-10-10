import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { profilePath } from '@/lib/profilePath'
import { Link, useParams } from 'react-router-dom'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { ArrowLeft, Check, CheckCheck, ChevronUp, MessageCircle, Send } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { getConversation, getMessages, markConversationRead, sendMessage } from '@/lib/chat'
import { subscribeMyMessages } from '@/lib/ws'
import { useAuthStore } from '@/stores/auth'
import { useI18nStore } from '@/stores/i18n'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { ChatMessageResponse } from '@/types/api'

const PAGE_SIZE = 30

type MessagesCache = InfiniteData<ChatMessageResponse[]>

/**
 * Sohbet ekranı.
 *
 * ⚠️ <b>YÜKSEKLİK ZİNCİRİ:</b> bu ekran `h-full` ile "ekranı doldur, yalnız
 * mesaj listesi kaysın" düzenini kurar. Zincirin üst halkası `guards.tsx`
 * içindedir (`CHAT_THREAD` → sarmalayıcı da `flex h-full flex-col` olur).
 * O halka kopuk olduğunda ekran içerik boyunda kalıyor, altında kocaman boş
 * gri alan oluşuyor ve yazma alanı sayfanın ortasında asılı kalıyordu.
 *
 * ⚠️ Gönderim <b>optimistic</b>: mesaj anında görünür, REST yanıtı ve WS
 * yankısı `clientMessageId` ile aynı kayda birleşir (çift satır oluşmaz).
 */
export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const me = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottomRef = useRef(true)

  const conversationQuery = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId as string),
    enabled: !!conversationId,
  })

  const messagesKey = ['chat-messages', conversationId] as const
  const messagesQuery = useInfiniteQuery({
    queryKey: messagesKey,
    queryFn: ({ pageParam }) => getMessages(conversationId as string, pageParam as string | undefined, PAGE_SIZE),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1].createdAt : undefined,
    enabled: !!conversationId,
  })

  /** Yeni mesajı önbelleğe ekler; id/clientMessageId ile çift kaydı önler. */
  const insertMessage = useCallback(
    (message: ChatMessageResponse) => {
      queryClient.setQueryData<MessagesCache>(messagesKey as never, (old) => {
        if (!old) return old
        const exists = old.pages.some((page) => page.some((m) => m.id === message.id))
        if (exists) return old
        // Optimistic kaydı gerçek mesajla değiştir (clientMessageId eşleşmesi).
        if (message.clientMessageId) {
          let replaced = false
          const pages = old.pages.map((page) =>
            page.map((m) => {
              if (m.clientMessageId === message.clientMessageId) {
                replaced = true
                return message
              }
              return m
            }),
          )
          if (replaced) return { ...old, pages }
        }
        // En yeni sayfanın başına ekle (sayfalar en-yeniden-eskiye sıralı).
        const pages = old.pages.map((page, i) => (i === 0 ? [message, ...page] : page))
        return { ...old, pages }
      })
    },
    [queryClient, messagesKey],
  )

  // Canlı teslim: bu sohbete ait mesajlar anında düşer, görünürken okundu sayılır.
  useEffect(() => {
    if (!conversationId) return
    return subscribeMyMessages((live) => {
      if (live.conversationId !== conversationId) return
      insertMessage({
        id: live.id,
        conversationId: live.conversationId,
        senderId: live.senderId,
        body: live.body,
        clientMessageId: live.clientMessageId,
        createdAt: live.createdAt,
      })
      if (live.senderId !== me?.id) {
        void markConversationRead(conversationId).then(() => {
          void queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
        })
      }
    })
  }, [conversationId, insertMessage, me?.id, queryClient])

  // Girişte okundu işaretle.
  useEffect(() => {
    if (!conversationId) return
    void markConversationRead(conversationId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .catch(() => {})
  }, [conversationId, queryClient])

  const sendMutation = useMutation({
    mutationFn: async ({ body, clientMessageId }: { body: string; clientMessageId: string }) =>
      sendMessage(conversationId as string, body, clientMessageId),
    onSuccess: (saved) => {
      insertMessage(saved)
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('chat.sendFailed'))),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !me || !conversationId) return
    const clientMessageId = crypto.randomUUID()
    // Optimistic: mesaj anında görünür; REST yanıtı/WS yankısı aynı kaydı günceller.
    insertMessage({
      id: `tmp-${clientMessageId}`,
      conversationId,
      senderId: me.id,
      body,
      clientMessageId,
      createdAt: new Date().toISOString(),
    })
    setDraft('')
    // Otomatik büyüyen alan tek satıra döner.
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    stickToBottomRef.current = true
    sendMutation.mutate({ body, clientMessageId })
  }

  // Mesajlar: sayfalar düzleştirilir (en yeniden eskiye) → görünümde ters (eskiden yeniye).
  const ordered = (messagesQuery.data?.pages.flat() ?? []).slice().reverse()

  // Alta sabitlenme: kullanıcı yukarı kaydırmadıysa yeni mesajda dibe in.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [ordered.length])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const other = conversationQuery.data?.other
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
  const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  /** Gün ayracı metni: bugün/dün ise sözcük, değilse tam tarih. */
  const dayLabel = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
    if (sameDay(d, today)) return t('chat.today')
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (sameDay(d, yesterday)) return t('chat.yesterday')
    return dayFmt.format(d)
  }

  if (!conversationId) return null

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* ---------------- başlık ---------------- */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-3 py-2.5 backdrop-blur md:px-5">
        <Link
          to="/chat"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-subtle"
          aria-label={t('chat.back')}
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Link>
        {other ? (
          <Link to={profilePath(other)} className="flex min-w-0 items-center gap-2.5">
            <Avatar src={other.avatarUrl} name={other.displayName} className="h-9 w-9" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14px] font-semibold">{other.displayName}</span>
              <span className="block truncate text-[12px] font-medium text-faint">@{other.username}</span>
            </span>
          </Link>
        ) : (
          <Spinner />
        )}
      </header>

      {/* ---------------- mesajlar ---------------- */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-4"
      >
        {messagesQuery.isLoading && (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        )}

        {messagesQuery.hasNextPage && (
          <div className="mb-3 text-center">
            <Button
              variant="subtle"
              size="sm"
              disabled={messagesQuery.isFetchingNextPage}
              onClick={() => void messagesQuery.fetchNextPage()}
            >
              {messagesQuery.isFetchingNextPage ? <Spinner /> : <ChevronUp className="h-4 w-4" />}
              {t('chat.olderMessages')}
            </Button>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col">
          {ordered.map((m, i) => {
            const mine = m.senderId === me?.id
            const prev = ordered[i - 1]
            const next = ordered[i + 1]
            /*
             * Gruplama: aynı kişinin arka arkaya mesajları tek blok gibi durur.
             * `first` üst boşluğu ve avatarı, `last` kuyruk köşesini belirler —
             * her mesaja avatar basmak listeyi gürültülü yapıyordu.
             */
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString()
            const first = newDay || prev?.senderId !== m.senderId
            const last = !next || next.senderId !== m.senderId ||
              new Date(next.createdAt).toDateString() !== new Date(m.createdAt).toDateString()
            const pending = m.id.startsWith('tmp-')

            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold text-muted">
                      {dayLabel(m.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    'flex items-end gap-2',
                    mine ? 'justify-end' : 'justify-start',
                    first ? 'mt-2' : 'mt-0.5',
                  )}
                >
                  {/* Karşı tarafın avatarı yalnız BLOĞUN SONUNDA — üstteki
                      mesajlar hizayı koruyan boş bir yer bırakır. */}
                  {!mine &&
                    (last ? (
                      <Avatar
                        src={other?.avatarUrl}
                        name={other?.displayName ?? '?'}
                        className="h-6 w-6 shrink-0"
                      />
                    ) : (
                      <span className="h-6 w-6 shrink-0" aria-hidden />
                    ))}

                  <div
                    className={cn(
                      'max-w-[80%] whitespace-pre-wrap break-words px-3.5 py-2 text-[14px] font-medium leading-relaxed',
                      // Köşeler: blok başı/sonu yuvarlak, ortası bitişik.
                      'rounded-2xl',
                      mine
                        ? cn('bg-ink text-on-ink', last && 'rounded-br-md')
                        : cn('bg-surface text-ink shadow-card', last && 'rounded-bl-md'),
                      pending && 'opacity-60',
                    )}
                  >
                    {m.body}
                    <span
                      className={cn(
                        'mt-1 flex items-center justify-end gap-1 text-[10.5px] font-semibold tabular-nums',
                        mine ? 'text-on-ink/55' : 'text-faint',
                      )}
                    >
                      {timeFmt.format(new Date(m.createdAt))}
                      {mine &&
                        (pending ? (
                          <Check className="h-3 w-3" aria-label={t('chat.sending')} />
                        ) : (
                          <CheckCheck className="h-3 w-3" />
                        ))}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {!messagesQuery.isLoading && ordered.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-subtle text-muted">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="text-[15px] font-semibold">{t('chat.empty')}</p>
              <p className="mt-1 max-w-xs text-[13px] font-medium leading-snug text-muted">
                {t('chat.emptyHint')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- yazma alanı ----------------
          ⚠️ Alt boşluk BURADA verilir: sohbet tam yükseklik bir ekran olduğu
          için sarmalayıcı taban boşluğu koymuyor; yazma alanı gezinme
          çubuğunun üstünde kalmalı (`.waydee-above-nav` ile aynı hesap). */}
      <form
        onSubmit={submit}
        className="shrink-0 border-t border-line bg-surface px-3 pt-2.5 md:px-6"
        style={{ paddingBottom: 'calc(3.25rem + env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              // Otomatik yükseklik: uzun mesaj yazarken kutu büyür, tavan 8rem.
              const el = e.target
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(e)
              }
            }}
            placeholder={t('chat.placeholder')}
            rows={1}
            maxLength={2000}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-canvas px-4 py-2.5 text-[14px] font-medium outline-none transition-colors focus:border-faint"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={!draft.trim()}
            aria-label={t('chat.send')}
          >
            <Send className="h-4.5 w-4.5" />
          </Button>
        </div>
      </form>
    </div>
  )
}
