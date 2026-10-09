import { createHmac, timingSafeEqual } from 'node:crypto'
import { GoogleAuth, OAuth2Client, type JWTInput } from 'google-auth-library'
import { withRatios } from './meta.js'

// Autenticação pela lib oficial do Google (google-auth-library); a Google Ads API em si é REST via fetch.
// v25 = major de julho/2026; cada major vive ~1 ano (developers.google.com/google-ads/api/docs/sunset-dates).
const ADS = 'https://googleads.googleapis.com/v25'
const SCOPE = 'https://www.googleapis.com/auth/adwords'

export class GoogleError extends Error {}

const oauthEnv = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
})

// Sem as 3 variáveis o botão "Conectar com o Google" (OAuth) não aparece; credenciais diretas seguem valendo.
export const oauthEnabled = () => Object.values(oauthEnv()).every(Boolean)

const oauthClient = () => new OAuth2Client(oauthEnv())

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
export const authUrl = () =>
  oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [SCOPE, 'openid', 'email'], state: makeState() })

export async function exchangeCode(code: string) {
  const client = oauthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) throw new GoogleError('O Google não devolveu refresh token; conecte de novo.')
  const ticket = tokens.id_token ? await client.verifyIdToken({ idToken: tokens.id_token, audience: oauthEnv().clientId }) : null
  return { refreshToken: tokens.refresh_token, email: ticket?.getPayload()?.email ?? null }
}

// --- De onde vem o acesso ---
// Ordem: JSON colado no painel > login OAuth > credenciais padrão do servidor (ADC: GOOGLE_APPLICATION_CREDENTIALS,
// `gcloud auth application-default login` ou a conta de serviço da máquina no GCP).
export type GoogleSource = 'credenciais' | 'oauth' | 'direto'

export function googleAuth(credentials: JWTInput | null, refreshToken: string | null): { source: GoogleSource; auth: GoogleAuth } {
  if (credentials) return { source: 'credenciais', auth: new GoogleAuth({ scopes: SCOPE, credentials }) }
  if (refreshToken) {
    const { clientId, clientSecret } = oauthEnv()
    const user = { type: 'authorized_user', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }
    return { source: 'oauth', auth: new GoogleAuth({ scopes: SCOPE, credentials: user }) }
  }
  return { source: 'direto', auth: new GoogleAuth({ scopes: SCOPE }) }
}

// ponytail: GoogleAuth novo por consulta = token novo a cada vez; reaproveitar a instância (cache de 1h da lib) se pesar.
export async function accessToken(auth: GoogleAuth) {
  const token = await auth.getAccessToken().catch((e: Error) => {
    throw new GoogleError(`Não foi possível autenticar no Google: ${e.message}`)
  })
  if (!token) throw new GoogleError('O Google não devolveu access token.')
  return token
}

// ADC disponível? Devolve o e-mail da conta de serviço (null para login de usuário via gcloud); undefined = sem ADC.
export const directIdentity = (auth: GoogleAuth) =>
  accessToken(auth).then(
    () => auth.getCredentials().then((c) => c.client_email ?? null, () => null),
    () => undefined,
  )

// --- Google Ads ---
type AdsError = { error?: { message?: string; details?: { errors?: { message?: string }[] }[] } }

export type AdsAuth = { token: string; developerToken: string }

async function ads<T>({ token, developerToken }: AdsAuth, path: string, opts: { loginCustomerId?: string; query?: string } = {}): Promise<T> {
  const res = await fetch(ADS + path, {
    method: opts.query ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'developer-token': developerToken,
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
async function search<T>(a: AdsAuth, customerId: string, loginCustomerId: string, query: string) {
  const batches = await ads<{ results?: T[] }[]>(a, `/customers/${customerId}/googleAds:searchStream`, { loginCustomerId, query })
  return batches.flatMap((b) => b.results ?? [])
}

export type AdsAccount = { id: string; loginCustomerId: string; name: string; status: string; currency: string }
type CustomerClientRow = { customerClient: { id: string; descriptiveName?: string; currencyCode: string; status: string } }

// Contas de anúncio (não-MCC) que o usuário alcança: as de acesso direto e as filhas de cada MCC.
// customer_client inclui a própria conta (nível 0), então conta avulsa também aparece.
// Também valida token + developer token antes de salvar credenciais.
export const accessibleCustomers = (a: AdsAuth) => ads<{ resourceNames?: string[] }>(a, '/customers:listAccessibleCustomers')

export async function listAccounts(a: AdsAuth): Promise<AdsAccount[]> {
  const { resourceNames = [] } = await accessibleCustomers(a)
  const roots = resourceNames.map((r) => r.split('/')[1])
  const query =
    'SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.status ' +
    'FROM customer_client WHERE customer_client.manager = false'
  const settled = await Promise.allSettled(roots.map((root) => search<CustomerClientRow>(a, root, root, query)))
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

const toMetrics = (m?: AdsMetricsRow) =>
  withRatios({
    spend: Number(m?.costMicros ?? 0) / 1_000_000,
    impressions: Number(m?.impressions ?? 0),
    clicks: Number(m?.clicks ?? 0),
    conversions: m?.conversions ?? 0,
    conversionsValue: m?.conversionsValue ?? 0,
  })

export function toAccount(a: AdsAccount, m?: AdsMetricsRow) {
  const status: 'ativa' | 'desativada' | 'outro' =
    a.status === 'ENABLED' ? 'ativa' : ['CANCELED', 'SUSPENDED', 'CLOSED'].includes(a.status) ? 'desativada' : 'outro'
  return { id: a.id, name: a.name, status, currency: a.currency, ...toMetrics(m) }
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

const METRICS = 'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value'
const CAMPAIGN_STATUS = { ENABLED: 'ativa', PAUSED: 'pausada', REMOVED: 'removida' } as const

type CampaignResult = { campaign: { id: string; name: string; status: string }; metrics?: AdsMetricsRow }

// Desempenho por campanha de uma conta; sem segmentar por data, o Google já devolve uma linha por campanha.
export async function campaignInsights(auth: AdsAuth, account: AdsAccount, from: string, to: string) {
  const query = `SELECT campaign.id, campaign.name, campaign.status, ${METRICS} FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`
  const rows = await search<CampaignResult>(auth, account.id, account.loginCustomerId, query)
  return rows
    .map(({ campaign: c, metrics }) => ({
      id: c.id,
      name: c.name,
      status: CAMPAIGN_STATUS[c.status as keyof typeof CAMPAIGN_STATUS] ?? ('outro' as const),
      ...toMetrics(metrics),
    }))
    .sort((a, b) => b.spend - a.spend)
}

// Métricas por conta em lotes de 10 chamadas paralelas. from/to já validados como YYYY-MM-DD.
export async function accountInsights(auth: AdsAuth, accounts: AdsAccount[], from: string, to: string) {
  const query = `SELECT ${METRICS} FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'`
  const out: Account[] = []
  for (let i = 0; i < accounts.length; i += 10) {
    const batch = accounts.slice(i, i + 10)
    const rows = await Promise.all(
      // ponytail: conta que recusa a consulta (cancelada, sem permissão) aparece zerada; expor o erro por conta se confundir.
      batch.map((a) => search<MetricsResult>(auth, a.id, a.loginCustomerId, query).catch((): MetricsResult[] => [])),
    )
    batch.forEach((a, j) => out.push(toAccount(a, rows[j][0]?.metrics)))
  }
  return out.sort((a, b) => b.spend - a.spend)
}
