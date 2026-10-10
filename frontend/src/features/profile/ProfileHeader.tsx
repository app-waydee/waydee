import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, MapPin, Share2 } from 'lucide-react'
import { VerifiedTick } from '@/components/VerifiedTick'
import { toast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { TerritoryResponse } from '@/types/api'
import { useT } from '@/i18n'

/**
 * <b>Kendi vitrin başlığın</b> — uygulama içinde (`/home`), vitrin profilinin
 * (`/{tag}`) aynı yerleşimiyle.
 *
 * <p>🔴 <b>Neden eklendi:</b> kullanıcı kendi adresini (`waydee.com/mustafa`)
 * uygulamanın hiçbir yerinde <b>göremiyordu</b>; paylaşacak bir şeyi olduğunu
 * bilmesinin yolu yoktu. Şerit adresi gösterir, tek dokunuşla <b>kopyalar</b>,
 * <b>paylaşır</b> ve vitrini yeni sekmede <b>açar</b>.
 *
 * <p>⚠️ Adres <code>window.location.origin</code> üzerinden kurulur — alan adı
 * ortamdan ortama değişir (yerelde <code>localhost:5175</code>, üretimde
 * <code>app.waydee.com</code>); sabit yazmak yerelde tıklanamayan bir bağlantı
 * üretirdi. Kullanıcıya gösterilen <b>etiket</b> ise alan adı olmadan sadeleşir.
 *
 * <p>⚠️ Mavi tik <b>sunucudan</b> gelir (<code>user.verified</code>, Pro
 * üyelikten türer) — istemci planı okuyup kendi karar vermez.
 */
export function ProfileHeader() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const [copied, setCopied] = useState(false)

  if (!user) return null

  const tag = user.username
  const path = `/${tag}`
  const url = `${window.location.origin}${path}`
  /** Görsel etiket: şemasız ve `www` olmadan — referanstaki gibi kısa. */
  const label = `${window.location.host.replace(/^www\./, '')}${path}`

  const initials = (user.displayName || tag)
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success(t('common.copied'))
    window.setTimeout(() => setCopied(false), 1500)
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: user.displayName ?? tag, url })
        return
      } catch {
        /* vazgeçildi */
      }
    }
    await copy()
  }

  return (
    <div className="relative flex w-full max-w-2xl flex-col">
      <div className="m-4">
        <div className="relative flex flex-col items-center justify-center md:flex-row">
          <span className="waydee-tag-avatar">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
          </span>
          <div className="p-3 text-center md:p-8 md:text-start">
            <div className="flex items-center justify-center gap-1.5 md:justify-start">
              <span className="waydee-tag-name">{user.displayName || tag}</span>
              {user.verified && <VerifiedTick size={20} title={t('profile.verified')} />}
            </div>
            <div className="waydee-tag-handle mb-1 truncate">{tag}</div>
          </div>
        </div>
        {user.bio && (
          <div className="flex flex-col items-center text-center">
            <p className="max-w-md text-sm text-muted md:text-base">{user.bio}</p>
          </div>
        )}

        {/* --- adres şeridi: göster · kopyala · paylaş · aç --- */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t('profile.myUrl')}
          </span>
          <div className="waydee-url-bar">
            <span className="truncate font-medium">{label}</span>
            <span className="waydee-url-sep" aria-hidden />
            <button type="button" onClick={copy} aria-label={t('profile.copyUrl')} title={t('profile.copyUrl')}>
              <Copy className="h-4 w-4" />
              <span className="sr-only">{copied ? t('common.copied') : t('profile.copyUrl')}</span>
            </button>
            <button type="button" onClick={share} aria-label={t('collection.share')} title={t('collection.share')}>
              <Share2 className="h-4 w-4" />
            </button>
            {/* ⚠️ Vitrin AYRI bir yüzey: `target="_blank"` — kullanıcı panelinden
                çıkmadan kendi vitrinine bakabilmeli. */}
            <Link to={path} target="_blank" rel="noopener" aria-label={t('profile.openUrl')} title={t('profile.openUrl')}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          {/*
            🔴 DAİRE korunuyor: yeni tasarım Waydee'nin kendi özelliğini
            yutmamalı. Kullanıcının haritadaki alanları başlığın altında çip
            olarak durur ve doğrudan o bölgeye gider; hiç dairesi yoksa satır
            haritaya davet eder (boş bir alan bırakmak yerine).
          */}
          <TerritoryChips />
        </div>
      </div>
    </div>
  )
}

/** Kendi dairelerin — başlığın altındaki küçük şerit. */
function TerritoryChips() {
  const t = useT()
  const { data } = useQuery({
    queryKey: ['my-territories'],
    queryFn: async () => (await api.get<TerritoryResponse[]>('/territories/my')).data,
    staleTime: 60_000,
  })

  const active = (data ?? []).filter((x) => x.status === 'ACTIVE')

  if (!data) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {active.length === 0 ? (
        <Link to="/map" className="waydee-terr-chip">
          <MapPin className="h-3.5 w-3.5" />
          {t('profile.noTerritory')}
        </Link>
      ) : (
        active.slice(0, 3).map((terr) => (
          <Link key={terr.id} to={`/t/${terr.id}`} className="waydee-terr-chip">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{terr.name}</span>
          </Link>
        ))
      )}
      {active.length > 3 && (
        <Link to="/me" className="waydee-terr-chip">
          +{active.length - 3}
        </Link>
      )}
    </div>
  )
}
