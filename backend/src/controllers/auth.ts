import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { createUser, findUserByEmail, findUserById } from '../models/user.js'
import type { loginBody, registerBody } from '../views/user.js'

export async function register(req: FastifyRequest<{ Body: z.infer<typeof registerBody> }>, reply: FastifyReply) {
  const { name, email, password } = req.body
  const user = await createUser({ name, email, passwordHash: await hashPassword(password) })
  if (!user) return reply.status(409).send({ message: 'E-mail já cadastrado.' })
  return reply.status(201).send({ token: await reply.jwtSign({ sub: String(user.id) }), user })
}

export async function login(req: FastifyRequest<{ Body: z.infer<typeof loginBody> }>, reply: FastifyReply) {
  const user = await findUserByEmail(req.body.email)
  if (!user || !(await verifyPassword(req.body.password, user.passwordHash))) {
    return reply.status(401).send({ message: 'E-mail ou senha inválidos.' })
  }
  return { token: await reply.jwtSign({ sub: String(user.id) }), user }
}

export async function me(req: FastifyRequest, reply: FastifyReply) {
  const user = await findUserById(Number(req.user.sub))
  if (!user) return reply.status(401).send({ message: 'Sessão inválida.' })
  return user
}
