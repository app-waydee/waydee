import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ImagePlus, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { uploadImage } from '@/lib/media'
import { createReport, getReportReasons } from '@/lib/reports'
import { cn } from '@/lib/utils'

interface ReportUserDialogProps {
  userId: string
  displayName: string
  onClose: () => void
}

/** Kullanıcı şikayeti: sebep + açıklama + kanıt (ekran görüntüsü). */
export function ReportUserDialog({ userId, displayName, onClose }: ReportUserDialogProps) {
  const [reason, setReason] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState<{ file: File; preview: string } | null>(null)

  const reasonsQuery = useQuery({ queryKey: ['report-reasons'], queryFn: getReportReasons })

  const submit = useMutation({
    mutationFn: async () => {
      if (!reason) return
      const media = evidence ? await uploadImage(evidence.file) : null
      await createReport({
        reportedUserId: userId,
        reason,
        description: description.trim() || undefined,
        evidenceMediaId: media?.id,
      })
    },
    onSuccess: () => {
      toast.success('Şikayetin iletildi. Ekibimiz inceleyecek.')
      onClose()
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Şikayet gönderilemedi')),
  })

  const pickEvidence = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setEvidence({ file, preview: String(reader.result) })
    reader.readAsDataURL(file)
  }

  return (
    <Dialog open onClose={onClose} title="Kullanıcıyı şikayet et">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl bg-peach-soft px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-danger" />
          <p className="text-[13px] font-medium leading-snug text-muted">
            <b className="font-semibold text-ink">{displayName}</b> hakkındaki şikayetin yönetim ekibine iletilir.
            Kanıt eklemen incelemeyi hızlandırır.
          </p>
        </div>

        <div>
          <Label>Sebep</Label>
          <div className="grid grid-cols-2 gap-2">
            {reasonsQuery.isLoading && <Spinner />}
            {reasonsQuery.data?.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  'rounded-xl border p-2.5 text-left text-[13px] font-semibold transition-colors',
                  reason === r.value
                    ? 'border-accent bg-accent/5 text-ink'
                    : 'border-line bg-subtle text-muted hover:text-ink',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="report-desc">Açıklama (opsiyonel)</Label>
          <Textarea
            id="report-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="Ne olduğunu kısaca anlat…"
          />
          <p className="mt-1 text-right text-xs font-medium text-faint">{description.length} / 1000</p>
        </div>

        <div>
          <Label>Kanıt (ekran görüntüsü)</Label>
          {evidence ? (
            <div className="relative">
              <img
                src={evidence.preview}
                alt="Kanıt"
                className="max-h-48 w-full rounded-xl border border-line object-contain bg-subtle"
              />
              <button
                type="button"
                onClick={() => setEvidence(null)}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-ink text-on-ink"
                aria-label="Kanıtı kaldır"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-3 text-[13px] font-semibold text-muted transition-colors hover:border-faint/60 hover:text-ink">
              <ImagePlus className="h-4 w-4" /> Görsel ekle
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) pickEvidence(f)
                }}
              />
            </label>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="subtle" className="flex-1" onClick={onClose} disabled={submit.isPending}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={!reason || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? <Spinner className="border-white/30 border-t-white" /> : 'Şikayet et'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
