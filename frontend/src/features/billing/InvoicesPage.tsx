import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Crown, FileText, Printer, Receipt, Wallet } from 'lucide-react'
import { DashShell, DashStat } from '@/components/dash'
import { USER_NAV } from '@/app/userNav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { PageSpinner, Spinner } from '@/components/ui/spinner'
import { getBillingSummary, getInvoice, getMyInvoices } from '@/lib/billing'
import { getMyBids, formatMoney, type BidHistoryRow } from '@/lib/storeBids'
import { fmtArea, fmtDate, fmtDateTime, fmtMoney, fmtRadius } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { InvoiceStatus, InvoiceSummary } from '@/types/api'

/**
 * Faturalarım — satın alınan her alanın faturası.
 *
 * Faturalar sunucuda satın alma anında kesilir; buradaki her şey **okuma**dır.
 * Gerçek ödeme altyapısı bağlandığında durum alanı (`ISSUED → PAID`) anlam
 * kazanır, ekranın geri kalanı aynı kalır.
 */
export function InvoicesPage() {
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  const summaryQuery = useQuery({ queryKey: ['billing-summary'], queryFn: getBillingSummary })
  const listQuery = useQuery({
    queryKey: ['invoices', page],
    queryFn: () => getMyInvoices(page, 20),
  })

  const summary = summaryQuery.data
  const invoices = listQuery.data?.content ?? []

  return (
    <DashShell navItems={USER_NAV}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DashStat
            icon={Receipt}
            tone="sky"
            label="Fatura sayısı"
            value={summary ? String(summary.invoiceCount) : '—'}
          />
          <DashStat
            icon={Wallet}
            tone="mint"
            label="Toplam harcama"
            value={summary ? fmtMoney(summary.totalSpent, summary.currency) : '—'}
          />
        </div>

        <Card className="p-4 md:p-5">
          <CardTitle>Faturalar</CardTitle>
          {listQuery.isLoading && <PageSpinner label="Yükleniyor…" />}

          {!listQuery.isLoading && invoices.length === 0 && (
            <div className="rounded-xl bg-subtle p-6 text-center">
              <p className="text-sm font-semibold">Henüz faturan yok</p>
              <p className="mt-1 text-xs font-medium text-faint">
                Bir alan satın aldığında faturası anında burada oluşur.
              </p>
              <Link to="/map" className="mt-3 inline-block">
                <Button size="sm">Haritayı aç</Button>
              </Link>
            </div>
          )}

          <div className="divide-y divide-line">
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} onOpen={() => setOpenId(invoice.id)} />
            ))}
          </div>

          {(listQuery.data?.totalPages ?? 0) > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="stroke"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Önceki
              </Button>
              <span className="text-xs font-semibold text-muted">
                {page + 1} / {listQuery.data?.totalPages}
              </span>
              <Button
                variant="stroke"
                size="sm"
                disabled={!listQuery.data?.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>

        {/* 🔴 25 Ağu 2026 — TEKLİF GEÇMİŞİ (kullanıcı isteği: *"faturalarım
            kısmına getir, küçük bir alan olsun"*).
            ⚠️ Faturaların ALTINDA ve küçük: asıl belge faturadır, bu liste
            onun tamamlayıcısı. Üste koymak, faturasını arayan kullanıcıyı
            her seferinde bir adım geriye atardı.
            ⚠️ Hiç teklif yoksa bölüm ÇİZİLMEZ — boş bir başlık, kullanıcıya
            eksik bir şey varmış hissi verirdi. */}
        <BidHistoryCard />
      </div>

      {openId && <InvoiceDialog id={openId} onClose={() => setOpenId(null)} />}
    </DashShell>
  )
}

/** Teklif durumları — metin İSTEMCİDE çözülür, sunucu kod gönderir. */
const BID_STATUS: Record<BidHistoryRow['status'], { label: string; tone: 'success' | 'info' | 'danger' | 'neutral' }> = {
  ACTIVE: { label: 'Sırada', tone: 'success' },
  REPLACED: { label: 'Geçmiş', tone: 'neutral' },
  PENDING: { label: 'Ödeme bekliyor', tone: 'info' },
  FAILED: { label: 'Başarısız', tone: 'danger' },
}

/**
 * <b>Teklif geçmişi</b> — "mağazanı öne taşı" ödemelerim.
 *
 * <p>⚠️ Sıralamayı belirleyen satır <b>ACTIVE</b> olandır; diğerleri geçmiş
 * ödemelerdir ve <b>iade edilmez</b>. Bu ayrımı göstermek şart: aynı kullanıcı
 * üç ödeme yapıp listede tek bir tutar görüyor ve "diğerleri nereye gitti?"
 * diye soruyor.
 */
