import { z } from 'zod'
import { permissions } from '../models/user.js'
import { userView } from './user.js'

export const permissionView = z.enum(permissions)

export const roleView = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  permissions: z.array(permissionView),
  isSystem: z.boolean(),
  createdAt: z.date(),
})

export const roleParams = z.object({ id: z.coerce.number().int().positive() })

export const createRoleBody = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().min(2).max(160),
  permissions: z.array(permissionView),
})

export const updateRoleBody = createRoleBody.partial().refine((value) => Object.keys(value).length > 0)

export const updateUserRoleBody = z.object({ roleId: z.number().int().positive() })

export const governanceView = z.object({
  roles: z.array(roleView),
  users: z.array(userView),
})
