import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/metric.js'
import { authenticate } from './auth.js'
import { createMetricBody, dashboardQuery, dashboardView, metricFilters, metricView, seriesQuery, seriesView, templateQuery } from '../views/metric.js'

export const metricsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Tudo exige login, menos o template (baixado por link direto, sem token).
  app.post('/metrics', { onRequest: authenticate, schema: { body: createMetricBody, response: { 201: metricView } } }, controller.create)
  app.get('/metrics', { onRequest: authenticate, schema: { querystring: metricFilters, response: { 200: z.array(metricView) } } }, controller.list)
  app.post('/metrics/import', { onRequest: authenticate }, controller.importSheet)
  app.get('/metrics/template', { schema: { querystring: templateQuery } }, controller.template)
  app.get('/metrics/series', { onRequest: authenticate, schema: { querystring: seriesQuery, response: { 200: seriesView } } }, controller.series)
  app.get('/metrics/dashboard', { onRequest: authenticate, schema: { querystring: dashboardQuery, response: { 200: dashboardView } } }, controller.dashboard)
}
