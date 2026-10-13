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
const DARK = 'FF171717'
const RED = 'FFE50915' // vermelho V4, o mesmo dos e-mails
const MUTED = 'FF71717A'
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })
const line = (argb: string) => ({ style: 'thin' as const, color: { argb } })
const GRID = { top: line('FFE4E4E7'), bottom: line('FFE4E4E7'), left: line('FFE4E4E7'), right: line('FFE4E4E7') }
const HEADER = {
  font: { ...FONT, bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
  fill: fill(DARK),
  alignment: { vertical: 'middle' as const, horizontal: 'left' as const, indent: 1 },
  border: { bottom: { style: 'medium' as const, color: { argb: RED } } },
}
const INPUT = fill('FFFFF8E1') // amarelo claro: célula para preencher
const EXAMPLE_FONT = { ...FONT, italic: true, color: { argb: MUTED } } // linhas de exemplo: apagar antes de importar
const LAST_ROW = 1000 // alcance da lista suspensa e das validações
const GRID_ROWS = 200 // linhas já desenhadas (bordas e amarelo) para preencher
const PAGE = { orientation: 'landscape' as const, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

function addSectionSheet(wb: ExcelJS.Workbook, section: Section, rows: Row[], example: boolean) {
  const { title, dimension, metrics } = SHEETS[section]
  const ws = wb.addWorksheet(title, {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    properties: { tabColor: { argb: section === 'comercial' ? RED : DARK } },
    pageSetup: PAGE,
  })
  // Cabeçalho na linha 1 e com estes nomes: é o que a importação lê.
  ws.columns = [
    { header: 'metrica', key: 'key', width: 26 },
    { header: dimension, key: 'dimension', width: 26 },
    { header: 'valor', key: 'value', width: 18 },
    { header: 'data', key: 'date', width: 14 },
  ]
  ws.getRow(1).height = 26
  ws.getRow(1).eachCell((c) => Object.assign(c, HEADER))
  ws.autoFilter = 'A1:D1'
  const notes: Record<string, string> = {
    A1: `Escolha na lista: ${Object.keys(metrics).join(', ')}.`,
    B1: section === 'comercial' ? 'Opcional. Nome do vendedor, para o ranking Top vendedores.' : 'Opcional. Conta, lead ou responsável, para a lista Contas por lead.',
    C1: 'Só o número: sem R$ ou %. Vírgula ou ponto para decimais.',
    D1: 'Data do lançamento, DD/MM/AAAA.',
  }
  for (const [ref, note] of Object.entries(notes)) ws.getCell(ref).note = note

  for (const r of rows) ws.addRow({ key: r.key, dimension: r.dimension, value: r.value, date: r.date ? new Date(r.date) : '' })
  for (let i = 2; i <= Math.max(GRID_ROWS, rows.length + 1); i++) {
    const row = ws.getRow(i)
    row.height = 18
    const r = rows[i - 2]
    for (const col of [1, 2, 3, 4]) {
      const c = row.getCell(col)
      c.font = r && example ? EXAMPLE_FONT : FONT
      c.border = GRID
      c.alignment = { vertical: 'middle', indent: 1, horizontal: col >= 3 ? 'right' : 'left' }
    }
    const value = row.getCell(3)
    value.numFmt = (r && metrics[r.key]?.fmt) || 'General'
    value.fill = INPUT
    row.getCell(4).numFmt = 'dd/mm/yyyy'
  }

  // Lista suspensa só com as métricas que o dashboard da aba lê (ainda aceita digitar outra, com aviso).
  const list = `"${Object.keys(metrics).join(',')}"`
  for (let i = 2; i <= LAST_ROW; i++) {
    ws.getCell(`A${i}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [list], showErrorMessage: true, errorStyle: 'warning',
      errorTitle: 'Métrica fora do dashboard', error: `O dashboard ${title} lê: ${Object.keys(metrics).join(', ')}.`,
    }
    ws.getCell(`C${i}`).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [-1e15], showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Digite só o número.' }
    ws.getCell(`D${i}`).dataValidation = {
      type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date('2000-01-01')], showErrorMessage: true, errorStyle: 'warning',
      errorTitle: 'Data inválida', error: 'Use DD/MM/AAAA.',
    }
  }
}

function addInstructions(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Instruções', { views: [{ showGridLines: false }], properties: { tabColor: { argb: MUTED } }, pageSetup: PAGE })
  ws.columns = [{ width: 16 }, { width: 24 }, { width: 14 }, { width: 72 }]
  const merged = (text: string, font: Partial<ExcelJS.Font>, height: number, bg?: string) => {
    const row = ws.addRow([text])
    ws.mergeCells(row.number, 1, row.number, 4)
    const c = row.getCell(1)
    c.font = { ...FONT, ...font }
    c.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
    if (bg) c.fill = fill(bg)
    row.height = height
  }
  const heading = (text: string) => { ws.addRow([]); merged(text, { bold: true, size: 12, color: { argb: RED } }, 22) }
  const table = (head: string[], body: string[][]) => {
    ws.addRow(head).eachCell((c) => Object.assign(c, HEADER))
    ws.lastRow!.height = 22
    body.forEach((values, i) => {
      const row = ws.addRow(values)
      for (const col of [1, 2, 3, 4]) {
        const c = row.getCell(col)
        c.font = col === 2 ? { ...FONT, bold: true } : FONT
        c.border = GRID
        c.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
        if (i % 2) c.fill = fill('FFFAFAFA')
      }
      row.height = 20
    })
  }

  merged('Modelo de importação de métricas', { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }, 34, DARK)
  merged('V4 Dashboard · preencha as abas Comercial e Operacional e importe o arquivo em Importar planilha.', { color: { argb: MUTED } }, 20)

  heading('Passo a passo')
  ;[
    'Apague as linhas de exemplo (texto cinza em itálico), se houver.',
    'Preencha uma linha por lançamento. As células amarelas são o valor a preencher.',
    'Escolha a métrica na lista suspensa e digite a data como DD/MM/AAAA.',
    'Não renomeie as abas nem os cabeçalhos da linha 1: é por eles que a importação lê o arquivo.',
    'Salve e envie o arquivo em Importar planilha, no dashboard.',
  ].forEach((step, i) => {
    const row = ws.addRow([String(i + 1), step])
    ws.mergeCells(row.number, 2, row.number, 4)
    row.getCell(1).font = { ...FONT, bold: true, color: { argb: RED } }
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).font = FONT
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true }
    row.height = 20
  })

  heading('Colunas')
  table(['aba', 'coluna', 'obrigatória', 'como preencher'], [
    ['Comercial', 'vendedor', 'não', 'nome do vendedor (usado no ranking Top vendedores)'],
    ['Operacional', 'dimensao', 'não', 'conta, lead ou responsável (usado na lista Contas por lead)'],
    ['as duas', 'metrica', 'sim', 'escolha na lista suspensa'],
    ['as duas', 'valor', 'sim', 'só o número: sem R$ ou %; vírgula ou ponto para decimais'],
    ['as duas', 'data', 'sim', 'DD/MM/AAAA'],
  ])

  heading('Métricas')
  table(['aba', 'metrica', 'formato', 'onde aparece'], SECTIONS.flatMap((section) =>
    Object.entries(SHEETS[section].metrics).map(([key, { fmt, hint }]) =>
      [SHEETS[section].title, key, fmt === INT ? 'inteiro' : fmt.includes('R$') ? 'R$' : '%', hint])))
}

export async function metricsTemplate(format: 'xlsx' | 'csv', rows = EXAMPLES): Promise<Buffer> {
  if (format === 'csv') {
    const sheet = XLSX.utils.aoa_to_sheet([Object.values(COLUMN_OF), ...rows.map((r) => [r.section, r.key, r.dimension, r.value, r.date])])
    return Buffer.from('﻿' + XLSX.utils.sheet_to_csv(sheet, { FS: ';' }), 'utf8')
  }
  const wb = new ExcelJS.Workbook()
  for (const section of SECTIONS) addSectionSheet(wb, section, rows.filter((r) => r.section === section), rows === EXAMPLES)
  addInstructions(wb)
  return Buffer.from(await wb.xlsx.writeBuffer())
}
