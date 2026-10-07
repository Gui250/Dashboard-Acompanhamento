import { AIMessage, createAgent, tool } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import { listMetrics, metricSeries } from '../models/metric.js'
import { metricFilters, seriesQuery } from '../views/metric.js'

// ponytail: corta em 200 linhas para não estourar o contexto; o modelo é orientado a filtrar ou usar a série.
const MAX_ROWS = 200

const listMetricsTool = tool(
  async (filters) => {
    const rows = await listMetrics(filters)
    const data = rows.slice(0, MAX_ROWS).map(({ section, key, dimension, value, date }) => ({ section, key, dimension, value, date }))
    return JSON.stringify({ total: rows.length, truncated: rows.length > MAX_ROWS, rows: data })
  },
  {
    name: 'list_metrics',
    description:
      'Lista lançamentos brutos de métricas das planilhas (section: comercial|operacional, key, dimension, value, date YYYY-MM-DD). ' +
      'Filtros opcionais: section, key, from, to. Use sem filtros para descobrir quais keys existem.',
    schema: metricFilters,
  },
)

const metricSeriesTool = tool(async (query) => JSON.stringify(await metricSeries(query)), {
  name: 'metric_series',
  description:
    'Soma value de uma métrica (key obrigatória) agrupando por data (groupBy=date) ou por dimensão (groupBy=dimension). ' +
    'Filtros opcionais: section, from, to (YYYY-MM-DD). Prefira esta tool para totais, rankings e tendências.',
  schema: seriesQuery,
})

const systemPrompt = () => `Você é o assistente do V4 Dashboard. Responda em português, de forma objetiva.
Use as tools para consultar as métricas reais (seções comercial e operacional) antes de responder sobre números; nunca invente dados.
Se não houver dados para o pedido, diga isso. Hoje é ${new Date().toISOString().slice(0, 10)}.`

// Construído por requisição: a chave/modelo podem mudar em Integrações.
export function buildAgent(config: { apiKey: string; model: string }) {
  return createAgent({
    model: new ChatOpenAI({ apiKey: config.apiKey, model: config.model }),
    tools: [listMetricsTool, metricSeriesTool],
    systemPrompt: systemPrompt(),
  })
}

type Message = { role: 'user' | 'assistant'; content: string }

// Só os tokens de texto do modelo; tool calls e resultados das tools ficam no servidor.
export async function* streamAnswer(config: { apiKey: string; model: string }, messages: Message[]) {
  const stream = await buildAgent(config).stream({ messages }, { streamMode: 'messages' })
  for await (const [chunk] of stream) {
    if (AIMessage.isInstance(chunk) && chunk.text) yield chunk.text
  }
}
