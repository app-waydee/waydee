import { api } from './api'
import type { ActivityResponse } from '@/types/api'

/**
 * Son hareketler. `withinMinutes > 0` verilirse sunucu yalnız o pencere
 * içindekileri döner (harita paneli 10 dk kullanır).
 */
export async function getRecentActivity(limit = 30, withinMinutes = 0): Promise<ActivityResponse[]> {
  return (await api.get<ActivityResponse[]>('/activity', { params: { limit, withinMinutes } })).data
}

/** Aktivite satırının Türkçe eylem metni. */
export function activityLabel(type: string): string {
  switch (type) {
    /*
     * 🔴 18 Ağu 2026 — metin "bu konumu satın aldı" İDİ ve artık YANLIŞTI.
     * Daire V38'den beri km² ile satılan bir ürün değil; kullanıcı bir yer
     * satın almıyor, oraya MAĞAZASINI AÇIYOR. Olay adı (`TERRITORY_PURCHASED`)
     * eski modelden kalma ve DEĞİŞTİRİLMEDİ: geçmiş kayıtlar o adla yazılı,
     * yeniden adlandırmak eski satırları görünmez kılardı. Değişen yalnız
     * kullanıcının okuduğu cümle.
     */
    case 'TERRITORY_PURCHASED':
      return 'mağazasını açtı'
    case 'PHOTO_SHARED':
      return 'bir fotoğraf paylaştı'
    case 'POST_SHARED':
      return 'bir gönderi paylaştı'
    case 'POLL_CREATED':
      return 'bir anket açtı'
    case 'EVENT_STARTED':
      return 'bir etkinlik başlattı'
    default:
      return 'bir hareket yaptı'
  }
}