function BidHistoryCard() {
  const { data, isLoading } = useQuery({ queryKey: ['my-bids'], queryFn: getMyBids, retry: false })
  if (isLoading || !data?.length) return null

  return (
    <Card className="p-4 md:p-5">
      <CardTitle>Öne çıkarma teklifleri</CardTitle>
      <p className="mt-1 text-[12.5px] font-medium text-muted">
        Sıralamayı belirleyen, en yüksek <b>sıradaki</b> teklifindir; geçmiş ödemeler iade edilmez.
      </p>
      <div className="mt-2 divide-y divide-line">
        {data.map((bid) => {
          const status = BID_STATUS[bid.status]
          return (
            <div key={bid.bidId} className="flex items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-subtle text-muted">
                <Crown className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold">
                    {bid.storeName ?? 'Mağaza silindi'}
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </span>
                <span className="mt-0.5 block truncate text-xs font-medium text-faint">
                  {fmtDateTime(bid.activatedAt ?? bid.placedAt)}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                {formatMoney(bid.amount, bid.currency)}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

const STATUS_LABEL: Record<InvoiceStatus, { label: string; tone: 'success' | 'info' | 'danger' | 'neutral' }> = {
  PAID: { label: 'Ödendi', tone: 'success' },
  ISSUED: { label: 'Kesildi', tone: 'info' },
  DRAFT: { label: 'Taslak', tone: 'neutral' },
  CANCELLED: { label: 'İptal', tone: 'danger' },
}

function InvoiceRow({ invoice, onOpen }: { invoice: InvoiceSummary; onOpen: () => void }) {
  const status = STATUS_LABEL[invoice.status]
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 py-2.5 text-left transition-opacity hover:opacity-70">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-subtle text-muted">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-mono text-[13px] font-semibold tracking-tight">{invoice.invoiceNo}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium text-faint">{invoice.description}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[13px] font-semibold">{fmtMoney(invoice.total, invoice.currency)}</span>
        <span className="block text-xs font-medium text-faint">{fmtDate(invoice.issuedAt)}</span>
      </span>
    </button>
  )
}

/** Yazdırılabilir fatura — sade, tek sütun, hairline ayraçlar. */
function InvoiceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id),
  })

  return (
    <Dialog open onClose={onClose} className="max-w-xl">
      {isLoading && <Spinner />}
      {invoice && (
        <div id="waydee-invoice" className="space-y-4">
          <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Fatura</p>
              <p className="font-mono text-lg font-semibold tracking-tight">{invoice.invoiceNo}</p>
              <p className="mt-0.5 text-xs font-medium text-faint">{fmtDateTime(invoice.issuedAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-semibold tracking-tight">WAYDEE</p>
              <p className="text-xs font-medium text-faint">Harita tabanlı sosyal platform</p>
              <Badge tone={STATUS_LABEL[invoice.status].tone} className="mt-1.5">
                {STATUS_LABEL[invoice.status].label}
              </Badge>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2">
            <InfoBlock title="Alıcı">
              <p className="text-[13px] font-semibold">{invoice.buyerName}</p>
              <p className="text-xs font-medium text-faint">@{invoice.buyerUsername}</p>
              <p className="text-xs font-medium text-faint">{invoice.buyerEmail}</p>
            </InfoBlock>
            <InfoBlock title="Ödeme">
              <p className="text-[13px] font-semibold">{invoice.paymentMethod ?? '—'}</p>
              <p className="break-all font-mono text-[11px] font-medium text-faint">
                {invoice.paymentReference ?? '—'}
              </p>
            </InfoBlock>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Kalem</p>
            <div className="rounded-xl bg-subtle p-3">
              <p className="text-[13px] font-semibold">{invoice.description}</p>
              {invoice.regionLabel && (
                <p className="mt-0.5 text-xs font-medium text-faint">{invoice.regionLabel}</p>
              )}
              {/*
                🔴 25 Ağu 2026 (98. tur) — ALAN/YARIÇAP SATIRLARI YALNIZ BÖLGE
                FATURALARINDA.

                Fatura şeması bölge satışı için tasarlandı ve bu üç alan orada
                anlamlı. "Mağazanı öne taşı" ödemesinin alanı yoktur; sıfır
                yazılıyor ve bu satırlar çizilseydi kullanıcı faturasında
                <b>"0 km² · 0 m"</b> okurdu — sayı doğru, cümle saçma.

                ⚠️ Ölçüt `kind`, tutar ya da alanın sıfır olması DEĞİL: bir gün
                gerçekten sıfır alanlı bir bölge kaydı olsa bile faturanın türü
                değişmez.
              */}
              {invoice.kind !== 'STORE_BID' && (
                <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  <Detail label="Alan" value={fmtArea(invoice.areaKm2)} />
                  <Detail label="Yarıçap" value={fmtRadius(invoice.radiusM)} />
                  <Detail
                    label="km² birim fiyat"
                    value={invoice.pricePerKm2 != null ? fmtMoney(invoice.pricePerKm2, invoice.currency) : '—'}
                  />
                </dl>
              )}
            </div>
          </section>

          <section className="space-y-1.5 border-t border-line pt-3">
            <Row label="Ara toplam" value={fmtMoney(invoice.subtotal, invoice.currency)} />
            <Row
              label={`KDV (%${Number(invoice.taxRate).toLocaleString('tr-TR')})`}
              value={fmtMoney(invoice.taxAmount, invoice.currency)}
            />
            <Row label="Toplam" value={fmtMoney(invoice.total, invoice.currency)} strong />
          </section>

          <footer className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-[11px] font-medium leading-snug text-faint">
              Bu belge elektronik olarak üretilmiştir; ıslak imza gerektirmez.
            </p>
            <Button variant="stroke" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Yazdır
            </Button>
          </footer>
        </div>
      )}
    </Dialog>
  )
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{title}</p>
      {children}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-faint">{label}</dt>
      <dd className="text-xs font-semibold">{value}</dd>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cn('text-[13px]', strong ? 'font-semibold' : 'font-medium text-muted')}>{label}</span>
      <span className={cn(strong ? 'text-base font-semibold tracking-tight' : 'text-[13px] font-semibold')}>
        {value}
      </span>
    </div>
  )
}
