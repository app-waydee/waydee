import { useQuery } from '@tanstack/react-query'
import { getChatUnreadCount } from '@/lib/chat'
import { useAuthStore } from '@/stores/auth'

/** Toplam okunmamış DM sayısı — nav rozetleri için (WS gelince invalidate edilir). */
export function useChatUnread(): number {
  const user = useAuthStore((s) => s.user)
  const query = useQuery({
    queryKey: ['chat-unread'],
    queryFn: getChatUnreadCount,
    enabled: !!user,
    refetchInterval: 60_000,
  })
  return query.data ?? 0
}
