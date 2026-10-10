import type { Creator, Currency, SizeTier } from '@/lib/creators'

/**
 * Influencer keşfinin biçimlendiricileri (108. tur).
 *
 * ⚠️ `lib/format.ts`'teki `fmtMoney`/`fmtDate` sabit `tr-TR` kullanıyor;
 * İngilizce arayüzde "12.500" yerine "12,500" görünmesi gerekir (vault, 88. tur).
 * Buradaki her biçimlendirici <b>dili parametre olarak</b> alır.
 *
 * ⚠️ `null` → `null`: "bulunamadı" ile "sıfır" farklı şeylerdir; çağıran
 * boşluğu kendi `—` işaretiyle ve açıklamasıyla gösterir.
 */

const compactCache = new Map<string, Intl.NumberFormat>()

/** 12.500 → "12,5 B" (tr) · "12.5K" (en). */
export function compact(n: number | null, locale: string): string | null {
  if (n == null) return null
  let f = compactCache.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
    compactCache.set(locale, f)
  }
  return f.format(n)
}

/** 3,2 → "%3,2" (tr) · "3.2%" (en) — yüzde işaretinin yeri dile göre değişir. */
export function percent(n: number | null, locale: string, signed = false): string | null {
  if (n == null) return null
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(n / 100)
}

/** Ücret aralığı: "₺5.000–8.000". Tek uç biliniyorsa yalnız o. */
export function moneyRange(min: number | null, max: number | null, currency: Currency | null,
                           locale: string): string | null {
  if (currency == null || (min == null && max == null)) return null
  const f = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
  if (min != null && max != null && Math.round(min) !== Math.round(max)) {
    return `${f.format(min)}–${f.format(max)}`
  }
  return f.format((min ?? max) as number)
}

/** Kademe aralığı: NANO → "1 B–10 B" (tr) · "1K–10K" (en). */
export function tierRange(tier: SizeTier, locale: string): string {
  const bounds: Record<SizeTier, [number, number | null]> = {
    NANO: [1_000, 10_000],
    MICRO: [10_000, 100_000],
    MID: [100_000, 500_000],
    MACRO: [500_000, 1_000_000],
    MEGA: [1_000_000, null],
  }
  const [min, max] = bounds[tier]
  return max == null ? `${compact(min, locale)}+` : `${compact(min, locale)}–${compact(max, locale)}`
}

/**
 * ISO kodundan bayrak emojisi — Analytics ile aynı yöntem (bölgesel gösterge harfleri).
 * ⚠️ Kod yoksa boş döner: burada bayrak yalnız ülke biliniyorsa çizilir.
 */
export function flagOf(code: string | null): string {
  if (!code || code.length !== 2) return ''
  const base = 0x1f1e6
  const upper = code.toUpperCase()
  return String.fromCodePoint(base + upper.charCodeAt(0) - 65, base + upper.charCodeAt(1) - 65)
}

const namesCache = new Map<string, Intl.DisplayNames | null>()

/**
 * Yerelleştirilmiş ülke/dil adı (`Intl.DisplayNames`). Sözlüğe tek bir ülke
 * adı yazılmadan beş dil (vault, 91. tur). ⚠️ Örnek dil başına bir kez kurulur.
 */
export function displayName(code: string | null, type: 'region' | 'language', locale: string): string | null {
  if (!code) return null
  const key = `${type}:${locale}`
  if (!namesCache.has(key)) {
    try {
      namesCache.set(key, new Intl.DisplayNames([locale], { type }))
    } catch {
      namesCache.set(key, null)
    }
  }
  try {
    return namesCache.get(key)?.of(type === 'region' ? code.toUpperCase() : code) ?? code
  } catch {
    return code
  }
}

/** Saniyeli süre: 1840 → "1,8 sn" değil "2 sn"; 65000 → "1 dk 5 sn". Dile göre birimler. */
export function duration(ms: number | null, locale: string): string | null {
  if (ms == null) return null
  if (ms < 1000) {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'millisecond', unitDisplay: 'narrow' }).format(ms)
  }
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const sec = new Intl.NumberFormat(locale, { style: 'unit', unit: 'second', unitDisplay: 'narrow' })
  if (minutes === 0) return sec.format(seconds)
  const min = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'narrow' })
  return seconds === 0 ? min.format(minutes) : `${min.format(minutes)} ${sec.format(seconds)}`
}

/**
 * CSV dışa aktarma.
 *
 * ⚠️ Excel uyumu için üç ayrıntı:
 * ① başta UTF-8 BOM — yoksa Excel Türkçe karakterleri bozuk açar;
 * ② 🔴 <b>ayırıcı dile göre</b> (108. turda ölçüldü): Excel CSV'yi işletim
 *    sisteminin liste ayırıcısıyla okur. Ondalığı virgül olan yerellerde
 *    (tr, de, es…) bu `;`'dir — virgülle ayrılmış dosya orada TEK SÜTUN açılır.
 *    Aynı sebeple sayılar o dilin ondalığıyla yazılır (`7,4`); `7.4` orada
 *    sayı değil metin ya da tarih sayılırdı;
 * ③ her alan tırnaklı (alan içindeki tırnak ikilenir).
 * 🔒 Formül enjeksiyonu: `=`, `+`, `-`, `@` ile başlayan METİN hücreleri tek
 * tırnakla etkisizleştirilir — bu metinler web'den geliyor ve Excel onları
 * formül olarak çalıştırırdı. Sayılar bu kurala girmez (negatif büyüme `-2`
 * bir formül değildir).
 */
export function toCsv(header: string[], rows: (string | number | null)[][], locale: string): string {
  const decimalComma = new Intl.NumberFormat(locale).format(1.5).includes(',')
  const delimiter = decimalComma ? ';' : ','
  const number = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 2 })
  const cell = (v: string | number | null) => {
    if (v == null) return '""'
    if (typeof v === 'number') return `"${number.format(v)}"`
    let s = v
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(delimiter)).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // ⚠️ Hemen iptal edilirse bazı tarayıcılar indirmeyi başlatamıyor.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** CSV satırı — sıralı sonuç ve kısa liste aynı sütunları kullanır. */
export function creatorRow(c: Creator, rank: number | null, score: number, locale: string,
                           note: string | null = null): (string | number | null)[] {
  return [
    rank,
    c.displayName,
    // ⚠️ `@` öneki YOK: sütun başlığı zaten "Kullanıcı adı" ve `@` ile başlayan
    // hücre formül koruması yüzünden `'@ad` olarak görünürdü.
    c.handle,
    c.platform,
    c.profileUrl,
    displayName(c.country, 'region', locale),
    displayName(c.language, 'language', locale),
    c.followers,
    c.engagementRatePct,
    c.avgViews,
    c.growth30dPct,
    moneyRange(c.estCostMin, c.estCostMax, c.costCurrency, locale),
    score,
    Math.round(c.coverage * 100),
    c.summary,
    note,
    c.evidence.map((e) => e.url).join(' '),
  ]
}
