import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { AtSign, ChevronRight, Globe, ImagePlus, Link2, Lock, LogOut, Mail, Map as MapIcon, MonitorSmartphone, Moon, Shield, ShieldOff, Sun, Tag, User as UserIcon } from 'lucide-react'
import { DashShell } from '@/components/dash'
import { USER_NAV } from '@/app/userNav'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { SocialLinksEditor } from '@/components/social/SocialLinksEditor'
import { BlockedUsersSection } from './BlockedUsersSection'
import { UsernameSection } from './UsernameSection'
import { LanguageSection } from './LanguageSection'
import { StoreCategorySection } from './StoreCategorySection'
import { SecuritySection } from './SecuritySection'
import { api, apiErrorMessage } from '@/lib/api'
import { changeEmail, changePassword, invalidateAvatarQueries, updateMe } from '@/lib/account'
import { resendMyVerification } from '@/lib/verification'
import { uploadImage } from '@/lib/media'
import { CropDialog } from '@/components/media/CropDialog'
import { MAP_STYLE_KEYS, MAP_STYLE_LABELS } from '@/lib/mapStyles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useT } from '@/i18n'
import type { UserResponse } from '@/types/api'

/**
 * <b>Ayarlar</b> — Instagram "Hesaplar Merkezi" düzeni.
 *
 * <p>🔴 <b>Neden baştan yazıldı:</b> önceki yapı iki ayrı gezinme mekanizması
 * taşıyordu — masaüstünde sol liste, mobilde alt sayfa açan ayrı bir seçici
 * (<code>MobileSectionNav</code>). Mobilde kullanıcı bir ayarı görmek için önce
 * bir sayfa açıp sonra seçmek zorundaydı; yani "ayarlara girdim" ile "ayarı
 * gördüm" arasında iki adım duruyordu ve bölümler arasında gezinmek her
 * seferinde o sayfayı yeniden açmak demekti.
 *
 * <p>Yeni yapı <b>tek liste</b>: bütün ayarlar başlıklar altında alt alta
 * sıralanır. Mobilde satıra dokununca bölüm <b>yerinde, yumuşakça</b> açılır
 * (akordeon) — sayfa değişmez, bağlam kaybolmaz. Masaüstünde aynı gruplu liste
 * solda durur, seçilen bölüm sağda çizilir.
 *
 * <p>⚠️ Açılma animasyonu <b>framer-motion height</b> ile yapılır,
 * <code>max-h-*</code> geçişiyle DEĞİL: bu projede Tailwind'in rastgele-özellik
 * geçişi + <code>max-h</code> ikilisi sessizce çalışmadı (vault kaydı). Ayrıca
 * <code>height: auto</code> hedefi içerik uzunluğunu tahmin etmeyi gerektirmez.
 *
 * <p>⚠️ Seçili bölüm URL'de (<code>/settings?s=password</code>) tutulur: bir
 * bölüme doğrudan bağlantı verilebilir ve tarayıcının geri tuşu çalışır.
 */

type SectionKey =
  | 'profile'
  | 'username'
  | 'social'
  | 'storeCategory'
  | 'privacy'
  | 'blocked'
  | 'password'
  | 'security'
  | 'email'
  | 'language'
  | 'appearance'
  | 'map'
  | 'session'

interface SectionMeta {
  key: SectionKey
  label: string
  desc: string
  icon: LucideIcon
}

/** Başlıklı öbek — Hesaplar Merkezi'nin okuma ritmi bu gruplardan gelir. */
interface SectionGroup {
  title: string
  items: SectionMeta[]
}

