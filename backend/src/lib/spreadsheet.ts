import * as XLSX from 'xlsx'

// Cabeçalhos em português, para quem preenche -> campos da API.
export const COLUMN_OF: Record<string, string> = {
  section: 'secao',
  key: 'metrica',
  dimension: 'dimensao',
  value: 'valor',
  date: 'data',
}
const HEADERS = Object.values(COLUMN_OF)

const EXAMPLES = [
  ['comercial', 'vendas', 'Ana', 12, '2026-10-01'],
  ['comercial', 'taxa_conversao', '', 18.5, '2026-10-01'],
  ['operacional', 'criativos_em_esteira', 'Cliente X', 7, '2026-10-01'],
]

const INSTRUCTIONS = [
  ['coluna', 'obrigatória', 'como preencher'],
  ['secao', 'sim', 'comercial ou operacional'],
  ['metrica', 'sim', 'nome da métrica, ex: vendas, faturamento, leads, taxa_conversao, criativos_em_esteira, contas_ativas'],
  ['dimensao', 'não', 'quem/o quê a métrica detalha, ex: nome do vendedor ou da conta'],
  ['valor', 'sim', 'número; use ponto ou vírgula para decimais'],
  ['data', 'sim', 'AAAA-MM-DD ou DD/MM/AAAA'],
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

// Lê a primeira aba (xlsx) ou o csv (separador , ou ; detectado automaticamente).
// Retorna objetos crus no formato da API; a validação fica com o zod.
export function parseMetricsSheet(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: true })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  return rows.map((row) => {
    const r = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]))
    const text = (v: unknown) => String(v ?? '').trim()
    const value = typeof r.valor === 'number' ? r.valor : text(r.valor).replace(',', '.')
    return {
      section: text(r.secao).toLowerCase(),
      key: text(r.metrica),
      dimension: text(r.dimensao) || null,
      value: value === '' ? NaN : Number(value),
      date: toIsoDate(r.data),
    }
  })
}

export function metricsTemplate(format: 'xlsx' | 'csv'): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...EXAMPLES])
  if (format === 'csv') return Buffer.from('﻿' + XLSX.utils.sheet_to_csv(sheet, { FS: ';' }), 'utf8')
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'metricas')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(INSTRUCTIONS), 'instrucoes')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
