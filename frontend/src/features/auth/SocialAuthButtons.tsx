import { useEffect, useState, type ReactNode } from 'react'
import { toast } from '@/components/ui/toast'
import { useT } from '@/i18n'
import { isGoogleAuthEnabled, subscribeGoogleAuth } from '@/lib/clientConfig'

/**
 * Referansın "Continue with …" düğme kümesi.
 *
 * Sıra referansın kendi dizisinden alındı: `[GOOGLE, APPLE, FACEBOOK]`
 * (paketteki `Mn`/`Kn` sabitleri). Etiket şablonu da referansın kendisi:
 * <b>"Continue with {service}"</b> — büyük harfe çevrilmez
 * (`textTransform: "none"`), harf aralığı 0'dır.
 *
 * 🔴 <b>Sadece Google gerçek bir akıştır.</b> Arka uçta yalnız Google OAuth
 * var ([[16-google-giris]]); Apple ve Facebook kullanıcının isteği üzerine
 * <b>temsilen</b> duruyor. Tıklanınca sessizce hiçbir şey yapmak yerine
 * "yakında" bildirimi çıkar — çalışmayan bir düğmeyi çalışıyormuş gibi
 * göstermek kullanıcıyı ölü bir yola sokardı.
 */

/* 🔴 Üç işaret de referansın CANLI DOM'undan `svg.outerHTML` ile alındı —
   path verileri birebir aynıdır, elle çizim/tahmin yoktur.
   ⚠️ `shrink-0` şart: düğme bir flex kabıdır ve etiket `flex-grow:1` aldığı
   için ikon aksi halde ezilip bozuluyor (kullanıcının gördüğü hata buydu). */

/** Google — referansın 18×18, dört renkli işareti (birebir). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.476 7.364H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615 0-.639-.057-1.252-.164-1.841z"
        fill="#4285F4"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.956 15.82l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18c2.43 0 4.467-.806 5.956-2.18z"
        fill="#34A853"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332A5.41 5.41 0 013.682 9z"
        fill="#FBBC05"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.44 4.925l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58c1.321 0 2.508.454 3.44 1.345z"
        fill="#EA4335"
      />
    </svg>
  )
}

/** Apple — referansın 16×20 işareti (birebir; öncekinde uydurma bir yol vardı). */
function AppleMark() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M15.665 15.586a11.048 11.048 0 01-1.022 1.934c-.537.806-.976 1.364-1.315 1.674-.525.509-1.088.769-1.69.784-.434 0-.955-.13-1.563-.393-.609-.262-1.169-.391-1.681-.391-.537 0-1.113.13-1.729.391-.617.263-1.114.4-1.494.414-.578.026-1.154-.242-1.729-.805-.367-.337-.826-.915-1.376-1.733-.59-.874-1.075-1.888-1.455-3.044C.204 13.17 0 11.961 0 10.791c0-1.34.275-2.497.826-3.465a4.986 4.986 0 011.73-1.843 4.48 4.48 0 012.339-.695c.459 0 1.061.15 1.809.443.746.295 1.225.445 1.435.445.157 0 .689-.175 1.591-.524.853-.323 1.573-.457 2.163-.404 1.598.136 2.798.8 3.597 1.994-1.43.912-2.136 2.19-2.122 3.827.013 1.277.452 2.339 1.316 3.182.392.391.83.694 1.316.908-.105.323-.217.631-.335.927zM11.999.401c0 1-.347 1.934-1.038 2.798-.835 1.028-1.845 1.622-2.94 1.528a3.275 3.275 0 01-.022-.38c0-.96.397-1.987 1.102-2.827.352-.426.8-.78 1.342-1.061C10.986.18 11.498.027 11.98 0c.013.134.02.268.02.4z"
        fill="#000"
      />
    </svg>
  )
}

/**
 * Facebook — 22×22, marka mavisi `#1877F2`.
 * ⚠️ Referans burada bir **base64 PNG** gömüyor (Facebook'un kendi rasteri);
 * o ikili veri kopyalanmadı, aynı marka işaretinin vektör hâli kullanıldı.
 */
function FacebookMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c-.03-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
      />
    </svg>
  )
}

/** Zarf — referansın 22×22, 2px konturlu çizimi (kayıt akışındaki
 *  "E-posta ile devam edin" düğmesi bunu kullanır). */
function MailMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M3 17V5h16v12H3z" stroke="#313131" strokeWidth="2" />
      <path d="M19 5l-7.5 7h-1L3 5" stroke="#313131" strokeWidth="2" />
    </svg>
  )
}

/**
 * Tek bir "Continue with …" düğmesi. İkon solda sabit durur, etiket
 * `flex-grow: 1` ile kalan alanı kaplayıp ortalanır — referansın
 * `<Box sx={{ flexGrow: 1 }}>` sarmalayıcısının birebir karşılığı.
 * `sq-wipe` sınıfı soldan sağa süpüren eğik hover panelini getirir.
 */
export function SocialButton({
  icon,
  label,
  onClick,
  dataTest,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  dataTest?: string
}) {
  return (
    <button
      type="button"
      className="sq-btn sq-wipe sq-btn-social"
      onClick={onClick}
      data-test={dataTest}
    >
      {icon}
      <span className="sq-btn-social-label">{label}</span>
    </button>
  )
}

export function SocialAuthButtons({
  callbackUrl,
  onEmail,
}: {
  callbackUrl?: string
  /**
   * Verilirse listenin sonuna referansın **"E-posta ile devam edin"**
   * düğmesi eklenir. Kayıt ekranı bunu kullanır (orada form ancak bu
   * adımdan sonra açılır); giriş ekranında form zaten solda durduğu için
   * bu düğme YOKTUR.
   */
  onEmail?: () => void
}) {
  const t = useT()
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(isGoogleAuthEnabled)

  // ⚠️ Abone olurken bilinen değer de iletilir; aksi halde React 19
  // StrictMode'un çift efektinde bildirim kimseye ulaşmıyor ve düğme hiç
  // çizilmiyordu (vault'ta kayıtlı tuzak).
  useEffect(() => subscribeGoogleAuth(setGoogleEnabled), [])

  // ⚠️ Tam sayfa yönlendirme: akış Google'ın alan adında sürer, `axios` ile
  // yapılamaz (CORS + kullanıcı onayı). Dönüşü `/auth/google` karşılar.
  const startGoogle = () => {
    const params = new URLSearchParams()
    if (callbackUrl) params.set('callbackUrl', callbackUrl)
    const query = params.toString()
    window.location.href = `/api/v1/auth/google/start${query ? `?${query}` : ''}`
  }

  const notYet = (service: string) => () => toast.info(t('auth.providerSoon', { service }))

  // Referansın işaretlemesi: `<ul data-test="third-party-providers">` +
  // her sağlayıcı bir `<li>`; öğeler arası boşluk `margin-bottom: 11px`.
  return (
    <ul data-test="third-party-providers" className="flex flex-col">
      {/* ⚠️ Google düğmesi **her zaman** çizilir (üçlü referansta da hep
          birlikte durur), ama sunucu Google'ı kapalı bildirdiğinde tıklamak
          yönlendirme yapmaz — Apple/Facebook ile aynı "yakında" bildirimi
          çıkar. Böylece ne düğme kaybolur ne de ölü bir yola girilir.
          (Açmak için: Google Cloud Console + 3 env → [[16-google-giris]].) */}
      <li className="mb-[11px]">
        <SocialButton
          icon={<GoogleMark />}
          label={t('auth.continueWith', { service: 'Google' })}
          onClick={googleEnabled ? startGoogle : notYet('Google')}
          dataTest="continue-google"
        />
      </li>
      <li className="mb-[11px]">
        <SocialButton
          icon={<AppleMark />}
          label={t('auth.continueWith', { service: 'Apple' })}
          onClick={notYet('Apple')}
          dataTest="continue-apple"
        />
      </li>
      <li className={onEmail ? 'mb-[11px]' : undefined}>
        <SocialButton
          icon={<FacebookMark />}
          label={t('auth.continueWith', { service: 'Facebook' })}
          onClick={notYet('Facebook')}
          dataTest="continue-facebook"
        />
      </li>
      {onEmail && (
        <li>
          <SocialButton
            icon={<MailMark />}
            label={t('auth.continueWithEmail')}
            onClick={onEmail}
            dataTest="continue-with-email"
          />
        </li>
      )}
    </ul>
  )
}
