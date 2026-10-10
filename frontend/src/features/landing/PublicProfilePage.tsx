import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, LogIn, MapPin, Sparkles } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { LogoMark } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { fmtRadius } from '@/lib/format'
import { getPublicUser, getPublicUserTerritories } from '@/lib/publicApi'

/**
 * Vitrin profil sayfası (`/p/:userId`) — kimliksiz görüntüleme.
 * Yalnız **açık** hesaplar açılır; gizli hesapta sunucu 403 döner ve
 * ziyaretçiye giriş çağrısı gösterilir. Gönderi/etkileşim burada yoktur.
 */
export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()

  const userQuery = useQuery({
    queryKey: ['public', 'user', userId],
    queryFn: () => getPublicUser(userId as string),
    enabled: !!userId,
    retry: false,
  })
  const territoriesQuery = useQuery({
    queryKey: ['public', 'user-territories', userId],
    queryFn: () => getPublicUserTerritories(userId as string),
    enabled: !!userId && userQuery.isSuccess,
    retry: false,
  })

  return (
    <div className="min-h-full bg-canvas pb-16">
      <header className="flex items-center justify-between gap-3 px-4 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <Button variant="stroke" size="icon" aria-label="Haritaya dön">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <LogoMark className="h-7 w-7" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="stroke" size="sm">
              <LogIn className="h-4 w-4" /> Giriş
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm">
              <Sparkles className="h-4 w-4" /> Kayıt ol
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 md:px-8">
        {userQuery.isLoading && (
          <div className="grid place-items-center py-24">
            <Spinner />
          </div>
        )}

        {userQuery.isError && (
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Bu profil görüntülenemiyor</h1>
            <p className="mt-2 text-sm font-medium text-muted">
              Hesap gizli olabilir. Giriş yaparak takip isteği gönderebilirsin.
            </p>
            <Link to="/login" className="mt-5 inline-block">
              <Button>
                <LogIn className="h-4 w-4" /> Giriş yap
              </Button>
            </Link>
          </Card>
        )}

        {userQuery.data && (
          <>
            <Card className="p-5 text-center md:p-7">
              <Avatar
                src={userQuery.data.avatarUrl}
                name={userQuery.data.displayName}
                className="mx-auto h-24 w-24"
              />
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">{userQuery.data.displayName}</h1>
              <p className="text-[13px] font-semibold text-accent">@{userQuery.data.username}</p>
              {userQuery.data.bio && (
                <p className="mx-auto mt-3 max-w-md text-sm font-medium text-muted">{userQuery.data.bio}</p>
              )}
              <Link to="/register" className="mt-5 inline-block">
                <Button>
                  <Sparkles className="h-4 w-4" /> Takip etmek için kayıt ol
                </Button>
              </Link>
            </Card>

            <h2 className="mb-3 mt-7 text-[15px] font-semibold">Bölgeleri</h2>
            <div className="space-y-2">
              {territoriesQuery.data?.map((t) => (
                <Card key={t.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-soft text-success">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.name}</span>
                    <span className="block truncate text-[13px] font-medium text-faint">
                      {t.regionLabel ?? 'Bölge'} · {fmtRadius(t.radiusM)} yarıçap
                    </span>
                  </span>
                </Card>
              ))}
              {territoriesQuery.data?.length === 0 && (
                <Card className="p-6 text-center text-sm font-medium text-muted">Henüz bölgesi yok.</Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
