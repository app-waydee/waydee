import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/theme'
import { cn } from '@/lib/utils'

/** Core 2.0 tema anahtarı: aydınlık ↔ karanlık. */
export function ThemeToggle({ className }: { className?: string }) {
  const mode = useThemeStore((s) => s.mode)
  const toggle = useThemeStore((s) => s.toggle)

  return (
    <Button
      variant="stroke"
      size="icon"
      className={cn('shrink-0', className)}
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
      title={mode === 'dark' ? 'Aydınlık tema' : 'Karanlık tema'}
    >
      {mode === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </Button>
  )
}
