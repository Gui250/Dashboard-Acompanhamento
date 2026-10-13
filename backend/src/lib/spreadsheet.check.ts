import assert from 'node:assert/strict'
import { metricsTemplate, parseMetricsSheet, templateRows } from './spreadsheet.js'

// O modelo formatado (bordas e amarelo em linhas vazias) tem que importar só as linhas preenchidas.
const examples = parseMetricsSheet(await metricsTemplate('xlsx'))
assert.equal(examples.length, 6)
assert.deepEqual(examples[0], { sheet: 'Comercial', line: 2, section: 'comercial', key: 'faturamento', dimension: 'Ana', value: 15400, date: '2026-10-01' })

const prefill = parseMetricsSheet(await metricsTemplate('xlsx', templateRows({ section: 'comercial', keys: ['vendas'], dimensions: ['Ana', 'Bia'], date: '2026-10-01' })))
assert.deepEqual(prefill.map((r) => r.dimension), ['Ana', 'Bia'])
console.log('spreadsheet.check ok')
