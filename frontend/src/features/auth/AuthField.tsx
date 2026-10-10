import { useId, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  label: string
  /** Alanın altında kırmızı olarak gösterilen hata metni. */
  error?: string | null
}

/**
 * Referans formundaki alan (Squarespace `sentinel` → `Field` + `Separator`).
 *
 * 🔴 <b>Alanın kutusu YOKTUR.</b> Üstte 9.75px'lik UPPERCASE mikro-etiket,
 * altında çerçevesiz bir `input`, onun da altında `role="separator"` taşıyan
 * <b>1px açık gri taban çizgisi</b> durur. Odaklanınca çizginin içindeki
 * siyah dolgu <b>0 → %100</b> genişler ve <b>2px</b>'e kalınlaşır.
 *
 * Kaynak (referansın kendi paketinden okundu):
 * - `Separator`: `bg: gray.800 · height: sizes.25 (1px)`, iç dolgu
 *   `backgroundColor: gray.100 · width: focused ? "100%" : 0` +
 *   `transition: all 0.3s cubic-bezier(0.32, 0.94, 0.60, 1.00)`
 * - alan sarmalayıcısı: `'& ~ [role="separator"] > div': { height: "2px" }`
 *
 * ⚠️ Eski tasarımdaki "alanın içinde yüzen etiket" (HeroUI `labelPlacement
 * ="inside"`) <b>tamamen kaldırıldı</b> — referansta öyle bir davranış yok.
 * Etiket her zaman üstte ve sabittir, bu yüzden yer tutucu da her zaman
 * görünebilir.
 */
export function AuthField({
  label,
  error = null,
  value,
  required,
  type,
  ...rest
}: AuthFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  // Referansta şifre alanının sağında bir **göz** düğmesi var (ekran
  // görüntüsünde de görünüyor); metni açıp kapatır.
  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)
  const inputType = isPassword && revealed ? 'text' : type

  return (
    <div className="sq-field" data-invalid={error ? 'true' : 'false'}>
      <label htmlFor={id} className="sq-label">
        {label}
      </label>
      <div className="sq-field-row">
        <input
          id={id}
          className="sq-field-input"
          type={inputType}
          value={value}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Şifreyi gizle' : 'Şifreyi göster'}
            aria-pressed={revealed}
            className="ms-2 flex h-9 w-9 shrink-0 items-center justify-center text-[color:var(--sq-fg)]"
          >
            {revealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>
      {/* Referansın `role="separator"` yapısı birebir: dış çizgi taban,
          iç div odakta açılan dolgu. Odak `:focus-within` ile yakalanır. */}
      <div className="sq-sep" role="separator" aria-hidden="true">
        <div className="sq-sep-fill" />
      </div>
      {error && (
        <p id={errorId} className="sq-field-error">
          {error}
        </p>
      )}
    </div>
  )
}
