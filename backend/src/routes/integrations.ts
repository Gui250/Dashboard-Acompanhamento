import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/integration.js'
import { authenticate } from './auth.js'
import { errorView } from '../views/user.js'
import {
  metaAccountsQuery,
  metaAccountsView,
  metaConfigBody,
  metaConfigView,
  openAIConfigBody,
  openAIConfigView,
  openAIModelsBody,
  openAIModelsView,
} from '../views/integration.js'

export const integrationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', authenticate) // tudo aqui exige login
  app.get('/integrations/openai', { schema: { response: { 200: openAIConfigView } } }, controller.show)
  app.put(
    '/integrations/openai',
    { schema: { body: openAIConfigBody, response: { 200: openAIConfigView, 400: errorView, 409: errorView } } },
    controller.save,
  )
  // POST para a chave ir no corpo, não na URL (que aparece em logs).
  app.post(
    '/integrations/openai/models',
    { schema: { body: openAIModelsBody, response: { 200: openAIModelsView, 400: errorView, 409: errorView } } },
    controller.models,
  )
  app.get('/integrations/meta', { schema: { response: { 200: metaConfigView } } }, controller.showMeta)
  app.put(
    '/integrations/meta',
    { schema: { body: metaConfigBody, response: { 200: metaConfigView, 400: errorView, 409: errorView } } },
    controller.saveMeta,
  )
  app.get(
    '/meta/accounts',
    { schema: { querystring: metaAccountsQuery, response: { 200: metaAccountsView, 409: errorView, 502: errorView } } },
    controller.metaAccounts,
  )
}
