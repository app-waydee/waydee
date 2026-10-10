/**
 * <b>Vitrin profilinin ikonları — referanstan BİREBİR alındı.</b>
 *
 * <p>🔴 7 Ağu 2026: sekmelerde önce ikon yoktu, çünkü referansı ölçerken
 * yalnız <code>textContent</code>'e bakmıştım — ikonlar <code>svg</code>
 * çocuğundaydı ve gözden kaçtı. Bu dosya artık referansın <b>kendi path
 * verisini</b> taşıyor; sekme etiketleri de referanstaki gibi
 * <b>BÜYÜK HARF</b>tir (<code>span.uppercase</code>).
 *
 * <p>Hepsi <code>viewBox="0 0 512 512"</code> · <code>fill="currentColor"</code> ·
 * <code>1em</code> boyutunda (react-icons/io5 ailesi) — referansta olduğu gibi
 * yazı boyutuyla ölçeklenirler.
 */

type IconProps = { className?: string }

const base = {
  stroke: 'currentColor',
  fill: 'currentColor',
  strokeWidth: 0,
  viewBox: '0 0 512 512',
  height: '1em',
  width: '1em',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
} as const

/** LINKS sekmesi — zincir halkası. */
export function IconLinks({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M280 341.1l-1.2.1c-3.6.4-7 2-9.6 4.5l-64.6 64.6c-13.7 13.7-32 21.2-51.5 21.2s-37.8-7.5-51.5-21.2c-13.7-13.7-21.2-32-21.2-51.5s7.5-37.8 21.2-51.5l68.6-68.6c3.5-3.5 7.3-6.6 11.4-9.3 4.6-3 9.6-5.6 14.8-7.5 4.8-1.8 9.9-3 15-3.7 3.4-.5 6.9-.7 10.2-.7 1.4 0 2.8.1 4.6.2 17.7 1.1 34.4 8.6 46.8 21 7.7 7.7 13.6 17.1 17.1 27.3 2.8 8 11.2 12.5 19.3 10.1.1 0 .2-.1.3-.1.1 0 .2 0 .2-.1 8.1-2.5 12.8-11 10.5-19.1-4.4-15.6-12.2-28.7-24.6-41-15.6-15.6-35.9-25.8-57.6-29.3-1.9-.3-3.8-.6-5.7-.8-3.7-.4-7.4-.6-11.1-.6-2.6 0-5.2.1-7.7.3-5.4.4-10.8 1.2-16.2 2.5-1.1.2-2.1.5-3.2.8-6.7 1.8-13.3 4.2-19.5 7.3-10.3 5.1-19.6 11.7-27.7 19.9l-68.6 68.6C58.9 304.4 48 330.8 48 359c0 28.2 10.9 54.6 30.7 74.4C98.5 453.1 124.9 464 153 464c28.2 0 54.6-10.9 74.4-30.7l65.3-65.3c10.4-10.5 2-28.3-12.7-26.9z" />
      <path d="M433.3 78.7C413.5 58.9 387.1 48 359 48s-54.6 10.9-74.4 30.7l-63.7 63.7c-9.7 9.7-3.6 26.3 10.1 27.4 4.7.4 9.3-1.3 12.7-4.6l63.8-63.6c13.7-13.7 32-21.2 51.5-21.2s37.8 7.5 51.5 21.2c13.7 13.7 21.2 32 21.2 51.5s-7.5 37.8-21.2 51.5l-68.6 68.6c-3.5 3.5-7.3 6.6-11.4 9.3-4.6 3-9.6 5.6-14.8 7.5-4.8 1.8-9.9 3-15 3.7-3.4.5-6.9.7-10.2.7-1.4 0-2.9-.1-4.6-.2-17.7-1.1-34.4-8.6-46.8-21-7.3-7.3-12.8-16-16.4-25.5-2.9-7.7-11.1-11.9-19.1-9.8-8.9 2.3-14.1 11.7-11.3 20.5 4.5 14 12.1 25.9 23.7 37.5l.2.2c16.9 16.9 39.4 27.6 63.3 30.1 3.7.4 7.4.6 11.1.6 2.6 0 5.2-.1 7.8-.3 6.5-.5 13-1.6 19.3-3.2 6.7-1.8 13.3-4.2 19.5-7.3 10.3-5.1 19.6-11.7 27.7-19.9l68.6-68.6c19.8-19.8 30.7-46.2 30.7-74.4s-11.1-54.6-30.9-74.4z" />
    </svg>
  )
}

