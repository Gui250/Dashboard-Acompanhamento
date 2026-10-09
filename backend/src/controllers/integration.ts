import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import {
  getGoogleConfig,
  getMetaConfig,
  getOpenAIConfig,
  saveGoogleConfig,
  saveMetaConfig,
  saveOpenAIConfig,
} from '../models/setting.js'
import { accountInsights, getBusiness, listBusinessAdAccounts, MetaError, toTotals } from '../lib/meta.js'
import * as google from '../lib/google.js'
import type {
  dateRangeQuery,
  googleCallbackQuery,
  metaConfigBody,
  openAIConfigBody,
  openAIModelsBody,
} from '../views/integration.js'

// Modelos de chat da conta; também serve para validar a chave.
async function fetchChatModels(apiKey: string) {
  const res = await fetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${apiKey}` } })
  if (!res.ok) return null
  const { data } = (await res.json()) as { data: { id: string }[] }
  return data
    .map((m) => m.id)
    .filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|tts|transcribe|image|search)/.test(id))
    .sort()
}

const invalidKey = { message: 'Chave OpenAI inválida ou sem acesso.' }

export async function show() {
  const config = await getOpenAIConfig()
  return {
    configured: !!config,
    keyHint: config ? `sk-...${config.apiKey.slice(-4)}` : null,
    model: config?.model ?? null,
  }
}

export async function models(req: FastifyRequest<{ Body: z.infer<typeof openAIModelsBody> }>, reply: FastifyReply) {
  const apiKey = req.body.apiKey ?? (await getOpenAIConfig())?.apiKey
  if (!apiKey) return reply.status(409).send({ message: 'Informe uma chave OpenAI.' })
  return (await fetchChatModels(apiKey)) ?? reply.status(400).send(invalidKey)
}

export async function save(req: FastifyRequest<{ Body: z.infer<typeof openAIConfigBody> }>, reply: FastifyReply) {
  const { apiKey, model } = req.body
  const key = apiKey ?? (await getOpenAIConfig())?.apiKey
  if (!key) return reply.status(409).send({ message: 'Informe uma chave OpenAI.' })
  const available = await fetchChatModels(key)
  if (!available) return reply.status(400).send(invalidKey)
  if (!available.includes(model)) return reply.status(400).send({ message: `Modelo "${model}" indisponível para esta chave.` })
  await saveOpenAIConfig({ apiKey, model })
  return show()
}

// --- Meta Ads ---
const invalidMeta = { message: 'Token ou Business ID da Meta inválido.' }

// Nome da BM vem da Graph; se ela falhar, mostra configurado sem nome.
export async function showMeta() {
  const config = await getMetaConfig()
  if (!config) return { configured: false, businessId: null, businessName: null }
  const business = await getBusiness(config.accessToken, config.businessId).catch(() => null)
  return { configured: true, businessId: config.businessId, businessName: business?.name ?? null }
}

export async function saveMeta(req: FastifyRequest<{ Body: z.infer<typeof metaConfigBody> }>, reply: FastifyReply) {
  const { accessToken, businessId } = req.body
  const token = accessToken ?? (await getMetaConfig())?.accessToken
  if (!token) return reply.status(409).send({ message: 'Informe um token da Meta.' })
  try {
    await getBusiness(token, businessId)
  } catch (e) {
    return reply.status(400).send({ message: e instanceof MetaError ? `${invalidMeta.message} ${e.message}` : invalidMeta.message })
  }
  await saveMetaConfig({ accessToken, businessId })
  return showMeta()
}

const day = (d: Date) => d.toISOString().slice(0, 10)

// Padrão: últimos 30 dias.
const range = (q: z.infer<typeof dateRangeQuery>) => ({
  from: q.from ?? day(new Date(Date.now() - 30 * 86_400_000)),
  to: q.to ?? day(new Date()),
})

export async function metaAccounts(req: FastifyRequest<{ Querystring: z.infer<typeof dateRangeQuery> }>, reply: FastifyReply) {
  const config = await getMetaConfig()
  if (!config) return reply.status(409).send({ message: 'Configure a Meta em Integrações.' })
  const { from, to } = range(req.query)
  try {
    const { accessToken: token, businessId } = config
    const [business, list] = await Promise.all([getBusiness(token, businessId), listBusinessAdAccounts(token, businessId)])
    const accounts = await accountInsights(token, list, from, to)
    return { business, from, to, totals: toTotals(accounts), accounts }
  } catch (e) {
    return reply.status(502).send({ message: e instanceof MetaError ? e.message : 'Falha ao consultar a Meta.' })
  }
}

// --- Google Ads (OAuth: o usuário faz login no Google e autoriza o app) ---
const googleOff = { message: 'Google Ads não está habilitado no servidor (faltam as variáveis GOOGLE_*).' }

export async function showGoogle() {
  const config = await getGoogleConfig()
  return { enabled: google.googleEnabled(), connected: !!config, email: config?.email ?? null }
}

// O front busca a URL (com o Bearer) e manda o navegador para ela.
export async function googleAuthUrl(_req: FastifyRequest, reply: FastifyReply) {
  if (!google.googleEnabled()) return reply.status(409).send(googleOff)
  return { url: google.authUrl() }
}

// Primeira origem do CORS = endereço do front.
const webUrl = () => (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0]

// Volta do consentimento: rota pública (o navegador chega sem Bearer); o state assinado faz o papel do login.
export async function googleCallback(req: FastifyRequest<{ Querystring: z.infer<typeof googleCallbackQuery> }>, reply: FastifyReply) {
  const back = (status: 'ok' | 'cancelado' | 'erro') => reply.redirect(`${webUrl()}/integracoes?google=${status}`)
  const { code, state, error } = req.query
  if (!state || !google.validState(state)) return back('erro')
  if (error || !code) return back('cancelado')
  try {
    await saveGoogleConfig(await google.exchangeCode(code))
  } catch (e) {
    req.log.error(e, 'falha ao trocar o code do Google')
    return back('erro')
  }
  return back('ok')
}

export async function googleAccounts(req: FastifyRequest<{ Querystring: z.infer<typeof dateRangeQuery> }>, reply: FastifyReply) {
  if (!google.googleEnabled()) return reply.status(409).send(googleOff)
  const config = await getGoogleConfig()
  if (!config) return reply.status(409).send({ message: 'Conecte o Google Ads em Integrações.' })
  const { from, to } = range(req.query)
  try {
    const token = await google.accessToken(config.refreshToken)
    const accounts = await google.accountInsights(token, await google.listAccounts(token), from, to)
    return { email: config.email, from, to, totals: google.toTotals(accounts), accounts }
  } catch (e) {
    return reply.status(502).send({ message: e instanceof google.GoogleError ? e.message : 'Falha ao consultar o Google Ads.' })
  }
}
