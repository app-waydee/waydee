import type { Creator, Signal, Weights } from '@/lib/creators'

/**
 * <b>Şeffaf puan — istemci tarafı</b> (108. tur).
 *
 * `puan = Σ(ağırlık × sinyal) / Σ(ağırlık)`; toplam yalnız <b>uygulanabilir</b>
 * sinyaller üzerinden, verisi olmayan sinyal <b>0,5 (nötr)</b> sayılır.
 *
 * 🔴 Bu formül sunucuda da var (`CreatorScorer.score`) ve ikisi BİREBİR aynı
 * olmalı: sunucu ilk sıralamayı, istemci radar grafiği sürüklenirken yeni
 * sıralamayı hesaplıyor. Ortak örnek (sunucuda `CreatorScorerTest`):
 * fit 0,9·20 + etkileşim 0,6·25 + erişim null·10 + büyüme 1,0·5 → **71,7**.
 * ⚠️ Sinyallerin KENDİSİ yalnız sunucuda hesaplanır; burada yalnız ortalama var.
 */
export const NEUTRAL = 0.5

export function scoreOf(signals: Creator['signals'], weights: Weights): number {
  let weighted = 0
  let total = 0
  for (const [key, value] of Object.entries(signals) as [Signal, number | null | undefined][]) {
    const w = weights[key] ?? 0
    if (w <= 0) continue
    weighted += w * (value ?? NEUTRAL)
    total += w
  }
  if (total === 0) {
    // Tüm ağırlıklar sıfırsa sıralama içerik uyumuna düşer — boş bir puan değil.
    const fit = signals.CONTENT_FIT
    return round1((fit ?? NEUTRAL) * 100)
  }
  return round1((weighted / total) * 100)
}

/** Sonuçları verilen ağırlıklarla sıralar. Eşitlikte veri kapsamı yüksek olan önce (sunucuyla aynı). */
export function rank(creators: Creator[], weights: Weights): (Creator & { live: number })[] {
  return creators
    .map((c) => ({ ...c, live: scoreOf(c.signals, weights) }))
    .sort((a, b) => b.live - a.live || b.coverage - a.coverage)
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}
