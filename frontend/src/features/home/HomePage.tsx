import { useEffect, useState } from 'react'
import { LinkDetailModal } from '@/features/link/LinkDetailModal'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, Plus } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { Pagination } from '@/components/ui/pagination'
import { CreateModal } from '@/components/layout/CreateModal'
import { AddLinkModal } from '@/features/link/AddLinkModal'
import { CreateCollectionModal } from '@/features/collection/CreateCollectionModal'
import { PostCard } from '@/features/post/PostCard'
import { StoryTray } from '@/features/story/StoryTray'
import { PlanBadge, PlanLimitCard } from '@/features/plan/PlanBadge'
import { PromoteCard } from '@/features/promotion/PromoteCard'
import { api } from '@/lib/api'
import { useT } from '@/i18n'
import { IconCollections, IconLinks, IconPosts } from '@/features/profile/profileIcons'

interface Page<T> {
  content: T[]
  page: number
  totalPages: number
  totalElements: number
}
interface PostTile {
  id: string
  title: string | null
  caption: string | null
  imageUrl: string | null
  tagCount: number
  likeCount: number
}
interface LinkRow {
  id: string
  title: string
  url: string
  iconUrl: string | null
  domainLabel: string | null
}
interface CollectionRow {
  id: string
  title: string
  coverUrl: string | null
  itemCount: number
}

type TabKey = 'links' | 'posts' | 'collections'

/**
 * Ana sayfa — <b>referans ekran görüntüleriyle birebir</b>.
 *
 * ```
 *      🔗 LINKS   🏷 POSTS   ▦ COLLECTIONS     ← ortalı şerit, seçili = beyaz pill
 *   ┌──────────┐ ┌──────────┐
 *   │ TRENDYOL │ │          │                  ← kart: görsel + sol üstte alan adı
 *   │  görsel  │ │          │
 *   ├──────────┤ ├──────────┤
 *   │ krem     │ │ sa       │                  ← açık gri şeritte ad
 *   └──────────┘ └──────────┘
 *            ‹ 1 ›                             ← sayfalama HER sekmede
 * ```
 *
 * ⚠️ <b>Varsayılan sekme LINKS</b> — ekran görüntülerinde seçili olan o.
 * ⚠️ Sayfalama <b>boş durumda da</b> çizilir (referansta "No links" ekranında
 * bile chevron'lar duruyor).
 * 🔴 Önceki sürümde `links`/`collections` sekmeleri yalnız boş kutu gösteriyor
 * ve <b>hiçbir şey oluşturulamıyordu</b>: "+ → Link" adres değiştiriyor ama
 * hiçbir modal açmıyordu. Artık her sekmenin kendi oluşturma modalı var.
 */
