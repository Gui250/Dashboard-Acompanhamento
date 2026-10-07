import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/assistant.js'
import { authenticate } from './auth.js'
import { errorView } from '../views/user.js'
import { chatBody } from '../views/assistant.js'

export const assistantRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/assistant/chat',
    { onRequest: authenticate, schema: { body: chatBody, response: { 409: errorView, 502: errorView } } },
    controller.chat,
  )
}
