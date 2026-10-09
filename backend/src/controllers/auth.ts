import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { createUser, findRoleByName, findUserByEmail, findUserById, userCount } from '../models/user.js'
import type { loginBody, registerBody } from '../views/user.js'

export async function register(req: FastifyRequest<{ Body: z.infer<typeof registerBody> }>, reply: FastifyReply) {
  const { name, email, password } = req.body
  const firstAccount = await userCount() === 0
  const systemAdmin = ['guilherme moreno', 'guilherme soares moreno'].includes(name.trim().toLowerCase())
  const role = await findRoleByName(firstAccount || systemAdmin ? 'Administrador' : 'Vendedor')
  if (!role) return reply.status(503).send({ message: 'Os cargos do sistema ainda não foram configurados.' })
  const created = await createUser({ name, email, passwordHash: await hashPassword(password), roleId: role.id })
  if (!created) return reply.status(409).send({ message: 'E-mail já cadastrado.' })
  const user = await findUserById(created.id)
  if (!user) return reply.status(500).send({ message: 'Não foi possível iniciar a conta.' })
  return reply.status(201).send({ token: await reply.jwtSign({ sub: String(created.id) }), user })
}

export async function login(req: FastifyRequest<{ Body: z.infer<typeof loginBody> }>, reply: FastifyReply) {
  const credentials = await findUserByEmail(req.body.email)
  if (!credentials || !(await verifyPassword(req.body.password, credentials.passwordHash))) {
    return reply.status(401).send({ message: 'E-mail ou senha inválidos.' })
  }
  const user = await findUserById(credentials.id)
  if (!user) return reply.status(401).send({ message: 'Sessão inválida.' })
  return { token: await reply.jwtSign({ sub: String(credentials.id) }), user }
}

export async function me(req: FastifyRequest, reply: FastifyReply) {
  const user = await findUserById(Number(req.user.sub))
  if (!user) return reply.status(401).send({ message: 'Sessão inválida.' })
  return user
}