export function SettingsPage() {
  const { user, setUser, clear, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const t = useT()

  /*
   * ⚠️ Bölüm listesi modül sabiti DEĞİL: etiketler çeviriden gelir ve dil
   * değişince yeniden hesaplanmalıdır. Sabit bir dizi, ilk render'daki dilde
   * donup kalırdı.
   */
  const GROUPS: SectionGroup[] = [
    {
      title: t('settings.groupAccount'),
      items: [
        { key: 'profile', label: t('settings.profile'), desc: t('settings.profileDesc'), icon: UserIcon },
        { key: 'username', label: t('username.title'), desc: t('username.settingsDesc'), icon: AtSign },
        { key: 'social', label: t('settings.social'), desc: t('settings.socialDesc'), icon: Link2 },
        {
          /* 🔴 24 Ağu 2026 (V52) — kullanıcı: *"o alan değiştirilebilir olsun
             ayarlar kısmında"*. HESAP öbeğinde, Tercihler'de değil: bu bir
             görünüm tercihi değil, mağazanın kim olduğunu söyleyen bir bilgi. */
          key: 'storeCategory',
          label: t('category.settingsTitle'),
          desc: t('category.settingsShortDesc'),
          icon: Tag,
        },
        { key: 'email', label: t('settings.email'), desc: t('settings.emailDesc'), icon: Mail },
      ],
    },
    {
      title: t('settings.groupSecurity'),
      items: [
        { key: 'password', label: t('settings.password'), desc: t('settings.passwordDesc'), icon: Lock },
        {
          key: 'security',
          label: t('settings.security'),
          desc: t('settings.securityTitle'),
          icon: MonitorSmartphone,
        },
        { key: 'privacy', label: t('settings.privacy'), desc: t('settings.privacyDesc'), icon: Shield },
        { key: 'blocked', label: t('settings.blocked'), desc: t('settings.blockedDesc'), icon: ShieldOff },
      ],
    },
    {
      title: t('settings.groupPreferences'),
      items: [
        { key: 'appearance', label: t('settings.appearance'), desc: t('settings.appearanceDesc'), icon: Sun },
        { key: 'language', label: t('settings.language'), desc: t('settings.languageTitle'), icon: Globe },
        { key: 'map', label: t('settings.mapStyle'), desc: t('settings.mapDesc'), icon: MapIcon },
      ],
    },
    {
      title: t('settings.groupSession'),
      items: [
        { key: 'session', label: t('settings.session'), desc: t('settings.sessionDesc'), icon: LogOut },
      ],
    },
  ]
  const ALL = GROUPS.flatMap((g) => g.items)

  const requested = params.get('s') as SectionKey | null
  /* ⚠️ Mobilde varsayılan AÇIK bölüm yok: liste bütünüyle görünsün, kullanıcı
     neyin nerede olduğunu tek bakışta okusun. Masaüstünde sağ panel boş
     kalmasın diye ilk bölüm seçili sayılır. */
  const active: SectionKey | null = ALL.some((x) => x.key === requested) ? requested! : null
  const desktopActive: SectionKey = active ?? 'profile'
  const desktopMeta = ALL.find((x) => x.key === desktopActive)!

  if (!user) return null

  const logout = async () => {
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken })
    } catch {
      /* zaten kapanmış olabilir */
    } finally {
      clear()
      // Tanıtım sayfasına dönüş yok — doğrudan giriş.
      navigate('/login', { replace: true })
    }
  }

  const select = (key: SectionKey) => setParams({ s: key })
  /** Mobilde aynı satıra ikinci dokunuş bölümü kapatır (akordeon). */
  const toggle = (key: SectionKey) => (active === key ? setParams({}) : setParams({ s: key }))

  const body = (key: SectionKey) => {
    switch (key) {
      case 'profile':
        return <ProfileSection user={user} setUser={setUser} />
      case 'username':
        return <UsernameSection user={user} setUser={setUser} />
      case 'storeCategory':
        return <StoreCategorySection />
      case 'social':
        return <SocialLinksEditor />
      case 'privacy':
        return <PrivacySection user={user} setUser={setUser} />
      case 'blocked':
        return <BlockedUsersSection />
      case 'password':
        return <PasswordSection />
      case 'security':
        return <SecuritySection />
      case 'email':
        return <EmailSection user={user} setUser={setUser} />
      case 'language':
        return <LanguageSection />
      case 'appearance':
        return <AppearanceSection />
      case 'map':
        return <MapStyleSection />
      case 'session':
        return (
          <Field hint={t('settings.logoutHint')}>
            <Button variant="danger" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" /> {t('nav.logout')}
            </Button>
          </Field>
        )
    }
  }

  return (
    <DashShell navItems={USER_NAV} mobileNav={false}>
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-4 px-1 text-[22px] font-semibold tracking-tight">{t('nav.settings')}</h1>

        {/* ── MOBİL / TABLET: tek liste, yerinde açılan akordeon ─────────── */}
        <div className="lg:hidden">
          {GROUPS.map((group) => (
            <section key={group.title} className="mb-4">
              <h2 className="waydee-settings-group">{group.title}</h2>
              <Card className="overflow-hidden p-0">
                {group.items.map((item, i) => (
                  <AccordionRow
                    key={item.key}
                    item={item}
                    open={active === item.key}
                    first={i === 0}
                    onToggle={() => toggle(item.key)}
                  >
                    {body(item.key)}
                  </AccordionRow>
                ))}
              </Card>
            </section>
          ))}
        </div>

        {/* ── MASAÜSTÜ: gruplu sol liste + sağ panel ─────────────────────── */}
        {/*
          ⚠️ `sticky` KULLANMA: ofset (96px) içeriğin doğal üst hizasından
          (84px) aşağıdaydı; sağ kart sol panelden uzun olduğu bölümlerde
          sticky devreye girip paneli 12px aşağı itiyor, kısa bölümlerde
          itmiyordu → bölüm değiştikçe panel zıplıyordu.
        */}
        <div className="hidden gap-5 lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            {GROUPS.map((group) => (
              <div key={group.title} className="mb-4">
                <h2 className="waydee-settings-group">{group.title}</h2>
                <Card className="p-1.5">
                  <nav className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const selected = item.key === desktopActive
                      return (
                        <button
                          key={item.key}
                          onClick={() => select(item.key)}
                          aria-current={selected ? 'page' : undefined}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors',
                            selected
                              ? 'bg-subtle text-ink'
                              : 'text-muted hover:bg-subtle/60 hover:text-ink',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                              selected ? 'bg-ink text-on-ink' : 'bg-subtle text-muted',
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold">
                              {item.label}
                            </span>
                            <span className="block truncate text-[11px] font-medium text-faint">
                              {item.desc}
                            </span>
                          </span>
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 text-faint transition-opacity rtl:-scale-x-100',
                              selected ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                        </button>
                      )
                    })}
                  </nav>
                </Card>
              </div>
            ))}
          </div>

          <Card className="p-5">
            <header className="mb-4 flex items-start gap-3 border-b border-line pb-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-subtle text-ink">
                <desktopMeta.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold tracking-tight">{desktopMeta.label}</h2>
                <p className="text-[13px] font-medium leading-snug text-faint">{desktopMeta.desc}</p>
              </div>
            </header>
            {/* ⚠️ `key` bölüm anahtarıdır: bölüm değişince alt ağaç YENİDEN
                kurulur. Aynı ağacı yeniden kullanmak, önceki bölümün form
                durumunu (yarım yazılmış şifre gibi) yeni bölüme taşıyordu. */}
            <div key={desktopActive}>{body(desktopActive)}</div>
          </Card>
        </div>
      </div>
    </DashShell>
  )
}

