import { asc, eq, sql } from 'drizzle-orm'
import { customType, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { db } from './db.js'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

export const STAGES = ['briefing', 'producao', 'revisao', 'aprovado', 'publicado'] as const

// Funil = um kanban separado; todos usam as mesmas etapas.
export const funnels = pgTable('funnels', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const creatives = pgTable('creatives', {
  id: serial('id').primaryKey(),
  funnelId: integer('funnel_id')
    .notNull()
    .references(() => funnels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  account: text('account').notNull(),
  format: text('format').notNull(),
  owner: text('owner').notNull(),
  stage: text('stage', { enum: STAGES }).notNull().default('briefing'),
  image: bytea('image'),
  imageType: text('image_type'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export type NewCreative = typeof creatives.$inferInsert
export type CreativeChanges = Partial<Pick<NewCreative, 'funnelId' | 'title' | 'account' | 'format' | 'owner' | 'stage'>>

// Nunca seleciona os bytes da imagem, só se ela existe.
const view = {
  id: creatives.id,
  funnelId: creatives.funnelId,
  title: creatives.title,
  account: creatives.account,
  format: creatives.format,
  owner: creatives.owner,
  stage: creatives.stage,
  hasImage: sql<boolean>`${creatives.image} is not null`,
  createdAt: creatives.createdAt,
  updatedAt: creatives.updatedAt,
}

export function listCreatives(funnelId?: number) {
  return db
    .select(view)
    .from(creatives)
    .where(funnelId ? eq(creatives.funnelId, funnelId) : undefined)
    .orderBy(asc(creatives.id))
}

export async function creativeStage(id: number) {
  const [row] = await db.select({ stage: creatives.stage }).from(creatives).where(eq(creatives.id, id))
  return row?.stage
}

export function listFunnels() {
  return db.select({ id: funnels.id, name: funnels.name }).from(funnels).orderBy(asc(funnels.id))
}

export async function findFunnel(id: number) {
  const [row] = await db.select({ id: funnels.id, name: funnels.name }).from(funnels).where(eq(funnels.id, id))
  return row
}

// undefined = já existe um funil com esse nome.
export async function createFunnel(name: string) {
  const [row] = await db.insert(funnels).values({ name }).onConflictDoNothing().returning({ id: funnels.id, name: funnels.name })
  return row
}

export async function createCreative(data: NewCreative) {
  const [row] = await db.insert(creatives).values(data).returning(view)
  return row
}

async function update(id: number, data: Partial<NewCreative>) {
  const [row] = await db.update(creatives).set(data).where(eq(creatives.id, id)).returning(view)
  return row // undefined = não existe
}

export function updateCreative(id: number, data: CreativeChanges) {
  return update(id, data)
}

export function setCreativeImage(id: number, image: Buffer | null, imageType: string | null) {
  return update(id, { image, imageType })
}

export async function deleteCreative(id: number) {
  const [row] = await db.delete(creatives).where(eq(creatives.id, id)).returning({ id: creatives.id })
  return row
}

export async function findCreativeImage(id: number) {
  const [row] = await db
    .select({ image: creatives.image, imageType: creatives.imageType })
    .from(creatives)
    .where(eq(creatives.id, id))
  return row?.image && row.imageType ? { image: row.image, imageType: row.imageType } : undefined
}
