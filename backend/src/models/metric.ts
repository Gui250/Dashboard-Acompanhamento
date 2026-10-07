import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { date, doublePrecision, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { db } from './db.js'

export const metrics = pgTable('metrics', {
  id: serial('id').primaryKey(),
  section: text('section', { enum: ['comercial', 'operacional'] }).notNull(),
  key: text('key').notNull(),
  dimension: text('dimension'),
  value: doublePrecision('value').notNull(),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type NewMetric = typeof metrics.$inferInsert

export type MetricFilters = {
  section?: 'comercial' | 'operacional'
  key?: string
  from?: string
  to?: string
}

function where(f: MetricFilters) {
  return and(
    f.section ? eq(metrics.section, f.section) : undefined,
    f.key ? eq(metrics.key, f.key) : undefined,
    f.from ? gte(metrics.date, f.from) : undefined,
    f.to ? lte(metrics.date, f.to) : undefined,
  )
}

export async function createMetric(data: NewMetric) {
  const [row] = await db.insert(metrics).values(data).returning()
  return row
}

export function listMetrics(f: MetricFilters) {
  return db.select().from(metrics).where(where(f)).orderBy(asc(metrics.date), asc(metrics.id))
}

export function metricSeries(f: MetricFilters & { groupBy: 'date' | 'dimension' }) {
  const label = sql<string>`coalesce(${f.groupBy === 'date' ? metrics.date : metrics.dimension}::text, 'sem dimensão')`
  const value = sql<number>`sum(${metrics.value})`.mapWith(Number)
  return db
    .select({ label, value })
    .from(metrics)
    .where(where(f))
    .groupBy(label)
    .orderBy(f.groupBy === 'date' ? asc(label) : desc(value))
}

export function createMetrics(rows: NewMetric[]) {
  return db.insert(metrics).values(rows).returning()
}