/**
 * Mobil akordeon satırı.
 *
 * <p>⚠️ Yükseklik animasyonu <code>height: auto</code> hedefiyle framer-motion
 * üzerinden yapılır. <code>max-h</code> geçişi denenirse içerik tavana takılıp
 * kırpılır ve uzun bölümler (Profil, Gizlilik) hiç açılmamış gibi görünür.
 *
 * <p>⚠️ Kapalıyken içerik <b>DOM'a hiç basılmaz</b>: on bir bölümün hepsini
 * birden monte etmek, her ayar ekranında on bir isteğin (engellenenler,
 * oturumlar, sosyal bağlantılar…) aynı anda atılması demekti.
 */
function AccordionRow({
  item,
  open,
  first,
  onToggle,
  children,
}: {
  item: SectionMeta
  open: boolean
  first: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className={cn(!first && 'border-t border-line')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-subtle"
      >
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors',
            open ? 'bg-ink text-on-ink' : 'bg-subtle text-muted',
          )}
        >
          <item.icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight">{item.label}</span>
          <span className="block truncate text-[12px] font-medium text-faint">{item.desc}</span>
        </span>
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-faint transition-transform duration-200 rtl:-scale-x-100',
            open && 'rotate-90',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface UserProps {
  user: UserResponse
  setUser: (u: UserResponse) => void
}

/** Bölüm içi küçük yardımcı: içerik + altında açıklama satırı. */
function Field({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      {children}
      {hint && <p className="text-xs font-medium leading-snug text-faint">{hint}</p>}
    </div>
  )
}

function ProfileSection({ user, setUser }: UserProps) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [bio, setBio] = useState(user.bio ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  /** Kırpılmış avatarın önizlemesi (data URL — ayrıca URL üretilmez). */
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  /** Kırpma bekleyen ham dosya (avatar 1:1 kırpılır). */
  const [rawAvatar, setRawAvatar] = useState<File | null>(null)
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: async () => {
      const avatar = avatarFile ? await uploadImage(avatarFile) : null
      return updateMe({ displayName, bio, avatarMediaId: avatar?.id })
    },
    onSuccess: (u) => {
      setUser(u)
      const changedAvatar = !!avatarFile
      setAvatarFile(null)
      setAvatarPreview(null)
      // Foto değiştiyse onu gömen tüm görünümleri tazele (harita dahil).
      if (changedAvatar) invalidateAvatarQueries(queryClient)
      toast.success('Profil güncellendi')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Güncellenemedi')),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar src={avatarPreview ?? user.avatarUrl} name={user.displayName} className="h-12 w-12" />
        <label className="flex cursor-pointer items-center gap-2 rounded-full bg-subtle px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
          <ImagePlus className="h-3.5 w-3.5" />
          {avatarFile ? "Foto hazır — Kaydet'e bas" : 'Fotoğrafı değiştir'}
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
      </div>
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
      <div>
        <Label htmlFor="s-name">Görünen ad</Label>
        <Input
          id="s-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          minLength={2}
          maxLength={60}
          className="h-9"
        />
      </div>
      <div>
        <Label htmlFor="s-bio">Biyografi</Label>
        <Textarea
          id="s-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Kendinden bahset…"
        />
      </div>
      <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : 'Kaydet'}
      </Button>
    </div>
  )
}

