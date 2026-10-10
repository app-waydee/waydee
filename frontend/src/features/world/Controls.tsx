import { useCallback, useRef, useState } from 'react'

/** Çubuğun yarıçapı (piksel) — parmağın/farenin merkezden azami uzaklığı. */
const RADIUS = 54

/**
 * Sürükleme mi dokunuş mu? Bu eşiğin altındaki hareket <b>dokunuş</b> sayılır
 * ve olay tuvale bırakılır — yoksa rafa dokunmak imkânsız olurdu.
 */
const TAP_SLOP = 8

/**
 * Dokunmatik <b>bakış sürüklemesi</b> — sahnenin KABINA takılan olay işleyicileri.
 *
 * <p>🔴 11 Ağu 2026. Kullanıcı: *"mobilde sağa sola dönme nasıl oluyor??
 * ekranın ortasını çevirince de sağa sola dönsün etrafını görsün"*. Önceki
 * sürümde bakış yalnız `PointerLockControls` ile yapılıyordu; fare kilidi
 * dokunmatikte olmadığı için <b>telefonda dönüş hiç yoktu</b>.
 *
 * <p>🔴 Neden tuvalin ÜSTÜNE bir katman koymuyoruz? Çünkü koyduğumuz an
 * raflara dokunmak biterdi: katman bütün işaretçi olaylarını yutar ve R3F'in
 * ışın testi hiç çalışmaz. Bunun yerine işleyiciler <b>kaba</b> bağlanıyor;
 * olaylar tuvalden yukarı <b>kabarıyor</b>, yani hem R3F kendi tıklamasını
 * görüyor hem biz sürüklemeyi ölçüyoruz. Sürükleme bittiğinde tıklamayı
 * ayrıca üretmemize gerek yok.
 *
 * <p>⚠️ Yalnız <b>fare dışındaki</b> işaretçiler yakalanır: masaüstünde bakış
 * fare kilidiyle çalışıyor, burada da saysaydık kamera iki kat dönerdi.
 *
 * <p>⚠️ Yalnız hedef <b>tuval</b> ise başlar. Aksi hâlde üst şeritteki geri
 * düğmesine ya da yön çubuğuna basmak da kamerayı çeviriyordu.
 */
export function useLookDrag(lookRef: React.RefObject<{ dx: number; dy: number }>) {
  const last = useRef<{ x: number; y: number } | null>(null)
  const active = useRef<number | null>(null)
  const moved = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    if (!(e.target instanceof HTMLCanvasElement)) return
    active.current = e.pointerId
    last.current = { x: e.clientX, y: e.clientY }
    moved.current = 0
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (active.current !== e.pointerId || !last.current) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      moved.current += Math.hypot(dx, dy)
      /* Eşiğin altındaki titreme kameraya YAZILMAZ: parmak rafa dokunurken
         birkaç piksel kayıyor ve sahne her dokunuşta hafifçe sarsılıyordu. */
      if (moved.current > TAP_SLOP) {
        const l = lookRef.current
        if (l) {
          l.dx += dx
          l.dy += dy
        }
      }
      last.current = { x: e.clientX, y: e.clientY }
    },
    [lookRef],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return
    active.current = null
    last.current = null
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
}

/**
 * <b>Yön çubuğu</b> — yürüme.
 *
 * <p>🔴 11 Ağu 2026'da <b>masaüstünde de</b> gösteriliyor (kullanıcı isteği:
 * *"mobilde joystick pc de de aynı şekilde"*). Önceden yalnız dokunmatikte
 * çiziliyordu. Masaüstünde WASD ile <b>toplanır</b>, onun yerine geçmez.
 *
 * <p>⚠️ Çıktı <b>ref</b>'e yazılır, state'e değil: parmak/fare hareketi
 * saniyede onlarca olay üretir ve her birinde render almak sahneyi düşürürdü.
 * Yalnız topuzun görsel konumu state'tedir ve o da bu küçük bileşeni çizer.
 */
export function MoveStick({ moveRef }: { moveRef: React.RefObject<{ x: number; y: number }> }) {
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const pointerId = useRef<number | null>(null)

  const reset = () => {
    origin.current = null
    pointerId.current = null
    moveRef.current = { x: 0, y: 0 }
    setKnob(null)
  }

  return (
    <div
      className="waydee-world-stick"
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        pointerId.current = e.pointerId
        /* Merkez, çubuğun ORTASI değil parmağın indiği nokta: kullanıcı
           kaba tam ortasından basmıyor ve fark, ilk anda ani bir sıçrama
           gibi hissediliyordu. */
        origin.current = { x: e.clientX, y: e.clientY }
        setKnob({ x: 0, y: 0 })
      }}
      onPointerMove={(e) => {
        if (pointerId.current !== e.pointerId || !origin.current) return
        let dx = e.clientX - origin.current.x
        let dy = e.clientY - origin.current.y
        const len = Math.hypot(dx, dy)
        if (len > RADIUS) {
          dx = (dx / len) * RADIUS
          dy = (dy / len) * RADIUS
        }
        setKnob({ x: dx, y: dy })
        /* ⚠️ İleri = ekranda YUKARI, yani −y. İşaret çevrilmezse çubuk ters
           çalışır ve kimse sebebini anlamaz. */
        moveRef.current = { x: dx / RADIUS, y: -dy / RADIUS }
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
      onLostPointerCapture={reset}
    >
      <span className="waydee-world-stick-base" />
      <span
        className="waydee-world-stick-knob"
        style={knob ? { transform: `translate(${knob.x}px, ${knob.y}px)` } : undefined}
      />
    </div>
  )
}
