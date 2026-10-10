import { api } from './api'
import type { CreateReportPayload, ReportReasonOption } from '@/types/api'

export async function getReportReasons(): Promise<ReportReasonOption[]> {
  return (await api.get<ReportReasonOption[]>('/reports/reasons')).data
}

export async function createReport(payload: CreateReportPayload): Promise<void> {
  await api.post('/reports', payload)
}
