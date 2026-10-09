import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/integration.js'
import { authenticate } from './auth.js'
import { errorView } from '../views/user.js'
import {
  dateRangeQuery,
  googleAccountsView,
  googleAuthUrlView,
  googleCallbackQuery,
  googleCampaignsQuery,
  googleCampaignsView,
  googleConfigView,
  googleCredentialsBody,
  mcpConfigView,
  metaAccountsView,
  metaAdHiddenBody,
  metaAdParams,
  metaAdsQuery,
  metaAdsView,
  metaCampaignsQuery,
  metaCampaignsView,
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
    { schema: { querystring: dateRangeQuery, response: { 200: metaAccountsView, 409: errorView, 502: errorView } } },
    controller.metaAccounts,
  )
  app.get(
    '/meta/campaigns',
    { schema: { querystring: metaCampaignsQuery, response: { 200: metaCampaignsView, 409: errorView, 502: errorView } } },
    controller.metaCampaigns,
  )
  app.get(
    '/meta/ads',
    { schema: { querystring: metaAdsQuery, response: { 200: metaAdsView, 409: errorView, 502: errorView } } },
    controller.metaAds,
  )
  app.patch(
    '/meta/ads/:id',
    { schema: { params: metaAdParams, body: metaAdHiddenBody, response: { 200: metaAdParams.extend(metaAdHiddenBody.shape) } } },
    controller.hideMetaAd,
  )
  app.get('/integrations/google', { schema: { response: { 200: googleConfigView } } }, controller.showGoogle)
  app.put(
    '/integrations/google',
    { schema: { body: googleCredentialsBody, response: { 200: googleConfigView, 400: errorView, 409: errorView } } },
    controller.saveGoogle,
  )
  app.delete('/integrations/google', { schema: { response: { 200: googleConfigView } } }, controller.disconnectGoogle)
  app.get(
    '/integrations/google/auth-url',
    { schema: { response: { 200: googleAuthUrlView, 409: errorView } } },
    controller.googleAuthUrl,
  )
  app.get(
    '/google/accounts',
    { schema: { querystring: dateRangeQuery, response: { 200: googleAccountsView, 409: errorView, 502: errorView } } },
    controller.googleAccounts,
  )
  app.get(
    '/google/campaigns',
    { schema: { querystring: googleCampaignsQuery, response: { 200: googleCampaignsView, 404: errorView, 409: errorView, 502: errorView } } },
    controller.googleCampaigns,
  )
  app.get('/integrations/mcp', { schema: { response: { 200: mcpConfigView } } }, controller.showMcp)
}

// Fora do hook de login: o Google redireciona o navegador para cá sem o Bearer.
export const googleCallbackRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/integrations/google/callback', { schema: { querystring: googleCallbackQuery } }, controller.googleCallback)
}
