import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'

interface CropDialogProps {
  file: File
  /** Kırpma oranı (genişlik/yükseklik): avatar 1, hikaye 9/16, gönderi 4/3. */
  aspect: number
  title?: string
  onCancel: () => void
  /** Kırpılmış dosya + hazır önizleme (data URL — ayrıca URL üretmeye gerek yok). */
  onDone: (file: File, previewUrl: string) => void
}

/**
 * Bağımlılıksız kırpma aracı: sürükle-konumlandır + kaydırıcıyla yakınlaştır,
 * canvas ile sabit oranda JPEG üretir.
 *
 * ⚠️ Görsel **data URL** ile yüklenir, `URL.createObjectURL` ile DEĞİL:
 * StrictMode efektleri iki kez çalıştırdığı için ilk cleanup blob URL'ini
 * iptal ediyor, resim hiç yüklenmiyordu (naturalWidth 0 → drawImage patlıyordu).
 */
export function CropDialog({ file, aspect, title = 'Fotoğrafı kırp', onCancel, onDone }: CropDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const [busy, setBusy] = useState(false)

  // Dosyayı data URL olarak oku (iptal edilebilir bir kaynak yok → StrictMode güvenli).
  useEffect(() => {
    const reader = new FileReader()
    let cancelled = false
    reader.onload = () => {
      if (!cancelled) setSrc(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => {
      if (!cancelled) toast.error('Görsel okunamadı')
    }
    reader.readAsDataURL(file)
    return () => {
      cancelled = true
      reader.abort()
    }
  }, [file])

  // Viewport ölçüsü state'te tutulur (render sırasında ref okumak güvenilmez).
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setVp({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [src])

  /** Kapsama (cover) taban ölçeği: görüntü viewport'u her zaman doldurur. */
  const baseScale = nat && vp.w > 0 && nat.w > 0 ? Math.max(vp.w / nat.w, vp.h / nat.h) : 1
  const ready = !!src && !!nat && vp.w > 0

  const clampOffset = useCallback(
    (x: number, y: number, z: number) => {
      if (!nat) return { x, y }
      const s = baseScale * z
      const maxX = Math.max(0, (nat.w * s - vp.w) / 2)
      const maxY = Math.max(0, (nat.h * s - vp.h) / 2)
      return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
    },
    [nat, baseScale, vp.w, vp.h],
  )

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!ready) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    setOffset(clampOffset(d.baseX + (e.clientX - d.startX), d.baseY + (e.clientY - d.startY), zoom))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const onZoom = (z: number) => {
    setZoom(z)
    setOffset((o) => clampOffset(o.x, o.y, z))
  }

  const confirm = async () => {
    const img = imgRef.current
    if (!img || !nat || !ready) return
    setBusy(true)
    try {
      const s = baseScale * zoom
      // Viewport'un görüntü koordinatlarındaki karşılığı.
      const srcX = (nat.w * s - vp.w) / 2 / s - offset.x / s
      const srcY = (nat.h * s - vp.h) / 2 / s - offset.y / s
      const srcW = vp.w / s
      const srcH = vp.h / s

      const outW = aspect >= 1 ? 1080 : Math.round(1080 * aspect)
      const outH = Math.round(outW / aspect)
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('blob')
      const base = file.name.replace(/\.[^.]+$/, '')
      onDone(new File([blob], `${base}-crop.jpg`, { type: 'image/jpeg' }), canvas.toDataURL('image/jpeg', 0.8))
    } catch {
      toast.error('Görsel kırpılamadı')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onCancel} title={title}>
      <div className="space-y-4">
        {/*
          🔴 8 Ağu 2026 — PENCERE ARTIK KAYDIRILMIYOR (kullanıcı isteği:
          "pc'de kaydırılabilir olmasın").
          <b>Kök neden:</b> kutu yalnız GENİŞLİKLE sınırlıydı (`max-w-sm`) ve
          yüksekliği orandan türüyordu. Hikaye oranında (9:16) bu
          <b>384 / 0,5625 ≈ 683px</b> demek; üstüne başlık, kaydırıcı ve
          düğmeler binince pencere ~850px oluyor, `max-h-[90vh]` devreye girip
          içerik kayıyordu. Ekran görüntüsünde <b>"Kırp ve kullan" görünmüyordu</b>.

          <b>Çözüm:</b> kutuyu <b>YÜKSEKLİKTEN</b> sınırla, genişliği orandan türet:
            width: min(100%, crop-h × oran)   ·   aspect-ratio: oran
          Genişlik açıkken yükseklik `width / oran` olur ve <b>her zaman</b>
          `crop-h`'yi aşmaz; `min(100%, …)` de dar telefonda taşmayı keser.
          ⚠️ Ters kurulum (`width:100%` + `max-height`) ÇALIŞMAZ: tarayıcı
          yüksekliği kırpar ama genişliği korur, oran bozulur.

          `crop-h` penceredeki diğer her şeyin (başlık ~64 · kaydırıcı ~44 ·
          düğmeler ~60 · dolgu ~48 = ~216px) payı düşülerek hesaplanır; 260px
          pay bırakıldı ki 90vh sınırına hiç dayanılmasın.
        */}
        <div
          ref={viewportRef}
          className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-2xl bg-subtle active:cursor-grabbing"
          style={{
            ['--crop-h' as string]: 'clamp(180px, calc(88vh - 260px), 560px)',
            width: `min(100%, calc(var(--crop-h) * ${aspect}))`,
            aspectRatio: String(aspect),
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget
                setNat({ w: el.naturalWidth, h: el.naturalHeight })
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={
                nat
                  ? {
                      width: `${nat.w}px`,
                      height: `${nat.h}px`,
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${baseScale * zoom})`,
                      transformOrigin: 'center',
                    }
                  : { opacity: 0 }
              }
            />
          )}
          {!ready && (
            <div className="absolute inset-0 grid place-items-center">
              <Spinner />
            </div>
          )}
          {/* 1/3 kılavuz çizgileri */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-1/3 border-t border-white/25" />
            <div className="absolute inset-x-0 top-2/3 border-t border-white/25" />
            <div className="absolute inset-y-0 left-1/3 border-l border-white/25" />
            <div className="absolute inset-y-0 left-2/3 border-l border-white/25" />
          </div>
        </div>

        <div className="flex items-center gap-3 px-1">
          <span className="text-xs font-semibold text-faint">Yakınlaştır</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--color-accent)]"
            aria-label="Yakınlaştır"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="subtle" className="flex-1" onClick={onCancel} disabled={busy}>
            Vazgeç
          </Button>
          <Button className="flex-1" onClick={() => void confirm()} disabled={busy || !ready}>
            {busy ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : 'Kırp ve kullan'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
