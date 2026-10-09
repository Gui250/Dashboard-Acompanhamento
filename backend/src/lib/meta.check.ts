import assert from 'node:assert/strict'
import { toAccount, toAd, toTotals } from './meta.js'

const a1 = { id: 'act_1', account_id: '1', name: 'A', account_status: 1, currency: 'BRL' }
const a2 = { id: 'act_2', account_id: '2', name: 'B', account_status: 2, currency: 'BRL' }
const row = {
  spend: '100.50',
  impressions: '10000',
  clicks: '200',
  reach: '8000',
  actions: [
    { action_type: 'lead', value: '7' },
    { action_type: 'purchase', value: '3' },
    { action_type: 'link_click', value: '99' },
  ],
}
const x = toAccount(a1, row)
const y = toAccount(a2) // sem dados
assert.equal(x.spend, 100.5)
assert.equal(x.leads, 7)
assert.equal(x.purchases, 3)
assert.equal(x.status, 'ativa')
assert.equal(x.ctr, 2)
assert.equal(x.cpm, 10.05)
assert.equal(y.status, 'desativada')
assert.deepEqual([y.spend, y.ctr, y.cpc, y.cpm, y.leads], [0, 0, 0, 0, 0])
const t = toTotals([x, y])
assert.equal(t.spend, 100.5)
assert.equal(t.ctr, 2)
assert.equal(t.cpc, 100.5 / 200)
console.log('meta.check ok')

const ad = toAd({ id: '9', name: 'Ad', effective_status: 'ACTIVE', campaign: { name: 'C' }, creative: { id: '5', thumbnail_url: 't', object_type: 'VIDEO' } })
assert.deepEqual([ad.campaign, ad.adset, ad.imageUrl, ad.type, ad.title], ['C', null, 't', 'VIDEO', null])
assert.equal(toAd({ id: '1', name: 'x', effective_status: 'ACTIVE', creative: { id: '2', image_url: 'i', thumbnail_url: 't' } }).imageUrl, 'i')
