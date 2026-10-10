import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropdownOption<T extends string | number> {
  value: T
  label: string
}

interface DropdownProps<T extends string | number> {
  /** Kutunun üstündeki küçük etiket (ör. "Tarih aralığı"). */
  label?: string
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  className?: string
  /**
   * <b>Uzun listeler için</b> (108. tur — ülke ve dil seçimi): menüye yükseklik
   * sınırı verir ve klavyeyle gezilen satırı görünür tutar.
   *
   * <p>⚠️ İsteğe bağlı ve varsayılan kapalı: mevcut kısa listeler (dönem,
   * stüdyo seçenekleri) olduğu gibi kalır. Menünün ortak kuralında
   * `overflow: hidden` var ve yükseklik sınırı yok — 40 satırlık bir liste
   * ekranın altına taşar ve kaydırılamazdı.
   */
  scrollable?: boolean
}

/**
 * <b>Tema uyumlu açılır liste.</b>
 *
 * <p>🔴 16 Ağustos 2026'da yazıldı. Öncesinde bu iş <b>saydam bir yerli
 * <code>&lt;select&gt;</code></b> ile yapılıyordu: görünen kutu bizim
 * işaretlememizdi, üstüne <code>opacity-0</code> bir <code>select</code>
 * bindirilmişti. Kullanıcı: <i>"süre dropdownu çalışmıyor, bozuk çalışıyor,
 * CSS yemiyor, koyu modda açık renkte geliyor."</i> Üçü de doğruydu ve hepsi
 * aynı kökten geliyordu:
 *
 * <ol>
 *   <li><b>Açılan listeye CSS geçmez.</b> Yerli bir <code>select</code>'in
 *       seçenek listesini <b>işletim sistemi</b> çizer. <code>bg-surface</code>
 *       yazsak da o pencereye ulaşmaz — "CSS yemiyor" tam olarak budur.</li>
 *   <li><b>Koyu modda açık geliyordu.</b> Bu projede tema
 *       <code>&lt;html data-theme&gt;</code> ile döner; tarayıcının yerli
 *       kontrolleri ise <code>color-scheme</code>'e bakar. İkisi ayrı
 *       kanaldır, yani uygulama koyuyken tarayıcı hâlâ "açık" varsayıyordu.</li>
 *   <li><b>Tıklama kaçıyordu.</b> Görünen kutu ile onu kapatan saydam
 *       <code>select</code> ayrı iki katmandı; kutunun büyüdüğü yerde
 *       <code>select</code> altında kalıyor ve tıklama boşa gidiyordu.</li>
 * </ol>
 *
 * <p>Çözüm yerli <code>select</code>'i tamamen bırakmak: burada açılan liste
 * de <b>bizim</b> işaretlememizdir, yani <code>--color-*</code> tokenlarını
 * kullanır ve tema düğmesini birebir takip eder.
 *
 * <p>⚠️ Klavye ve ekran okuyucu <b>elle</b> kuruldu (yerli <code>select</code>
 * bunları bedava veriyordu, bırakınca borç oluyor): <code>role="listbox"</code>,
 * <code>aria-activedescendant</code>, ok tuşları, Home/End, Enter/Space,
 * Escape ve odak kapanışta düğmeye geri döner.
 *
 * <p>⚠️ Dışarı tıklama <code>pointerdown</code> ile dinlenir, <code>click</code>
 * ile değil: <code>click</code> seçim yapıldıktan sonra gelir ve liste daha
 * kapanmadan yeniden açılabiliyordu.
 */
export function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
  scrollable = false,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)))
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  /* Kaydırma YALNIZ klavye gezinmesinde: fare satırın üstüne geldiğinde de
     `active` değişiyor ve orada kaydırmak listeyi imlecin altından kaçırırdı. */
  const keyboardMove = useRef(true)

  useEffect(() => {
    if (!open || !scrollable || !keyboardMove.current) return
    document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, scrollable, active, id])

  const selected = options.find((o) => o.value === value) ?? options[0]

  // Açılışta imleç seçili satıra oturur — liste hep baştan başlamamalı.
  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)))
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const pick = (next: T) => {
    onChange(next)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    keyboardMove.current = true
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(options[active].value)
    }
  }

  return (
    <div ref={rootRef} className={cn('waydee-dd', className)} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          // Açılışta seçili satır görünür olmalı (uzun listede ekranın dışında kalabilir).
          keyboardMove.current = true
          setOpen((v) => !v)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="waydee-dd-button"
      >
        <span className="min-w-0 text-start">
          {label && <span className="waydee-dd-label">{label}</span>}
          <span className="waydee-dd-value">{selected?.label}</span>
        </span>
        <ChevronDown className={cn('waydee-dd-chevron', open && 'waydee-dd-chevron-open')} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-activedescendant={`${id}-${active}`}
          tabIndex={-1}
          className={cn('waydee-dd-menu', scrollable && 'waydee-dd-menu-scroll')}
        >
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onPointerEnter={() => {
                keyboardMove.current = false
                setActive(i)
              }}
              onClick={() => pick(o.value)}
              className={cn('waydee-dd-item', i === active && 'waydee-dd-item-active')}
            >
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && <Check className="h-4 w-4 shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
