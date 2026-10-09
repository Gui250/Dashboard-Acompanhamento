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

// Listas por vírgula na URL (o MCP manda arrays, que viram "a,b" na querystring).
const list = z
  .string()
  .optional()
  .transform((s) => s?.split(',').map((v) => v.trim()).filter(Boolean))

export const templateQuery = z
  .object({ format: z.enum(['xlsx', 'csv']).default('xlsx'), section: section.optional(), keys: list, dimensions: list, date: isoDate.optional() })
  .refine((q) => !q.keys?.length || q.section, { message: 'Informe a section junto com as keys.', path: ['section'] })

// Mesmos campos, com arrays de verdade, para a tool do MCP.
export const templateTool = z.object({
  format: z.enum(['xlsx', 'csv']).default('csv'),
  section: section.optional(),
  keys: z.array(z.string().trim().min(1)).optional(),
  dimensions: z.array(z.string().trim().min(1)).optional(),
  date: isoDate.optional(),
})
