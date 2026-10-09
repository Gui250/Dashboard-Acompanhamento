import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import {
  createRole as insertRole,
  deleteRole as removeRole,
  findRoleByName,
  listRoles,
  listUsers,
  roleHasUsers,
  updateRole as changeRole,
  updateUserRole as changeUserRole,
} from '../models/user.js'
import type { createRoleBody, roleParams, updateRoleBody, updateUserRoleBody } from '../views/governance.js'

export async function overview() {
  const [roles, users] = await Promise.all([listRoles(), listUsers()])
  return { roles, users }
}

export async function createRole(req: FastifyRequest<{ Body: z.infer<typeof createRoleBody> }>, reply: FastifyReply) {
  if (await findRoleByName(req.body.name)) return reply.status(409).send({ message: 'Já existe um cargo com este nome.' })
  return reply.status(201).send(await insertRole(req.body))
}

export async function updateRole(req: FastifyRequest<{ Params: z.infer<typeof roleParams>; Body: z.infer<typeof updateRoleBody> }>, reply: FastifyReply) {
  const roles = await listRoles()
  const current = roles.find((role) => role.id === req.params.id)
  if (!current) return reply.status(404).send({ message: 'Cargo não encontrado.' })
  if (current.name === 'Administrador') return reply.status(409).send({ message: 'O acesso total do Administrador é protegido.' })
  if (current.isSystem && req.body.name && req.body.name !== current.name) return reply.status(409).send({ message: 'O nome deste cargo essencial é protegido.' })
  if (req.body.name) {
    const sameName = await findRoleByName(req.body.name)
    if (sameName && sameName.id !== current.id) return reply.status(409).send({ message: 'Já existe um cargo com este nome.' })
  }
  return changeRole(req.params.id, req.body)
}

export async function deleteRole(req: FastifyRequest<{ Params: z.infer<typeof roleParams> }>, reply: FastifyReply) {
  const roles = await listRoles()
  const current = roles.find((role) => role.id === req.params.id)
  if (!current) return reply.status(404).send({ message: 'Cargo não encontrado.' })
  if (current.isSystem) return reply.status(409).send({ message: 'Os cargos essenciais do sistema não podem ser excluídos.' })
  if (await roleHasUsers(current.id)) return reply.status(409).send({ message: 'Mova as pessoas deste cargo antes de excluí-lo.' })
  await removeRole(current.id)
  return reply.status(204).send()
}

export async function updateUserRole(req: FastifyRequest<{ Params: z.infer<typeof roleParams>; Body: z.infer<typeof updateUserRoleBody> }>, reply: FastifyReply) {
  if (req.params.id === Number(req.user.sub)) return reply.status(409).send({ message: 'Seu próprio acesso de Administrador é protegido.' })
  const roles = await listRoles()
  if (!roles.some((role) => role.id === req.body.roleId)) return reply.status(404).send({ message: 'Cargo não encontrado.' })
  const user = await changeUserRole(req.params.id, req.body.roleId)
  if (!user) return reply.status(404).send({ message: 'Pessoa não encontrada.' })
  return user
}
