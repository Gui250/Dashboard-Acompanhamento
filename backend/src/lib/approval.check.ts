import assert from 'node:assert/strict'
process.env.JWT_SECRET ??= 'teste'
const { approvalEmail, approvalToken, readApprovalToken } = await import('./approval.js')

const now = 1_700_000_000_000
const t = approvalToken(42, now)
assert.equal(readApprovalToken(t, now), 42)
assert.equal(readApprovalToken(t, now + 8 * 86_400_000), null) // expirado
assert.equal(readApprovalToken(t.replace(/^42\./, '43.'), now), null) // outro criativo, mesma assinatura
assert.equal(readApprovalToken('lixo', now), null)

const mail = approvalEmail({ title: '<b>Promo</b>', account: 'A', format: 'Reels', owner: 'Bia', funnel: null, imageUrl: null, reviewUrl: 'https://x/aprovacao/t' })
assert.ok(mail.html.includes('&lt;b&gt;Promo&lt;/b&gt;') && !mail.html.includes('<b>Promo'))
assert.ok(mail.text.includes('https://x/aprovacao/t?decision=aprovar'))
console.log('approval.check ok')
