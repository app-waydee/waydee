import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { deleteStory, userStories, viewStory } from '@/lib/social'
import type { AuthorSummary } from '@/types/api'
import { useT } from '@/i18n'
import { useStoryComposer } from './useStoryComposer'
import { StoryViewer } from './StoryViewer'

interface ProfileStoryAvatarProps {
  ownerUserId: string
  author: AuthorSummary
  avatarSrc: string | null
  avatarName: string
  isOwner: boolean
  /** Avatar boyut sınıfları (ör. "h-[88px] w-[88px] md:h-28 md:w-28"). */
  sizeClassName: string
  /**
   * 🔴 8 Ağu 2026 — <b>kare varyant</b>. `/me` referans tasarımında avatar
   * karedir ve hikaye halkası onun çevresinde durur. Şekil prop'u olmasaydı
   * `/me` için ikinci bir halka bileşeni yazmak gerekirdi.
   */
  shape?: 'circle' | 'square'
}

const UNSEEN_RING = 'linear-gradient(135deg,#2a85ff,#8e59ff,#ff6a55)'

export function ProfileStoryAvatar({
  ownerUserId,
  author,
  avatarSrc,
  avatarName,
  isOwner,
  sizeClassName,
  shape = 'circle',
}: ProfileStoryAvatarProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [viewerOpen, setViewerOpen] = useState(false)
  /*
   * 🔴 Oluşturma akışı burada da KOPYA DEĞİL: `useStoryComposer` şerit ve
   * `+` menüsüyle aynı zinciri verir. Bu dosya üçüncü kopyayı taşıyordu.
   */
  const { openPicker, composer } = useStoryComposer(() => void refetch())
  /** Yuvarlak mı kare mi — halka, iç çerçeve ve avatar aynı yarıçapı paylaşır. */
  const radius = shape === 'square' ? 'rounded-2xl' : 'rounded-full'

  const storiesQuery = useQuery({
    queryKey: ['stories', 'user', ownerUserId],
    queryFn: () => userStories(ownerUserId),
  })
  const stories = storiesQuery.data ?? []
  const hasStories = stories.length > 0
  const hasUnseen = stories.some((s) => !s.seen)

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['stories', 'user', ownerUserId] })

  const onAvatarClick = () => {
    if (hasStories) setViewerOpen(true)
    else if (isOwner) openPicker()
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={onAvatarClick}
        className={cn('block', radius, hasStories && 'p-[3px]')}
        style={hasStories ? { background: hasUnseen ? UNSEEN_RING : 'var(--color-faint)' } : undefined}
        aria-label={hasStories ? t('story.open') : isOwner ? t('story.add') : avatarName}
      >
        <span
          className={cn(
            'block bg-surface',
            radius,
            hasStories ? 'border-[3px] border-surface' : 'border-4 border-surface',
          )}
        >
          <Avatar src={avatarSrc} name={avatarName} className={cn(sizeClassName, radius)} />
        </span>
      </button>

      {isOwner && (
        <button
          type="button"
          onClick={openPicker}
          className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-accent text-white shadow-card transition-transform hover:scale-105"
          aria-label={t('story.add')}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      {composer}

      {viewerOpen && hasStories && (
        <StoryViewer
          author={author}
          stories={stories}
          onClose={() => setViewerOpen(false)}
          onViewed={(id) => {
            void viewStory(id).catch(() => {})
          }}
          onDelete={
            isOwner
              ? async (id) => {
                  try {
                    await deleteStory(id)
                    toast.success(t('story.deleted'))
                    setViewerOpen(false)
                    void refetch()
                  } catch (e) {
                    toast.error(apiErrorMessage(e))
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
