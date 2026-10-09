import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/metric.js'
import { authenticate, requirePermission } from './auth.js'
import { createMetricBody, dashboardQuery, importContentBody, dashboardView, metricFilters, metricView, seriesQuery, seriesView, templateQuery } from '../views/metric.js'

export const metricsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Tudo exige login, menos o template (baixado por link direto, sem token).
  app.post('/metrics', { onRequest: authenticate, preHandler: requirePermission('metrics.manage'), schema: { body: createMetricBody, response: { 201: metricView } } }, controller.create)
  app.get('/metrics', { onRequest: authenticate, preHandler: requirePermission('metrics.view'), schema: { querystring: metricFilters, response: { 200: z.array(metricView) } } }, controller.list)
  app.post('/metrics/import', { onRequest: authenticate, preHandler: requirePermission('metrics.manage') }, controller.importSheet)
  // Mesmo limite do upload (5 MB) depois de virar base64 (~4/3).
  app.post('/metrics/import/content', { onRequest: authenticate, preHandler: requirePermission('metrics.manage'), bodyLimit: 7 * 1024 * 1024, schema: { body: importContentBody } }, controller.importContent)
  app.get('/metrics/template', { schema: { querystring: templateQuery } }, controller.template)
  app.get('/metrics/series', { onRequest: authenticate, preHandler: requirePermission('metrics.view'), schema: { querystring: seriesQuery, response: { 200: seriesView } } }, controller.series)
  app.get('/metrics/dashboard', { onRequest: authenticate, preHandler: requirePermission('metrics.view'), schema: { querystring: dashboardQuery, response: { 200: dashboardView } } }, controller.dashboard)
}
