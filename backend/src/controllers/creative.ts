import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import {
  createCreative,
  createFunnel,
  creativeStage,
  defaultFunnel,
  deleteCreative,
  deleteFunnel,
  findCreative,
  findCreativeImage,
  findFunnel,
  listCreatives,
  listApprovals,
  listFunnels,
  recordApproval,
  requesterEmail,
  setCreativeImage,
  updateCreative,
  updateFunnel,
} from '../models/creative.js'
import { sendEmail } from '../lib/email.js'
import { approvalEmail, approvalToken, approvedEmail, readApprovalToken } from '../lib/approval.js'
import { apiUrl, webUrl } from '../lib/urls.js'
import type {
  approvalBody,
  approvalParams,
  createCreativeBody,
  creativeParams,
  creativesQuery,
  funnelBody,
  notificationsQuery,
  updateCreativeBody,
  updateFunnelBody,
} from '../views/creative.js'

type Params = { Params: z.infer<typeof creativeParams> }
const notFound = { message: 'Criativo não encontrado.' }
const noFunnel = { message: 'Funil não encontrado.' }

// Quem aprova os criativos: recebe o e-mail com Aprovar / Pedir ajustes quando um card vai para Revisão.
const APPROVER = 'flaviasobral@v4company.com'
const noResend = 'E-mail não configurado: faltam RESEND_API_KEY e RESEND_FROM no servidor.'

type Row = NonNullable<Awaited<ReturnType<typeof updateCreative>>>

// Usuário logado (o token do MCP com MCP_API_KEY não tem usuário: null).
const userId = (req: FastifyRequest) => Number((req.user as { sub?: string } | undefined)?.sub) || null

// Link assinado para a página de aprovação; a imagem vai por URL da API (e-mail não carrega imagem com login).
async function notifyApproval(c: Row) {
  const token = approvalToken(c.id)
  const funnel = await findFunnel(c.funnelId)
  const mail = approvalEmail({
    title: c.title,
    account: c.account,
    format: c.format,
    owner: c.owner,
    funnel: funnel?.name ?? null,
    imageUrl: c.hasImage ? `${apiUrl()}/approvals/${token}/image` : null,
    reviewUrl: `${webUrl()}/aprovacao/${token}`,
  })
  return sendEmail({ to: APPROVER, ...mail })
}

// Arrastar para Revisão também avisa. Fora do caminho da resposta: falha no e-mail vai para o log e não desfaz o movimento.
function notifyIfReview(req: FastifyRequest, c: Row, before?: string) {
  if (c.stage !== 'revisao' || before === 'revisao') return
  notifyApproval(c)
    .then((sent) => sent || req.log.warn(noResend))
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
  const row = await createCreative({ ...req.body, funnelId: funnel.id, approvalRequestedBy: req.body.stage === 'revisao' ? userId(req) : null })
  notifyIfReview(req, row)
  return reply.status(201).send(row)
}

