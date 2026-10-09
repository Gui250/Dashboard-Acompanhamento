import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'

type Section = 'comercial' | 'operacional'
type Row = { section: string; key: string; dimension: string; value: number | ''; date: string }

// Cabeçalhos em português, para quem preenche -> campos da API (csv e mensagens de erro).
export const COLUMN_OF: Record<string, string> = {
  section: 'secao',
  key: 'metrica',
  dimension: 'dimensao',
  value: 'valor',
  date: 'data',
}

const INT = '#,##0'
// Métricas que cada dashboard lê, com o formato do valor e a dica de dimensão.
const SHEETS: Record<Section, { title: string; dimension: string; metrics: Record<string, { fmt: string; hint: string }> }> = {
  comercial: {
    title: 'Comercial',
    dimension: 'vendedor',
    metrics: {
      faturamento: { fmt: '"R$" #,##0.00', hint: 'Valor em reais. Card Faturamento e gráfico de evolução.' },
      vendas: { fmt: INT, hint: 'Quantidade de negócios. Informe o vendedor para o ranking Top vendedores.' },
      leads: { fmt: INT, hint: 'Oportunidades recebidas. Card Leads.' },
      taxa_conversao: { fmt: '0.0"%"', hint: 'Percentual: 18,5 = 18,5%. O card mostra a mais recente.' },
    },
  },
  operacional: {
    title: 'Operacional',
    dimension: 'dimensao',
    metrics: {
      criativos_em_esteira: { fmt: INT, hint: 'Itens na esteira. Card e gráfico Criativos em movimento.' },
      contas_ativas: { fmt: INT, hint: 'Informe a conta/lead na dimensão para a lista Contas por lead.' },
    },
  },
}
const SECTIONS = Object.keys(SHEETS) as Section[]

const EXAMPLES: Row[] = [
  { section: 'comercial', key: 'faturamento', dimension: 'Ana', value: 15400, date: '2026-10-01' },
  { section: 'comercial', key: 'vendas', dimension: 'Ana', value: 12, date: '2026-10-01' },
  { section: 'comercial', key: 'leads', dimension: '', value: 85, date: '2026-10-01' },
  { section: 'comercial', key: 'taxa_conversao', dimension: '', value: 18.5, date: '2026-10-01' },
  { section: 'operacional', key: 'criativos_em_esteira', dimension: 'Cliente X', value: 7, date: '2026-10-01' },
  { section: 'operacional', key: 'contas_ativas', dimension: 'Cliente X', value: 1, date: '2026-10-01' },
]

function toIsoDate(v: unknown) {
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v) // célula de data do Excel (número serial)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(v ?? '').trim()
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return br ? `${br[3]}-${br[2]}-${br[1]}` : s
}

// xlsx: lê as abas Comercial e Operacional (a seção vem do nome da aba; no comercial a dimensão é "vendedor").
// Fora delas, só a 1ª aba, com a coluna secao (modelo antigo e csv; string = texto CSV, separador , ou ;).
// Retorna objetos crus no formato da API, com a aba e a linha de origem; a validação fica com o zod.
export function parseMetricsSheet(input: Buffer | string) {
  const wb = XLSX.read(input, { type: typeof input === 'string' ? 'string' : 'buffer', raw: true })
  return wb.SheetNames.flatMap((name, i) => {
    const sheetSection = SECTIONS.find((s) => s === name.trim().toLowerCase())
    if (!sheetSection && i > 0) return [] // instruções e outras abas
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' })
    return rows.map((row) => {
      const r = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]))
      const text = (v: unknown) => String(v ?? '').trim()
      const value = typeof r.valor === 'number' ? r.valor : text(r.valor).replace(',', '.')
      return {
        sheet: sheetSection && name,
        line: (row as { __rowNum__: number }).__rowNum__ + 1,
        section: text(r.secao).toLowerCase() || sheetSection || '',
        key: text(r.metrica),
        dimension: text(r.dimensao) || text(r.vendedor) || null,
        value: value === '' ? NaN : Number(value),
        date: toIsoDate(r.data),
      }
    })
  })
}

export type TemplatePrefill = { section?: string; keys?: string[]; dimensions?: string[]; date?: string }

// Sem keys = linhas de exemplo. Com keys = uma linha por métrica × dimensão, com o valor em branco para preencher.
export function templateRows({ section, keys, dimensions, date }: TemplatePrefill): Row[] {
  if (!keys?.length) return EXAMPLES
  const dims = dimensions?.length ? dimensions : ['']
  return keys.flatMap((key) => dims.map((dimension) => ({ section: section ?? '', key, dimension, value: '' as const, date: date ?? '' })))
}

