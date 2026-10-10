import { Check, Clock, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useFollowMutation } from './useFollowMutation'
import type { RelationshipResponse } from '@/types/api'

interface FollowButtonProps {
  userId: string
  relationship: RelationshipResponse
  onChanged: (relationship: RelationshipResponse) => void
  className?: string
}

export function FollowButton({ userId, relationship, onChanged, className }: FollowButtonProps) {
  /* 🔴 Tazeleme paylaşılan kancada (`useFollowMutation`): bu düğme eskiden
     YALNIZ kendi yerel durumunu güncelliyordu, yani sayfadaki takipçi
     sayaçları olduğu gibi kalıyordu. */
  const mutation = useFollowMutation(userId, relationship.following || relationship.requested, {
    onChanged,
  })

  if (relationship.isSelf) return null

  const { following, requested } = relationship
  const label = following ? 'Takip ediliyor' : requested ? 'İstek gönderildi' : 'Takip et'
  const Icon = following ? Check : requested ? Clock : UserPlus

  return (
    <Button
      variant={following || requested ? 'stroke' : 'primary'}
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      className={className}
    >
      {mutation.isPending ? <Spinner className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      {label}
    </Button>
  )
}
