import { z } from 'zod'
import { permissions } from '../models/user.js'

const email = z.email().trim().toLowerCase()

export const registerBody = z.object({
  name: z.string().trim().min(1),
  email,
  password: z.string().min(8).max(128),
})

export const loginBody = z.object({
  email,
  password: z.string().min(1),
})

// Nunca inclui o hash da senha.
export const userView = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
  role: z.object({
    id: z.number(),
    name: z.string(),
    permissions: z.array(z.enum(permissions)),
  }),
})

export const sessionView = z.object({ token: z.string(), user: userView })

export const errorView = z.object({ message: z.string() })
