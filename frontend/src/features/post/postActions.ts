import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/toast'
import type { PostResponse } from '@/types/api'

/**
 * <b>Beğeni ve kaydetme</b> — tek yerde, iyimser güncellemeli.
 *
 * <p>🔴 <b>Neden iyimser:</b> kalp ve yer imi dokunulduğu anda dolmalı. Sunucu
 * yanıtını beklemek, 200 ms'lik bir ağda bile "bastım ama olmadı" hissi
 * veriyordu ve kullanıcı ikinci kez basıyordu — ikinci basış geri alma olduğu
 * için sonuç ilk niyetin tersi oluyordu.
 *
 * <p>⚠️ Uç <b>toggle değil</b>: `POST` = ekle, `DELETE` = kaldır. Tek bir toggle
 * ucunda, ağ gecikmesiyle ters sırayla varan iki istek son durumu belirsiz
 * bırakırdı. İstemci hangi yöne gittiğini bildiği için bu ayrım bedavaya gelir.
 *
 * <p>⚠️ Hata olursa <b>eski değer geri konur</b> ve bildirim gösterilir; sessizce
 * yutmak, kullanıcının beğendiğini sanıp beğenmemiş olmasına yol açardı.
 */

/** Önbellekteki her `PostResponse` kopyasını yerinde günceller. */
function patchPostEverywhere(
  qc: ReturnType<typeof useQueryClient>,
  postId: string,
  patch: (p: PostResponse) => PostResponse,
) {
  /* ⚠️ Anahtar bilinmiyor: aynı gönderi akışta, profil ızgarasında, kaydettiklerim
     listesinde ve detay ekranında ayrı sorgularda duruyor. Hepsini tek tek
     saymak yerine TÜM önbellek taranır; veri kümesi zaten sayfalıdır. */
  qc.setQueriesData<unknown>({ type: 'active' }, (old: unknown) => {
    if (!old) return old
    const walk = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(walk)
      if (node && typeof node === 'object') {
        const o = node as Record<string, unknown>
        if (typeof o.id === 'string' && o.id === postId && 'likedByMe' in o) {
          return patch(o as unknown as PostResponse)
        }
        const next: Record<string, unknown> = {}
        let changed = false
        for (const [k, v] of Object.entries(o)) {
          next[k] = walk(v)
          if (next[k] !== v) changed = true
        }
        return changed ? next : node
      }
      return node
    }
    return walk(old)
  })
}

export function usePostLike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, liked }: { id: string; liked: boolean }) => {
      if (liked) await api.delete(`/posts/${id}/like`)
      else await api.post(`/posts/${id}/like`)
    },
    onMutate: ({ id, liked }) => {
      patchPostEverywhere(qc, id, (p) => ({
        ...p,
        likedByMe: !liked,
        likeCount: Math.max(0, p.likeCount + (liked ? -1 : 1)),
      }))
      return { id, liked }
    },
    onError: (_e, { id, liked }) => {
      patchPostEverywhere(qc, id, (p) => ({
        ...p,
        likedByMe: liked,
        likeCount: Math.max(0, p.likeCount + (liked ? 1 : -1)),
      }))
      toast.error('İşlem tamamlanamadı')
    },
  })
}

export function usePostSave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) await api.delete(`/posts/${id}/save`)
      else await api.post(`/posts/${id}/save`)
    },
    onMutate: ({ id, saved }) => {
      patchPostEverywhere(qc, id, (p) => ({
        ...p,
        savedByMe: !saved,
        saveCount: Math.max(0, p.saveCount + (saved ? -1 : 1)),
      }))
    },
    onError: (_e, { id, saved }) => {
      patchPostEverywhere(qc, id, (p) => ({
        ...p,
        savedByMe: saved,
        saveCount: Math.max(0, p.saveCount + (saved ? 1 : -1)),
      }))
      toast.error('İşlem tamamlanamadı')
    },
    onSettled: () => {
      /* ⚠️ "Kaydettiklerim" listesi iyimser olarak GÜNCELLENEMEZ: kaydı listeye
         eklemek için gönderinin tamamı gerekir ve sıralama sunucudadır. Bu
         yüzden yalnız o liste tazelenir. */
      void qc.invalidateQueries({ queryKey: ['saved-posts'] })
    },
  })
}