/** POSTS sekmesi — çift fiyat etiketi (referansta anahtar `tags`). */
export function IconPosts({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M442 107v141L229.2 451.7c8 8 20.8 12.3 28.8 12.3s22.8-3.7 31.4-12.3L480 272V144l-38-37z" />
      <path d="M384 48H224L44.3 235.6c-8 8-12 17.8-12.3 28.4-.3 11.3 3.7 23.3 12.3 31.9l123.8 123.6c8 8 20.8 12.5 28.8 12.5s22.7-3.9 31.3-12.5L416 240V80l-32-32zm-30.7 102.7c-21.7 6.1-41.3-10-41.3-30.7 0-17.7 14.3-32 32-32 20.7 0 36.8 19.6 30.7 41.3-2.9 10.3-11.1 18.5-21.4 21.4z" />
    </svg>
  )
}

/** COLLECTIONS sekmesi — dört kare ızgara. */
export function IconCollections({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M240 240H32V32h208zm240 0H272V32h208zM240 480H32V272h208zm240 0H272V272h208z" />
    </svg>
  )
}

/**
 * Paylaş — referansın kullandığı <b>Phosphor "export"</b> ikonu
 * (kutudan yukarı çıkan ok). ⚠️ Lucide'ın <code>Share2</code>'si değil;
 * biçim tamamen farklıydı.
 */
export function IconShare({ className }: IconProps) {
  return (
    <svg
      stroke="currentColor"
      fill="currentColor"
      strokeWidth={0}
      viewBox="0 0 256 256"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M220,112v96a20,20,0,0,1-20,20H56a20,20,0,0,1-20-20V112A20,20,0,0,1,56,92H76a12,12,0,0,1,0,24H60v88H196V116H180a12,12,0,0,1,0-24h20A20,20,0,0,1,220,112ZM96.49,72.49,116,53v83a12,12,0,0,0,24,0V53l19.51,19.52a12,12,0,1,0,17-17l-40-40a12,12,0,0,0-17,0l-40,40a12,12,0,1,0,17,17Z" />
    </svg>
  )
}

/**
 * Alt şeritteki etiket işareti — referansta 20×20, <b>dolgu rengi metinle
 * aynı</b> olacak şekilde <code>currentColor</code>'a çevrildi (referansta
 * sabit <code>#000000</code>'dı; bizde tema koyu olabildiği için sabit siyah
 * görünmez olurdu).
 */
export function IconClaimTag({ className }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 511 511"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path
        d="M392.757 13.0237C447.659 19.6367 490.932 62.9114 497.545 117.813L509.708 218.788C514.113 255.365 501.473 291.939 475.422 317.99L317.99 475.423C271.127 522.285 195.147 522.285 148.284 475.423L35.1471 362.285C-11.7158 315.423 -11.7158 239.443 35.1471 192.58L192.579 35.1477C218.63 9.09658 255.204 -3.54364 291.782 0.862027L392.757 13.0237ZM457.936 148.379C455.769 96.4241 414.145 54.8006 362.191 52.6334L278.02 49.1228C250.075 47.9572 222.919 58.5483 203.142 78.3254L75.8009 205.666C36.7485 244.719 36.7485 308.035 75.8009 347.087L163.482 434.769C202.535 473.821 265.851 473.821 304.903 434.769L432.244 307.428C452.021 287.651 462.612 260.494 461.447 232.549L457.936 148.379Z"
        fill="currentColor"
      />
      <circle cx="319.488" cy="182.361" r="30" fill="currentColor" />
    </svg>
  )
}