export function HomePage() {
  const t = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  /**
   * 🔴 15 Ağu 2026 — VARSAYILAN SEKME `posts` (eskiden `links`).
   *
   * Kullanıcı: *"login olduğumuzda home'da bağlantılar açılıyor, gönderiler
   * açılacak; her home'a gittiğimizde, her yerden gidilirse gidilsin."*
   *
   * ⚠️ Tek nokta bilinçli: `/home`'a giren her yol (giriş · kayıt · üst
   * çubuktaki marka · alt gezinme · ödeme dönüşü · guard yönlendirmeleri)
   * adrese `?tab=` koymadan geliyor, yani hepsi buradan çözülüyor. Sekmeyi
   * çağrı yerlerine `?tab=posts` ekleyerek çözmek, ileride eklenecek yeni bir
   * yolun yine `links` açmasına yol açardı.
   *
   * ⚠️ Açık `?tab=` hâlâ ezer — `PostEditPage` (`?tab=posts`) ve
   * `CollectionPage` (`?tab=collections`) kaydettikten sonra kullanıcıyı
   * geldiği sekmeye geri bırakıyor; o davranış korunmalı.
   */
  const tab = (params.get('tab') as TabKey) || 'posts'
  const page = Math.max(Number(params.get('page') || '1'), 1)

  const [createOpen, setCreateOpen] = useState(false)
  /** Açık bağlantı penceresinin kimliği — gönderi karosundaki `detail` deseninin aynısı. */
  const [linkDetail, setLinkDetail] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)

  // "+ → Link/Collection" bu sayfaya `?create=1` ile gelir; doğru modalı açıp
  // bayrağı adresten temizleriz (yenilemede tekrar açılmasın).
  useEffect(() => {
    if (params.get('create') !== '1') return
    if (tab === 'links') setLinkOpen(true)
    if (tab === 'collections') setCollectionOpen(true)
    const next = new URLSearchParams(params)
    next.delete('create')
    setParams(next, { replace: true })
  }, [params, setParams, tab])

  const setTab = (next: TabKey) => {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    p.delete('page') // sekme değişince 1. sayfadan başla
    setParams(p, { replace: true })
  }
  const setPage = (next: number) => {
    const p = new URLSearchParams(params)
    p.set('page', String(next))
    setParams(p, { replace: true })
  }

  /*
   * ⚠️ Sunucu 0 tabanlı, arayüz 1 tabanlı (referansın `page` prop'u da 1
   * tabanlıdır) → istekte `page - 1`.
   * ⚠️ Üç sorgu da AYRI yazılır, bir yardımcı fonksiyonda toplanmaz: `useQuery`
   * bir hook'tur ve koşullu/döngüsel çağrılamaz (React hook kuralı).
   */
  const linksQuery = useQuery({
    queryKey: ['profile-links', page],
    queryFn: async () => (await api.get<Page<LinkRow>>(`/profile-links?page=${page - 1}`)).data,
    enabled: tab === 'links',
  })
  const postsQuery = useQuery({
    queryKey: ['profile-posts', page],
    queryFn: async () => (await api.get<Page<PostTile>>(`/profile-posts?page=${page - 1}`)).data,
    enabled: tab === 'posts',
  })
  const collectionsQuery = useQuery({
    queryKey: ['collections', page],
    queryFn: async () => (await api.get<Page<CollectionRow>>(`/collections?page=${page - 1}`)).data,
    enabled: tab === 'collections',
  })
  const active =
    tab === 'links' ? linksQuery : tab === 'posts' ? postsQuery : collectionsQuery
  const totalPages = active.data?.totalPages ?? 0
  const isEmpty = !active.isLoading && (active.data?.content.length ?? 0) === 0

  const TABS: { key: TabKey; icon: typeof IconLinks; label: string }[] = [
    /* 🔴 İkonlar `profileIcons.tsx`'ten — referansın (taginbio) KENDİ path
       verisi. Burada lucide `Link2 / Tag / LayoutGrid` kullanılıyordu ve
       vitrin profilindeki sekmelerle görsel olarak tutmuyordu; oysa ikisi de
       aynı üç sekme. */
    { key: 'links', icon: IconLinks, label: t('home.tabLinks') },
    { key: 'posts', icon: IconPosts, label: t('home.tabPosts') },
    { key: 'collections', icon: IconCollections, label: t('home.tabCollections') },
  ]

  const startCreate = () => {
    if (tab === 'links') setLinkOpen(true)
    else if (tab === 'collections') setCollectionOpen(true)
    else setCreateOpen(true)
  }

  return (
    <div className="flex w-full flex-col items-center">
      {/*
        🔴 8 Ağu 2026 — ANA SAYFA SADELEŞTİ (kullanıcı isteği: "sadece
        bağlantılar, gönderiler ve koleksiyonlar kalacak").
        Buradan taşınanlar — <b>hiçbiri silinmedi</b>:
         · `ProfileHeader` (avatar · ad · vitrin adresi · daire çipleri) → `/me`
         · `StoryTray` (hikaye şeridi) → `/me`
        ⚠️ Hikaye <b>paylaşma</b> ayrıca `+` menüsüne alındı; şerit taşınınca
        oluşturmanın tek girişi kalmasın diye. Bkz. `useStoryComposer`.
        Ana sayfa artık tek işe bakar: içeriğini yönetmek.
      */}

      {/* 🔴 9 Ağu 2026 — HİKAYE ŞERİDİ ANA SAYFAYA GERİ GELDİ, ama başka bir
          işle: <b>takip ettiklerimin</b> hikayeleri (`scope="following"`) ve
          <b>daha ince çerçeve</b> (`variant="thin"`) — kullanıcı isteği.
          8 Ağustos'ta şerit buradan `/me`'ye taşınmıştı; oradaki keşif şeridi
          (tüm açık hesaplar) olduğu gibi duruyor. İkisi ayrı kapsam çünkü ayrı
          iki soru: "kimi takip ediyorum" ve "kimler paylaşmış". */}
      <div className="w-full max-w-screen-xl">
        <StoryTray scope="following" variant="thin" />
      </div>

      {/* Plan rozeti sekmelerin yanında: kullanıcı hakkını limite çarpmadan görür.
          🔴 25 Ağu 2026 (98. tur) — SAĞINDA "mağazanı öne taşı" kartı
          (kullanıcı isteği). Paket rozeti "neyim var", öne çıkarma "daha ne
          alabilirim" cümlesidir; yan yana durunca ikincisi birincinin doğal
          devamı olur. ⚠️ Kart mağazası olmayana hiç çizilmez (bkz. bileşen). */}
      <div className="flex w-full max-w-screen-xl flex-wrap items-center gap-3">
        <PlanBadge />
        <PromoteCard />
      </div>

      {/* 🔴 Sekme şeridi vitrin profiliyle AYNI bileşene alındı
          (`waydee-ptabs`/`waydee-ptab`). Burada ikinci bir uygulama vardı
          (`waydee-tabs`) ve referanstan sapmıştı: kap köşesi 12px (16 olmalı),
          sekme köşesi 8px (11.2 olmalı), yazı kalınlığı tanımsız (500 olmalı)
          ve seçili sekme DOLU KOYU bir hap oluyordu — referansta seçili sekme
          BEYAZ bir yüzey üstünde siyah yazıdır. Aynı üç sekmenin iki ayrı
          görünümü olması zaten hataydı. */}
      <div className="waydee-ptabs mt-2" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className="waydee-ptab"
          >
            {tab === item.key && <span className="waydee-ptab-cursor" aria-hidden />}
            <span className="waydee-ptab-content">
              <item.icon />
              <span className="uppercase">{item.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 w-full max-w-screen-xl">
        {tab === 'posts' && <PlanLimitCard />}
        {active.isLoading && <PageSpinner label={t('feed.loading')} />}

        {isEmpty && (
          <div className="waydee-empty">
            <h3 className="mb-2 text-lg font-semibold">
              {tab === 'links'
                ? t('home.noLinks')
                : tab === 'posts'
                  ? t('home.noPosts')
                  : t('home.noCollections')}
            </h3>
            <button type="button" onClick={startCreate} className="waydee-empty-cta">
              <Plus className="h-5 w-5" />
              {tab === 'links'
                ? t('home.firstLink')
                : tab === 'posts'
                  ? t('home.firstPost')
                  : t('home.firstCollection')}
            </button>
          </div>
        )}

        {!active.isLoading && !isEmpty && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {tab === 'links' &&
              linksQuery.data?.content.map((l) => (
                /* 🔴 17 Ağu 2026 — karo artık adresi DOĞRUDAN AÇMIYOR.
                   Sahibi kendi bağlantısını yönetemiyordu: düzenlemenin ya da
                   silmenin hiçbir yolu yoktu. Karo bir PENCERE açar; adrese
                   gitmek orada bir düğme — gönderi karosunun deseninin
                   birebir aynısı (o da rotaya değil `PostDetailModal`a gider).
                   ⚠️ İlk denemede ayrı bir rota (`/link/:id`) yazılmıştı ve
                   adres çubuğunda UUID bırakıyordu; kullanıcı haklı olarak
                   reddetti. */
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLinkDetail(l.id)}
                  className="waydee-link-card text-start"
                >
                  <span className="waydee-link-media">
                    {l.iconUrl ? <img src={l.iconUrl} alt="" loading="lazy" /> : null}
                    {l.domainLabel && <span className="waydee-link-domain">{l.domainLabel}</span>}
                  </span>
                  <span className="waydee-link-title block truncate">{l.title}</span>
                </button>
              ))}

            {tab === 'posts' &&
              /* ⋯ menüsü ve detay/düzenleme penceresi PostCard'ın içindedir. */
              postsQuery.data?.content.map((p) => <PostCard key={p.id} post={p} owner />)}

            {tab === 'collections' &&
              collectionsQuery.data?.content.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/collections/${c.id}`)}
                  className="waydee-link-card"
                >
                  <span className="waydee-link-media">
                    {c.coverUrl ? (
                      <img src={c.coverUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-muted">
                        <LayoutGrid className="h-6 w-6" />
                      </span>
                    )}
                  </span>
                  <span className="waydee-link-title block truncate">{c.title}</span>
                </button>
              ))}
          </div>
        )}

        {/* ⚠️ Sayfalama boş durumda da çizilir — referansta öyle. */}
        <Pagination
          page={page}
          totalPages={Math.max(totalPages, 1)}
          onChange={setPage}
          className="mt-6"
        />
      </div>

      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <AddLinkModal open={linkOpen} onClose={() => setLinkOpen(false)} />
      <CreateCollectionModal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        onCreated={(id) => navigate(`/collections/${id}`)}
      />
      {/* Bağlantı detayı — karo tıklanınca açılır (gönderi karosuyla aynı desen). */}
      {linkDetail && (
        <LinkDetailModal linkId={linkDetail} onClose={() => setLinkDetail(null)} />
      )}
    </div>
  )
}