const FONT = { name: 'Arial', size: 10 }
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })
const HEADER = { font: { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } }, fill: fill('FF171717') }
const INPUT = fill('FFFFF8E1') // amarelo claro: célula para preencher
const LAST_ROW = 1000 // alcance da lista suspensa e dos formatos

function addSectionSheet(wb: ExcelJS.Workbook, section: Section, rows: Row[]) {
  const { title, dimension, metrics } = SHEETS[section]
  const ws = wb.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'metrica', key: 'key', width: 24 },
    { header: dimension, key: 'dimension', width: 24 },
    { header: 'valor', key: 'value', width: 16 },
    { header: 'data', key: 'date', width: 14, style: { numFmt: 'dd/mm/yyyy', font: FONT } },
  ]
  ws.getRow(1).eachCell((c) => Object.assign(c, HEADER))
  ws.getRow(1).height = 20
  ws.autoFilter = 'A1:D1'

  for (const r of rows) {
    const row = ws.addRow({ key: r.key, dimension: r.dimension, value: r.value, date: r.date ? new Date(r.date) : '' })
    row.font = FONT
    const value = row.getCell('value')
    value.numFmt = metrics[r.key]?.fmt ?? '#,##0.##'
    value.fill = INPUT
  }

  // Lista suspensa só com as métricas que o dashboard da aba lê (ainda aceita digitar outra, com aviso).
  const list = `"${Object.keys(metrics).join(',')}"`
  for (let i = 2; i <= LAST_ROW; i++) {
    ws.getCell(`A${i}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [list], showErrorMessage: true, errorStyle: 'warning',
      errorTitle: 'Métrica fora do dashboard', error: `O dashboard ${title} lê: ${Object.keys(metrics).join(', ')}.`,
    }
    ws.getCell(`C${i}`).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [-1e15], showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Digite só o número.' }
  }
}

function addInstructions(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Instruções')
  ws.columns = [{ width: 16 }, { width: 24 }, { width: 14 }, { width: 80 }]
  const header = (values: string[]) => ws.addRow(values).eachCell((c) => Object.assign(c, HEADER))
  const title = ws.addRow(['Como preencher'])
  title.font = { ...FONT, bold: true, size: 14 }
  ws.addRow(['Preencha uma linha por lançamento nas abas Comercial e Operacional. Células amarelas = valor a preencher. Apague as linhas de exemplo antes de importar.']).font = FONT
  ws.addRow([])
  header(['aba', 'coluna', 'obrigatória', 'como preencher'])
  ws.addRow(['Comercial', 'vendedor', 'não', 'nome do vendedor (usado no ranking Top vendedores)'])
  ws.addRow(['Operacional', 'dimensao', 'não', 'conta, lead ou responsável (usado na lista Contas por lead)'])
  ws.addRow(['as duas', 'metrica', 'sim', 'escolha na lista suspensa'])
  ws.addRow(['as duas', 'valor', 'sim', 'só o número: sem R$ ou %; vírgula ou ponto para decimais'])
  ws.addRow(['as duas', 'data', 'sim', 'DD/MM/AAAA'])
  ws.addRow([])
  header(['aba', 'metrica', 'formato', 'onde aparece'])
  for (const section of SECTIONS) {
    for (const [key, { fmt, hint }] of Object.entries(SHEETS[section].metrics)) {
      ws.addRow([SHEETS[section].title, key, fmt === INT ? 'inteiro' : fmt.includes('R$') ? 'R$' : '%', hint])
    }
  }
  ws.eachRow((row, i) => { if (i > 3) row.eachCell((c) => { c.font ??= FONT; c.alignment = { wrapText: true, vertical: 'top' } }) })
}

export async function metricsTemplate(format: 'xlsx' | 'csv', rows = EXAMPLES): Promise<Buffer> {
  if (format === 'csv') {
    const sheet = XLSX.utils.aoa_to_sheet([Object.values(COLUMN_OF), ...rows.map((r) => [r.section, r.key, r.dimension, r.value, r.date])])
    return Buffer.from('﻿' + XLSX.utils.sheet_to_csv(sheet, { FS: ';' }), 'utf8')
  }
  const wb = new ExcelJS.Workbook()
  for (const section of SECTIONS) addSectionSheet(wb, section, rows.filter((r) => r.section === section))
  addInstructions(wb)
  return Buffer.from(await wb.xlsx.writeBuffer())
}
