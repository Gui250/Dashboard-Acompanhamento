// Cliente mínimo do WeSales (white-label do GoHighLevel, API LeadConnector). Token de integração privada (pit-...) da subconta.
const API = 'https://services.leadconnectorhq.com'

export class WesalesError extends Error {}

export type Conn = { token: string; locationId: string }

async function ghl<T>(token: string, pathOrUrl: string): Promise<T> {
  const res = await fetch(pathOrUrl.startsWith('http') ? pathOrUrl : API + pathOrUrl, {
    headers: { authorization: `Bearer ${token}`, version: '2021-07-28', accept: 'application/json' },
  })
  const body = (await res.json().catch(() => ({}))) as T & { message?: string | string[] }
  if (!res.ok) throw new WesalesError([body.message].flat().join(' ') || `WeSales respondeu ${res.status}`)
  return body
}

export const getLocation = async ({ token, locationId }: Conn) =>
  (await ghl<{ location: { id: string; name: string } }>(token, `/locations/${locationId}`)).location

export type Pipeline = { id: string; name: string; stages: { id: string; name: string }[] }
export type User = { id: string; name: string }
export type Opportunity = {
  id: string
  pipelineId: string
  pipelineStageId: string
  status: 'open' | 'won' | 'lost' | 'abandoned'
  monetaryValue?: number | null
  assignedTo?: string | null
  createdAt: string
  lastStatusChangeAt?: string | null
}

export const listPipelines = async ({ token, locationId }: Conn) =>
  (await ghl<{ pipelines: Pipeline[] }>(token, `/opportunities/pipelines?locationId=${locationId}`)).pipelines

export const listUsers = async ({ token, locationId }: Conn) =>
  (await ghl<{ users: User[] }>(token, `/users/?locationId=${locationId}`)).users

// ponytail: baixa todas as oportunidades (100 por página) e filtra aqui; filtrar por data na API se passar de alguns milhares.
export async function listOpportunities({ token, locationId }: Conn) {
  const out: Opportunity[] = []
  let next: string | undefined = `/opportunities/search?location_id=${locationId}&limit=100`
  while (next) {
    const page: { opportunities: Opportunity[]; meta: { nextPageUrl?: string | null } } = await ghl(token, next)
    out.push(...page.opportunities)
    next = page.opportunities.length ? (page.meta.nextPageUrl ?? undefined) : undefined
  }
  return out
}

// ponytail: dia em UTC (o fuso da conta está errado no WeSales); usar o fuso da conta se ele for corrigido.
const inRange = (iso: string | null | undefined, from: string, to: string) => !!iso && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to

// Leads = oportunidades criadas no período; vendas = ganhas no período (status won, pela data da mudança de status).
// Etapas e "em aberto" = foto atual das oportunidades criadas no período.
export function summarize(opps: Opportunity[], pipelines: Pipeline[], users: User[], from: string, to: string) {
  const value = (o: Opportunity) => o.monetaryValue ?? 0
  const created = opps.filter((o) => inRange(o.createdAt, from, to))
  const won = opps.filter((o) => o.status === 'won' && inRange(o.lastStatusChangeAt ?? o.createdAt, from, to))
  const open = created.filter((o) => o.status === 'open')
  const sum = (list: Opportunity[]) => list.reduce((s, o) => s + value(o), 0)

  const names = new Map(users.map((u) => [u.id, u.name]))
  const owners = new Map<string, { name: string; leads: number; won: number; wonValue: number }>()
  const owner = (o: Opportunity) => {
    const name = (o.assignedTo && names.get(o.assignedTo)) || 'Sem responsável'
    if (!owners.has(name)) owners.set(name, { name, leads: 0, won: 0, wonValue: 0 })
    return owners.get(name)!
  }
  created.forEach((o) => owner(o).leads++)
  won.forEach((o) => {
    const row = owner(o)
    row.won++
    row.wonValue += value(o)
  })

  return {
    totals: {
      leads: created.length,
      open: open.length,
      won: won.length,
      lost: created.filter((o) => o.status === 'lost').length,
      wonValue: sum(won),
      openValue: sum(open),
      conversion: created.length ? (won.length / created.length) * 100 : 0,
    },
    pipelines: pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      stages: p.stages.map((s) => {
        const here = created.filter((o) => o.pipelineStageId === s.id)
        return { id: s.id, name: s.name, count: here.length, value: sum(here) }
      }),
    })),
    owners: [...owners.values()].sort((a, b) => b.wonValue - a.wonValue || b.leads - a.leads),
  }
}
