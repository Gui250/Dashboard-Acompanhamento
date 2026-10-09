import { z } from 'zod'

const section = z.enum(['comercial', 'operacional'])
const isoDate = z.iso.date()

export const createMetricBody = z.object({
  section,
  key: z.string().trim().min(1),
  dimension: z.string().trim().min(1).nullish(),
  value: z.number().finite(),
  date: isoDate,
})

export const metricFilters = z.object({
  section: section.optional(),
  key: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
})

export const seriesQuery = metricFilters.extend({
  key: z.string().min(1),
  groupBy: z.enum(['date', 'dimension']).default('date'),
})

export const metricView = z.object({
  id: z.number(),
  section,
  key: z.string(),
  dimension: z.string().nullable(),
  value: z.number(),
  date: z.string(),
  createdAt: z.date(),
})

export const seriesView = z.array(z.object({ label: z.string(), value: z.number() }))

export const dashboardQuery = z.object({
  section,
  timelineKey: z.string().min(1),
  rankingKey: z.string().min(1).optional(),
})

export const dashboardView = z.object({
  metrics: z.array(metricView),
  timeline: seriesView,
  ranking: seriesView,
})

// Importação sem multipart (MCP): CSV como texto ou xlsx em base64.
export const importContentBody = z.object({
  format: z.enum(['csv', 'xlsx']),
  content: z.string().min(1),
})

export const templateQuery = z.object({ format: z.enum(['xlsx', 'csv']).default('xlsx') })