export async function update(req: FastifyRequest<Params & { Body: z.infer<typeof updateCreativeBody> }>, reply: FastifyReply) {
  if (req.body.funnelId && !(await findFunnel(req.body.funnelId))) return reply.status(400).send(noFunnel)
  const before = req.body.stage === 'revisao' ? await creativeStage(req.params.id) : undefined
  const entering = before !== undefined && before !== 'revisao' // quem move para Revisão recebe o aviso de aprovado
  const row = await updateCreative(req.params.id, entering ? { ...req.body, approvalRequestedBy: userId(req) } : req.body)
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

// Botão "Enviar para aprovação": manda o e-mail primeiro e só então move para Revisão (e limpa o pedido de ajuste
// anterior); se o e-mail falhar, nada muda e o erro volta para a tela. Reenviar com o card já em Revisão vale.
export async function sendForApproval(req: FastifyRequest<Params>, reply: FastifyReply) {
  const found = await findCreative(req.params.id)
  if (!found) return reply.status(404).send(notFound)
  let sent: boolean
  try {
    sent = await notifyApproval({ ...found, stage: 'revisao' })
  } catch (e) {
    req.log.error(e, 'falha ao enviar e-mail de aprovação')
    return reply.status(502).send({ message: 'O Resend recusou o envio do e-mail. Veja o log do servidor.' })
  }
  if (!sent) return reply.status(503).send({ message: noResend })
  return updateCreative(found.id, { stage: 'revisao', reviewNote: null, approvalRequestedBy: userId(req) })
}

// --- Página pública de aprovação (link do e-mail) ---
const invalidLink = { message: 'Link de aprovação inválido ou expirado.' }

async function fromToken(token: string) {
  const id = readApprovalToken(token)
  return id ? findCreative(id) : undefined
}

export async function approvalShow(req: FastifyRequest<{ Params: z.infer<typeof approvalParams> }>, reply: FastifyReply) {
  const c = await fromToken(req.params.token)
  if (!c) return reply.status(404).send(invalidLink)
  const funnel = await findFunnel(c.funnelId)
  const { id, title, account, format, owner, stage, reviewNote, hasImage } = c
  return { pending: stage === 'revisao', creative: { id, title, account, format, owner, stage, reviewNote, hasImage, funnel: funnel?.name ?? null } }
}

export async function approvalImage(req: FastifyRequest<{ Params: z.infer<typeof approvalParams> }>, reply: FastifyReply) {
  const id = readApprovalToken(req.params.token)
  const found = id && (await findCreativeImage(id))
  if (!found) return reply.status(404).send({ message: 'Imagem não encontrada.' })
  return reply
    .header('content-type', found.imageType)
    .header('x-content-type-options', 'nosniff')
    .header('cache-control', 'private, max-age=3600')
    .send(found.image)
}

// Só decide enquanto o card está em Revisão: depois disso o link vira só consulta (não dá para decidir duas vezes).
export async function approvalDecide(
  req: FastifyRequest<{ Params: z.infer<typeof approvalParams>; Body: z.infer<typeof approvalBody> }>,
  reply: FastifyReply,
) {
  const c = await fromToken(req.params.token)
  if (!c) return reply.status(404).send(invalidLink)
  if (c.stage !== 'revisao') return reply.status(409).send({ message: 'Este criativo já saiu de Revisão: a decisão já foi tomada.' })
  const body = req.body
  await updateCreative(c.id, body.decision === 'aprovar' ? { stage: 'aprovado', reviewNote: null } : { stage: 'producao', reviewNote: body.note })
  if (body.decision === 'aprovar') {
    await recordApproval(c.id) // vira aviso com som para quem estiver na plataforma
    notifyApproved(req, c, req.params.token)
  }
  return approvalShow(req, reply)
}

// E-mail de "aprovado" para quem mandou para aprovação. Fora do caminho da resposta, como os outros avisos.
function notifyApproved(req: FastifyRequest, c: Row, token: string) {
  requesterEmail(c.id)
    .then(async (to) => {
      if (!to) return req.log.warn({ creative: c.id }, 'aprovado sem e-mail: ninguém registrado como solicitante')
      const mail = approvedEmail({
        title: c.title,
        account: c.account,
        format: c.format,
        requester: to.name.split(' ')[0],
        imageUrl: c.hasImage ? `${apiUrl()}/approvals/${token}/image` : null,
        kanbanUrl: `${webUrl()}/kanban`,
      })
      if (!(await sendEmail({ to: to.email, ...mail }))) req.log.warn(noResend)
    })
    .catch((e) => req.log.error(e, 'falha ao enviar e-mail de aprovado'))
}

// Sino da plataforma: aprovações mais novas que "after".
export function notifications(req: FastifyRequest<{ Querystring: z.infer<typeof notificationsQuery> }>) {
  return listApprovals(req.query.after)
}
