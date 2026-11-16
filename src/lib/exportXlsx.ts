import ExcelJS from 'exceljs'
import { AppState, SHEET_NAMES } from '../types'
import { buildModel, hasAeo, hasGeo } from './model'
import { todayIso } from './util'

type Cell = string | number | Date | null | undefined

/** Fill the original workbook template. Sheets, headers, dropdowns, formulas and colours stay as they are. */
export async function buildWorkbook(s: AppState, template: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(template as ArrayBuffer)
  const m = buildModel(s)

  const clearExample = (ws: ExcelJS.Worksheet, cols: number) => {
    for (let c = 1; c <= cols; c++) {
      const cell = ws.getRow(2).getCell(c)
      const below = ws.getRow(3).getCell(c)
      cell.style = JSON.parse(JSON.stringify(below.style ?? {}))
      const v = cell.value as unknown
      const isFormula = v && typeof v === 'object' && 'formula' in (v as object)
      if (!isFormula) cell.value = null
    }
  }
  const put = (ws: ExcelJS.Worksheet, row: number, vals: Cell[], dateCols: number[] = []) => {
    vals.forEach((v, i) => {
      if (v === null || v === undefined || v === '') return
      const cell = ws.getRow(row).getCell(i + 1)
      cell.value = v as ExcelJS.CellValue
      if (dateCols.includes(i + 1)) cell.numFmt = 'yyyy-mm-dd'
    })
  }
  const sheet = (name: string) => {
    const ws = wb.getWorksheet(name)
    if (!ws) throw new Error(`The template has no sheet called "${name}".`)
    return ws
  }
  const toDate = (iso: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(iso.slice(0, 10) + 'T00:00:00Z') : new Date(todayIso() + 'T00:00:00Z'))

  // Findings Log
  let ws = sheet('Findings Log'); clearExample(ws, 12)
  const found = toDate(s.psi.date || s.sf?.crawledAt || todayIso())
  m.findings.forEach((f, i) => put(ws, i + 2, [i + 1, found, f.area, f.issue, f.url, f.evidence + ' (add file link)', f.why, f.fix, f.priority, 'Owner to assign', 'Open'], [2]))

  // Page Review
  ws = sheet('Page Review'); clearExample(ws, 14)
  m.pages.forEach((p, i) => put(ws, i + 2, [p.url, p.purpose, p.keyword, p.title, null, p.meta || 'None', p.h1 || 'No H1 found', p.words, null, p.inlinks, null, null, p.action, 'Open']))

  // Keywords
  ws = sheet('Keywords'); clearExample(ws, 8)
  m.keywords.forEach((k, i) => {
    const hit = k.impressions !== undefined
    const pending = s.gsc ? 'Not in export' : 'Pending'
    put(ws, i + 2, [k.keyword, k.intent, hit ? k.impressions : pending, hit ? k.clicks : pending, hit ? Math.round(k.position! * 10) / 10 : pending, k.target, k.priority,
      s.gsc ? `Search Console export ${s.gsc.start} to ${s.gsc.end}. Intent, priority and target page entered by the user.` : 'Search Console data pending. Intent, priority and target page entered by the user.'])
  })

  // Competitors
  ws = sheet('Competitors'); clearExample(ws, 6)
  s.competitors.forEach((c, i) => put(ws, i + 2, [c.name, c.website, c.keyword, c.good, c.gap, c.notes]))

  // Questions
  ws = sheet('Questions'); clearExample(ws, 7)
  if (hasAeo(s)) s.questions.forEach((q, i) => put(ws, i + 2, [q.question, q.source, q.target, q.answered ? 'Yes' : 'No', null, null, q.answered ? 'Done' : 'Open']))

  // AI Check
  ws = sheet('AI Check'); clearExample(ws, 8)
  if (hasGeo(s) && s.ai) s.ai.forEach((r, i) => put(ws, i + 2, [toDate(r.date), r.question, r.tool, r.run, r.named ? 'Yes' : 'No', r.source === null ? null : r.source ? 'Yes' : 'No', r.competitors, null], [1]))

  // Monthly Tracker
  ws = sheet('Monthly Tracker'); clearExample(ws, 11)
  const k = (label: string) => m.kpis.find((x) => x.label.startsWith(label))
  const val = (label: string, numeric?: number) => (numeric !== undefined ? numeric : k(label)!.value)
  put(ws, 2, [
    s.project.month,
    m.organic !== undefined ? m.organic : s.ga4?.empty ? 'Not tracked' : 'Pending',
    m.enquiriesNum !== undefined ? m.enquiriesNum : 'Not available',
    m.gscOk ? s.gsc!.clicks : 'Pending',
    m.gscOk ? s.gsc!.impressions : 'Pending',
    m.gscOk ? Math.round(s.gsc!.position * 10) / 10 : 'Pending',
    m.p.mobileScore !== undefined ? Math.round(m.p.mobileScore) : 'Pending',
    s.indexedPages.trim() && Number.isFinite(parseFloat(s.indexedPages)) ? parseFloat(s.indexedPages) : 'Pending',
    hasGeo(s) ? (m.ai ? m.ai.named : 'Pending') : null,
    hasAeo(s) ? m.answered : null,
    m.notes,
  ])
  void val

  // Optional: leave out sheets the user does not want. The Read Me counts use formulas that point at the
  // other sheets, so if any other sheet is left out, Read Me goes too (otherwise it would show #REF!).
  const want: Record<string, boolean> = { ...s.cfg.sheets }
  if (SHEET_NAMES.some((n) => n !== 'Read Me' && want[n] === false)) want['Read Me'] = false
  const keepCount = SHEET_NAMES.filter((n) => want[n] !== false).length
  if (keepCount > 0) for (const n of SHEET_NAMES) if (want[n] === false) wb.removeWorksheet(sheet(n).id)

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
