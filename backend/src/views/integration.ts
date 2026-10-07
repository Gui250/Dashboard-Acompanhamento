import { z } from 'zod'

const apiKey = z.string().trim().startsWith('sk-')

export const openAIConfigBody = z.object({ apiKey: apiKey.optional(), model: z.string().trim().min(1) })

// Chave opcional: testa uma chave nova antes de salvar; sem ela, usa a salva.
export const openAIModelsBody = z.object({ apiKey: apiKey.optional() })

// Nunca devolve a chave, só o final dela.
export const openAIConfigView = z.object({
  configured: z.boolean(),
  keyHint: z.string().nullable(),
  model: z.string().nullable(),
})

export const openAIModelsView = z.array(z.string())

// Token da Meta nunca volta ao cliente.
export const metaConfigBody = z.object({
  accessToken: z.string().trim().min(1).optional(),
  businessId: z.string().trim().regex(/^\d+$/),
})

export const metaConfigView = z.object({
  configured: z.boolean(),
  businessId: z.string().nullable(),
  businessName: z.string().nullable(),
})

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const metaAccountsQuery = z.object({ from: date.optional(), to: date.optional() })

const metrics = {
  spend: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  reach: z.number(),
  leads: z.number(),
  purchases: z.number(),
  ctr: z.number(),
  cpc: z.number(),
  cpm: z.number(),
}

export const metaAccountsView = z.object({
  business: z.object({ id: z.string(), name: z.string() }),
  from: z.string(),
  to: z.string(),
  totals: z.object(metrics),
  accounts: z.array(
    z.object({
      id: z.string(),
      accountId: z.string(),
      name: z.string(),
      status: z.enum(['ativa', 'desativada', 'outro']),
      currency: z.string(),
      ...metrics,
    }),
  ),
})
