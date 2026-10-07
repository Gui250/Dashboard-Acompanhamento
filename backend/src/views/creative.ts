import { z } from 'zod'
import { STAGES } from '../models/creative.js'

const stage = z.enum(STAGES)
const field = z.string().trim().min(1)

export const createCreativeBody = z.object({
  title: field,
  account: field,
  format: field,
  owner: field,
  stage: stage.default('briefing'),
})

export const updateCreativeBody = createCreativeBody.extend({ stage }).partial()

export const creativeParams = z.object({ id: z.coerce.number().int().positive() })

// Nunca inclui os bytes da imagem.
export const creativeView = z.object({
  id: z.number(),
  title: z.string(),
  account: z.string(),
  format: z.string(),
  owner: z.string(),
  stage,
  hasImage: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
