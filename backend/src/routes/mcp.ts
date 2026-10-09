import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { z } from 'zod'
import { authenticate, requirePermission } from './auth.js'
import { apiUrl } from '../lib/urls.js'
import { createMetricBody, importContentBody, metricFilters, seriesQuery, templateTool } from '../views/metric.js'
import { createCreativeBody, creativesQuery, funnelBody, funnelChanges, updateCreativeBody } from '../views/creative.js'
import { dateRangeQuery, googleCampaignsQuery, metaAdHiddenBody, metaAdParams, metaAdsQuery, metaCampaignsQuery } from '../views/integration.js'

// Servidor MCP (Streamable HTTP) em /mcp. Cada tool repassa para uma rota REST via inject:
// validação, regras e erros continuam num lugar só. Para expor algo novo, acrescente uma linha em TOOLS.

type Tool = {
  name: string
  description: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  url: string // ":id" é trocado pelo argumento de mesmo nome
  input: z.ZodObject
  download?: true // rota pública que devolve arquivo: a resposta ganha o link para baixar
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
    name: 'import_metrics_sheet',
    description:
      'Importa uma planilha de métricas. Colunas (cabeçalho na 1ª linha): secao (comercial|operacional), metrica, dimensao (opcional), valor, data (AAAA-MM-DD ou DD/MM/AAAA). ' +
      'format=csv: content é o texto CSV (separador , ou ;). format=xlsx: content é o arquivo em base64; lê as abas Comercial e Operacional do modelo (sem coluna secao; no Comercial a dimensao se chama vendedor) ou, se não houver, a 1ª aba com essas colunas. ' +
      'Se a planilha do usuário tiver outro layout, converta para essas colunas em CSV antes. Tudo ou nada: com qualquer linha inválida nada é gravado e voltam os erros por linha.',
    method: 'POST',
    url: '/metrics/import/content',
    input: importContentBody,
  },
  {
    name: 'list_funnels',
    description: 'Lista os funis (kanbans separados) com id, nome e isDefault (o padrão vem primeiro). Todo criativo pertence a um funil.',
    method: 'GET',
    url: '/funnels',
    input: z.object({}),
  },
  {
    name: 'create_funnel',
    description: 'Cria um funil (kanban novo, com as mesmas etapas). Nome único.',
    method: 'POST',
    url: '/funnels',
    input: funnelBody,
  },
  {
    name: 'update_funnel',
    description: 'Renomeia um funil (name) e/ou o torna o padrão (isDefault: true; o anterior deixa de ser).',
    method: 'PATCH',
    url: '/funnels/:id',
    input: funnelChanges.extend({ id: z.number().int().positive() }),
  },
  {
    name: 'delete_funnel',
    description: 'Exclui um funil; os criativos dele vão para o funil padrão (nada é apagado). O padrão não pode ser excluído. Confirme com o usuário antes.',
    method: 'DELETE',
    url: '/funnels/:id',
    input: z.object({ id: z.number().int().positive() }),
  },
  {
    name: 'create_metrics_template',
    description:
      'Cria o modelo de planilha de métricas para preencher e importar (depois, com import_metrics_sheet). ' +
      'Sem keys: modelo com linhas de exemplo. Com keys (+ section): uma linha por métrica × dimensão (dimensions, opcional) com o valor em branco e a data (date, opcional) já preenchida. ' +
      'format=csv devolve o texto; xlsx devolve o arquivo formatado (abas Comercial e Operacional, com lista de métricas, e aba de instruções). Os dois vêm com o link de download.',
    method: 'GET',
    url: '/metrics/template',
    input: templateTool,
    download: true,
  },
  {
    name: 'list_creatives',
    description: 'Lista os criativos do kanban (funnelId, title, account, format, owner, stage). funnelId opcional filtra por funil.',
    method: 'GET',
    url: '/creatives',
    input: creativesQuery,
  },
  {
    name: 'create_creative',
    description:
      'Cria um criativo no kanban de um funil (funnelId de list_funnels; omitido = funil padrão). stage padrão: briefing. ' +
      'Entrar em revisao manda e-mail de aprovação para flaviasobral@v4company.com.',
    method: 'POST',
    url: '/creatives',
    input: createCreativeBody,
  },
  {
    name: 'update_creative',
    description: 'Atualiza campos de um criativo pelo id (ex.: mover de etapa com stage, trocar de funil com funnelId). Mover para revisao manda e-mail de aprovação para flaviasobral@v4company.com.',
    method: 'PATCH',
    url: '/creatives/:id',
    input: updateCreativeBody.extend({ id: z.number().int().positive() }),
  },
  {
    name: 'send_creative_for_approval',
    description:
      'Envia o criativo (id) para aprovação: manda o e-mail com a imagem e os botões Aprovar / Pedir ajustes para flaviasobral@v4company.com e move o card para revisao. ' +
      'Se o card já está em revisao, reenvia o e-mail. A decisão dela move para aprovado, ou volta para producao com o pedido em reviewNote.',
    method: 'POST',
    url: '/creatives/:id/approval',
    input: z.object({ id: z.number().int().positive() }),
  },
  {
    name: 'delete_creative',
    description: 'Apaga um criativo do kanban pelo id (inclui a imagem). Não dá para desfazer: confirme com o usuário antes.',
    method: 'DELETE',
    url: '/creatives/:id',
    input: z.object({ id: z.number().int().positive() }),
  },
  {
    name: 'meta_ads_accounts',
    description: 'Contas de anúncio da Meta com gasto, impressões, cliques, alcance, leads, compras, CTR, CPC e CPM no período (padrão: últimos 30 dias).',
    method: 'GET',
    url: '/meta/accounts',
    input: dateRangeQuery,
  },
  {
    name: 'meta_ads_campaigns',
    description:
      'Campanhas de uma conta da Meta (accountId = id de meta_ads_accounts, ex.: act_123) com gasto, impressões, cliques, alcance, leads, compras, CTR, CPC e CPM no período (padrão: últimos 30 dias).',
    method: 'GET',
    url: '/meta/campaigns',
    input: metaCampaignsQuery,
  },
  {
    name: 'meta_top_ads',
    description:
      'Criativos da Meta que mais performam no período (padrão: últimos 30 dias), em todas as contas: gasto, impressões, cliques, alcance, leads, compras, CTR, CPC, CPM, imagem, título e conta. ' +
      'A lista vem ordenada por gasto e omite anúncios ocultos no dashboard. Reordene por leads, compras ou CTR se o critério for outro.',
    method: 'GET',
    url: '/meta/top-ads',
    input: dateRangeQuery,
  },
  {
    name: 'meta_ads_creatives',
    description:
      'Anúncios veiculando agora (ACTIVE) de uma conta da Meta (accountId = id de meta_ads_accounts) com o criativo: título, texto, imagem, tipo, campanha e conjunto. ' +
      'hidden=true = escondido do dashboard.',
    method: 'GET',
    url: '/meta/ads',
    input: metaAdsQuery,
  },
  {
    name: 'hide_meta_ad',
    description:
      'Esconde (hidden=true) ou volta a mostrar (hidden=false) um anúncio da Meta no dashboard, pelo id de meta_ads_creatives. Não pausa nada na Meta: o anúncio continua veiculando.',
    method: 'PATCH',
    url: '/meta/ads/:id',
    input: metaAdParams.extend(metaAdHiddenBody.shape),
  },
  {
    name: 'google_ads_accounts',
    description: 'Contas do Google Ads com gasto, impressões, cliques, conversões, valor de conversão, CTR, CPC e CPM no período (padrão: últimos 30 dias).',
    method: 'GET',
    url: '/google/accounts',
    input: dateRangeQuery,
  },
  {
    name: 'google_ads_campaigns',
    description:
      'Campanhas de uma conta do Google Ads (accountId = id de google_ads_accounts, só dígitos) com status, gasto, impressões, cliques, conversões, valor de conversão, CTR, CPC e CPM no período (padrão: últimos 30 dias).',
    method: 'GET',
    url: '/google/campaigns',
    input: googleCampaignsQuery,
  },
]

