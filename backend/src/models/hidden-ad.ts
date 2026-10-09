import { eq, inArray } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { db } from './db.js'

// Anúncios da Meta escondidos do dashboard. Só afeta a tela: na Meta o anúncio continua veiculando.
export const hiddenAds = pgTable('hidden_meta_ads', {
  adId: text('ad_id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export async function hiddenAdIds(ids: string[]) {
  if (!ids.length) return new Set<string>()
  const rows = await db.select({ adId: hiddenAds.adId }).from(hiddenAds).where(inArray(hiddenAds.adId, ids))
  return new Set(rows.map((r) => r.adId))
}

export async function setAdHidden(adId: string, hidden: boolean) {
  if (hidden) await db.insert(hiddenAds).values({ adId }).onConflictDoNothing()
  else await db.delete(hiddenAds).where(eq(hiddenAds.adId, adId))
}
