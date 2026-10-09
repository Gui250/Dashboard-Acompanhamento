import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/governance.js'
import { createRoleBody, governanceView, roleParams, roleView, updateRoleBody, updateUserRoleBody } from '../views/governance.js'
import { errorView, userView } from '../views/user.js'
import { authenticate, requirePermission } from './auth.js'

export const governanceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', authenticate)
  app.addHook('preHandler', requirePermission('governance.manage'))

  app.get('/governance', { schema: { response: { 200: governanceView, 403: errorView } } }, controller.overview)
  app.post('/governance/roles', { schema: { body: createRoleBody, response: { 201: roleView, 409: errorView } } }, controller.createRole)
  app.patch('/governance/roles/:id', { schema: { params: roleParams, body: updateRoleBody, response: { 200: roleView, 404: errorView, 409: errorView } } }, controller.updateRole)
  app.delete('/governance/roles/:id', { schema: { params: roleParams, response: { 204: z.null(), 404: errorView, 409: errorView } } }, controller.deleteRole)
  app.patch('/governance/users/:id/role', { schema: { params: roleParams, body: updateUserRoleBody, response: { 200: userView, 404: errorView, 409: errorView } } }, controller.updateUserRole)
}
