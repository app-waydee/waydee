import { api } from './api'
import { publicApi, readVisitorPass } from './publicApi'
import { useAuthStore } from '@/stores/auth'

/**
 * <b>Bağlantı tıklama ölçümü</b> (V46).
 *
 * <p>🔴 16 Ağu 2026'ya kadar bu ölçüm <b>hiç yoktu</b>: sunucudaki
 * {@code click_count} kolonu arayüzde gösteriliyor ama hiçbir yerde
 * artırılmıyordu — kullanıcı her zaman sıfır olan bir sayıya bakıyordu.
 */

export interface LinkRow {
  id: string
  title: string
  url: string
  iconUrl: string | null
  /** Seçili dönemdeki tıklama. */
  clicks: number
  /** Seçili dönemdeki <b>tekil</b> ziyaretçi. */
  visitors: number
  /** Ömür boyu toplam. */
  totalClicks: number
  lastClickAt: string | null
}

/** @property code ISO 3166-1 alpha-2; bilinmiyorsa `null`. Ad İSTEMCİDE üretilir. */
export interface CountryRow {
  code: string | null
  clicks: number
}

export interface DayRow {
  day: string
  clicks: number
}

export interface VisitorRow {
  at: string
  country: string | null
  userId: string | null
  /** Ziyaretçi oturum açmamışsa `null` — arayüz "ziyaretçi" yazar. */
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  linkTitle: string
}

export interface LinkStats {
  days: number
  clicks: number
  visitors: number
  /** Tıklayanların kaçı giriş yapmış bir kullanıcıydı. */
  identified: number
  daily: DayRow[]
  countries: CountryRow[]
  links: LinkRow[]
  recent: VisitorRow[]
}

export async function getLinkStats(days = 30): Promise<LinkStats> {
  return (await api.get<LinkStats>('/profile-links/stats', { params: { days } })).data
}

/**
 * <b>Tıklamayı bildirir ve BEKLEMEZ.</b>
 *
 * <p>🔴 Hatalar <b>sessizce yutulur</b> ve bu bilinçli: ölçüm, ölçtüğü
 * deneyimi bozmamalı. Ziyaretçiye "istatistik gönderilemedi" demek anlamsız
 * (projedeki etiket ölçümüyle aynı ilke).
 *
 * <p>⚠️ {@code keepalive}: tarayıcı yeni sekmeye/hedefe giderken isteği iptal
 * edebilir. Bu bayrak, sayfa değişse bile isteğin tamamlanmasını sağlar —
 * onsuz ölçüm <b>rastgele</b> kaybolurdu ve rakamlar hep düşük çıkardı.
 *
 * <p>⚠️ Oturum açıksa {@code Authorization} taşınır: sunucu böylece
 * "gerçek user bilgisi"ni kaydeder. Ziyaretçide ise vitrin geçişi
 * ({@code X-Waydee-Pass}) gönderilir.
 */
export function reportLinkClick(linkId: string): void {
  const token = useAuthStore.getState().accessToken
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  else {
    const pass = readVisitorPass()
    if (pass) headers['X-Waydee-Pass'] = pass
  }
  try {
    void fetch(`${publicApi.defaults.baseURL}/links/${linkId}/click`, {
      method: 'POST',
      headers,
      keepalive: true,
    }).catch(() => {
      /* yut */
    })
  } catch {
    /* yut */
  }
}
