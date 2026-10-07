import type { FastifyReply, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as controller from '../controllers/auth.js'
import { errorView, loginBody, registerBody, sessionView, userView } from '../views/user.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
    user: { sub: string }
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ message: 'Não autenticado.' })
  }
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/register',
    { schema: { body: registerBody, response: { 201: sessionView, 409: errorView } } },
    controller.register,
  )
  app.post(
    '/auth/login',
    { schema: { body: loginBody, response: { 200: sessionView, 401: errorView } } },
    controller.login,
  )
  app.get(
    '/auth/me',
    { onRequest: authenticate, schema: { response: { 200: userView, 401: errorView } } },
    controller.me,
  )
}
