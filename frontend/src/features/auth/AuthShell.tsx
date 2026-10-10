import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Logo } from '@/components/Logo'
import { Card } from '@/components/ui/card'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * Core 2.0 kimlik ekranı: açık gri tuval, ortada tek beyaz kart.
 *
 * ⚠️ <b>KAYDIRMA — bir daha bozulmasın diye:</b> bu kabuk eskiden
 * `min-h-full` + `items-center` + <b>`overflow-hidden`</b> kullanıyordu.
 * `html, body, #root` yüksekliği %100 olduğu için kayıt formu (dört alan +
 * bot doğrulaması + düğme) kısa telefon ekranına sığmadığında taşan kısım
 * <b>kırpılıyor ve sayfa kaydırılamıyordu</b> — alanların bir bölümüne hiç
 * ulaşılamıyordu. `overflow-hidden` artık YALNIZ dekoratif katmanda; içerik
 * taşarsa sayfa normal şekilde kayar.
 *
 * ⚠️ Giriş animasyonu yalnız `opacity` — konumu etkileyen `y`/`x` transform'ları
 * bu projede birkaç kez başlangıç değerinde takıldı (vault 12-tuzaklar).
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative min-h-full bg-canvas">
      {/* Dekoratif lekeler kendi kabında kırpılır — içeriğe dokunmaz. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-sky/30 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-lilac/25 blur-3xl" />
      </div>

      <div className="relative flex min-h-full items-center justify-center px-5 py-7 md:py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-[420px]"
        >
          <div className="mb-4 flex justify-center md:mb-7">
            <Logo />
          </div>
          <Card className="p-5 md:p-8">
            <h1 className="text-[23px] font-semibold leading-tight tracking-tight md:text-[28px]">
              {title}
            </h1>
            <p className="mb-5 mt-1.5 text-[13px] font-medium leading-snug text-muted md:mb-7 md:mt-2 md:text-sm">
              {subtitle}
            </p>
            {children}
          </Card>
          {footer && (
            <div className="mt-4 text-center text-sm font-medium text-muted md:mt-6">{footer}</div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
