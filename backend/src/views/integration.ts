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
export const dateRangeQuery = z.object({ from: date.optional(), to: date.optional() })

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

// --- Google Ads --- refresh token, JSON de credenciais e developer token nunca voltam ao cliente.
// oauth = servidor tem GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI; source null = sem acesso ao Google.
export const googleConfigView = z.object({
  oauth: z.boolean(),
  developerToken: z.boolean(),
  source: z.enum(['credenciais', 'oauth', 'direto']).nullable(),
  email: z.string().nullable(),
})

// Campos omitidos = mantém o salvo.
export const googleCredentialsBody = z
  .object({ credentials: z.string().trim().min(1).optional(), developerToken: z.string().trim().min(1).optional() })
  .refine((b) => b.credentials || b.developerToken, 'Informe as credenciais ou o developer token.')

export const googleAuthUrlView = z.object({ url: z.string() })

// O Google manda também scope, authuser etc.; o z.object descarta.
export const googleCallbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
})

const googleMetrics = {
  spend: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  conversionsValue: z.number(),
  ctr: z.number(),
  cpc: z.number(),
  cpm: z.number(),
}

export const googleAccountsView = z.object({
  email: z.string().nullable(),
  from: z.string(),
  to: z.string(),
  totals: z.object(googleMetrics),
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.enum(['ativa', 'desativada', 'outro']),
      currency: z.string(),
      ...googleMetrics,
    }),
  ),
})

// Chave fixa do servidor MCP (env MCP_API_KEY); null = só o JWT do login entra.
export const mcpConfigView = z.object({ apiKey: z.string().nullable() })
