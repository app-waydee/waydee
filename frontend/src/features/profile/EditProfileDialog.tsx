import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { invalidateAvatarQueries, updateMe } from '@/lib/account'
import { uploadImage } from '@/lib/media'
import { CropDialog } from '@/components/media/CropDialog'
import type { UserResponse } from '@/types/api'

interface EditProfileDialogProps {
  user: UserResponse
  onClose: () => void
  onSaved: (u: UserResponse) => void
}

/**
 * Instagram tarzı profil düzenleme: üstte fotoğraf + "Fotoğrafı değiştir",
 * altında ad, kullanıcı adı (sabit) ve biyografi (sayaçlı).
 * Fotoğraf seçilince önce kırpılır (1:1).
 */
export function EditProfileDialog({ user, onClose, onSaved }: EditProfileDialogProps) {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [bio, setBio] = useState(user.bio ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [rawAvatar, setRawAvatar] = useState<File | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const media = avatarFile ? await uploadImage(avatarFile) : null
      return updateMe({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarMediaId: media?.id,
      })
    },
    onSuccess: (u) => {
      onSaved(u)
      // Foto değiştiyse haritada/profillerde/gönderilerde anında tazelensin.
      if (avatarFile) invalidateAvatarQueries(queryClient)
      toast.success('Profilin güncellendi')
      onClose()
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Profil güncellenemedi')),
  })

  return (
    <>
      <Dialog open onClose={onClose} title="Profili düzenle">
        <div className="space-y-5">
          {/* Fotoğraf */}
          <div className="flex flex-col items-center gap-3">
            <label className="group relative cursor-pointer">
              <Avatar
                src={avatarPreview ?? user.avatarUrl}
                name={user.displayName}
                className="h-24 w-24 ring-4 ring-subtle"
              />
              <span className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-accent text-white transition-transform group-hover:scale-105">
                <Camera className="h-4 w-4" />
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  e.target.value = ''
                  if (f) setRawAvatar(f)
                }}
              />
            </label>
            <span className="text-[13px] font-semibold text-accent">
              {avatarFile ? 'Yeni fotoğraf hazır' : 'Profil fotoğrafını değiştir'}
            </span>
          </div>

          <div>
            <Label htmlFor="ep-name">Ad</Label>
            <Input
              id="ep-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              maxLength={60}
            />
          </div>

          <div>
            <Label htmlFor="ep-username">Kullanıcı adı</Label>
            <Input id="ep-username" value={`@${user.username}`} disabled readOnly />
            <p className="mt-1 text-xs font-medium text-faint">Kullanıcı adı değiştirilemez.</p>
          </div>

          <div>
            <Label htmlFor="ep-bio">Biyografi</Label>
            <Textarea
              id="ep-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              placeholder="Kendinden bahset…"
            />
            <p className="mt-1 text-right text-xs font-medium text-faint">{bio.length} / 280</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="subtle" className="flex-1" onClick={onClose} disabled={save.isPending}>
              Vazgeç
            </Button>
            <Button className="flex-1" disabled={save.isPending || displayName.trim().length < 2} onClick={() => save.mutate()}>
              {save.isPending ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Dialog>

      {rawAvatar && (
        <CropDialog
          file={rawAvatar}
          aspect={1}
          title="Profil fotoğrafını kırp"
          onCancel={() => setRawAvatar(null)}
          onDone={(f, preview) => {
            setAvatarFile(f)
            setAvatarPreview(preview)
            setRawAvatar(null)
          }}
        />
      )}
    </>
  )
}
