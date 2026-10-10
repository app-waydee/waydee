import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, Heart, ImageOff, Lock, LockOpen, MapPin, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { VerifiedTick } from '@/components/VerifiedTick'
import { SocialLinks } from '@/components/social/SocialIcons'
import { StoreCategoryIcon } from '@/components/StoreCategoryIcon'
import { StoryViewer } from '@/features/story/StoryViewer'
import { api } from '@/lib/api'
import { publicApi } from '@/lib/publicApi'
import { useFollowMutation } from '@/features/follow/useFollowMutation'
import { likeTerritory } from '@/lib/discovery'
import { getPublicTerritoryCard, getTerritoryCard } from '@/lib/territoryCard'
import { useStoreCategoryLabel } from '@/lib/storeCategories'
import { useT } from '@/i18n'
import { gradientPartner } from './mapCanvas'

/** Kapağı olmayan mağazaların varsayılan arka planı — gerekçe kullanım yerinde. */
const DEFAULT_COVER = '/default-cover.png'
import type {
  AuthorSummary,
  PageResponse,
  PostResponse,
  StoryResponse,
  TerritoryProperties,
} from '@/types/api'

interface TerritoryCardProps {
  territory: TerritoryProperties
  onClose: () => void
  /**
   * 🔴 <b>ARTIK YOK SAYILIYOR</b> (24 Ağu 2026).
   *
   * <p>Panel artık haritanın üstünde yüzen 320px'lik bir kart değil;
   * masaüstünde <b>sağda tam yükseklik</b>, mobilde <b>alt sayfa</b>. Bir
   * kenara yapışık panelin dairenin merkezine çapalanması anlamsız — çapa,
   * kartı dairenin yanında tutmak içindi.
   *
   * <p>⚠️ Prop <b>silinmedi</b>: `MapPage` ve `PublicMapPage` onu hâlâ geçiyor
   * ve kaldırmak iki çağrı yerini birden kırardı. Yok sayılıyor; bu not
   * "neden hiçbir şey yapmıyor" sorusunun cevabı.
   */
  anchored?: boolean
  /** Vitrin haritası kimliksiz uca bağlanır. */
  variant?: 'session' | 'public'
  /** Landing'de profil düğmesi farklı rotaya gider. */
  hrefs?: { profile: (username: string) => string }
}

const DEFAULT_HREFS = {
  profile: (username: string) => `/${username}`,
}

/**
 * <b>Haritadaki mağazaya tıklayınca açılan MAĞAZA PANELİ.</b>
 *
 * <h3>🔴 24 Ağu 2026 — sağda tam yükseklik panele dönüştü</h3>
 * <p>Kullanıcı ekran görüntüsü verdi: *"haritadaki mağazalara tıklayınca
 * açılan popup tasarımı sağda tüm ekranda olacak şekilde fotoğraftaki gibi
 * olacak; storyler altta aynı şekilde görülecek; ekstra olarak sosyal medya
 * ikonları gelecek"*.
 *
 * <p>Sıra ekran görüntüsünün sırasıdır ve <b>bilinçlidir</b>: kapak → halkalı
 * avatar → ad + mavi tik → konum → canlı/kategori rozeti → açıklama →
 * sayılar → <b>Mağazayı gör</b> + "…" → sosyal ikonlar → SON HİKAYELER →
 * gönderi ızgarası.
 *
 * <h3>⚠️ Panel haritayı KAPATMAZ</h3>
 * <p>Masaüstünde sol taraf serbest kalır: kullanıcı tıkladığı mağazayı
 * haritada görmeye devam eder. Tam ekran bir modal, "haritadaki mağazaya
 * baktım" hissini bitirirdi.
 *
 * <h3>⚠️ Hikayeler AYRI bir istek</h3>
 * <p>Kart yükü (`/card`) hikaye taşımıyor ve taşımamalı: hikayeler 24 saatte
 * bir değişir, kartın geri kalanı değişmez. Tek yüke katılsaydı kartın
 * `staleTime`'ı hikayelerin ömrüne inerdi.
 */
