import { z } from 'zod'
import { STAGES } from '../models/creative.js'

const stage = z.enum(STAGES)
const field = z.string().trim().min(1)

const funnelId = z.number().int().positive()

// funnelId omitido = funil padrão.
export const createCreativeBody = z.object({
  funnelId: funnelId.optional(),
  title: field,
  account: field,
  format: field,
  owner: field,
  stage: stage.default('briefing'),
})

export const updateCreativeBody = createCreativeBody.extend({ stage }).partial()

export const creativeParams = z.object({ id: z.coerce.number().int().positive() })
export const creativesQuery = z.object({ funnelId: z.coerce.number().int().positive().optional() })

const funnelName = z.string().trim().min(1).max(80)
export const funnelBody = z.object({ name: funnelName })
// isDefault só aceita true: o padrão muda marcando outro funil, nunca fica sem nenhum.
export const funnelChanges = z.object({ name: funnelName.optional(), isDefault: z.literal(true).optional() })
export const updateFunnelBody = funnelChanges.refine((b) => b.name || b.isDefault, 'Informe o nome ou isDefault: true.')
export const funnelView = z.object({ id: z.number(), name: z.string(), isDefault: z.boolean() })
export const deleteFunnelView = z.object({ moved: z.number() })

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
