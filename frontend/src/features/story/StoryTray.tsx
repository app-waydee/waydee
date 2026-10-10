import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Plus, RotateCw } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { storyFeed, viewStory } from '@/lib/social'
import { useAuthStore } from '@/stores/auth'
import type { StoryGroupResponse } from '@/types/api'
import { useStoryComposer } from './useStoryComposer'
import { StoryViewer } from './StoryViewer'

const UNSEEN_RING = 'linear-gradient(135deg,#2a85ff,#8e59ff,#ff6a55)'

/**
 * Instagram tarzı üst hikaye şeridi.
 *
 * @param scope `following` → yalnız <b>takip ettiklerimin</b> hikayeleri.
 *        Ana sayfa şeridi budur: kullanıcı birini takip ettiği için
 *        hikayesini görür. Boş bırakılırsa keşif şeridi (tüm açık hesaplar).
 * @param variant `thin` → <b>daha ince çerçeve</b> ve daha küçük karo
 *        (kullanıcı isteği, 9 Ağu 2026). Ana sayfa bir içerik yönetim
 *        ekranıdır; şerit orada baskın değil, hafif bir üst şerit olmalı.
 */
export function StoryTray({
  scope,
  variant = 'default',
}: {
  scope?: 'following'
  variant?: 'default' | 'thin'
} = {}) {
  const me = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [openGroup, setOpenGroup] = useState<StoryGroupResponse | null>(null)
  const thin = variant === 'thin'
  /*
   * 🔴 8 Ağu 2026: oluşturma akışı buradan `useStoryComposer`'a çıkarıldı —
   * artık **+ menüsü de** aynı zinciri kullanıyor. Kopyalansaydı iki akış
   * zamanla ayrışırdı.
   */
  const { openPicker, composer } = useStoryComposer()

  const feedQuery = useQuery({
    queryKey: ['story-feed', scope ?? 'all'],
    queryFn: () => storyFeed(scope),
  })
  const groups = feedQuery.data ?? []
  const myGroup = me ? groups.find((g) => g.author.id === me.id) : undefined
  const others = me ? groups.filter((g) => g.author.id !== me.id) : groups


  if (!me) return null

  // Sunucuya ulaşılamadığında şerit "boş" görünüyordu (hikaye yok sanılıyordu).
  // Hata artık açıkça yazılır ve tek dokunuşla tekrar denenir.
  if (feedQuery.isError) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-peach-soft text-danger">
          <AlertCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Hikayeler yüklenemedi</p>
          <p className="truncate text-xs font-medium text-faint">
            {apiErrorMessage(feedQuery.error, 'Sunucuya ulaşılamıyor')}
          </p>
        </div>
        <Button variant="stroke" size="sm" onClick={() => void feedQuery.refetch()}>
          <RotateCw className="h-3.5 w-3.5" /> Yeniden dene
        </Button>
      </Card>
    )
  }

  return (
    /* 🔴 Hikaye şeridi yeni tasarıma uyduruldu: eski `Card` kabuğu (beyaz
       kart + gölge + 24px köşe) yeni sade tuvale yamalı duruyordu. Artık
       kap yok — şerit doğrudan tuvalin üstünde, referansın "hafif" dili. */
    <div className="waydee-story-strip">
      <div className={cn('flex overflow-x-auto pb-1', thin ? 'gap-3' : 'gap-4')}>
        {/* Kendi hikayen */}
        <Tile
          name="Hikayen"
          avatarSrc={me.avatarUrl}
          ring={myGroup ? (myGroup.hasUnseen ? UNSEEN_RING : 'var(--color-faint)') : null}
          showAdd
          thin={thin}
          onClick={() => (myGroup ? setOpenGroup(myGroup) : openPicker())}
          onAdd={openPicker}
        />

        {others.map((g) => (
          <Tile
            key={g.author.id}
            name={g.author.displayName}
            avatarSrc={g.author.avatarUrl}
            ring={g.hasUnseen ? UNSEEN_RING : 'var(--color-faint)'}
            thin={thin}
            onClick={() => setOpenGroup(g)}
          />
        ))}
      </div>

      {composer}

      {openGroup && (
        <StoryViewer
          author={openGroup.author}
          stories={openGroup.stories}
          onClose={() => {
            setOpenGroup(null)
            void queryClient.invalidateQueries({ queryKey: ['story-feed'] })
          }}
          onViewed={(id) => {
            void viewStory(id).catch(() => {})
          }}
        />
      )}
    </div>
  )
}

function Tile({
  name,
  avatarSrc,
  ring,
  showAdd,
  thin,
  onClick,
  onAdd,
}: {
  name: string
  avatarSrc: string | null
  ring: string | null
  showAdd?: boolean
  /** İnce şerit: halka 2.5px→1.5px, iç kenar 2px→1px, avatar 56px→44px. */
  thin?: boolean
  onClick: () => void
  onAdd?: () => void
}) {
  return (
    <div className={cn('flex shrink-0 flex-col items-center gap-1.5', thin ? 'w-14' : 'w-16')}>
      <button
        type="button"
        onClick={onClick}
        className={cn('relative block rounded-full', ring ? (thin ? 'p-[1.5px]' : 'p-[2.5px]') : 'p-0')}
        style={ring ? { background: ring } : undefined}
        aria-label={name}
      >
        <span className={cn('block rounded-full bg-surface', thin ? 'border border-surface' : 'border-2 border-surface')}>
          <Avatar src={avatarSrc} name={name} className={cn('rounded-full', thin ? 'h-11 w-11' : 'h-14 w-14')} />
        </span>
        {showAdd && (
          <span
            onClick={(e) => {
              e.stopPropagation()
              onAdd?.()
            }}
            className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-surface bg-accent text-white"
          >
            <Plus className="h-3 w-3" />
          </span>
        )}
      </button>
      <span className={cn('truncate text-center font-medium text-muted', thin ? 'w-14 text-[10px]' : 'w-16 text-[11px]')}>
        {name}
      </span>
    </div>
  )
}
