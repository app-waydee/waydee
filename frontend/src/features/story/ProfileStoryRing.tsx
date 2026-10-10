import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { userStories, viewStory } from '@/lib/social'
import { useT } from '@/i18n'
import type { AuthorSummary } from '@/types/api'
import { StoryViewer } from './StoryViewer'

interface ProfileStoryRingProps {
  /** Profilin sahibi — hikayeleri bu kişiden çekilir. */
  ownerUserId: string
  /** Görüntüleyicinin başlığında görünen yazar. */
  author: AuthorSummary
  /**
   * Sorgu atılsın mı. <b>Oturum yoksa `false`</b>: `/stories/user/:id` kimlik
   * ister, ziyaretçide 401 döner ve konsolu hatayla doldururdu.
   */
  enabled: boolean
  /** Halkanın saracağı avatar — olduğu gibi çizilir. */
  children: React.ReactNode
  /** Avatarın köşe yarıçapı; halka aynısını bir tık büyüğüyle kullanır. */
  radius?: 'circle' | 'square'
}

/** Görülmemiş hikaye halkası — Instagram'ın okunur kıldığı sıcak degrade. */
const UNSEEN_RING = 'linear-gradient(135deg,#2a85ff,#8e59ff,#ff6a55)'

/**
 * <b>Vitrin profilindeki hikaye halkası.</b>
 *
 * <p>🔴 16 Ağustos 2026, kullanıcı isteği: <i>"story'ler kişi profillerinde
 * görünsün; profil çerçevesinde hafif Instagram gibi bir çerçeveyle belli
 * olsun, tıklayınca story açılsın."</i>
 *
 * <p>🔴 <b>Neden `ProfileStoryAvatar` kullanılmadı.</b> O bileşen avatarı
 * <i>kendi</i> çiziyor (`Avatar` + boyut sınıfı) ve yanına "hikaye ekle"
 * düğmesi koyuyor — `/me` için doğru, vitrin için değil. Vitrin avatarının
 * görünümü referanstan <b>ölçülmüş</b> bir CSS sınıfıdır
 * (`.waydee-tag-avatar`: 112px kare, 2px çerçeve, 30px baş harfler); onu
 * `Avatar`'a çevirmek ölçülmüş tasarımı bozardı. Bu yüzden halka avatarı
 * <b>sarmalar</b>, yerini almaz.
 *
 * <p>⚠️ Hikayesi olmayan profilde halka <b>hiç çizilmez</b> ve avatar tek
 * pikselini bile oynatmaz: halka `padding` ile yer kaplar, koşulsuz çizilseydi
 * hikayesi olan ve olmayan profiller farklı boyda görünürdü.
 *
 * <p>⚠️ Ziyaretçide (oturumsuz) halka hiç görünmez. Hikaye uçları kimlik
 * ister; "giriş yap" diye bağıran bir halka çizmek yerine sessiz kalmak doğru.
 */
export function ProfileStoryRing({
  ownerUserId,
  author,
  enabled,
  children,
  radius = 'square',
}: ProfileStoryRingProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const storiesQuery = useQuery({
    queryKey: ['stories', 'user', ownerUserId],
    queryFn: () => userStories(ownerUserId),
    enabled: enabled && !!ownerUserId,
    /* Gizli hesapta 403 döner — tekrar denemek anlamsız, halka da çizilmez. */
    retry: false,
  })

  const stories = storiesQuery.data ?? []
  if (!stories.length) return <>{children}</>

  const hasUnseen = stories.some((s) => !s.seen)
  const shape = radius === 'square' ? 'rounded-[20px]' : 'rounded-full'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('story.open')}
        className={`inline-block p-[3px] ${shape}`}
        /* Görülmüşse halka nötr griye düşer — Instagram'ın da yaptığı ayrım;
           "yeni bir şey var mı" sorusunun tek bakışta cevabı bu. */
        style={{ background: hasUnseen ? UNSEEN_RING : 'var(--color-faint)' }}
      >
        <span className={`block border-[3px] border-surface bg-surface ${shape}`}>{children}</span>
      </button>

      {open && (
        <StoryViewer
          author={author}
          stories={stories}
          onClose={() => {
            setOpen(false)
            /* Halkayı tazele: bakılan hikaye artık "görüldü" ve halkanın
               griye dönmesi gerekiyor. Sunucuya yeniden sormak şart — `seen`
               kararını o veriyor. */
            void queryClient.invalidateQueries({ queryKey: ['stories', 'user', ownerUserId] })
          }}
          onViewed={(id) => {
            /* ⚠️ Hata YUTULUR ve beklenmez: "görüldü" bir ölçümdür, izlemeyi
               geciktirmemeli. Başarısız olursa halka bir süre daha renkli
               kalır, o kadar. */
            void viewStory(id).catch(() => {})
          }}
        />
      )}
    </>
  )
}
