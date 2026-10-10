import { useEffect, useState } from 'react'
import axios from 'axios'

/**
 * <b>Üyelik fiyat tablosu</b> — sunucudan gelir, koda gömülmez.
 *
 * <p>🔴 Tanıtım sayfası fiyatı (<code>$10</code>) <b>koda gömülüydü</b>: yönetim
 * panelinden değiştirilse bile vitrin eski fiyatı göstermeye devam ederdi.
 * Artık tek kaynak sunucudaki <code>app_settings</code> kaydı; bu kanca onu
 * <code>GET /config</code> ile okur (kimlik istemez — vitrin de çağırır).
 *
 * <p>🔴 <b>V37: dört hücre</b> (Pro/Premium × aylık/yıllık). Değerler her zaman
 * <b>aylık eşdeğerdir</b>; yıllıkta 12 katı tahsil edilir. Toplamı taşımak,
 * ekranda "10 $/ay, yıllık faturalanır" cümlesini kurmayı imkânsız kılardı.
 *
 * <p>⚠️ Kendi axios örneği bilinçli: <code>api</code> JWT + 401 kuyruğu taşır ve
 * oturumsuz vitrinde gereksizdir, <code>publicApi</code> ise yolu
 * <code>/public/config</code>'e çevirip <b>404</b> verirdi (Mapbox anahtarında
 * yaşanmış tuzağın aynısı).
 *
 * <p>⚠️ Değer gelene kadar <b>hiçbir şey çizilmez</b> (<code>null</code>):
 * önce yanlış bir fiyat gösterip sonra düzeltmek, fiyat gibi bir bilgide
 * güven kırar.
 */
const configApi = axios.create({ baseURL: '/api/v1', timeout: 8000 })

export type PaidPlan = 'PRO' | 'PREMIUM'
export type BillingPeriod = 'MONTHLY' | 'YEARLY'

export interface PlanPricing {
  /** Aylık eşdeğer fiyatlar. */
  proMonthly: number
  proYearly: number
  premiumMonthly: number
  premiumYearly: number
  currency: string
}

interface ClientConfigResponse {
  proPrice?: number | string
  proCurrency?: string
  plans?: {
    proMonthly?: number | string
    proYearly?: number | string
    premiumMonthly?: number | string
    premiumYearly?: number | string
    currency?: string
  }
}

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', TRY: '₺' }

/**
 * `10.00 USD` → `$10` · `149.90 TRY` → `₺149,90` (kuruş yoksa gösterilmez).
 *
 * <p>🔴 <b>Sayı olmayan değerde boş döner, ÇÖKMEZ.</b> Eskiden doğrudan
 * `price.toFixed(2)` çağrılıyordu; fiyat tablosu dört hücreye çıkarken
 * (V37) tanıtım sayfası bir süre eski biçimdeki önbelleği okudu ve
 * `undefined.toFixed` <b>tüm `PricingDark` bölümünü hata sınırına düşürdü</b>
 * (tarayıcıda ölçüldü). Fiyat gibi dışarıdan gelen bir değerde biçimlendirici
 * savunmasız olmamalı: gösterilecek bir sayı yoksa gösterilmez.
 */
export function formatPrice(price: number | null | undefined, currency: string): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return ''
  }
  const symbol = SYMBOLS[currency] ?? `${currency} `
  const whole = Number.isInteger(price)
  const body = whole
    ? String(price)
    : price.toFixed(2).replace('.', currency === 'TRY' ? ',' : '.')
  return `${symbol}${body}`
}

const num = (raw: unknown): number | null => {
  const v = typeof raw === 'string' ? Number(raw) : (raw as number | undefined)
  return v == null || Number.isNaN(v) ? null : v
}

/* Tek istek, tüm bileşenler paylaşır — vitrinde fiyat üç ayrı yerde geçiyor. */
let cached: PlanPricing | null = null
let inflight: Promise<PlanPricing | null> | null = null
const listeners = new Set<(p: PlanPricing) => void>()

async function load(): Promise<PlanPricing | null> {
  if (cached) return cached
  if (!inflight) {
    inflight = configApi
      .get<ClientConfigResponse>('/config')
      .then((r) => {
        const t = r.data?.plans
        /* ⚠️ `plans` yoksa ESKİ sunucu konuşuyordur: tek fiyattan türetmek
           yerine yalnız Pro aylığı doldurup diğerlerini ondan ayırmıyoruz —
           uydurma bir Premium fiyatı göstermek, olmayan bir ürünü satmaktır.
           Bu durumda Premium kartı çizilmez (fiyatı null kalır). */
        const proMonthly = num(t?.proMonthly) ?? num(r.data?.proPrice)
        if (proMonthly == null) return null
        cached = {
          proMonthly,
          proYearly: num(t?.proYearly) ?? proMonthly,
          premiumMonthly: num(t?.premiumMonthly) ?? 0,
          premiumYearly: num(t?.premiumYearly) ?? 0,
          currency: t?.currency || r.data?.proCurrency || 'USD',
        }
        listeners.forEach((fn) => fn(cached as PlanPricing))
        return cached
      })
      .catch(() => null)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function usePlanPricing(): PlanPricing | null {
  const [pricing, setPricing] = useState<PlanPricing | null>(cached)
  useEffect(() => {
    if (cached) {
      setPricing(cached)
      return
    }
    /* ⚠️ Abone ol → değer BİR KEZ iletilir. StrictMode'da efekt iki kez koşar;
       yanıt "abonelikten çıkılmış" pencereye düşerse bildirim kimseye ulaşmaz
       (Google düğmesinde yaşanan tuzağın aynısı). */
    const listener = (p: PlanPricing) => setPricing(p)
    listeners.add(listener)
    void load().then((p) => {
      if (p) setPricing(p)
    })
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return pricing
}

/** Tek hücrenin aylık eşdeğeri. */
export function monthlyOf(p: PlanPricing, plan: PaidPlan, period: BillingPeriod): number {
  if (plan === 'PREMIUM') return period === 'YEARLY' ? p.premiumYearly : p.premiumMonthly
  return period === 'YEARLY' ? p.proYearly : p.proMonthly
}

/** Yıllık taahhüdün indirim yüzdesi — `%23` rozetini bu besler. */
export function yearlyDiscount(p: PlanPricing, plan: PaidPlan): number {
  const monthly = monthlyOf(p, plan, 'MONTHLY')
  const yearly = monthlyOf(p, plan, 'YEARLY')
  if (!monthly || yearly >= monthly) return 0
  return Math.round(((monthly - yearly) / monthly) * 100)
}

/** Yıllıkta bir kerede tahsil edilen tutar (aylık eşdeğer × 12). */
export function yearlyTotal(p: PlanPricing, plan: PaidPlan): number {
  return monthlyOf(p, plan, 'YEARLY') * 12
}

/**
 * Vitrindeki "şu fiyattan başlar" etiketi — Pro aylık.
 *
 * <p>⚠️ Değer gelene kadar <b>null</b> döner ve çağıran yerinde ince bir yer
 * tutucu çizer. Boş dize dönmek, fiyatın yanındaki "/ay" ekini öksüz bırakırdı.
 */
export function useProPriceLabel(): string | null {
  const p = usePlanPricing()
  if (!p) return null
  const label = formatPrice(p.proMonthly, p.currency)
  return label || null
}
