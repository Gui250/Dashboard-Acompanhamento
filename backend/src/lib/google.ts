import { createHmac, timingSafeEqual } from 'node:crypto'
import { withRatios } from './meta.js'

// Cliente mínimo da Google Ads API (REST) + OAuth do Google, só com fetch. Token sempre no header.
// v25 = major de julho/2026; cada major vive ~1 ano (developers.google.com/google-ads/api/docs/sunset-dates).
const ADS = 'https://googleads.googleapis.com/v25'
const SCOPES = 'https://www.googleapis.com/auth/adwords openid email'

export class GoogleError extends Error {}

const env = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
})

// Sem as 4 variáveis o servidor não oferece a integração.
export const googleEnabled = () => Object.values(env()).every(Boolean)

// --- OAuth ---
// state = "expira.assinatura": só quem pediu a URL logado no app consegue um state válido (10 min).
const sign = (exp: string) => createHmac('sha256', process.env.JWT_SECRET!).update(`google-oauth:${exp}`).digest('base64url')

export function makeState(now = Date.now()) {
  const exp = String(now + 10 * 60_000)
  return `${exp}.${sign(exp)}`
}

export function validState(state: string, now = Date.now()) {
  const [exp = '', sig = ''] = state.split('.')
  const [given, expected] = [Buffer.from(sig), Buffer.from(sign(exp))]
  return given.length === expected.length && timingSafeEqual(given, expected) && Number(exp) > now
}

// prompt=consent garante refresh_token mesmo em reconexões.
export function authUrl() {
  const { clientId, redirectUri } = env()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: makeState(),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

type TokenResponse = { access_token?: string; refresh_token?: string; id_token?: string; error?: string; error_description?: string }

async function oauthToken(params: Record<string, string>) {
  const { clientId, clientSecret } = env()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  })
  const body = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || !body.access_token) throw new GoogleError(body.error_description ?? body.error ?? `OAuth do Google respondeu ${res.status}`)
  return body
}

export async function exchangeCode(code: string) {
  const t = await oauthToken({ grant_type: 'authorization_code', code, redirect_uri: env().redirectUri })
  if (!t.refresh_token) throw new GoogleError('O Google não devolveu refresh token; conecte de novo.')
  // id_token veio direto do Google por TLS: dá para ler o payload sem verificar a assinatura.
  const claims = t.id_token ? JSON.parse(Buffer.from(t.id_token.split('.')[1], 'base64url').toString()) : {}
  return { refreshToken: t.refresh_token, email: (claims.email as string | undefined) ?? null }
}

// ponytail: troca o refresh token a cada consulta (1 chamada extra); cachear o access token (1h) se pesar.
export const accessToken = async (refreshToken: string) =>
  (await oauthToken({ grant_type: 'refresh_token', refresh_token: refreshToken })).access_token!

// --- Google Ads ---
type AdsError = { error?: { message?: string; details?: { errors?: { message?: string }[] }[] } }

async function ads<T>(token: string, path: string, opts: { loginCustomerId?: string; query?: string } = {}): Promise<T> {
  const res = await fetch(ADS + path, {
    method: opts.query ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'developer-token': env().developerToken,
      ...(opts.loginCustomerId && { 'login-customer-id': opts.loginCustomerId }),
      ...(opts.query && { 'content-type': 'application/json' }),
    },
    body: opts.query ? JSON.stringify({ query: opts.query }) : undefined,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // searchStream devolve o erro dentro de um array.
    const err = ((Array.isArray(body) ? body[0] : body) as AdsError)?.error
    throw new GoogleError(err?.details?.[0]?.errors?.[0]?.message ?? err?.message ?? `Google Ads respondeu ${res.status}`)
  }
  return body as T
}

// searchStream: uma chamada só, sem paginação; a resposta vem em lotes.
async function search<T>(token: string, customerId: string, loginCustomerId: string, query: string) {
  const batches = await ads<{ results?: T[] }[]>(token, `/customers/${customerId}/googleAds:searchStream`, { loginCustomerId, query })
  return batches.flatMap((b) => b.results ?? [])
}

