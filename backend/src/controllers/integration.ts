import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { JWTInput } from 'google-auth-library'
import {
  clearGoogleConnection,
  getGoogleConfig,
  getMetaConfig,
  getOpenAIConfig,
  saveGoogleConfig,
  saveGoogleCredentials,
  saveMetaConfig,
  saveOpenAIConfig,
} from '../models/setting.js'
import { accountInsights, activeAds, campaignInsights, getBusiness, listBusinessAdAccounts, MetaError, toTotals } from '../lib/meta.js'
import * as google from '../lib/google.js'
import { hiddenAdIds, setAdHidden } from '../models/hidden-ad.js'
import type {
  dateRangeQuery,
  googleCallbackQuery,
  googleCampaignsQuery,
  googleCredentialsBody,
  metaAdHiddenBody,
  metaAdParams,
  metaAdsQuery,
  metaCampaignsQuery,
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
  // Lista as contas, não só a BM: ler a BM passa sem business_management, listar as contas não.
  try {
    await listBusinessAdAccounts(token, businessId)
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

export async function metaCampaigns(req: FastifyRequest<{ Querystring: z.infer<typeof metaCampaignsQuery> }>, reply: FastifyReply) {
  const config = await getMetaConfig()
  if (!config) return reply.status(409).send({ message: 'Configure a Meta em Integrações.' })
  const { from, to } = range(req.query)
  try {
    return { accountId: req.query.accountId, from, to, campaigns: await campaignInsights(config.accessToken, req.query.accountId, from, to) }
  } catch (e) {
    return reply.status(502).send({ message: e instanceof MetaError ? e.message : 'Falha ao consultar a Meta.' })
  }
}

export async function metaAds(req: FastifyRequest<{ Querystring: z.infer<typeof metaAdsQuery> }>, reply: FastifyReply) {
  const config = await getMetaConfig()
  if (!config) return reply.status(409).send({ message: 'Configure a Meta em Integrações.' })
  try {
    const ads = await activeAds(config.accessToken, req.query.accountId)
    const hidden = await hiddenAdIds(ads.map((a) => a.id))
    return { accountId: req.query.accountId, ads: ads.map((a) => ({ ...a, hidden: hidden.has(a.id) })) }
  } catch (e) {
    return reply.status(502).send({ message: e instanceof MetaError ? e.message : 'Falha ao consultar a Meta.' })
  }
}

// Só esconde/mostra no dashboard; não muda nada na Meta.
export async function hideMetaAd(req: FastifyRequest<{ Params: z.infer<typeof metaAdParams>; Body: z.infer<typeof metaAdHiddenBody> }>) {
  await setAdHidden(req.params.id, req.body.hidden)
  return { id: req.params.id, hidden: req.body.hidden }
}

// --- Google Ads: credenciais padrão do servidor (ADC), JSON colado no painel ou login OAuth ---
// Developer token salvo no painel vale mais que o do env.
async function googleConn() {
  const s = await getGoogleConfig()
  const credentials = s.credentials ? (JSON.parse(s.credentials) as JWTInput) : null
  return {
    ...google.googleAuth(credentials, s.refreshToken),
    email: credentials ? (credentials.client_email ?? null) : s.email,
    developerToken: s.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || null,
  }
}

export async function showGoogle() {
  const c = await googleConn()
  // Nada salvo: só conta como conectado se o servidor achar credenciais padrão.
  const direct = c.source === 'direto' ? await google.directIdentity(c.auth) : null
  const connected = c.source !== 'direto' || direct !== undefined
  return {
    oauth: google.oauthEnabled(),
    developerToken: !!c.developerToken,
    source: connected ? c.source : null,
    email: direct ?? c.email,
  }
}

const noDevToken = { message: 'Informe o developer token do Google Ads em Integrações.' }

// Testa (autentica + lista as contas acessíveis) antes de salvar.
export async function saveGoogle(req: FastifyRequest<{ Body: z.infer<typeof googleCredentialsBody> }>, reply: FastifyReply) {
  const { credentials, developerToken } = req.body
  let parsed: JWTInput | null = null
  if (credentials) {
    try {
      parsed = JSON.parse(credentials)
    } catch {}
    if (typeof parsed?.type !== 'string') return reply.status(400).send({ message: 'Cole o JSON de credenciais do Google (ex.: chave da conta de serviço).' })
  }
  const s = await getGoogleConfig()
  const devToken = developerToken ?? s.developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!devToken) return reply.status(409).send(noDevToken)
  const { auth } = parsed ? google.googleAuth(parsed, null) : await googleConn()
  try {
    await google.accessibleCustomers({ token: await google.accessToken(auth), developerToken: devToken })
  } catch (e) {
    return reply.status(400).send({ message: e instanceof google.GoogleError ? e.message : 'Credenciais do Google inválidas.' })
  }
  await saveGoogleCredentials({ credentials, developerToken })
  return showGoogle()
}

export async function disconnectGoogle() {
  await clearGoogleConnection()
  return showGoogle()
}

// O front busca a URL (com o Bearer) e manda o navegador para ela.
export async function googleAuthUrl(_req: FastifyRequest, reply: FastifyReply) {
  if (!google.oauthEnabled()) return reply.status(409).send({ message: 'Login com o Google não está habilitado no servidor (faltam GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI).' })
  return { url: google.authUrl() }
}

// Primeira origem do CORS = endereço do front.
export const webUrl = () => (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0]

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
  const c = await googleConn()
  if (!c.developerToken) return reply.status(409).send(noDevToken)
  const { from, to } = range(req.query)
  try {
    const auth = { token: await google.accessToken(c.auth), developerToken: c.developerToken }
    const accounts = await google.accountInsights(auth, await google.listAccounts(auth), from, to)
    return { email: c.email, from, to, totals: google.toTotals(accounts), accounts }
  } catch (e) {
    return reply.status(502).send({ message: e instanceof google.GoogleError ? e.message : 'Falha ao consultar o Google Ads.' })
  }
}

export async function googleCampaigns(req: FastifyRequest<{ Querystring: z.infer<typeof googleCampaignsQuery> }>, reply: FastifyReply) {
  const c = await googleConn()
  if (!c.developerToken) return reply.status(409).send(noDevToken)
  const { from, to } = range(req.query)
  try {
    const auth = { token: await google.accessToken(c.auth), developerToken: c.developerToken }
    // A lista dá o login-customer-id (MCC) que a consulta da conta exige.
    const account = (await google.listAccounts(auth)).find((a) => a.id === req.query.accountId)
    if (!account) return reply.status(404).send({ message: 'Conta do Google Ads não encontrada para este acesso.' })
    return { accountId: account.id, from, to, campaigns: await google.campaignInsights(auth, account, from, to) }
  } catch (e) {
    return reply.status(502).send({ message: e instanceof google.GoogleError ? e.message : 'Falha ao consultar o Google Ads.' })
  }
}

// Só usuários logados chegam aqui; a mesma pessoa já poderia usar o próprio JWT no MCP.
export async function showMcp() {
  return { apiKey: process.env.MCP_API_KEY || null }
}
