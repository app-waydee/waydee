import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { lockScroll } from '@/lib/scrollLock'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

/** Core 2.0 modalı. AnimatePresence kullanılmaz — React 19'da exit animasyonu öğeyi DOM'da bırakıyor. */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const release = lockScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      release()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className={cn(
          'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface p-6 shadow-float md:p-7',
          className,
        )}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          {title && <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>}
          <Button variant="stroke" size="icon" onClick={onClose} aria-label="Kapat">
            <X className="h-4.5 w-4.5" />
          </Button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
