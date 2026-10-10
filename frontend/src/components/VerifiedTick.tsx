import { cn } from '@/lib/utils'

/**
 * <b>Mavi doğrulama tiki</b> — Pro üyeliğin görünür karşılığı.
 *
 * <p>🔴 Tek kaynak: sunucu <code>verified</code> döner ve bu bayrak
 * <code>plan === 'PRO'</code>'dan türer (bkz. <code>User#hasVerifiedBadge</code>).
 * İstemci planı okuyup kendi karar VERMEZ — rozetin kuralı sunucuda kalır.
 *
 * <p>Biçim tanıtım sayfasındaki rozetle aynı: yıldız gövde <code>#42A5F5</code>,
 * içinde beyaz tik. Boyut <code>size</code> ile piksel olarak verilir; satır
 * içinde adın yanına oturması için <code>vertical-align: middle</code>.
 */
export function VerifiedTick({
  size = 16,
  className,
  title,
}: {
  size?: number
  className?: string
  /** Erişilebilirlik metni; verilmezse rozet dekoratif sayılır. */
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 25 25"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      style={{ verticalAlign: 'middle' }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M15.8452 0L17.8869 3.16071L21.6488 3.34524L21.8393 7.10714L25 9.14881L23.2857 12.5L25 15.8452L21.8393 17.8869L21.6548 21.6488L17.8929 21.8393L15.8512 25L12.5 23.2857L9.15476 25L7.1131 21.8393L3.35119 21.6548L3.16071 17.8929L0 15.8512L1.71429 12.5L0 9.15476L3.16071 7.1131L3.34524 3.35119L7.10714 3.16071L9.14881 0L12.5 1.71429L15.8452 0Z"
        fill="#42A5F5"
      />
      <path
        d="M10.9471 16.8158L7.08398 12.9527L8.34589 11.6908L10.9709 14.3098L16.6614 8.79199L17.9054 10.0718L10.9471 16.8158Z"
        fill="white"
      />
    </svg>
  )
}
