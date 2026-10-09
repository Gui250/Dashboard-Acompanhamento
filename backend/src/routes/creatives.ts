import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/creative.js'
import { authenticate } from './auth.js'
import { errorView } from '../views/user.js'
import { createCreativeBody, creativeParams as params, creativesQuery, creativeView, funnelBody, funnelView, updateCreativeBody } from '../views/creative.js'

export const creativesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/funnels', { onRequest: authenticate, schema: { response: { 200: z.array(funnelView) } } }, controller.funnels)
  app.post('/funnels', { onRequest: authenticate, schema: { body: funnelBody, response: { 201: funnelView, 409: errorView } } }, controller.addFunnel)
  app.get('/creatives', { onRequest: authenticate, schema: { querystring: creativesQuery, response: { 200: z.array(creativeView) } } }, controller.list)
  app.post('/creatives', { onRequest: authenticate, schema: { body: createCreativeBody, response: { 201: creativeView, 400: errorView } } }, controller.create)
  app.patch('/creatives/:id', { onRequest: authenticate, schema: { params, body: updateCreativeBody, response: { 200: creativeView, 400: errorView, 404: errorView } } }, controller.update)
  app.delete('/creatives/:id', { onRequest: authenticate, schema: { params, response: { 404: errorView } } }, controller.remove)
  app.put('/creatives/:id/image', { onRequest: authenticate, schema: { params, response: { 200: creativeView, 400: errorView, 404: errorView } } }, controller.uploadImage)
  app.delete('/creatives/:id/image', { onRequest: authenticate, schema: { params, response: { 200: creativeView, 404: errorView } } }, controller.removeImage)
  app.get('/creatives/:id/image', { onRequest: authenticate, schema: { params } }, controller.image)
}
