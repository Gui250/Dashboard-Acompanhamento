import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import {
  createCreative,
  createFunnel,
  creativeStage,
  defaultFunnel,
  deleteCreative,
  deleteFunnel,
  findCreativeImage,
  findFunnel,
  listCreatives,
  listFunnels,
  setCreativeImage,
  updateCreative,
  updateFunnel,
} from '../models/creative.js'
import { escapeHtml, sendEmail } from '../lib/email.js'
import { webUrl } from './integration.js'
import type { createCreativeBody, creativeParams, creativesQuery, funnelBody, updateCreativeBody, updateFunnelBody } from '../views/creative.js'

type Params = { Params: z.infer<typeof creativeParams> }
const notFound = { message: 'Criativo não encontrado.' }
const noFunnel = { message: 'Funil não encontrado.' }

// Quem aprova os criativos: recebe um e-mail quando um card entra em Revisão.
const APPROVER = 'flaviasobral@v4.company'

type Row = NonNullable<Awaited<ReturnType<typeof updateCreative>>>

async function notifyApproval(c: Row) {
  const funnel = await findFunnel(c.funnelId)
  const rows = [['Funil', funnel?.name ?? '-'], ['Conta', c.account], ['Formato', c.format], ['Responsável', c.owner]]
  return sendEmail({
    to: APPROVER,
    subject: `Criativo aguardando aprovação: ${c.title}`,
    html:
      `<p>O criativo <strong>${escapeHtml(c.title)}</strong> entrou em <strong>Revisão</strong> e precisa da sua aprovação.</p>` +
      `<ul>${rows.map(([k, v]) => `<li>${k}: ${escapeHtml(v)}</li>`).join('')}</ul>` +
      `<p><a href="${webUrl()}/kanban">Abrir o kanban</a></p>`,
  })
}

// Fora do caminho da resposta: falha no e-mail vai para o log e não desfaz a mudança no kanban.
function notifyIfReview(req: FastifyRequest, c: Row, before?: string) {
  if (c.stage !== 'revisao' || before === 'revisao') return
  notifyApproval(c)
    .then((sent) => sent || req.log.warn('e-mail de aprovação não enviado: faltam RESEND_API_KEY e RESEND_FROM'))
    .catch((e) => req.log.error(e, 'falha ao enviar e-mail de aprovação'))
}

// Tipo real pela assinatura do arquivo; o mimetype enviado não é confiável. SVG nunca passa.
function imageType(buf: Buffer) {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
  if (/^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'image/gif'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
}

export function list(req: FastifyRequest<{ Querystring: z.infer<typeof creativesQuery> }>) {
  return listCreatives(req.query.funnelId)
}

export async function create(req: FastifyRequest<{ Body: z.infer<typeof createCreativeBody> }>, reply: FastifyReply) {
  const funnel = await (req.body.funnelId ? findFunnel(req.body.funnelId) : defaultFunnel())
  if (!funnel) return reply.status(400).send(noFunnel)
  const row = await createCreative({ ...req.body, funnelId: funnel.id })
  notifyIfReview(req, row)
  return reply.status(201).send(row)
}

export async function update(req: FastifyRequest<Params & { Body: z.infer<typeof updateCreativeBody> }>, reply: FastifyReply) {
  if (req.body.funnelId && !(await findFunnel(req.body.funnelId))) return reply.status(400).send(noFunnel)
  const before = req.body.stage === 'revisao' ? await creativeStage(req.params.id) : undefined
  const row = await updateCreative(req.params.id, req.body)
  if (!row) return reply.status(404).send(notFound)
  notifyIfReview(req, row, before)
  return row
}

export function funnels() {
  return listFunnels()
}

export async function addFunnel(req: FastifyRequest<{ Body: z.infer<typeof funnelBody> }>, reply: FastifyReply) {
  const row = await createFunnel(req.body.name)
  return row ? reply.status(201).send(row) : reply.status(409).send(duplicateFunnel)
}

const duplicateFunnel = { message: 'Já existe um funil com esse nome.' }

export async function editFunnel(req: FastifyRequest<Params & { Body: z.infer<typeof updateFunnelBody> }>, reply: FastifyReply) {
  const row = await updateFunnel(req.params.id, req.body)
  if (row === null) return reply.status(409).send(duplicateFunnel)
  return row ?? reply.status(404).send(noFunnel)
}

export async function removeFunnel(req: FastifyRequest<Params>, reply: FastifyReply) {
  const result = await deleteFunnel(req.params.id)
  if (!result) return reply.status(404).send(noFunnel)
  if (result === 'default') return reply.status(409).send({ message: 'O funil padrão não pode ser excluído. Marque outro como padrão antes.' })
  return result
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
