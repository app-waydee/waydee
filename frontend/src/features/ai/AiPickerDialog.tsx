import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { listGenerations } from '@/lib/aiStudio'
import { fileFromMediaUrl } from '@/lib/media'
import { lockScroll } from '@/lib/scrollLock'
import { useT } from '@/i18n'

/**
 * <b>"Yapay zekâ görsellerimden seç" — alttan açılan panel</b> (V45).
 *
 * <h3>🔴 Neden genel {@code Dialog} DEĞİL</h3>
 * <p>Kullanıcı: <i>"+ ile gönderi yüklerken bu kısma tıklayınca o pop-up'ın
 * ALTINDA açılıyor ve bozuluyor."</i> Ölçüldü: gönderi penceresinin perdesi
 * {@code .waydee-create-scrim} <b>z-index 70</b>, genel {@code Dialog} ise
 * <b>z-50</b> kullanıyor — yani galeri, kendisini açan pencerenin <b>arkasına</b>
 * düşüyordu.
 *
 * <p>⚠️ Çözüm genel {@code Dialog}'un z-index'ini yükseltmek <b>değil</b>: o
 * bileşen uygulamanın her yerinde kullanılıyor ve bir ekranı düzeltip
 * başkasında sıralamayı bozardı. Panel kendi yüzeyini alıyor (z-index 80).
 *
 * <p>Biçim de kullanıcının istediği gibi: <i>"altta ai galerisi açılabilir
 * soft şekilde"</i> — aşağıdan yumuşak bir yay eğrisiyle yükselen, tutamaçlı
 * bir panel. Bu aynı zamanda <b>doğru</b> çözüm: üstteki pencere görünür
 * kalıyor, yani kullanıcı hangi akışın içinde olduğunu kaybetmiyor.
 *
 * <h3>Neden {@link File} döndürüyor, medya kimliği değil</h3>
 * <p>Gönderi ve hikâye akışlarının ikisi de görseli <b>kırpıyor</b> ve kırpma
 * sonucu yeni bir görseldir. Dosya döndürmek, iki akışın da tek satır bile
 * değişmeden çalışmasını sağlıyor.
 *
 * <p>⚠️ Bayt indirilirken adrese {@code stream=1} eklenir: normal adres S3'e
 * 302 atıyor ve S3 CORS döndürmüyor — {@code fetch} sessizce başarısız olur,
 * kırpma tuvali de "kirlenip" {@code toDataURL}'de patlardı (vault, 85. tur).
 */
export function AiPickerDialog({
  onClose,
  onPicked,
}: {
  onClose: () => void
  /** Seçilen görselin dosya hâli — çağıran kendi kırpma akışına verir. */
  onPicked: (file: File) => void
}) {
  const t = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['ai-generations'],
    queryFn: () => listGenerations(40),
  })

  /* ⚠️ Kaydırma kilidi SAYAÇLIDIR (vault tuzağı): gönderi penceresi zaten
     kilitlemiş durumda ve bu ikinci kilit onu bozmaz; kapanışta yalnız kendi
     payı bırakılır. `overflow: hidden` ile kurulsaydı panel kapanınca alttaki
     pencerenin kilidi de düşerdi. */
  useEffect(() => {
    const release = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      release()
    }
  }, [onClose])

  const done = (data ?? []).filter((g) => g.status === 'SUCCEEDED' && g.imageUrl)

  const pick = async (url: string, id: string) => {
    setBusy(id)
    try {
      onPicked(await fileFromMediaUrl(url, 'waydee-ai.jpg'))
      onClose()
    } catch {
      // 🔴 Sessiz `await` yasak (vault, 73. tur): hata görünmezse kullanıcı
      // düğmenin çalışmadığını sanır.
      toast.error(t('ai.pickFailed'))
    } finally {
      setBusy(null)
    }
  }

  return createPortal(
    <div
      className="waydee-ai-sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t('ai.pickTitle')}
      onMouseDown={(e) => {
        // ⚠️ Yalnız perdenin KENDİSİNE basınca kapanır; panel içindeki bir
        // tıklamanın kabarcıklanması paneli kapatmamalı.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="waydee-ai-sheet">
        <span className="waydee-ai-sheet-grip" aria-hidden />

        <div className="waydee-ai-sheet-head">
          <span className="waydee-ai-sheet-title">
            <Sparkles className="h-4 w-4 shrink-0 text-violet" />
            <span className="truncate">{t('ai.pickTitle')}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="waydee-ai-shuffle shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="waydee-ai-sheet-body">
          {isLoading ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : done.length === 0 ? (
            <div className="py-8 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-faint" />
              <p className="mt-2 text-[13px] font-semibold text-muted">{t('ai.noneYet')}</p>
              <Link
                to="/ai"
                onClick={onClose}
                className="mt-4 inline-flex h-10 items-center rounded-xl bg-ink px-5 text-[13px] font-semibold text-on-ink transition-opacity hover:opacity-90"
              >
                {t('ai.openStudio')}
              </Link>
            </div>
          ) : (
            <div className="waydee-ai-sheet-grid">
              {done.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void pick(g.imageUrl as string, g.id)}
                  className="waydee-ai-sheet-tile"
                >
                  <img src={g.imageUrl as string} alt="" />
                  {busy === g.id && (
                    <span className="waydee-ai-sheet-busy">
                      <Spinner />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
