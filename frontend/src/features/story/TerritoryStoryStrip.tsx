import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { deleteStory, territoryStories, viewStory } from '@/lib/social'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/format'
import type { AuthorSummary } from '@/types/api'
import { StoryViewer } from './StoryViewer'

/**
 * Bir bölgenin (harita profilinin) hikaye şeridi.
 *
 * Yalnız **akış (STANDARD)** profillerde anlamlıdır — gömülü site/HTML
 * profilinde akış gösterilmediği için çağıran taraf bu bileşeni oraya koymaz.
 * Hikaye yoksa hiçbir şey render edilmez (boş kart bırakmaz).
 */
export function TerritoryStoryStrip({
  territoryId,
  owner,
  isOwner,
}: {
  territoryId: string
  owner: AuthorSummary
  isOwner: boolean
}) {
  const queryClient = useQueryClient()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const { data } = useQuery({
    queryKey: ['territory-stories', territoryId],
    queryFn: () => territoryStories(territoryId),
  })

  const stories = data ?? []
  if (stories.length === 0) return null

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['territory-stories', territoryId] })

  return (
    <>
      <Card className="mt-3 p-3.5">
        <div className="mb-2.5 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <h2 className="text-[13px] font-semibold tracking-tight">Bölgenin hikayeleri</h2>
          <span className="text-[11px] font-medium text-faint">· 24 saat</span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {stories.map((story, index) => (
            <button
              key={story.id}
              onClick={() => setOpenIndex(index)}
              className="group shrink-0"
              aria-label={story.caption ?? 'Hikayeyi aç'}
            >
              <span
                className={cn(
                  'block rounded-xl p-[2px] transition-transform group-hover:scale-105',
                  story.seen ? 'bg-line' : 'bg-gradient-to-br from-accent via-violet to-danger',
                )}
              >
                <img
                  src={story.mediaUrl}
                  alt=""
                  className="h-24 w-16 rounded-[10px] border-2 border-surface object-cover"
                />
              </span>
              <span className="mt-1 block text-center text-[10px] font-medium text-faint">
                {timeAgo(story.createdAt)}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {openIndex !== null && (
        <StoryViewer
          author={owner}
          stories={stories}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
          onViewed={(id) => {
            void viewStory(id).catch(() => {})
          }}
          onDelete={
            isOwner
              ? async (id) => {
                  try {
                    await deleteStory(id)
                    toast.success('Hikaye silindi')
                    setOpenIndex(null)
                    void refetch()
                  } catch (e) {
                    toast.error(apiErrorMessage(e))
                  }
                }
              : undefined
          }
        />
      )}
    </>
  )
}
