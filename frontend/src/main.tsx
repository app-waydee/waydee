import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/toast'
import { router } from '@/app/router'
import { SessionBootstrap } from '@/app/SessionBootstrap'
import { initTheme } from '@/stores/theme'
import { initI18n } from '@/stores/i18n'
import { initMapboxToken } from '@/lib/clientConfig'
import './index.css'

initTheme()
// Dil: kayıtlı seçim → tarayıcı dili. `<html lang/dir>` burada kurulur
// (Arapçada yön sağdan sola döner) ve gerekiyorsa sözlük indirilir.
initI18n()
// Mapbox anahtarını sunucudan çek (env yedeğiyle başlar). Harita bileşenleri
// anahtar değişirse kendilerini yeniden kurar — beklemeye gerek yok.
void initMapboxToken()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>
        <RouterProvider router={router} />
      </SessionBootstrap>
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
