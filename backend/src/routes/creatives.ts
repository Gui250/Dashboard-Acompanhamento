import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/creative.js'
import { authenticate, requirePermission } from './auth.js'
import { errorView } from '../views/user.js'
import {
  approvalBody,
  approvalParams,
  approvalView,
  createCreativeBody,
  creativeParams as params,
  creativesQuery,
  creativeView,
  deleteFunnelView,
  funnelBody,
  funnelView,
  updateCreativeBody,
  notificationsQuery,
  notificationsView,
  updateFunnelBody,
} from '../views/creative.js'

export const creativesRoutes: FastifyPluginAsyncZod = async (app) => {
  const view = requirePermission('kanban.view')
  const manage = requirePermission('kanban.manage')
  app.get('/funnels', { onRequest: authenticate, preHandler: view, schema: { response: { 200: z.array(funnelView) } } }, controller.funnels)
  app.post('/funnels', { onRequest: authenticate, preHandler: manage, schema: { body: funnelBody, response: { 201: funnelView, 409: errorView } } }, controller.addFunnel)
  app.patch('/funnels/:id', { onRequest: authenticate, preHandler: manage, schema: { params, body: updateFunnelBody, response: { 200: funnelView, 404: errorView, 409: errorView } } }, controller.editFunnel)
  app.delete('/funnels/:id', { onRequest: authenticate, preHandler: manage, schema: { params, response: { 200: deleteFunnelView, 404: errorView, 409: errorView } } }, controller.removeFunnel)
  app.get('/creatives', { onRequest: authenticate, preHandler: view, schema: { querystring: creativesQuery, response: { 200: z.array(creativeView) } } }, controller.list)
  app.post('/creatives', { onRequest: authenticate, preHandler: manage, schema: { body: createCreativeBody, response: { 201: creativeView, 400: errorView } } }, controller.create)
  app.patch('/creatives/:id', { onRequest: authenticate, preHandler: manage, schema: { params, body: updateCreativeBody, response: { 200: creativeView, 400: errorView, 404: errorView } } }, controller.update)
  app.delete('/creatives/:id', { onRequest: authenticate, preHandler: manage, schema: { params, response: { 404: errorView } } }, controller.remove)
  app.put('/creatives/:id/image', { onRequest: authenticate, preHandler: manage, schema: { params, response: { 200: creativeView, 400: errorView, 404: errorView } } }, controller.uploadImage)
  app.delete('/creatives/:id/image', { onRequest: authenticate, preHandler: manage, schema: { params, response: { 200: creativeView, 404: errorView } } }, controller.removeImage)
  app.get('/creatives/:id/image', { onRequest: authenticate, preHandler: view, schema: { params } }, controller.image)
  app.get('/notifications', { onRequest: authenticate, preHandler: view, schema: { querystring: notificationsQuery, response: { 200: notificationsView } } }, controller.notifications)
  app.post(
    '/creatives/:id/approval',
    { onRequest: authenticate, preHandler: manage, schema: { params, response: { 200: creativeView, 404: errorView, 502: errorView, 503: errorView } } },
    controller.sendForApproval,
  )

  // Públicas: o token assinado do e-mail faz o papel do login (só para este criativo).
  const token = { params: approvalParams }
  app.get('/approvals/:token', { schema: { ...token, response: { 200: approvalView, 404: errorView } } }, controller.approvalShow)
  app.get('/approvals/:token/image', { schema: token }, controller.approvalImage)
  app.post(
    '/approvals/:token',
    { schema: { ...token, body: approvalBody, response: { 200: approvalView, 404: errorView, 409: errorView } } },
    controller.approvalDecide,
  )
}