export function TerritoryCard({
  territory,
  onClose,
  variant = 'session',
  hrefs = DEFAULT_HREFS,
}: TerritoryCardProps) {
  const t = useT()
  const navigate = useNavigate()
  const categoryLabel = useStoreCategoryLabel()
  const [storyIndex, setStoryIndex] = useState<number | null>(null)
  /**
   * <b>Mağaza beğenisi</b> (97. tur) — kartın kalbi.
   *
   * <p>🔴 İYİMSER ve <b>yalnız basıldıktan sonra</b> anlamlı: `null` iken
   * sunucudan gelen değer gösterilir. Başlangıç durumunu karttan kopyalayıp
   * state'e yazsaydık, kart yenilendiğinde (başkası beğendi) ekrandaki sayı
   * eski değerde donup kalırdı.
   *
   * <p>⚠️ Kalp yalnız OTURUMLU kartta çizilir: vitrin ziyaretçisi beğenemez
   * (sunucu 401 döner) ve basılamayan bir kalp, çalışmayan bir düğmedir.
   */
  const [likeState, setLikeState] = useState<{ liked: boolean; count: number } | null>(null)

  const cardQuery = useQuery({
    queryKey: ['territory-card', variant, territory.id],
    queryFn: () =>
      variant === 'public'
        ? getPublicTerritoryCard(String(territory.id))
        : getTerritoryCard(String(territory.id)),
    staleTime: 30_000,
    retry: false,
  })
  const card = cardQuery.data
  const owner = card?.owner

  /* 🔴 Tazeleme paylaşılan kancada (`useFollowMutation`). */
  const followMutation = useFollowMutation(owner?.id ?? '', !!owner?.followedByMe)

  const showFollow = variant === 'session' && !!owner?.id && !owner.me && !card?.reserved

  const postsQuery = useQuery({
    queryKey: ['territory-card-posts', variant, owner?.id ?? owner?.username],
    queryFn: async (): Promise<{ id: string; imageUrl: string | null }[]> => {
      /* 🔴 SAHİBİN gönderileri isteniyor, BÖLGENİNKİ değil: gönderiler profil
         akışından açıldığı için `territory_id` NULL kalıyor ve bölge sorgusu
         HER ZAMAN boş dönüyordu. */
      if (variant === 'public') {
        const { data } = await publicApi.get<PageResponse<{ id: string; imageUrl: string | null }>>(
          `/profiles/${owner!.username}/posts`,
          { params: { page: 0, size: 6 } },
        )
        return data.content
      }
      const { data } = await api.get<PageResponse<PostResponse>>(`/users/${owner!.id}/posts`, {
        params: { page: 0, size: 6 },
      })
      /* ⚠️ İki uç FARKLI şekil döner: vitrin `imageUrl`, oturumlu `mediaUrls[]`. */
      return data.content.map((p) => ({ id: p.id, imageUrl: p.mediaUrls[0] ?? null }))
    },
    enabled:
      !!card && card.canOpen && !card.reserved &&
      (variant === 'public' ? !!owner?.username : !!owner?.id),
    staleTime: 60_000,
    retry: false,
  })
  const posts = postsQuery.data ?? []

  /*
   * SON HİKAYELER (24 Ağu 2026).
   *
   * ⚠️ Yalnız OTURUMLU haritada: `/stories/user/{id}` kimlik ister ve vitrin
   * haritasında ziyaretçinin oturumu yok. Vitrinde şerit hiç çizilmez — boş
   * bir "Son hikayeler" başlığı, orada hikaye OLMADIĞINI söylerdi ki bu
   * yanlış olurdu (90. turun "verisi olmayan kontrol çizilmez" kuralı).
   */
  const storiesQuery = useQuery({
    queryKey: ['territory-card-stories', owner?.id],
    queryFn: async (): Promise<StoryResponse[]> => {
      const { data } = await api.get<StoryResponse[]>(`/stories/user/${owner!.id}`)
      return data
    },
    enabled: variant === 'session' && !!card && card.canOpen && !card.reserved && !!owner?.id,
    staleTime: 60_000,
    retry: false,
  })
  const stories = storiesQuery.data ?? []

  const openProfile = () => {
    if (owner?.username) navigate(hrefs.profile(owner.username))
  }

  /* Halkanın ve degradenin rengi mağazanın HARİTADAKİ rengidir — panelle
     işaretçi arasındaki görsel bağ bu.
     ⚠️ `gradientPartner` haritayla PAYLAŞILAN fonksiyondur, kopyası değil:
     kopyalanan bir formül er ya da geç ayrışır ve mağaza haritada bir renk,
     panelde başka bir renk gösterirdi (vault 20. bölümün uyarısı). */
  const color = territory.color ?? '#2a85ff'
  const ringGradient = `linear-gradient(135deg, ${gradientPartner(color)}, ${color})`

  const storyAuthor: AuthorSummary | null = owner?.id
    ? {
        id: owner.id,
        username: owner.username,
        displayName: owner.displayName,
        avatarUrl: owner.avatarUrl,
      }
    : null

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-label={card?.name ?? territory.name}
        className="waydee-store-sheet pointer-events-auto"
      >
        {/* ---------------- kapak + kapat ----------------
            ⚠️ Kapat düğmesi `bg-surface/85 backdrop-blur`: kapak fotoğrafı
            açık ya da koyu olabilir ve düz bir ikon iki durumda birden okunur
            olamazdı. */}
        <div className="waydee-store-sheet-cover">
          {/* 🔴 25 Ağu 2026 — KAPAK VARSAYILANI (kullanıcı isteği). Kapak
              özelliği sonradan eklendiği için hemen kimsede yok ve kartların
              üstü boş bir degradeyle açılıyordu; marka görseli hem doluluk
              hem tanıdıklık veriyor. Kendi kapağını yükleyen kullanıcıda
              hiçbir şey değişmez. */}
          {/* ⚠️ Degrade ALTTA DURUYOR, kaldırılmadı: varsayılan görsel bir
              sebeple yüklenmezse (404, çevrimdışı) kapak boş bir dikdörtgen
              olmasın. Mağazanın kendi rengini taşıdığı için de doğru yedek. */}
          <div className="waydee-store-sheet-cover-fallback" style={{ background: ringGradient }} />
          <img
            src={territory.coverUrl ?? DEFAULT_COVER}
            alt=""
            className="relative h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-surface/85 text-ink backdrop-blur transition-colors hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>

          {/*
            🔴 AVATAR KAPAĞIN İÇİNDE — 24 Ağu 2026 (2. düzeltme).

            İlk sürümde avatar gövdenin ilk öğesiydi ve kapağa `-mt-11` ile
            biniyordu. <b>Kırpılıyordu</b> ve sebep z-index DEĞİLDİ: gövde
            `overflow-y: auto` ve bu bir <b>kırpma kutusu</b> kurar — negatif
            margin ile kutunun üstüne taşan içerik kapağın üstüne boyanmaz,
            <b>kesilir</b>. `position: relative; z-index: 10` bunu düzeltemez;
            kırpma boyama sırasından önce gelir.

            ✅ Çözüm: avatar artık kapağın <b>mutlak konumlu çocuğu</b> ve
            aşağı taşıyor. Kapakta `overflow` yok, sarmalayıcı panelin
            `overflow: hidden`'ı ise yalnız panel kenarında kırpar — avatar
            panelin içinde kaldığı için ona değmez.

            ⚠️ `bottom: -2.625rem` = halkanın yarısı (5,25rem / 2). Gövdedeki
            `pt-14` bu taşan yarıyı karşılar; ikisi birlikte değişmeli.
          */}
          <button
            type="button"
            onClick={openProfile}
            disabled={!owner?.username}
            className="waydee-store-sheet-ring absolute start-5 z-20 transition-transform enabled:hover:scale-[1.03]"
            style={{ background: ringGradient, bottom: '-2.625rem' }}
          >
            <span>
              <Avatar
                src={owner?.avatarUrl ?? null}
                name={owner?.displayName || owner?.username || '?'}
                className="h-full w-full"
              />
            </span>
          </button>
        </div>

        {cardQuery.isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Spinner />
          </div>
        ) : !card ? (
          <div className="px-5 py-8 text-center text-[13px] font-medium text-muted">
            {t('territoryCard.unavailable')}
          </div>
        ) : (
          /*
           * ⚠️ Kaydırma BURADA: kapak, kapat düğmesi ve avatar yerinde kalmalı.
           *
           * ⚠️ `pt-14` — avatar artık kapaktan aşağı taşıyor (yarısı, 2,625rem)
           * ve bu dolgu o taşan yarıya yer açar. Avatarın ölçüsü değişirse
           * ikisi BİRLİKTE değişmeli, yoksa ad avatarın altına girer.
           *
           * 🔴 Burada `position`/`z-index` YOK ve olmamalı: avatar artık
           * kapağın çocuğu; gövdeyi konumlandırmak onu avatarın ÜSTÜNE
           * boyayıp fotoğrafı yeniden gizlerdi.
           */
          <div className="min-h-0 flex-1 overflow-y-auto pt-14">
            <div className="px-5">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[19px] font-black leading-tight">
                  {owner?.displayName || owner?.username}
                </p>
                {card.verified && <VerifiedTick size={17} title={t('profile.verified')} />}
              </div>

              {card.regionLabel && (
                <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{card.regionLabel}</span>
                </p>
              )}

              {/* Rozetler.
                  ⚠️ Canlı rozet ÖNCE gelir: geçici ve zamana bağlı bir bilgi,
                  kategori ise kalıcıdır. */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {/*
                  🔴 25 Ağu 2026 — GİZLİ / AÇIK HESAP ROZETİ (kullanıcı isteği).

                  ⚠️ Bilgi zaten karta geliyordu (`owner.privateAccount`) ama
                  hiçbir yerde gösterilmiyordu: kullanıcı "Takip et"e basıp
                  neden gönderi göremediğini ancak denedikten sonra anlıyordu.

                  ⚠️ İki durum da çizilir, yalnız gizli olan değil. "Rozet yoksa
                  açıktır" bir çıkarımdır ve öğrenilmesi gerekir; iki ayrı rozet
                  hiçbir şey öğretmeden anlaşılır.
                */}
                {owner && (
                  <span
                    className={`waydee-privacy-chip ${
                      owner.privateAccount ? 'waydee-privacy-chip-locked' : ''
                    }`}
                    title={owner.privateAccount ? t('territoryCard.privateHint') : t('territoryCard.publicHint')}
                  >
                    {owner.privateAccount ? (
                      <Lock className="h-3 w-3" strokeWidth={2.6} />
                    ) : (
                      <LockOpen className="h-3 w-3" strokeWidth={2.6} />
                    )}
                    {owner.privateAccount ? t('territoryCard.private') : t('territoryCard.public')}
                  </span>
                )}
                {card.liveActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/12 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-danger">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                    {t('territoryCard.live')}
                  </span>
                )}
                {card.category && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide"
                    style={{
                      background: `color-mix(in srgb, ${card.category.color} 14%, transparent)`,
                      color: card.category.color,
                    }}
                  >
                    <StoreCategoryIcon
                      name={card.category.icon}
                      className="h-3.5 w-3.5"
                      color={card.category.color}
                    />
                    {categoryLabel(card.category)}
                  </span>
                )}
              </div>

              {card.description && (
                <p className="mt-3 text-[13.5px] leading-snug text-muted">{card.description}</p>
              )}

              {/* ---------------- sayılar ----------------
                  ⚠️ Üçü de GERÇEK veriden: takipçi · hikaye · gönderi. Ekran
                  görüntüsündeki "Campaigns" bu üründe karşılığı olmayan bir
                  kavram; olmayan bir sayacı çizmek, 91. turda düzeltilen
                  "gösterilen ama artmayan sayaç" hatasını yeniden üretirdi. */}
              <div className="mt-4 flex items-center gap-6">
                {/* 🔴 25 Ağu 2026 — ORTADAKİ SAYAÇ "Hikaye" DEĞİL "Takip
                    edilen" (kullanıcı isteği). Hikaye sayısı zaten şeridin
                    kendisinde görünüyordu ve **geçici** bir sayı: 24 saat
                    sonra sıfırlanıyor. Takip edilen sayısı ise takipçi
                    sayısının doğal eşi — ikisi yan yana profilin ölçeğini
                    anlatıyor. */}
                <Stat value={owner?.followerCount ?? 0} label={t('me.followers')} />
                <Stat value={owner?.followingCount ?? 0} label={t('me.following')} />
                <Stat value={card.postCount} label={t('home.tabPosts')} />
              </div>

              <div className="mt-4 flex items-center gap-2">
                {/*
                  🔴 MAĞAZA BEĞENİSİ (97. tur, kullanıcı isteği: *"haritadaki
                  mağaza kartlarına da kalp işareti koy"*). 3B mağazadaki kalple
                  aynı eylemi yapar — ikisi de aynı sayacı besler.

                  ⚠️ Sayı düğmenin İÇİNDE: ayrı bir sayaç şeridi, 91. turun
                  "gösterilen ama artmayan sayaç" hatasının görünür olmadığı
                  yerdir; burada basan kişi sayının arttığını aynı anda görür.
                */}
                {variant === 'session' && !card.reserved && (
                  <button
                    type="button"
                    className={`waydee-store-like ${
                      (likeState?.liked ?? card.likedByMe) ? 'waydee-store-like-on' : ''
                    }`}
                    aria-pressed={likeState?.liked ?? card.likedByMe}
                    aria-label={t('territoryCard.like')}
                    onClick={() => {
                      const current = likeState ?? { liked: card.likedByMe, count: card.likeCount }
                      const next = {
                        liked: !current.liked,
                        count: Math.max(0, current.count + (current.liked ? -1 : 1)),
                      }
                      setLikeState(next)
                      likeTerritory(String(territory.id), next.liked)
                        .then((res) => setLikeState({ liked: res.liked, count: res.likeCount }))
                        /* Hata → durum geri alınır; sessizce "beğenilmiş"
                           görünen bir kalp, kullanıcıya yalan söylerdi. */
                        .catch(() => setLikeState(current))
                    }}
                  >
                    <Heart className="h-4 w-4" />
                    <span className="tabular-nums">{likeState?.count ?? card.likeCount}</span>
                  </button>
                )}
                {showFollow && (
                  <Button
                    variant={owner?.followedByMe ? 'subtle' : 'primary'}
                    className="flex-1"
                    disabled={followMutation.isPending}
                    onClick={() => followMutation.mutate()}
                  >
                    {owner?.followedByMe ? t('follow.following') : t('follow.follow')}
                  </Button>
                )}
                <Button
                  variant={showFollow ? 'stroke' : 'primary'}
                  className="flex-1"
                  disabled={!owner?.username}
                  onClick={openProfile}
                >
                  {t('territoryCard.viewStore')}
                  <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </Button>
                {/* 🔴 25 Ağu 2026 — "…" DÜĞMESİ KALDIRILDI (kullanıcı isteği).
                    Zaten menü açmıyordu, yanındaki "Mağazayı gör" ile
                    **birebir aynı yere** gidiyordu: aynı hedefe iki düğme,
                    kullanıcıya "bunlar farklı şeyler mi?" dedirtir. */}
              </div>

              {/* Kullanıcı isteği: *"ekstra olarak sosyal medya ikonları
                  gelecek, şu ankinde olan"* — mevcut `SocialLinks` bileşeni. */}
              {card.socialLinks?.length > 0 && (
                <SocialLinks links={card.socialLinks} size="sm" className="mt-4" />
              )}
            </div>

            {/* ---------------- son hikayeler ---------------- */}
            {stories.length > 0 && storyAuthor && (
              <div className="mt-5 px-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted">
                    {t('territoryCard.recentStories')}
                  </p>
                  <button
                    type="button"
                    className="text-[12px] font-bold text-accent"
                    onClick={() => setStoryIndex(0)}
                  >
                    {t('territoryCard.viewAll')}
                  </button>
                </div>
                <div className="waydee-store-sheet-stories mt-2.5">
                  {stories.map((story, index) => (
                    <button
                      key={story.id}
                      type="button"
                      onClick={() => setStoryIndex(index)}
                      className="w-[4.75rem] shrink-0 text-start"
                    >
                      {/* ⚠️ Halka `seen`e göre solar — profildeki
                          `ProfileStoryRing` ile aynı kural. */}
                      <span
                        className="block rounded-xl p-[2px]"
                        style={{ background: story.seen ? 'var(--color-line)' : ringGradient }}
                      >
                        <span className="block overflow-hidden rounded-[0.6rem] border-2 border-surface">
                          <img
                            src={story.mediaUrl}
                            alt=""
                            loading="lazy"
                            className="h-[5.5rem] w-full object-cover"
                          />
                        </span>
                      </span>
                      <span className="mt-1.5 block truncate text-[11.5px] font-bold leading-tight">
                        {story.caption || t('territoryCard.story')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------- gönderiler ---------------- */}
            {!card.canOpen ? (
              <div className="mt-5 flex items-center gap-2 border-t border-line px-5 py-4 text-[13px] font-medium text-muted">
                <Lock className="h-4 w-4 shrink-0" />
                {card.lockedReason ?? t('territoryCard.locked')}
              </div>
            ) : posts.length > 0 ? (
              <div className="mt-5 grid grid-cols-3 gap-1 border-t border-line p-1">
                {posts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => navigate(`/posts/${post.id}`)}
                    className="group relative overflow-hidden rounded-lg bg-subtle"
                    style={{ aspectRatio: '1 / 1' }}
                  >
                    {post.imageUrl ? (
                      <img
                        src={post.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-muted">
                        <ImageOff className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : postsQuery.isLoading ? (
              <div className="mt-5 grid h-20 place-items-center border-t border-line">
                <Spinner />
              </div>
            ) : (
              <p className="mt-5 border-t border-line px-5 py-4 text-center text-[13px] font-medium text-faint">
                {t('territoryCard.noPosts')}
              </p>
            )}

            {/* ⚠️ Alt boşluk: mobilde alt gezinme çubuğu ve `safe-area` var;
                olmadan son satır çubuğun altında kalıyordu. */}
            <div className="h-[max(1.5rem,env(safe-area-inset-bottom))]" />
          </div>
        )}
      </motion.div>

      {/* Hikaye görüntüleyici — panelin ÜSTÜNDE tam ekran. */}
      {storyIndex !== null && storyAuthor && stories.length > 0 && (
        <StoryViewer
          author={storyAuthor}
          stories={stories}
          startIndex={storyIndex}
          onClose={() => setStoryIndex(null)}
        />
      )}
    </>
  )
}

/** Sayı + etiket — üç sayacın tek kalıbı. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[17px] font-black leading-none tabular-nums">{value}</p>
      <p className="mt-1 truncate text-[11.5px] font-semibold text-muted">{label}</p>
    </div>
  )
}
