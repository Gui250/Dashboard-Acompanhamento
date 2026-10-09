import assert from 'node:assert/strict'
import { makeState, toAccount, toTotals, validState } from './google.js'

process.env.JWT_SECRET ??= 'segredo-de-teste'

const a1 = { id: '1', loginCustomerId: '9', name: 'A', status: 'ENABLED', currency: 'BRL' }
const a2 = { id: '2', loginCustomerId: '9', name: 'B', status: 'CANCELED', currency: 'BRL' }
const x = toAccount(a1, { costMicros: '100500000', impressions: '10000', clicks: '200', conversions: 7.5, conversionsValue: 300 })
const y = toAccount(a2) // sem dados
assert.equal(x.spend, 100.5)
assert.equal(x.conversions, 7.5)
assert.equal(x.status, 'ativa')
assert.equal(x.ctr, 2)
assert.equal(x.cpm, 10.05)
assert.equal(y.status, 'desativada')
assert.deepEqual([y.spend, y.ctr, y.cpc, y.cpm, y.conversions], [0, 0, 0, 0, 0])
const t = toTotals([x, y])
assert.equal(t.spend, 100.5)
assert.equal(t.cpc, 100.5 / 200)

const now = Date.now()
const state = makeState(now)
assert.ok(validState(state, now))
assert.ok(!validState(state, now + 11 * 60_000)) // expirado
assert.ok(!validState(state.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), now)) // assinatura adulterada
assert.ok(!validState(`${now + 999_999}.${state.split('.')[1]}`, now)) // validade esticada
assert.ok(!validState('lixo', now))
assert.ok(!validState(`${state.split('.')[0]}.${'é'.repeat(43)}`, now)) // multibyte não derruba o timingSafeEqual
console.log('google.check ok')
