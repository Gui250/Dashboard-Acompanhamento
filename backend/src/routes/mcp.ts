import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { z } from 'zod'
import { authenticate } from './auth.js'
import { createMetricBody, metricFilters, seriesQuery } from '../views/metric.js'
import { createCreativeBody, updateCreativeBody } from '../views/creative.js'
import { dateRangeQuery } from '../views/integration.js'

// Servidor MCP (Streamable HTTP) em /mcp. Cada tool repassa para uma rota REST via inject:
// validação, regras e erros continuam num lugar só. Para expor algo novo, acrescente uma linha em TOOLS.

type Tool = {
  name: string
  description: string
  method: 'GET' | 'POST' | 'PATCH'
  url: string // ":id" é trocado pelo argumento de mesmo nome
  input: z.ZodObject
}

const TOOLS: Tool[] = [
  {
    name: 'list_metrics',
    description:
      'Lista lançamentos de métricas das planilhas (section: comercial|operacional, key, dimension, value, date YYYY-MM-DD). ' +
      'Filtros opcionais: section, key, from, to. Use sem filtros para descobrir quais keys existem.',
    method: 'GET',
    url: '/metrics',
    input: metricFilters,
  },
  {
    name: 'metric_series',
    description:
      'Soma value de uma métrica (key obrigatória) agrupando por data (groupBy=date) ou por dimensão (groupBy=dimension). ' +
      'Filtros opcionais: section, from, to. Prefira para totais, rankings e tendências.',
    method: 'GET',
    url: '/metrics/series',
    input: seriesQuery,
  },
  {
    name: 'create_metric',
    description: 'Lança uma métrica (section, key, value, date YYYY-MM-DD e dimension opcional).',
    method: 'POST',
    url: '/metrics',
    input: createMetricBody,
  },
  {
    name: 'list_creatives',
    description: 'Lista os criativos do kanban (title, account, format, owner, stage).',
    method: 'GET',
    url: '/creatives',
    input: z.object({}),
  },
  {
    name: 'create_creative',
    description: 'Cria um criativo no kanban. stage padrão: briefing.',
    method: 'POST',
    url: '/creatives',
    input: createCreativeBody,
  },
  {
    name: 'update_creative',
    description: 'Atualiza campos de um criativo pelo id (ex.: mover de etapa com stage).',
    method: 'PATCH',
    url: '/creatives/:id',
    input: updateCreativeBody.extend({ id: z.number().int().positive() }),
  },
  {
    name: 'meta_ads_accounts',
    description: 'Contas de anúncio da Meta com gasto, impressões, cliques, alcance, leads, compras, CTR, CPC e CPM no período (padrão: últimos 30 dias).',
    method: 'GET',
    url: '/meta/accounts',
    input: dateRangeQuery,
  },
  {
    name: 'google_ads_accounts',
    description: 'Contas do Google Ads com gasto, impressões, cliques, conversões, valor de conversão, CTR, CPC e CPM no período (padrão: últimos 30 dias).',
    method: 'GET',
    url: '/google/accounts',
    input: dateRangeQuery,
  },
]

// ponytail: corta listas em 200 itens para não estourar o contexto do modelo, igual ao assistente.
const MAX_ROWS = 200

function buildServer(app: FastifyInstance) {
  const server = new McpServer({ name: 'v4-dashboard', version: '1.0.0' })
  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.input, annotations: { readOnlyHint: t.method === 'GET', destructiveHint: false } },
      async (args: Record<string, unknown>) => {
        const { id, ...rest } = args
        const url = t.url.replace(':id', String(id))
        const query = new URLSearchParams(Object.entries(rest).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
        const res = await app.inject({
          method: t.method,
          url: t.method === 'GET' && query.size ? `${url}?${query}` : url,
          // Token interno de 1 min: as rotas continuam exigindo login normalmente.
          headers: { authorization: `Bearer ${app.jwt.sign({ sub: 'mcp' }, { expiresIn: '1m' })}` },
          ...(t.method !== 'GET' && { payload: rest }),
        })
        let data: unknown = res.body ? res.json() : null
        if (Array.isArray(data) && data.length > MAX_ROWS) data = { total: data.length, truncated: true, rows: data.slice(0, MAX_ROWS) }
        return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], isError: res.statusCode >= 400 }
      },
    )
  }
  return server
}

// sha256 dos dois lados: timingSafeEqual exige o mesmo tamanho.
const digest = (s: string) => createHash('sha256').update(s).digest()

// Bearer = MCP_API_KEY (não expira, para integrações) ou o JWT do login do app.
async function mcpAuth(req: FastifyRequest, reply: FastifyReply) {
  const key = process.env.MCP_API_KEY
  const given = req.headers.authorization?.replace(/^Bearer /i, '') ?? ''
  if (key && timingSafeEqual(digest(given), digest(key))) return
  return authenticate(req, reply)
}

export async function mcpRoutes(app: FastifyInstance) {
  // Stateless: um McpServer por requisição; serve a revisão 2026 e clientes da era 2025.
  const handle = toNodeHandler(createMcpHandler(() => buildServer(app)), { onerror: (e) => app.log.error(e, 'mcp') })
  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    onRequest: mcpAuth,
    handler: async (req, reply) => {
      reply.hijack() // a resposta (JSON ou SSE) é escrita pelo SDK direto no socket
      await handle(req.raw, reply.raw, req.body)
    },
  })
}
