import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { MarketingNav } from '@/components/MarketingNav'
import { PageSpinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/stores/auth'
import { useSeo, shareImageForPost } from '@/lib/seo'
import { useT } from '@/i18n'
import { PostDetailBody, usePostDetail } from './PostDetailModal'

/**
 * <b>Herkese açık gönderi sayfası</b> — {@code /post/:postId}.
 *
 * <p>🔴 <b>Neden bir SAYFA gerekti:</b> gönderinin paylaşılabilir bir adresi
 * yoktu. "Copy link" {@code /p/{postId}} üretiyordu ama o rota <b>kullanıcı</b>
 * sayfasınındır — bağlantıya tıklayan herkes "profil bulunamadı" görüyordu.
 * Pencere (modal) tek başına yetmez: modalın adresi olmaz, geri tuşu çalışmaz
 * ve <b>arama motoruna verilecek bir sayfa</b> ortaya çıkmaz.
 *
 * <p>⚠️ Rota iki guard'ın da DIŞINDADIR (vitrin profili gibi): {@code RequireAuth}
 * altında ziyaretçi hiç giremezdi, {@code RedirectIfAuthed} altında ise giriş
 * yapmış kullanıcı kendi paylaştığı bağlantıyı açamaz, haritaya atılırdı.
 *
 * <p>Sayfanın gövdesi pencereyle <b>aynı bileşendir</b> ({@code PostDetailBody}):
 * beğeni, kaydetme, ürün etiketleri ve sosyal bağlantılar iki yerde de birebir.
 */
export function PublicPostPage() {
  const t = useT()
  const { postId = '' } = useParams()
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const q = usePostDetail(postId)
  const d = q.data

  const authorName = d?.author?.displayName || d?.author?.tag || 'Waydee'
  const title = d?.title || `${authorName} · Waydee`
  const productNames = (d?.tags ?? [])
    .map((x) => x.productName)
    .filter((x): x is string => !!x)

  useSeo(
    !d
      ? null
      : {
          title,
          description:
            d.caption ||
            (productNames.length
              ? `${authorName}: ${productNames.slice(0, 6).join(', ')}`
              : t('seo.postFallback')),
          canonicalPath: `/post/${d.id}`,
          image: d.imageUrl ? shareImageForPost(d.id) : null,
          type: 'article',
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'SocialMediaPosting',
            headline: title,
            url: `${window.location.origin}/post/${d.id}`,
            author: d.author
              ? {
                  '@type': 'Person',
                  name: authorName,
                  url: `${window.location.origin}/${d.author.tag}`,
                }
              : undefined,
            image: d.imageUrl ? shareImageForPost(d.id) : undefined,
            articleBody: d.caption ?? undefined,
            /* Ürün etiketleri Google'a `Product` + `Offer` olarak verilir:
               fiyatlı bir etiket zengin sonuçta fiyatıyla görünebilir. */
            mentions: d.tags.map((tag) => ({
              '@type': 'Product',
              name: tag.productName || tag.productUrl,
              url: tag.productUrl,
              ...(tag.price
                ? {
                    offers: {
                      '@type': 'Offer',
                      price: String(tag.price),
                      priceCurrency: tag.currency || 'TRY',
                      url: tag.productUrl,
                    },
                  }
                : {}),
            })),
          },
        },
  )

  return (
    <div className="waydee-vitrin flex min-h-full w-full flex-col items-center">
      <MarketingNav variant="minimal" />
      <div className="mx-auto w-full max-w-[520px] px-4 py-5">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
          {t('common.back')}
        </button>

        {q.isLoading ? (
          <PageSpinner label={t('feed.loading')} />
        ) : !d ? (
          <div className="waydee-empty">
            <h3 className="text-lg font-semibold">{t('post.notFound')}</h3>
          </div>
        ) : (
          <div className="waydee-post-page">
            <PostDetailBody
              data={d}
              owner={!!me && me.username === d.author?.tag}
              onEdit={() => navigate(`/posts/${d.id}/edit`)}
            />
          </div>
        )}

        {!me && (
          <div className="mt-8 flex justify-center">
            <Link to={`/login?next=${encodeURIComponent(`/post/${postId}`)}`} className="waydee-vitrin-login">
              {t('landing.nav.login')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
