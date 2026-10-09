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

type CampaignRow = InsightRow & { campaign_id: string; campaign_name: string }

// Desempenho por campanha de uma conta (act_123 ou 123).
export async function campaignInsights(token: string, accountId: string, since: string, until: string) {
  const range = encodeURIComponent(JSON.stringify({ since, until }))
  const act = `act_${accountId.replace(/^act_/, '')}`
  const rows = await graphAll<CampaignRow>(
    token,
    `/${act}/insights?level=campaign&fields=campaign_id,campaign_name,spend,impressions,clicks,reach,actions&time_range=${range}&limit=500`,
  )
  return rows.map((r) => ({ id: r.campaign_id, name: r.campaign_name, ...toMetrics(r) })).sort((a, b) => b.spend - a.spend)
}

type AdInsightRow = InsightRow & { ad_id: string; ad_name: string; campaign_name?: string; adset_name?: string }

// Uma página dos anúncios que mais gastaram na conta. O ranking final (leads, CTR…) é feito em cima desse recorte.
export async function adInsights(token: string, accountId: string, since: string, until: string, limit = 40) {
  const range = encodeURIComponent(JSON.stringify({ since, until }))
  const act = `act_${accountId.replace(/^act_/, '')}`
  const page = await graph<Paged<AdInsightRow>>(
    token,
    `/${act}/insights?level=ad&fields=ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks,reach,actions&time_range=${range}&sort=spend_descending&limit=${limit}`,
  )
  return page.data
    .map((r) => ({
      id: r.ad_id,
      name: r.ad_name,
      campaign: r.campaign_name ?? null,
      adset: r.adset_name ?? null,
      ...toMetrics(r),
    }))
    .filter((ad) => ad.spend > 0 || ad.impressions > 0)
}

type CreativeFields = { id?: string; title?: string; body?: string; image_url?: string; thumbnail_url?: string; object_type?: string }

// thumbnail_url vem 64x64 por padrão (pixelado nos cards); pedir 1080 deixa vídeo/carrossel nítidos.
const CREATIVE = 'creative.thumbnail_width(1080).thumbnail_height(1080){id,title,body,image_url,thumbnail_url,object_type}'

// Criativo (título, texto, imagem) dos anúncios já ranqueados, um pedido por anúncio em lotes de 10.
// Não usar /?ids=a,b,c: a Graph derruba o lote inteiro se um único id falhar, e aí nenhum card tinha imagem.
export async function adCreatives(token: string, ids: string[]) {
  const out = new Map<string, { creativeId: string | null; title: string | null; body: string | null; imageUrl: string | null; type: string | null }>()
  const fields = CREATIVE
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10)
    const rows = await Promise.all(
      batch.map((id) => graph<{ creative?: CreativeFields }>(token, `/${id}?fields=${fields}`).catch((): { creative?: CreativeFields } => ({}))),
    )
    for (const [j, id] of batch.entries()) {
      const c = rows[j].creative
      out.set(id, {
        creativeId: c?.id ?? null,
        title: c?.title ?? null,
        body: c?.body ?? null,
        imageUrl: c?.image_url ?? c?.thumbnail_url ?? null,
        type: c?.object_type ?? null,
      })
    }
  }
  return out
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

type AdRow = {
  id: string
  name: string
  effective_status: string
  campaign?: { name: string }
  adset?: { name: string }
  creative?: { id: string; title?: string; body?: string; image_url?: string; thumbnail_url?: string; object_type?: string }
}

// Anúncio + criativo no formato da API; image_url é a imagem cheia, thumbnail_url (vídeo, carrossel) é pequena.
export function toAd(r: AdRow) {
  const c = r.creative
  return {
    id: r.id,
    name: r.name,
    status: r.effective_status,
    campaign: r.campaign?.name ?? null,
    adset: r.adset?.name ?? null,
    creativeId: c?.id ?? null,
    title: c?.title ?? null,
    body: c?.body ?? null,
    imageUrl: c?.image_url ?? c?.thumbnail_url ?? null,
    type: c?.object_type ?? null,
  }
}

// Anúncios veiculando agora (effective_status ACTIVE) de uma conta, com o criativo de cada um.
export async function activeAds(token: string, accountId: string) {
  const act = `act_${accountId.replace(/^act_/, '')}`
  const fields = `id,name,effective_status,campaign{name},adset{name},${CREATIVE}`
  const status = encodeURIComponent('["ACTIVE"]')
  const rows = await graphAll<AdRow>(token, `/${act}/ads?fields=${fields}&effective_status=${status}&limit=200`)
  return rows.map(toAd)
}
