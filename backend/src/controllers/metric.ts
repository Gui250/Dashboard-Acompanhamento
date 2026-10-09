import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import { COLUMN_OF, parseMetricsSheet, metricsTemplate, templateRows } from '../lib/spreadsheet.js'
import { createMetric, createMetrics, listMetrics, metricSeries } from '../models/metric.js'
import { createMetricBody, type dashboardQuery, type importContentBody, type metricFilters, type seriesQuery, type templateQuery } from '../views/metric.js'

export async function create(req: FastifyRequest<{ Body: z.infer<typeof createMetricBody> }>, reply: FastifyReply) {
  return reply.status(201).send(await createMetric(req.body))
}

export function list(req: FastifyRequest<{ Querystring: z.infer<typeof metricFilters> }>) {
  return listMetrics(req.query)
}

export function series(req: FastifyRequest<{ Querystring: z.infer<typeof seriesQuery> }>) {
  return metricSeries(req.query)
}

export async function dashboard(req: FastifyRequest<{ Querystring: z.infer<typeof dashboardQuery> }>) {
  const { section, timelineKey, rankingKey } = req.query
  const [metrics, timeline, ranking] = await Promise.all([
    listMetrics({ section }),
    metricSeries({ section, key: timelineKey, groupBy: 'date' }),
    rankingKey ? metricSeries({ section, key: rankingKey, groupBy: 'dimension' }) : Promise.resolve([]),
  ])
  return { metrics, timeline, ranking }
}

export async function importSheet(req: FastifyRequest, reply: FastifyReply) {
  const file = await req.file()
  if (!file || !/\.(xlsx|csv)$/i.test(file.filename)) {
    return reply.status(400).send({ message: 'Envie um arquivo .xlsx ou .csv no campo "file".' })
  }
  return importRows(parseMetricsSheet(await file.toBuffer()), reply)
}

export function importContent(req: FastifyRequest<{ Body: z.infer<typeof importContentBody> }>, reply: FastifyReply) {
  const { format, content } = req.body
  return importRows(parseMetricsSheet(format === 'csv' ? content : Buffer.from(content, 'base64')), reply)
}

async function importRows(rows: ReturnType<typeof parseMetricsSheet>, reply: FastifyReply) {
  if (rows.length === 0) return reply.status(400).send({ message: 'A planilha está vazia.' })

  const valid: z.infer<typeof createMetricBody>[] = []
  const errors: { line: number; message: string }[] = []
  rows.forEach((row) => {
    const parsed = createMetricBody.safeParse(row)
    if (parsed.success) valid.push(parsed.data)
    else errors.push({ line: row.line, message: (row.sheet ? `aba ${row.sheet} · ` : '') + parsed.error.issues.map((e) => `${COLUMN_OF[String(e.path[0])] ?? e.path.join('.')}: ${e.message}`).join('; ') })
  })
  // Tudo ou nada: com qualquer linha inválida, nada é gravado.
  if (errors.length) return reply.status(400).send({ message: 'Planilha com linhas inválidas.', errors })

  await createMetrics(valid)
  return reply.status(201).send({ imported: valid.length })
}

export async function template(req: FastifyRequest<{ Querystring: z.infer<typeof templateQuery> }>, reply: FastifyReply) {
  const { format, ...prefill } = req.query
  return reply
    .header('content-type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('content-disposition', `attachment; filename="template-metricas.${format}"`)
    .send(await metricsTemplate(format, templateRows(prefill)))
}
