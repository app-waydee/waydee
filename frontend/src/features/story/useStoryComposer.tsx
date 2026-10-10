import { useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CropDialog } from '@/components/media/CropDialog'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { uploadImage } from '@/lib/media'
import { createStory } from '@/lib/social'
import { useAuthStore } from '@/stores/auth'
import { AiPickerDialog } from '@/features/ai/AiPickerDialog'
import { AddStoryDialog } from './AddStoryDialog'

/**
 * <b>Hikaye oluşturma akışı — TEK KAYNAK.</b>
 *
 * <p>Akış: dosya seç → <b>9:16 kırp</b> → açıklama + bölge seçimi → yükle ve
 * yayınla. Bu zincir 8 Ağu 2026'ya kadar <code>StoryTray</code>'in <b>içinde
 * gömülüydü</b>; kullanıcı hikaye paylaşımını <b>+ menüsüne</b> de isteyince
 * ikinci bir kopya yazmak yerine buraya çıkarıldı — iki yerde ayrı yaşasaydı
 * biri düzelip diğeri eskirdi (UI bileşenlerinin iki uygulamada kopya olması
 * zaten bilinen bir bedel, bunu çoğaltmanın anlamı yok).
 *
 * <p>🔴 <b>Neden kanca + parça döndürüyor, hazır bir düğme değil:</b> dosya
 * seçiciyi açmak <b>kullanıcı hareketi</b> ister. Bileşen kendi düğmesini
 * dayatsaydı iki çağıran da (şeritteki daire · menüdeki kart) kendi
 * görünümünü kaybederdi. Bu yüzden <code>openPicker</code> doğrudan
 * <b>tıklama işleyicisinden</b> çağrılır: gizli <code>input.click()</code>
 * o hareketin içinde koşar ve tarayıcı engellemez.
 * ⚠️ Bir efektten (ör. "modal açılınca otomatik aç") çağırmak <b>güvenilmez</b> —
 * kullanıcı etkileşimi penceresi kapanmış olabilir ve seçici sessizce açılmaz.
 *
 * <p>⚠️ Önizleme bir <b>data URL</b>'dir (`CropDialog` öyle üretir); geri
 * alınacak bir `objectURL` yoktur, o yüzden temizlikte `revokeObjectURL`
 * çağrılmaz.
 *
 * @param onShared Yayın başarılı olduğunda çağrılır — çağıran kendi kabuğunu
 *   (menü/modal) kapatabilsin diye. Şerit için gereksizdir, menü için şart.
 */
export function useStoryComposer(onShared?: () => void) {
  const me = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  /** Kırpma bekleyen ham dosya. */
  const [raw, setRaw] = useState<File | null>(null)
  /** Kırpılmış dosya + önizleme; açıklama/bölge ekranı bunu gösterir. */
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)

  const share = useMutation({
    mutationFn: async ({ caption, territoryIds }: { caption: string; territoryIds: string[] }) => {
      if (!pending) return []
      const media = await uploadImage(pending.file)
      await createStory(media.id, caption || undefined, territoryIds)
      return territoryIds
    },
    onSuccess: (territoryIds) => {
      toast.success(
        territoryIds.length
          ? `Hikaye paylaşıldı — ${territoryIds.length} bölgende de yayında`
          : 'Hikaye paylaşıldı',
      )
      setPending(null)
      void queryClient.invalidateQueries({ queryKey: ['story-feed'] })
      if (me) void queryClient.invalidateQueries({ queryKey: ['stories', 'user', me.id] })
      // Yayınlanan her bölgenin kendi şeridi de tazelenmeli.
      territoryIds.forEach((id) => {
        void queryClient.invalidateQueries({ queryKey: ['territory-stories', id] })
      })
      onShared?.()
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Hikaye paylaşılamadı')),
  })

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // ⚠️ Değer HEMEN sıfırlanır: aynı dosya ikinci kez seçilirse `change`
    // olayı hiç tetiklenmez ve akış sessizce ölür.
    e.target.value = ''
    if (file) setRaw(file)
  }

  /** Tıklama işleyicisinden çağrılmalı (bkz. yukarıdaki not). */
  const openPicker = () => fileRef.current?.click()

  /**
   * <b>Yapay zekâ galerisinden hikâye</b> (V45).
   *
   * <p>⚠️ Galeriden gelen dosya {@code raw}'a konur, yani <b>aynı kırpma
   * zincirine</b> girer (9:16). Hazır medyayı doğrudan yayınlayan ikinci bir
   * yol açmak, dikey olmayan bir üretimin hikâyede kırpılmadan görünmesi
   * demekti — ve akışın iki kopyaya bölünmesi.
   */
  const [aiPicker, setAiPicker] = useState(false)
  const openAiPicker = () => setAiPicker(true)

  /**
   * Gizli input + kırpma ve paylaşma pencereleri. Çağıran bunu ağacına koyar;
   * hiçbir görsel yer kaplamaz, yalnız akış açıkken pencere çizer.
   */
  const composer = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={onPick}
      />

      {aiPicker && (
        <AiPickerDialog
          onClose={() => setAiPicker(false)}
          onPicked={(file) => setRaw(file)}
        />
      )}

      {raw && (
        <CropDialog
          file={raw}
          aspect={9 / 16}
          title="Hikayeni kırp"
          onCancel={() => setRaw(null)}
          onDone={(f, preview) => {
            setRaw(null)
            setPending({ file: f, url: preview })
          }}
        />
      )}

      {pending && (
        <AddStoryDialog
          previewUrl={pending.url}
          submitting={share.isPending}
          onClose={() => setPending(null)}
          onShare={(caption, territoryIds) => share.mutate({ caption, territoryIds })}
        />
      )}
    </>
  )

  /** Akışın herhangi bir adımı açık mı — çağıran kendi kabuğunu gizleyebilsin diye. */
  const active = raw !== null || pending !== null || aiPicker

  return { openPicker, openAiPicker, composer, active }
}
