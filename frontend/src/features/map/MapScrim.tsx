import { cn } from '@/lib/utils'

interface MapScrimProps {
  /** Alt gezinme çubuğu olan yüzeylerde daha yüksek perde gerekir. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Haritanın alt kenarındaki karartma perdesi.
 *
 * Neden var: Mapbox künyesi (attribution) ve kontrolleri harita tuvalinin altında
 * açık renkli bir şerit oluşturuyor ve tuvale oturan yüzen öğelerin altında göze
 * batıyor. Künye **kaldırılmaz** (Mapbox şartları sayfada bulunmasını ister) —
 * `index.css` onu söndürür, bu perde de üstüne yumuşak bir geçiş koyar.
 *
 * ⚠️ Uygulamadaki BEŞ harita yüzeyinin hepsinde kullanılmalıdır; yalnız birine
 * eklenirse diğerlerinde aynı beyaz şerit geri gelir (kamera hafızasıyla aynı
 * tuzak — bkz. vault 12-tuzaklar "harita davranışı = beş yüzey").
 */
export function MapScrim({ size = 'md', className }: MapScrimProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent backdrop-blur-[2px]',
        size === 'sm' ? 'h-20 md:h-24' : 'h-28 md:h-32',
        className,
      )}
    />
  )
}
