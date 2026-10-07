import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/creative.js'
import { authenticate } from './auth.js'
import { errorView } from '../views/user.js'
import { createCreativeBody, creativeParams as params, creativeView, updateCreativeBody } from '../views/creative.js'

export const creativesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/creatives', { onRequest: authenticate, schema: { response: { 200: z.array(creativeView) } } }, controller.list)
  app.post('/creatives', { onRequest: authenticate, schema: { body: createCreativeBody, response: { 201: creativeView } } }, controller.create)
  app.patch('/creatives/:id', { onRequest: authenticate, schema: { params, body: updateCreativeBody, response: { 200: creativeView, 404: errorView } } }, controller.update)
  app.delete('/creatives/:id', { onRequest: authenticate, schema: { params, response: { 404: errorView } } }, controller.remove)
  app.put('/creatives/:id/image', { onRequest: authenticate, schema: { params, response: { 200: creativeView, 400: errorView, 404: errorView } } }, controller.uploadImage)
  app.delete('/creatives/:id/image', { onRequest: authenticate, schema: { params, response: { 200: creativeView, 404: errorView } } }, controller.removeImage)
  app.get('/creatives/:id/image', { onRequest: authenticate, schema: { params } }, controller.image)
}
