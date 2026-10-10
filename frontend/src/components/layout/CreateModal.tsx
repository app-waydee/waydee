import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CirclePlay, Image, Layers, Link2, Sparkles, X } from 'lucide-react'
import { lockScroll } from '@/lib/scrollLock'
import { CreatePostFlow } from '@/features/post/CreatePostFlow'
import { useStoryComposer } from '@/features/story/useStoryComposer'
import { useT } from '@/i18n'

/**
 * "Create New" popup'ı — <b>referans ekran görüntüsüyle birebir</b>.
 *
 * ```
 * ┌───────────────────────────────┐
 * │        Create New          ✕  │
 * │ ┌───────────────────────────┐ │
 * │ │ 🔗  Link                  │ │  ← beyaz kart, rounded-2xl, hairline
 * │ │     Add a new link…       │ │
 * │ ├───────────────────────────┤ │
 * │ │ 🖼  Post                  │ │
 * │ ├───────────────────────────┤ │
 * │ │ 📚 Collection             │ │
 * └───────────────────────────────┘
 * ```
 * Sıra referanstaki gibidir: <b>Link → Post → Collection</b>.
 *
 * 🔴 <b>Önceki sürüm bozuktu:</b> açılır menü `/create/post`,
 * `/collections/new`, `/links/new` adreslerine gidiyordu ve bu rotaların
 * <b>hiçbiri router'da tanımlı değildi</b> → tıklayınca hiçbir şey olmuyordu.
 * Artık hedefler var olan rotalardır (`/home` + sekme + `create` bayrağı).
 */
export function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const [postFlow, setPostFlow] = useState(false)
  /* Hikaye zinciri (seç → 9:16 kırp → açıklama/bölge → yayınla) şeritle ORTAK. */
  const { openPicker, composer, active: storyActive } = useStoryComposer(onClose)

  // ⚠️ Kilit `overflow:hidden` ile KURULMAZ (kaydırma çubuğu kaybolur, sayfa
  // 8px kayar) — projenin sayaçlı `lockScroll`u kullanılır (vault tuzağı).
  useEffect(() => {
    if (!open) return
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [open, onClose])

  // Gönderi akışı popup'ın KENDİSİNDEN açılır — sayfa değiştirmez.
  if (postFlow) {
    return <CreatePostFlow open onClose={() => { setPostFlow(false); onClose() }} />
  }
  /*
   * ⚠️ Hikaye akışı açıkken menü GİZLENİR ama <b>ağaçtan sökülmez</b>:
   * `composer` sökülseydi kırpma/paylaşma pencereleri de yok olur, akış
   * ortasında kapanırdı. Bu yüzden `open` kontrolü aşağıda yalnız menü
   * kartlarını sarar, `composer` her hâlükârda çizilir.
   */
  if (!open && !storyActive) return composer

  const go = (tab: string) => {
    if (tab === 'posts') { setPostFlow(true); return }
    if (tab === 'ai') { onClose(); navigate('/ai'); return }
    if (tab === 'story') {
      // 🔴 Dosya seçici DOĞRUDAN tıklama işleyicisinden açılır — bir efekte
      // ertelenirse tarayıcı kullanıcı hareketi görmediği için engeller.
      openPicker()
      return
    }
    onClose()
    navigate(`/home?tab=${tab}&create=1`)
  }

  const options = [
    { icon: Link2, title: t('create.linkTitle'), desc: t('create.linkDesc'), tab: 'links' },
    { icon: Image, title: t('create.postTitle'), desc: t('create.postDesc'), tab: 'posts' },
    /*
     * 🔴 8 Ağu 2026 — HİKAYE eklendi (kullanıcı isteği). Öncesinde hikaye
     * paylaşmanın tek yolu ana sayfadaki şeritte kendi dairene dokunmaktı;
     * ana sayfa sadeleşince o şerit `/me`'ye taşındı ve "+ → Hikaye" hikayenin
     * birincil giriş noktası oldu.
     * ⚠️ Sıra sona konuldu: referansın Link → Post → Collection sırası korunur,
     * yeni öğe araya girmez.
     */
    { icon: Layers, title: t('create.collectionTitle'), desc: t('create.collectionDesc'), tab: 'collections' },
    { icon: CirclePlay, title: t('create.storyTitle'), desc: t('create.storyDesc'), tab: 'story' },
    /*
     * 🔴 16 Ağu 2026 (V45) — YAPAY ZEKÂ GÖRSELİ.
     * ⚠️ Bu kart bir akış AÇMAZ, stüdyoya GİDER: üretim bir form doldurmayı
     * gerektiriyor ve onu bir popup'a sıkıştırmak, sekmelerin ve sonuç
     * panelinin yerini bırakmazdı. Üretilen görselden gönderi/hikâye açmak
     * yine buradaki iki karttan yapılır ("Yapay zekâ görsellerimden seç").
     */
    { icon: Sparkles, title: t('create.aiTitle'), desc: t('create.aiDesc'), tab: 'ai' },
  ]

  return createPortal(
    <>
      {composer}
      {open && !storyActive && (
    <div
      className="waydee-create-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t('create.newTitle')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="waydee-create-modal">
        <div className="relative mb-5">
          <h2 className="text-center text-xl font-bold">{t('create.newTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute end-0 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {options.map((o) => (
            <button key={o.tab} type="button" onClick={() => go(o.tab)} className="waydee-create-card">
              <o.icon className="h-6 w-6 shrink-0" strokeWidth={1.9} />
              <span className="min-w-0 text-start">
                <span className="block text-[15px] font-bold leading-tight">{o.title}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
      )}
    </>,
    document.body,
  )
}
