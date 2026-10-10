import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Referansın **mıknatıs** sarmalayıcısı (kaynak modül `27832`).
 *
 * Öğenin üstüne gelince içerik fareyi <b>yaylanarak</b> takip eder, ayrılınca
 * yerine geri oturur. Referanstan birebir çıkarılan değerler:
 *
 * ```js
 * onMouseEnter: bounds = el.getBoundingClientRect()
 * onMouseMove:  x = 0.1 * (clientX - (left + width/2))
 *               y = 0.1 * (clientY - (top  + height/2))
 * onMouseLeave: x = 0, y = 0
 * transition:   { type: 'spring', stiffness: 350, damping: 5, mass: 0.5 }
 * ```
 *
 * ⚠️ <b>framer-motion KULLANILMAZ.</b> Vault'un altın kuralı: konumu kritik bir
 * öğede `x`/`y` transform animasyonu framer-motion v12 + React 19'da başlangıç
 * değerinde takılıyor (bu projede üç kez ısırdı). Yay burada elle çözülüyor ve
 * sonuç <b>doğrudan DOM'a</b> yazılıyor — React state'i her karede güncellenmez.
 *
 * ⚠️ `stiffness 350 / damping 5 / mass 0.5` <b>çok az sönümlü</b> bir yaydır:
 * karakteri veren şey bu salınımdır, sayıları "düzeltme".
 */
export function MagneticLink({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const inner = wrap.firstElementChild as HTMLElement | null
    if (!inner) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    // Yay durumu: konum (x,y) ve hız (vx,vy).
    let x = 0
    let y = 0
    let vx = 0
    let vy = 0
    let targetX = 0
    let targetY = 0
    let bounds = { left: 0, top: 0, width: 0, height: 0 }
    let frame = 0
    let idle = true

    const STIFFNESS = 350
    const DAMPING = 5
    const MASS = 0.5
    const DT = 1 / 60

    const step = () => {
      // F = -k·x - c·v   →   a = F / m
      const ax = (-STIFFNESS * (x - targetX) - DAMPING * vx) / MASS
      const ay = (-STIFFNESS * (y - targetY) - DAMPING * vy) / MASS
      vx += ax * DT
      vy += ay * DT
      x += vx * DT
      y += vy * DT
      inner.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`

      const settled =
        Math.abs(x - targetX) < 0.05 &&
        Math.abs(y - targetY) < 0.05 &&
        Math.abs(vx) < 0.05 &&
        Math.abs(vy) < 0.05
      if (settled && targetX === 0 && targetY === 0) {
        // Yerine oturdu ve hedef merkez: döngüyü durdur (boşuna kare harcama).
        inner.style.transform = ''
        idle = true
        return
      }
      frame = requestAnimationFrame(step)
    }

    const wake = () => {
      if (!idle) return
      idle = false
      frame = requestAnimationFrame(step)
    }

    const onEnter = () => {
      const r = wrap.getBoundingClientRect()
      bounds = { left: r.left, top: r.top, width: r.width, height: r.height }
    }
    const onMove = (e: MouseEvent) => {
      targetX = 0.1 * (e.clientX - (bounds.left + bounds.width / 2))
      targetY = 0.1 * (e.clientY - (bounds.top + bounds.height / 2))
      wake()
    }
    const onLeave = () => {
      targetX = 0
      targetY = 0
      wake()
    }

    wrap.addEventListener('mouseenter', onEnter)
    wrap.addEventListener('mousemove', onMove)
    wrap.addEventListener('mouseleave', onLeave)
    return () => {
      wrap.removeEventListener('mouseenter', onEnter)
      wrap.removeEventListener('mousemove', onMove)
      wrap.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [])

  // Referansta sarmalayıcı `style={{position:'relative'}}` taşır.
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {children}
    </div>
  )
}
