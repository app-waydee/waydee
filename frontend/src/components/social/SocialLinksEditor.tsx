import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { getMySocialLinks, saveSocialLinks } from '@/lib/account'
import { cn } from '@/lib/utils'
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/api'
import { PLATFORMS } from './SocialIcons'

/**
 * Sosyal medya bağlantılarını düzenleme.
 *
 * Her platform için tek satır: ikon + giriş. Boş bırakılan platform kaydedilmez
 * (sunucuda da elenir), yani "silmek" = alanı boşaltmak. Kullanıcı ister tam
 * adres ister yalnız kullanıcı adı yazabilir; adresi sunucu üretir.
 */
export function SocialLinksEditor() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Record<string, string> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-social-links'],
    queryFn: getMySocialLinks,
  })

  // Sunucudan gelen değerler taslağın temeli; kullanıcı yazdıkça taslak üstte kalır.
  const values: Record<string, string> =
    draft ?? Object.fromEntries((data ?? []).map((l) => [l.platform, l.value]))

  const save = useMutation({
    mutationFn: () =>
      saveSocialLinks(
        SOCIAL_PLATFORMS.filter((p) => (values[p] ?? '').trim()).map((p) => ({
          platform: p,
          value: values[p].trim(),
        })),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(['my-social-links'], saved)
      // Bölge profilleri de bu bağlantıları gösteriyor → tazele.
      void queryClient.invalidateQueries({ queryKey: ['territory-profile'] })
      setDraft(null)
      toast.success('Bağlantılar kaydedildi')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Kaydedilemedi')),
  })

  if (isLoading) return <Spinner />

  const filled = SOCIAL_PLATFORMS.filter((p) => (values[p] ?? '').trim()).length

  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        {SOCIAL_PLATFORMS.map((platform) => (
          <PlatformRow
            key={platform}
            platform={platform}
            value={values[platform] ?? ''}
            onChange={(v) => setDraft({ ...values, [platform]: v })}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <p className="text-xs font-medium text-faint">
          {filled > 0 ? `${filled} bağlantı eklendi` : 'Kullanıcı adı ya da tam adres yazabilirsin'}
        </p>
        <Button size="sm" disabled={save.isPending || draft === null} onClick={() => save.mutate()}>
          {save.isPending ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : 'Kaydet'}
        </Button>
      </div>
    </div>
  )
}

function PlatformRow({
  platform,
  value,
  onChange,
}: {
  platform: SocialPlatform
  value: string
  onChange: (v: string) => void
}) {
  const meta = PLATFORMS[platform]
  const { Icon } = meta
  const active = value.trim().length > 0
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
          active ? 'text-[var(--brand)]' : 'text-faint',
          'bg-subtle',
        )}
        style={{ ['--brand' as string]: meta.color }}
        title={meta.label}
      >
        <Icon className="h-4 w-4" />
      </span>
      <Input
        aria-label={meta.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={meta.placeholder}
        maxLength={200}
        className="h-9 text-[13px]"
      />
    </div>
  )
}
