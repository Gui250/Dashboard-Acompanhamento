import { asc, desc, eq, gt, sql } from 'drizzle-orm'
import { boolean, customType, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { db } from './db.js'
import { users } from './user.js'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

export const STAGES = ['briefing', 'producao', 'revisao', 'aprovado', 'publicado'] as const

// Funil = um kanban separado; todos usam as mesmas etapas.
// O padrão (só um, garantido pelo índice) abre primeiro e recebe os criativos sem funil e os de funis excluídos.
export const funnels = pgTable(
  'funnels',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('funnels_one_default_idx').on(t.isDefault).where(sql`${t.isDefault}`)],
)

export const creatives = pgTable('creatives', {
  id: serial('id').primaryKey(),
  funnelId: integer('funnel_id')
    .notNull()
    .references(() => funnels.id, { onDelete: 'restrict' }), // excluir funil nunca apaga criativos
  title: text('title').notNull(),
  account: text('account').notNull(),
  format: text('format').notNull(),
  owner: text('owner').notNull(),
  stage: text('stage', { enum: STAGES }).notNull().default('briefing'),
  image: bytea('image'),
  imageType: text('image_type'),
  reviewNote: text('review_note'), // último pedido de ajuste da aprovação
  approvalRequestedBy: integer('approval_requested_by').references(() => users.id, { onDelete: 'set null' }), // quem recebe o aviso de aprovado
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
})

export type NewCreative = typeof creatives.$inferInsert
export type CreativeChanges = Partial<
  Pick<NewCreative, 'funnelId' | 'title' | 'account' | 'format' | 'owner' | 'stage' | 'reviewNote' | 'approvalRequestedBy'>
>

// Nunca seleciona os bytes da imagem, só se ela existe.
const view = {
  id: creatives.id,
  funnelId: creatives.funnelId,
  title: creatives.title,
  account: creatives.account,
  format: creatives.format,
  owner: creatives.owner,
  stage: creatives.stage,
  reviewNote: creatives.reviewNote,
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

export async function findCreative(id: number) {
  const [row] = await db.select(view).from(creatives).where(eq(creatives.id, id))
  return row
}

export async function creativeStage(id: number) {
  const [row] = await db.select({ stage: creatives.stage }).from(creatives).where(eq(creatives.id, id))
  return row?.stage
}

const funnelView = { id: funnels.id, name: funnels.name, isDefault: funnels.isDefault }

// Padrão primeiro, depois por criação.
export function listFunnels() {
  return db.select(funnelView).from(funnels).orderBy(desc(funnels.isDefault), asc(funnels.id))
}

export async function findFunnel(id: number) {
  const [row] = await db.select(funnelView).from(funnels).where(eq(funnels.id, id))
  return row
}

export async function defaultFunnel() {
  const [row] = await db.select(funnelView).from(funnels).where(eq(funnels.isDefault, true))
  return row
}

// undefined = já existe um funil com esse nome. O primeiro funil criado já nasce padrão.
export async function createFunnel(name: string) {
  const isDefault = sql<boolean>`not exists (select 1 from ${funnels} where ${funnels.isDefault})`
  const [row] = await db.insert(funnels).values({ name, isDefault }).onConflictDoNothing().returning(funnelView)
  return row
}

// Renomeia e/ou vira o padrão (o padrão anterior deixa de ser). Só dá para ganhar o padrão, não tirar:
// sempre existe um. undefined = não existe; null = nome já usado por outro funil.
export function updateFunnel(id: number, { name, isDefault }: { name?: string; isDefault?: true }) {
  return db.transaction(async (tx) => {
    const [found] = await tx.select({ id: funnels.id }).from(funnels).where(eq(funnels.id, id))
    if (!found) return undefined
    const [clash] = name ? await tx.select({ id: funnels.id }).from(funnels).where(eq(funnels.name, name)) : []
    if (clash && clash.id !== id) return null
    if (isDefault) await tx.update(funnels).set({ isDefault: false }).where(eq(funnels.isDefault, true))
    const [row] = await tx.update(funnels).set({ name, isDefault }).where(eq(funnels.id, id)).returning(funnelView)
    return row
  })
}

// Move os criativos para o padrão e apaga o funil. O padrão não pode ser excluído.
// 'default' = é o padrão; undefined = não existe.
export function deleteFunnel(id: number) {
  return db.transaction(async (tx) => {
    const [target] = await tx.select(funnelView).from(funnels).where(eq(funnels.id, id))
    if (!target) return undefined
    if (target.isDefault) return 'default' as const
    const [fallback] = await tx.select({ id: funnels.id }).from(funnels).where(eq(funnels.isDefault, true))
    const moved = await tx.update(creatives).set({ funnelId: fallback.id }).where(eq(creatives.funnelId, id)).returning({ id: creatives.id })
    await tx.delete(funnels).where(eq(funnels.id, id))
    return { moved: moved.length }
  })
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

// Cada aprovação da Flávia vira um aviso para todos na plataforma (sino + som). Some junto com o criativo.
export const approvals = pgTable('creative_approvals', {
  id: serial('id').primaryKey(),
  creativeId: integer('creative_id')
    .notNull()
    .references(() => creatives.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export async function recordApproval(creativeId: number) {
  await db.insert(approvals).values({ creativeId })
}

// Mais recentes primeiro; after = só as mais novas que esse id (o que o front já viu).
export function listApprovals(after = 0, limit = 20) {
  return db
    .select({ id: approvals.id, createdAt: approvals.createdAt, creative: view })
    .from(approvals)
    .innerJoin(creatives, eq(creatives.id, approvals.creativeId))
    .where(gt(approvals.id, after))
    .orderBy(desc(approvals.id))
    .limit(limit)
}

export async function requesterEmail(creativeId: number) {
  const [row] = await db
    .select({ email: users.email, name: users.name })
    .from(creatives)
    .innerJoin(users, eq(users.id, creatives.approvalRequestedBy))
    .where(eq(creatives.id, creativeId))
  return row
}
