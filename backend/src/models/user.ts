import { eq } from 'drizzle-orm'
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { db } from './db.js'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type NewUser = typeof users.$inferInsert

export async function createUser(data: NewUser) {
  const [row] = await db.insert(users).values(data).onConflictDoNothing().returning()
  return row // undefined = email já cadastrado
}

export async function findUserByEmail(email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email))
  return row
}

export async function findUserById(id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id))
  return row
}