function PrivacySection({ user, setUser }: UserProps) {
  const priv = user.privateAccount
  const toggle = useMutation({
    mutationFn: () => updateMe({ privateAccount: !priv }),
    onSuccess: (u) => {
      setUser(u)
      toast.success(u.privateAccount ? 'Hesabın artık gizli' : 'Hesabın artık herkese açık')
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })
  return (
    <Field hint="Gizli hesapta seni takip etmek için onayın gerekir; takipçi/takip listelerin ve içeriklerin yalnız takipçilerine görünür.">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-subtle px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">Gizli hesap</p>
          <p className="text-xs font-medium text-faint">
            {priv ? 'Açık — takip için onay gerekir' : 'Kapalı — herkes takip edebilir'}
          </p>
        </div>
        <Switch checked={priv} disabled={toggle.isPending} onChange={() => toggle.mutate()} />
      </div>
    </Field>
  )
}

function PasswordSection() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const save = useMutation({
    mutationFn: () => changePassword(cur, next),
    onSuccess: () => {
      setCur('')
      setNext('')
      toast.success('Şifre değişti. Diğer cihazlardaki oturumlar kapatıldı.')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Şifre değiştirilemedi')),
  })
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="s-cur">Mevcut şifre</Label>
        <Input id="s-cur" type="password" value={cur} onChange={(e) => setCur(e.target.value)} className="h-9" />
      </div>
      <div>
        <Label htmlFor="s-new">Yeni şifre</Label>
        <Input
          id="s-new"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="En az 8 karakter, harf + rakam"
          className="h-9"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={save.isPending || !cur || !next} onClick={() => save.mutate()}>
          {save.isPending ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : 'Şifreyi güncelle'}
        </Button>
        <p className="text-xs font-medium text-faint">Değişince diğer oturumlar kapanır.</p>
      </div>
    </div>
  )
}

