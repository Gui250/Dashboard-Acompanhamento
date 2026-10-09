import { createHmac, timingSafeEqual } from 'node:crypto'
import { escapeHtml } from './email.js'

// Link de aprovação = "id.expira.assinatura". Segredo próprio (derivado do JWT_SECRET com outro rótulo):
// o token só abre a aprovação deste criativo, nunca vale como login na API.
const TTL = 7 * 86_400_000
const sign = (id: number, exp: string) =>
  createHmac('sha256', process.env.JWT_SECRET!).update(`creative-approval:${id}:${exp}`).digest('base64url')

export function approvalToken(id: number, now = Date.now()) {
  const exp = String(now + TTL)
  return `${id}.${exp}.${sign(id, exp)}`
}

// id do criativo, ou null se adulterado/expirado.
export function readApprovalToken(token: string, now = Date.now()) {
  const [rawId = '', exp = '', sig = ''] = token.split('.')
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0 || !(Number(exp) > now)) return null
  const expected = Buffer.from(sign(id, exp))
  const given = Buffer.from(sig)
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null
}

export type ApprovalEmail = {
  title: string
  account: string
  format: string
  owner: string
  funnel: string | null
  imageUrl: string | null
  reviewUrl: string // página de aprovação; ?decision= pré-seleciona o botão
}

const RED = '#e50915'
const button = (href: string, label: string, bg: string, fg: string, border: string) =>
  `<a href="${href}" style="display:inline-block;padding:14px 26px;border-radius:8px;background:${bg};color:${fg};border:1px solid ${border};font-weight:700;font-size:14px;text-decoration:none">${label}</a>`

// HTML de e-mail: tabelas e estilos inline (Gmail/Outlook ignoram <style> e flex). Texto puro vai junto.
export function approvalEmail(c: ApprovalEmail) {
  const e = escapeHtml
  const approve = `${c.reviewUrl}?decision=aprovar`
  const changes = `${c.reviewUrl}?decision=ajustes`
  const details: [string, string][] = [
    ['Funil', c.funnel ?? '-'],
    ['Conta', c.account],
    ['Formato', c.format],
    ['Responsável', c.owner],
  ]
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Criativo para aprovar</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#171717">
<span style="display:none;max-height:0;overflow:hidden">${e(c.title)} está aguardando a sua aprovação.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#171717;padding:20px 28px;color:#ffffff;font-size:13px;letter-spacing:2px;font-weight:700">V4 DASHBOARD <span style="color:${RED}">·</span> APROVAÇÃO DE CRIATIVO</td></tr>
  <tr><td style="padding:28px 28px 8px">
    <p style="margin:0 0 6px;color:${RED};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Aguardando sua aprovação</p>
    <h1 style="margin:0;font-size:24px;line-height:1.25">${e(c.title)}</h1>
  </td></tr>
  ${c.imageUrl ? `<tr><td style="padding:16px 28px"><img src="${c.imageUrl}" alt="${e(c.title)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border-radius:8px;border:1px solid #e4e4e7"></td></tr>` : ''}
  <tr><td style="padding:8px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
      ${details.map(([k, v]) => `<tr><td style="padding:8px 0;color:#71717a;width:130px;border-bottom:1px solid #f4f4f5">${k}</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #f4f4f5">${e(v)}</td></tr>`).join('')}
    </table>
  </td></tr>
  <tr><td align="center" style="padding:28px">
    ${button(approve, 'Aprovar criativo', RED, '#ffffff', RED)}
    <span style="display:inline-block;width:10px"></span>
    ${button(changes, 'Pedir ajustes', '#ffffff', '#171717', '#d4d4d8')}
  </td></tr>
  <tr><td style="padding:0 28px 28px;color:#71717a;font-size:12px;line-height:1.5">
    Os botões abrem a página de aprovação, onde você confirma a decisão. O link vale por 7 dias e deixa de funcionar quando o criativo sai de Revisão.
  </td></tr>
</table>
</td></tr></table>
</body></html>`
  const text = [
    `Criativo aguardando sua aprovação: ${c.title}`,
    ...details.map(([k, v]) => `${k}: ${v}`),
    '',
    `Aprovar: ${approve}`,
    `Pedir ajustes: ${changes}`,
  ].join('\n')
  return { subject: `Aprovar criativo: ${c.title}`, html, text }
}

// Aviso para quem pediu a aprovação: mesmo visual do pedido, com um carimbo verde e o link para o kanban.
export function approvedEmail(c: { title: string; account: string; format: string; imageUrl: string | null; kanbanUrl: string; requester: string }) {
  const e = escapeHtml
  const GREEN = '#0f7a54'
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Criativo aprovado</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#171717">
<span style="display:none;max-height:0;overflow:hidden">A Flávia aprovou ${e(c.title)}.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#171717;padding:20px 28px;color:#ffffff;font-size:13px;letter-spacing:2px;font-weight:700">V4 DASHBOARD <span style="color:${RED}">·</span> APROVAÇÃO DE CRIATIVO</td></tr>
  <tr><td style="padding:28px 28px 8px">
    <span style="display:inline-block;padding:6px 12px;border:2px solid ${GREEN};border-radius:6px;color:${GREEN};font-size:13px;font-weight:800;letter-spacing:1px">APROVADO</span>
    <h1 style="margin:14px 0 6px;font-size:24px;line-height:1.25">${e(c.title)}</h1>
    <p style="margin:0;color:#52525b;font-size:15px;line-height:1.5">Oi, ${e(c.requester)}. A Flávia aprovou este criativo e ele já está na coluna Aprovado do kanban.</p>
  </td></tr>
  ${c.imageUrl ? `<tr><td style="padding:16px 28px"><img src="${c.imageUrl}" alt="${e(c.title)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border-radius:8px;border:1px solid #e4e4e7"></td></tr>` : ''}
  <tr><td style="padding:4px 28px 0;color:#71717a;font-size:14px">${e(c.account)}, ${e(c.format)}</td></tr>
  <tr><td align="center" style="padding:28px">${button(c.kanbanUrl, 'Abrir o kanban', '#171717', '#ffffff', '#171717')}</td></tr>
</table>
</td></tr></table>
</body></html>`
  const text = `A Flávia aprovou o criativo "${c.title}" (${c.account}, ${c.format}). Ele já está em Aprovado no kanban: ${c.kanbanUrl}`
  return { subject: `Criativo aprovado: ${c.title}`, html, text }
}
