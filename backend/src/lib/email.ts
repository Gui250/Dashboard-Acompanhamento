// Envio pela API HTTP do Resend (resend.com/docs/api-reference/emails/send-email).
// RESEND_FROM precisa ser de um domínio verificado no Resend. Sem as duas envs, não envia (retorna false).
export async function sendEmail(email: { to: string; subject: string; html: string; text?: string }) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!key || !from) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, ...email }),
  })
  if (!res.ok) throw new Error(`Resend respondeu ${res.status}: ${await res.text()}`)
  return true
}

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c])
