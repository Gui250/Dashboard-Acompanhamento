import { z } from 'zod'
import { STAGES } from '../models/creative.js'

const stage = z.enum(STAGES)
const field = z.string().trim().min(1)

const funnelId = z.number().int().positive()

export const createCreativeBody = z.object({
  funnelId,
  title: field,
  account: field,
  format: field,
  owner: field,
  stage: stage.default('briefing'),
})

export const updateCreativeBody = createCreativeBody.extend({ stage }).partial()

export const creativeParams = z.object({ id: z.coerce.number().int().positive() })
export const creativesQuery = z.object({ funnelId: z.coerce.number().int().positive().optional() })

export const funnelBody = z.object({ name: z.string().trim().min(1).max(80) })
export const funnelView = z.object({ id: z.number(), name: z.string() })

// Nunca inclui os bytes da imagem.
export const creativeView = z.object({
  id: z.number(),
  funnelId: z.number(),
  title: z.string(),
  account: z.string(),
  format: z.string(),
  owner: z.string(),
  stage,
  hasImage: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