// ponytail: corta listas em 200 itens para não estourar o contexto do modelo, igual ao assistente.
const MAX_ROWS = 200

function buildServer(app: FastifyInstance) {
  const server = new McpServer({ name: 'v4-dashboard', version: '1.0.0' })
  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.input, annotations: { readOnlyHint: t.method === 'GET', destructiveHint: t.method === 'DELETE' } },
      async (args: Record<string, unknown>) => {
        const { id, ...rest } = args
        const url = t.url.replace(':id', String(id))
        const query = new URLSearchParams(Object.entries(rest).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
        const res = await app.inject({
          method: t.method,
          url: t.method === 'GET' && query.size ? `${url}?${query}` : url,
          // Token interno de 1 min: as rotas continuam exigindo login normalmente.
          headers: { authorization: `Bearer ${app.jwt.sign({ sub: 'mcp' }, { expiresIn: '1m' })}` },
          ...((t.method === 'POST' || t.method === 'PATCH') && { payload: rest }),
        })
        const type = String(res.headers['content-type'] ?? '')
        if (res.statusCode < 400 && res.body && !type.includes('json')) return fileResult(res.rawPayload, type, t.download && publicUrl(url, query))
        let data: unknown = res.body ? res.json() : { ok: res.statusCode < 400 } // 204 do DELETE
        if (Array.isArray(data) && data.length > MAX_ROWS) data = { total: data.length, truncated: true, rows: data.slice(0, MAX_ROWS) }
        return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], isError: res.statusCode >= 400 }
      },
    )
  }
  return server
}

