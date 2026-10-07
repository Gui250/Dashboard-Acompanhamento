import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import {
  createCreative,
  deleteCreative,
  findCreativeImage,
  listCreatives,
  setCreativeImage,
  updateCreative,
} from '../models/creative.js'
import type { createCreativeBody, creativeParams, updateCreativeBody } from '../views/creative.js'

type Params = { Params: z.infer<typeof creativeParams> }
const notFound = { message: 'Criativo não encontrado.' }

// Tipo real pela assinatura do arquivo; o mimetype enviado não é confiável. SVG nunca passa.
function imageType(buf: Buffer) {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
  if (/^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'image/gif'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
}

export function list() {
  return listCreatives()
}

export async function create(req: FastifyRequest<{ Body: z.infer<typeof createCreativeBody> }>, reply: FastifyReply) {
  return reply.status(201).send(await createCreative(req.body))
}

export async function update(req: FastifyRequest<Params & { Body: z.infer<typeof updateCreativeBody> }>, reply: FastifyReply) {
  return (await updateCreative(req.params.id, req.body)) ?? reply.status(404).send(notFound)
}

export async function remove(req: FastifyRequest<Params>, reply: FastifyReply) {
  if (!(await deleteCreative(req.params.id))) return reply.status(404).send(notFound)
  return reply.status(204).send()
}

export async function uploadImage(req: FastifyRequest<Params>, reply: FastifyReply) {
  const file = await req.file()
  const message = 'Envie uma imagem PNG, JPEG, WEBP ou GIF no campo "file".'
  if (!file || file.fieldname !== 'file') return reply.status(400).send({ message })
  const buf = await file.toBuffer()
  const type = imageType(buf)
  if (!type) return reply.status(400).send({ message })
  return (await setCreativeImage(req.params.id, buf, type)) ?? reply.status(404).send(notFound)
}

export async function removeImage(req: FastifyRequest<Params>, reply: FastifyReply) {
  return (await setCreativeImage(req.params.id, null, null)) ?? reply.status(404).send(notFound)
}

export async function image(req: FastifyRequest<Params>, reply: FastifyReply) {
  const found = await findCreativeImage(req.params.id)
  if (!found) return reply.status(404).send({ message: 'Imagem não encontrada.' })
  return reply.header('content-type', found.imageType).header('x-content-type-options', 'nosniff').send(found.image)
}
