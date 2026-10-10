import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CreateModal } from '@/components/layout/CreateModal'
import { useT } from '@/i18n'

/**
 * Sidebar'ın <b>tam ortasındaki + düğmesi</b> — referansın `create` öğesi.
 *
 * Referansta bu öğe bir bağlantı değil, <b>popup açan bir tetikleyicidir</b>
 * (`data-slot="trigger" aria-haspopup="dialog"`).
 *
 * 🔴 İlk sürümde burada bir <b>açılır menü</b> vardı ve var olmayan rotalara
 * gidiyordu → tıklayınca hiçbir şey olmuyordu. Artık referanstaki
 * <b>"Create New" popup'ını</b> açıyor ({@link CreateModal}).
 */
export function CreateMenu({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('create.title')}
        className={`waydee-side-item ${open ? 'waydee-side-item-on' : ''}`}
      >
        <Plus className={compact ? 'h-7 w-7' : 'h-[26px] w-[26px]'} strokeWidth={2.2} />
      </button>
      <CreateModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