const publicUrl = (url: string, query: URLSearchParams) => `${apiUrl()}${url}${query.size ? `?${query}` : ''}`

// Texto (ex.: CSV) vai inline; binário (ex.: xlsx) vai como recurso em base64.
function fileResult(body: Buffer, mimeType: string, link: string | false | undefined) {
  const content: CallToolResult['content'] = mimeType.startsWith('text/')
    ? [{ type: 'text', text: body.toString('utf8').replace(/^\uFEFF/, '') }]
    : [{ type: 'resource', resource: { uri: link || 'v4-dashboard://arquivo', mimeType, blob: body.toString('base64') } }]
  if (link) content.push({ type: 'text', text: `Download: ${link}` })
  return { content }
}

// sha256 dos dois lados: timingSafeEqual exige o mesmo tamanho.
const digest = (s: string) => createHash('sha256').update(s).digest()

// Bearer = MCP_API_KEY (não expira, para integrações) ou o JWT do login do app.
async function mcpAuth(req: FastifyRequest, reply: FastifyReply) {
  const key = process.env.MCP_API_KEY
  const given = req.headers.authorization?.replace(/^Bearer /i, '') ?? ''
  if (key && timingSafeEqual(digest(given), digest(key))) return
  await authenticate(req, reply)
  if (reply.sent) return
  return requirePermission('governance.manage')(req, reply)
}

export async function mcpRoutes(app: FastifyInstance) {
  // Stateless: um McpServer por requisição; serve a revisão 2026 e clientes da era 2025.
  const handle = toNodeHandler(createMcpHandler(() => buildServer(app)), { onerror: (e) => app.log.error(e, 'mcp') })
  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    bodyLimit: 8 * 1024 * 1024, // cabe o xlsx em base64 do import_metrics_sheet
    onRequest: mcpAuth,
    handler: async (req, reply) => {
      reply.hijack() // a resposta (JSON ou SSE) é escrita pelo SDK direto no socket
      await handle(req.raw, reply.raw, req.body)
    },
  })
}
