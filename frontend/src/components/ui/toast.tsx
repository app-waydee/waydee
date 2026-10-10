import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info' | 'loading' | 'live'

interface Toast {
  id: number
  kind: ToastKind
  message: string
  /** `live` için: emoji + eylem düğmesi (referansta 🥳 + "View Post"). */
  emoji?: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>, ttl: number) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t, ttl) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }))
    // ⚠️ `loading` KENDİ KENDİNE kapanmaz — iş bitince `dismiss` ile kaldırılır.
    // Süreli olsaydı uzun bir yükleme ortasında kaybolur, kullanıcı "takıldı mı?"
    // diye düşünürdü.
    if (ttl > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), ttl)
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().push({ kind: 'success', message }, 4200),
  error: (message: string) => useToastStore.getState().push({ kind: 'error', message }, 4200),
  info: (message: string) => useToastStore.getState().push({ kind: 'info', message }, 4200),

  /**
   * Referansın (`taag.app` / taginbio) yükleme bildirimi.
   * Paketten okundu: `toast.loading("Creating your post", { id })` — süresiz,
   * iş bitince `toast.dismiss(id)` ile kaldırılıyor. Dönen kimliği sakla.
   */
  loading: (message: string) => useToastStore.getState().push({ kind: 'loading', message }, 0),

  /**
   * Referansın başarı bildirimi: `kd("Your new post is live", cb, "View Post", "🥳")`
   * — emoji + UPPERCASE kısa metin + eylem düğmesi.
   */
  live: (message: string, actionLabel?: string, onAction?: () => void, emoji = '🥳') =>
    useToastStore.getState().push({ kind: 'live', message, emoji, actionLabel, onAction }, 7000),

  dismiss: (id: number) => useToastStore.getState().dismiss(id),
}

const ICONS: Record<'success' | 'error' | 'info', typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

const ICON_TONES: Record<'success' | 'error' | 'info', string> = {
  success: 'bg-mint-soft text-success',
  error: 'bg-peach-soft text-danger',
  info: 'bg-sky-soft text-accent',
}

/**
 * Bildirim yüzeyi.
 *
 * ⚠️ İki aile bilinçli olarak AYRI konumlanır:
 * <ul>
 *   <li><b>Core 2.0</b> (success/error/info) → sağ üst, geniş kart (mevcut davranış).</li>
 *   <li><b>Referans</b> (loading/live) → <b>üst orta</b>, dar pill. Ekran
 *       görüntülerinde "Creating your post" ve "YOUR NEW POST IS LIVE" sayfanın
 *       üstünde ortada duruyor.</li>
 * </ul>
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  const side = toasts.filter((t) => t.kind === 'success' || t.kind === 'error' || t.kind === 'info')
  const center = toasts.filter((t) => t.kind === 'loading' || t.kind === 'live')

  return (
    <>
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
        <AnimatePresence>
          {side.map((t) => {
            const kind = t.kind as 'success' | 'error' | 'info'
            const Icon = ICONS[kind]
            return (
              <motion.button
                key={t.id}
                onClick={() => dismiss(t.id)}
                className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-surface p-3.5 text-left shadow-float"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ICON_TONES[kind]}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="pt-1 text-[13px] font-semibold leading-snug text-ink">{t.message}</span>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[110] flex flex-col items-center gap-2">
        <AnimatePresence>
          {center.map((t) =>
            t.kind === 'loading' ? (
              <motion.div
                key={t.id}
                className="waydee-toast-soft"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <span className="waydee-toast-spin" aria-hidden />
                <span>{t.message}</span>
              </motion.div>
            ) : (
              <motion.div
                key={t.id}
                className="waydee-toast-live"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[17px] leading-none">{t.emoji}</span>
                  <span className="text-[13px] font-bold uppercase tracking-wide text-ink">
                    {t.message}
                  </span>
                </div>
                {t.actionLabel && (
                  <button
                    type="button"
                    className="waydee-toast-action pointer-events-auto"
                    onClick={() => {
                      t.onAction?.()
                      dismiss(t.id)
                    }}
                  >
                    {t.actionLabel}
                  </button>
                )}
              </motion.div>
            ),
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
