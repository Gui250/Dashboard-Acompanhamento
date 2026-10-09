// Cliente mínimo da Graph API (Marketing API). Token sempre no header, nunca na URL.
// v26.0 lançada em 29/07/2026 (developers.facebook.com/docs/graph-api/changelog/versions).
const GRAPH = 'https://graph.facebook.com/v26.0'

export class MetaError extends Error {}

type Paged<T> = { data: T[]; paging?: { next?: string } }

async function graph<T>(token: string, pathOrUrl: string): Promise<T> {
  const res = await fetch(pathOrUrl.startsWith('http') ? pathOrUrl : GRAPH + pathOrUrl, {
    headers: { authorization: `Bearer ${token}` },
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) throw new MetaError(body.error?.message ?? `Graph API respondeu ${res.status}`)
  return body
}

// Segue paging.next até acabar.
async function graphAll<T>(token: string, path: string): Promise<T[]> {
  const out: T[] = []
  let next: string | undefined = path
  while (next) {
    const page: Paged<T> = await graph(token, next)
    out.push(...page.data)
    next = page.paging?.next
  }
  return out
}

export const getBusiness = (token: string, businessId: string) =>
  graph<{ id: string; name: string }>(token, `/${businessId}?fields=id,name`)

export type AdAccount = { id: string; account_id: string; name: string; account_status: number; currency: string }

export async function listBusinessAdAccounts(token: string, businessId: string) {
  const fields = 'id,account_id,name,account_status,currency&limit=100'
  const [owned, client] = await Promise.all([
    graphAll<AdAccount>(token, `/${businessId}/owned_ad_accounts?fields=${fields}`),
    graphAll<AdAccount>(token, `/${businessId}/client_ad_accounts?fields=${fields}`),
  ])
  return [...new Map([...owned, ...client].map((a) => [a.id, a])).values()]
}

type Action = { action_type: string; value: string }
export type InsightRow = Partial<Record<'spend' | 'impressions' | 'clicks' | 'reach', string>> & { actions?: Action[] }

export type Metrics = {
  spend: number
  impressions: number
  clicks: number
  reach: number
  leads: number
  purchases: number
  ctr: number
  cpc: number
  cpm: number
}

const sumAction = (actions: Action[] = [], type: string) =>
  actions.filter((a) => a.action_type === type).reduce((s, a) => s + Number(a.value), 0)

// ctr em %, cpc/cpm na moeda da conta; divisão por zero = 0. Também usado pelo Google Ads.
export function withRatios<T extends { spend: number; impressions: number; clicks: number }>(m: T) {
  return {
    ...m,
    ctr: m.impressions ? (m.clicks / m.impressions) * 100 : 0,
    cpc: m.clicks ? m.spend / m.clicks : 0,
    cpm: m.impressions ? (m.spend / m.impressions) * 1000 : 0,
  }
}

// Linha de insights (ou undefined = sem dados) -> métricas numéricas.
// leads = action_type 'lead' (total on+off site; 'onsite_conversion.lead_grouped' é só um subconjunto).
// purchases = 'purchase' (agregado; 'offsite_conversion.fb_pixel_purchase' é só do pixel).
export function toMetrics(row?: InsightRow): Metrics {
  return withRatios({
    spend: Number(row?.spend ?? 0),
    impressions: Number(row?.impressions ?? 0),
    clicks: Number(row?.clicks ?? 0),
    reach: Number(row?.reach ?? 0),
    leads: sumAction(row?.actions, 'lead'),
    purchases: sumAction(row?.actions, 'purchase'),
  })
}

export function toAccount(a: AdAccount, row?: InsightRow) {
  const status: 'ativa' | 'desativada' | 'outro' = a.account_status === 1 ? 'ativa' : a.account_status === 2 ? 'desativada' : 'outro'
  return { id: a.id, accountId: a.account_id, name: a.name, status, currency: a.currency, ...toMetrics(row) }
}

// ponytail: soma contas de moedas diferentes sem converter; converter se a BM misturar moedas.
// reach somado é aproximado (a mesma pessoa pode ser alcançada por mais de uma conta).
export function toTotals(accounts: Metrics[]): Metrics {
  const sum = (k: 'spend' | 'impressions' | 'clicks' | 'reach' | 'leads' | 'purchases') =>
    accounts.reduce((s, a) => s + a[k], 0)
  return withRatios({
    spend: sum('spend'),
    impressions: sum('impressions'),
    clicks: sum('clicks'),
    reach: sum('reach'),
    leads: sum('leads'),
    purchases: sum('purchases'),
  })
}

// Insights por conta em lotes de 10 chamadas paralelas.
export async function accountInsights(token: string, accounts: AdAccount[], since: string, until: string) {
  const fields = 'spend,impressions,clicks,ctr,cpc,cpm,reach,actions'
  const range = encodeURIComponent(JSON.stringify({ since, until }))
  const out: ReturnType<typeof toAccount>[] = []
  for (let i = 0; i < accounts.length; i += 10) {
    const batch = accounts.slice(i, i + 10)
    const rows = await Promise.all(
      // ponytail: conta sem permissão para o token (comum em client_ad_accounts) aparece zerada em vez de derrubar a página; expor o erro por conta se confundir.
      batch.map((a) =>
        graph<Paged<InsightRow>>(token, `/${a.id}/insights?fields=${fields}&time_range=${range}`).catch((): Paged<InsightRow> => ({ data: [] })),
      ),
    )
    batch.forEach((a, j) => out.push(toAccount(a, rows[j].data[0])))
  }
  return out.sort((a, b) => b.spend - a.spend)
}