function EmailSection({ user }: UserProps) {
  const [email, setEmail] = useState(user.email)
  const [pw, setPw] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const save = useMutation({
    // Adres ARTIK ANINDA DEĞİŞMEZ: yeni adrese doğrulama bağlantısı gider ve
    // tıklanana kadar hesap eski adresle çalışır — bu yüzden store güncellenmez.
    mutationFn: () => changeEmail(email, pw),
    onSuccess: (result) => {
      setPw('')
      setPending(result.pendingEmail)
      toast.success('Doğrulama bağlantısı yeni adresine gönderildi')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'E-posta değiştirilemedi')),
  })
  const resend = useMutation({
    mutationFn: resendMyVerification,
    onSuccess: () => toast.success('Doğrulama bağlantısı gönderildi'),
    onError: (e) => toast.error(apiErrorMessage(e, 'Bağlantı gönderilemedi')),
  })

  return (
    <div className="space-y-3">
      {/* Mevcut adresin durumu — kullanıcı neden kısıtlı olduğunu buradan görür. */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-subtle px-3 py-2.5">
        <Badge tone={user.emailVerified ? 'success' : 'warning'}>
          {user.emailVerified ? 'Doğrulanmış' : 'Doğrulanmamış'}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{user.email}</span>
        {!user.emailVerified && (
          <Button size="sm" variant="stroke" disabled={resend.isPending} onClick={() => resend.mutate()}>
            Tekrar gönder
          </Button>
        )}
      </div>

      {pending && (
        <p className="rounded-2xl bg-sand-soft px-3 py-2.5 text-xs font-medium leading-relaxed text-ink">
          <strong>{pending}</strong> adresine doğrulama bağlantısı gönderildi. Bağlantıya tıklayana
          kadar hesabın <strong>mevcut adresle</strong> çalışmaya devam eder.
        </p>
      )}

      <div>
        <Label htmlFor="s-email">Yeni e-posta</Label>
        <Input
          id="s-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9"
        />
      </div>
      <div>
        <Label htmlFor="s-epw">Şifren</Label>
        <Input id="s-epw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-9" />
      </div>
      <Button
        size="sm"
        disabled={save.isPending || !email || !pw || email === user.email}
        onClick={() => save.mutate()}
      >
        {save.isPending ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : 'Doğrulama bağlantısı gönder'}
      </Button>
      <p className="text-xs font-medium text-faint">
        Yeni adres, bağlantıya tıklandıktan sonra hesabına işlenir.
      </p>
    </div>
  )
}

function AppearanceSection() {
  const { mode, setMode } = useThemeStore()
  const apply = (m: 'light' | 'dark') => {
    setMode(m)
    // Tercihi DB'ye yaz (cihazlar arası kalıcı); yerel değişim zaten anında uygulandı.
    void updateMe({ themeMode: m }).catch(() => {})
  }
  return (
    <Field hint="Tercihin hesabına kaydedilir; diğer cihazlarında da geçerli olur.">
      <div className="grid grid-cols-2 gap-2">
        {(['light', 'dark'] as const).map((m) => (
          <button
            key={m}
            onClick={() => apply(m)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border p-2.5 text-[13px] font-semibold transition-colors',
              mode === m ? 'border-accent bg-accent/5 text-ink' : 'border-line bg-subtle text-muted hover:text-ink',
            )}
          >
            {m === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {m === 'light' ? 'Açık' : 'Koyu'}
          </button>
        ))}
      </div>
    </Field>
  )
}

/** Harita stili — haritadan buraya taşındı; tercih DB'de kullanıcıya özel saklanır. */
function MapStyleSection() {
  const { mapStyle, setMapStyle } = useThemeStore()
  const active = mapStyle ?? null

  const apply = (key: string | null) => {
    setMapStyle(key)
    /*
     * 🔴 10 Ağu 2026 — "Temayı takip et" ARTIK GERÇEKTEN TEMİZLİYOR.
     * Önceki hâli tercihi silmek yerine o anki temayı (`light`/`dark`)
     * <b>sabit bir seçim</b> olarak yazıyordu; bir sonraki girişte
     * `SessionBootstrap` onu kayıtlı tercih olarak geri yükleyip tabanı
     * kilitliyordu — yani düğme kendi vaadini bir oturum sonra bozuyordu.
     * Sunucuda **boş dize** "tercihimi sil" demektir (bkz. UserService).
     */
    void updateMe({ mapStyle: key ?? '' }).catch(() => {})
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MAP_STYLE_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => apply(key)}
            className={cn(
              'rounded-xl border p-2.5 text-[13px] font-semibold transition-colors',
              active === key ? 'border-accent bg-accent/5 text-ink' : 'border-line bg-subtle text-muted hover:text-ink',
            )}
          >
            {MAP_STYLE_LABELS[key]}
          </button>
        ))}
      </div>
      <button
        onClick={() => apply(null)}
        className={cn(
          'w-full rounded-xl border p-2.5 text-xs font-semibold transition-colors',
          active === null ? 'border-accent bg-accent/5 text-ink' : 'border-line bg-subtle text-muted hover:text-ink',
        )}
      >
        Temayı takip et (açık/koyu)
      </button>
    </div>
  )
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  )
}
