import assert from 'node:assert/strict'
import { summarize, type Opportunity } from './wesales.js'

const pipelines = [{ id: 'p', name: 'Vendas', stages: [{ id: 's1', name: 'Contato' }, { id: 's2', name: 'Fechado' }] }]
const users = [{ id: 'u1', name: 'Ana' }]
const opp = (o: Partial<Opportunity>): Opportunity => ({ id: 'x', pipelineId: 'p', pipelineStageId: 's1', status: 'open', createdAt: '2026-10-10T12:00:00Z', ...o })
const r = summarize(
  [
    opp({ monetaryValue: 100, assignedTo: 'u1' }),
    opp({ status: 'lost' }),
    // criada antes do período, ganha dentro dele: conta como venda, não como lead
    opp({ status: 'won', pipelineStageId: 's2', monetaryValue: 500, assignedTo: 'u1', createdAt: '2026-09-01T00:00:00Z', lastStatusChangeAt: '2026-10-15T00:00:00Z' }),
    opp({ createdAt: '2026-11-01T00:00:00Z' }), // fora do período
  ],
  pipelines,
  users,
  '2026-10-01',
  '2026-10-31',
)
assert.deepEqual(r.totals, { leads: 2, open: 1, won: 1, lost: 1, wonValue: 500, openValue: 100, conversion: 50 })
assert.deepEqual(r.pipelines[0].stages.map((s) => [s.name, s.count, s.value]), [['Contato', 2, 100], ['Fechado', 0, 0]])
assert.deepEqual(r.owners, [{ name: 'Ana', leads: 1, won: 1, wonValue: 500 }, { name: 'Sem responsável', leads: 1, won: 0, wonValue: 0 }])
assert.equal(summarize([], pipelines, users, '2026-10-01', '2026-10-31').totals.conversion, 0)
console.log('wesales.check ok')
