import { count, eq } from 'drizzle-orm'
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { db } from './db.js'

export const permissions = [
  'metrics.view',
  'metrics.manage',
  'kanban.view',
  'kanban.manage',
  'integrations.view',
  'integrations.manage',
  'governance.manage',
] as const

export type Permission = typeof permissions[number]

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  permissions: text('permissions').notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type NewUser = typeof users.$inferInsert
export type NewRole = typeof roles.$inferInsert

function parsePermissions(value: string): Permission[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is Permission => permissions.includes(item)) : []
  } catch {
    return []
  }
}

const userSelection = {
  id: users.id,
  name: users.name,
  email: users.email,
  createdAt: users.createdAt,
  roleId: roles.id,
  roleName: roles.name,
  rolePermissions: roles.permissions,
}

type UserRow = {
  id: number
  name: string
  email: string
  createdAt: Date
  roleId: number
  roleName: string
  rolePermissions: string
}

function shapeUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    role: {
      id: row.roleId,
      name: row.roleName,
      permissions: parsePermissions(row.rolePermissions),
    },
  }
}

function shapeRole(row: typeof roles.$inferSelect) {
  return { ...row, permissions: parsePermissions(row.permissions) }
}

export async function createUser(data: NewUser) {
  const [row] = await db.insert(users).values(data).onConflictDoNothing().returning()
  return row // undefined = email já cadastrado
}

export async function findUserByEmail(email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email))
  return row
}

export async function findUserById(id: number) {
  const [row] = await db.select(userSelection).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, id))
  return row ? shapeUser(row) : undefined
}

export async function userCount() {
  const [row] = await db.select({ value: count() }).from(users)
  return Number(row.value)
}

export async function findRoleByName(name: string) {
  const [row] = await db.select().from(roles).where(eq(roles.name, name))
  return row ? shapeRole(row) : undefined
}

export async function listRoles() {
  const rows = await db.select().from(roles).orderBy(roles.id)
  return rows.map(shapeRole)
}

export async function createRole(data: { name: string; description: string; permissions: Permission[] }) {
  const [row] = await db.insert(roles).values({
    ...data,
    permissions: JSON.stringify(data.permissions),
    isSystem: false,
  }).returning()
  return shapeRole(row)
}

export async function updateRole(id: number, data: { name?: string; description?: string; permissions?: Permission[] }) {
  const values = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.permissions !== undefined ? { permissions: JSON.stringify(data.permissions) } : {}),
  }
  const [row] = await db.update(roles).set(values).where(eq(roles.id, id)).returning()
  return row ? shapeRole(row) : undefined
}

export async function deleteRole(id: number) {
  const [row] = await db.delete(roles).where(eq(roles.id, id)).returning()
  return row ? shapeRole(row) : undefined
}

export async function listUsers() {
  const rows = await db.select(userSelection).from(users).innerJoin(roles, eq(users.roleId, roles.id)).orderBy(users.name)
  return rows.map(shapeUser)
}

export async function updateUserRole(id: number, roleId: number) {
  const [row] = await db.update(users).set({ roleId }).where(eq(users.id, id)).returning({ id: users.id })
  return row ? findUserById(row.id) : undefined
}

export async function roleHasUsers(roleId: number) {
  const [row] = await db.select({ value: count() }).from(users).where(eq(users.roleId, roleId))
  return Number(row.value) > 0
}
