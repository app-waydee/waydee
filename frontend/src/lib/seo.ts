import { useEffect } from 'react'

/**
 * <b>Sayfa meta'sı</b> — başlık, açıklama, kanonik adres, Open Graph ve JSON-LD.
 *
 * <p>🔴 <b>Neden gerekli:</b> tek sayfalık uygulamada belge başlığı ve meta
 * etiketleri {@code index.html}'de <b>bir kez</b> yazılır; gezinme onları
 * değiştirmez. Yani kullanıcı bir vitrin profiline gittiğinde tarayıcı sekmesi,
 * yer imi adı ve <b>sayfa geçmişi</b> hâlâ "WAYDEE · Dünyada Yerini Al" diyordu.
 *
 * <p>⚠️ Bu kanca <b>bot SEO'sunun yerine geçmez</b>: JavaScript çalıştırmayan
 * önizleme robotları bu değişiklikleri hiç görmez. Sunucu tarafındaki karşılığı
 * {@code SeoService}'tir (nginx botları oraya yönlendirir). İkisi <b>aynı
 * değerleri</b> üretmek zorundadır; ayrışırlarsa paylaşılan kart ile sayfanın
 * kendisi farklı şeyler söyler.
 *
 * <p>⚠️ Temizlik şart: bileşen kalkarken eklenen etiketler kaldırılır, yoksa
 * profilden profile gezinen kullanıcıda <b>üst üste binmiş</b> canonical ve
 * JSON-LD kalır (Google bunu çelişkili sinyal sayar).
 */
export interface SeoOptions {
  title: string
  description?: string
  /** Kanonik yol (`/ali`) ya da tam adres. Verilmezse mevcut adres kullanılır. */
  canonicalPath?: string
  image?: string | null
  type?: 'website' | 'profile' | 'article'
  /** Uygulama içi (oturumlu) ekranlar için: arama motoruna "indeksleme" de. */
  noindex?: boolean
  /** Sayfaya gömülecek yapılandırılmış veri. */
  jsonLd?: Record<string, unknown> | null
}

const MANAGED = 'data-waydee-seo'

function meta(attr: 'name' | 'property', key: string, content: string) {
  const el = document.createElement('meta')
  el.setAttribute(attr, key)
  el.setAttribute('content', content)
  el.setAttribute(MANAGED, '')
  document.head.appendChild(el)
}

export function useSeo(options: SeoOptions | null) {
  const key = JSON.stringify(options ?? {})
  useEffect(() => {
    if (!options) return
    const previousTitle = document.title
    document.title = options.title

    const url = options.canonicalPath
      ? options.canonicalPath.startsWith('http')
        ? options.canonicalPath
        : window.location.origin + options.canonicalPath
      : window.location.origin + window.location.pathname

    const desc = (options.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)

    const link = document.createElement('link')
    link.rel = 'canonical'
    link.href = url
    link.setAttribute(MANAGED, '')
    document.head.appendChild(link)

    if (desc) meta('name', 'description', desc)
    meta(
      'name',
      'robots',
      options.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1',
    )
    meta('property', 'og:site_name', 'Waydee')
    meta('property', 'og:type', options.type ?? 'website')
    meta('property', 'og:title', options.title)
    meta('property', 'og:url', url)
    if (desc) meta('property', 'og:description', desc)
    meta('name', 'twitter:card', options.image ? 'summary_large_image' : 'summary')
    meta('name', 'twitter:title', options.title)
    if (desc) meta('name', 'twitter:description', desc)
    if (options.image) {
      meta('property', 'og:image', options.image)
      meta('name', 'twitter:image', options.image)
    }

    let script: HTMLScriptElement | null = null
    if (options.jsonLd) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(options.jsonLd)
      script.setAttribute(MANAGED, '')
      document.head.appendChild(script)
    }

    return () => {
      document.title = previousTitle
      document.head.querySelectorAll(`[${MANAGED}]`).forEach((el) => el.remove())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/**
 * Görsel adresini <b>kalıcı</b> paylaşım adresine çevirir.
 *
 * <p>⚠️ İmzalı medya bağlantısı 7 günde ölür; sosyal kartta ve arama
 * sonucunda görünen adres aylarca yaşar. Bu yüzden kartlarda her zaman
 * sunucudaki kalıcı yönlendirme uçları kullanılır.
 */
export function shareImageForPost(postId: string) {
  return `${window.location.origin}/api/v1/public/posts/${postId}/image`
}

export function shareImageForUser(userId: string) {
  return `${window.location.origin}/api/v1/public/profiles/id/${userId}/avatar`
}
