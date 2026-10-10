import { api } from './api'
import type { BillingSummary, InvoiceDetail, InvoiceSummary, PageResponse } from '@/types/api'

/**
 * Faturalandırma. Her satın alma anında sunucuda fatura kesilir; burada
 * yalnızca okuma vardır (fatura istemciden oluşturulamaz/değiştirilemez).
 */

export async function getMyInvoices(page = 0, size = 20): Promise<PageResponse<InvoiceSummary>> {
  return (await api.get<PageResponse<InvoiceSummary>>('/invoices', { params: { page, size } })).data
}

export async function getInvoice(id: string): Promise<InvoiceDetail> {
  return (await api.get<InvoiceDetail>(`/invoices/${id}`)).data
}

export async function getBillingSummary(): Promise<BillingSummary> {
  return (await api.get<BillingSummary>('/invoices/summary')).data
}