export type AdsAccount = { id: string; loginCustomerId: string; name: string; status: string; currency: string }
type CustomerClientRow = { customerClient: { id: string; descriptiveName?: string; currencyCode: string; status: string } }

// Contas de anúncio (não-MCC) que o usuário alcança: as de acesso direto e as filhas de cada MCC.
// customer_client inclui a própria conta (nível 0), então conta avulsa também aparece.
export async function listAccounts(token: string): Promise<AdsAccount[]> {
  const { resourceNames = [] } = await ads<{ resourceNames?: string[] }>(token, '/customers:listAccessibleCustomers')
  const roots = resourceNames.map((r) => r.split('/')[1])
  const query =
    'SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.status ' +
    'FROM customer_client WHERE customer_client.manager = false'
  const settled = await Promise.allSettled(roots.map((root) => search<CustomerClientRow>(token, root, root, query)))
  const accounts = settled.flatMap((s, i) =>
    s.status === 'fulfilled'
      ? s.value.map(({ customerClient: c }) => ({
          id: c.id,
          loginCustomerId: roots[i],
          name: c.descriptiveName || c.id,
          status: c.status,
          currency: c.currencyCode,
        }))
      : [],
  )
  // Raiz sem acesso (conta cancelada etc.) é pulada; se todas falharem, mostra o erro (ex.: developer token só de teste).
  const failed = settled.find((s) => s.status === 'rejected')
  if (!accounts.length && failed) throw failed.reason
  return [...new Map(accounts.map((a) => [a.id, a])).values()]
}

export type AdsMetricsRow = {
  costMicros?: string
  impressions?: string
  clicks?: string
  conversions?: number
  conversionsValue?: number
}

export function toAccount(a: AdsAccount, m?: AdsMetricsRow) {
  const status: 'ativa' | 'desativada' | 'outro' =
    a.status === 'ENABLED' ? 'ativa' : ['CANCELED', 'SUSPENDED', 'CLOSED'].includes(a.status) ? 'desativada' : 'outro'
  return {
    id: a.id,
    name: a.name,
    status,
    currency: a.currency,
    ...withRatios({
      spend: Number(m?.costMicros ?? 0) / 1_000_000,
      impressions: Number(m?.impressions ?? 0),
      clicks: Number(m?.clicks ?? 0),
      conversions: m?.conversions ?? 0,
      conversionsValue: m?.conversionsValue ?? 0,
    }),
  }
}

type Account = ReturnType<typeof toAccount>

// ponytail: soma moedas diferentes sem converter, igual ao Meta.
export function toTotals(accounts: Account[]) {
  const sum = (k: 'spend' | 'impressions' | 'clicks' | 'conversions' | 'conversionsValue') => accounts.reduce((s, a) => s + a[k], 0)
  return withRatios({
    spend: sum('spend'),
    impressions: sum('impressions'),
    clicks: sum('clicks'),
    conversions: sum('conversions'),
    conversionsValue: sum('conversionsValue'),
  })
}

type MetricsResult = { metrics?: AdsMetricsRow }

// Métricas por conta em lotes de 10 chamadas paralelas. from/to já validados como YYYY-MM-DD.
export async function accountInsights(token: string, accounts: AdsAccount[], from: string, to: string) {
  const query =
    'SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value ' +
    `FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'`
  const out: Account[] = []
  for (let i = 0; i < accounts.length; i += 10) {
    const batch = accounts.slice(i, i + 10)
    const rows = await Promise.all(
      // ponytail: conta que recusa a consulta (cancelada, sem permissão) aparece zerada; expor o erro por conta se confundir.
      batch.map((a) => search<MetricsResult>(token, a.id, a.loginCustomerId, query).catch((): MetricsResult[] => [])),
    )
    batch.forEach((a, j) => out.push(toAccount(a, rows[j][0]?.metrics)))
  }
  return out.sort((a, b) => b.spend - a.spend)
}
