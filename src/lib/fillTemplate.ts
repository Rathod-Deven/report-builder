import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import ExcelJS from 'exceljs'
import { Lists, Scalars, knownToken } from './placeholders'

export type TemplateKind = 'docx' | 'xlsx' | 'pptx'
export const kindOf = (name: string): TemplateKind | null => {
  const e = name.toLowerCase().split('.').pop()
  return e === 'docx' || e === 'xlsx' || e === 'pptx' ? e : null
}

const TOKEN = /\{\{\s*([#\w.:]+)\s*\}\}/g
const LOOP = /\{\{\s*#(\w+)(?::(\d+))?\s*\}\}/

type El = Element
const kids = (n: Node): Node[] => { const out: Node[] = []; for (let c = n.firstChild; c; c = c.nextSibling) out.push(c); return out }
const desc = (n: unknown, local: string): El[] => {
  const out: El[] = []
  const walk = (x: Node) => { for (const c of kids(x)) if (c.nodeType === 1) { if ((c as El).localName === local) out.push(c as El); walk(c) } }
  walk(n as unknown as Node)
  return out
}
const textOf = (n: Node): string => desc(n, 't').map((t) => t.textContent ?? '').join('')
const setNodeText = (el: El, text: string) => {
  while (el.firstChild) el.removeChild(el.firstChild)
  el.appendChild(el.ownerDocument.createTextNode(text))
  el.setAttribute('xml:space', 'preserve')
}

type Resolve = (tok: string) => string | undefined

/** Replace placeholders inside one paragraph. A placeholder can be split across several runs by Word, so we work on the joined text. */
function processParagraph(p: El, resolve: Resolve) {
  const nodes = desc(p, 't')
  if (!nodes.length) return
  const full = nodes.map((t) => t.textContent ?? '').join('')
  if (!full.includes('{{')) return
  const out = full.replace(TOKEN, (m, tok) => resolve(tok) ?? m)
  if (out === full) return
  const write = (para: El, text: string) => { const ns = desc(para, 't'); setNodeText(ns[0], text); for (const n of ns.slice(1)) setNodeText(n, '') }
  if (out.includes('\n')) {
    const single = /^\s*\{\{\s*[#\w.:]+\s*\}\}\s*$/.test(full)
    if (single) {
      const lines = out.split('\n')
      write(p, lines[0])
      let prev: El = p
      for (const line of lines.slice(1)) { const c = p.cloneNode(true) as El; write(c, line); prev.parentNode!.insertBefore(c, prev.nextSibling); prev = c }
      return
    }
    write(p, out.replace(/\n+/g, '; '))
    return
  }
  write(p, out)
}

function processXml(xml: string, data: { scalars: Scalars; lists: Lists }): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const scalarResolve: Resolve = (tok) => (tok in data.scalars ? data.scalars[tok] : undefined)

  // 1. table rows that repeat: any row containing {{#list}}
  const rows = desc(doc, 'tr').filter((r) => LOOP.test(textOf(r)))
  for (const row of rows) {
    const mm = LOOP.exec(textOf(row))!
    const name = mm[1]
    const items = (data.lists[name] ?? []).slice(0, mm[2] ? parseInt(mm[2]) : undefined)
    let anchor: Node = row
    for (const item of items) {
      const c = row.cloneNode(true) as El
      const res: Resolve = (tok) => (tok.startsWith('#' + name) ? '' : tok.startsWith(name + '.') ? (item[tok.slice(name.length + 1)] ?? '') : scalarResolve(tok))
      for (const p of desc(c, 'p')) processParagraph(p, res)
      row.parentNode!.insertBefore(c, anchor.nextSibling); anchor = c
    }
    row.parentNode!.removeChild(row)
  }
  // 2. all other paragraphs
  for (const p of desc(doc, 'p')) processParagraph(p, scalarResolve)
  return new XMLSerializer().serializeToString(doc)
}

const partOk = (kind: TemplateKind, name: string) =>
  kind === 'docx' ? /^word\/(document|header\d*|footer\d*)\.xml$/.test(name) : /^ppt\/slides\/slide\d+\.xml$/.test(name)

const cellText = (v: ExcelJS.CellValue): string | null => {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && 'richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('')
  return null
}

export async function fillTemplate(buf: ArrayBuffer, kind: TemplateKind, data: { scalars: Scalars; lists: Lists }): Promise<ArrayBuffer> {
  if (kind === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    for (const ws of wb.worksheets) {
      // repeat rows, bottom first so row numbers stay valid
      const loops: { r: number; name: string; max?: number }[] = []
      ws.eachRow((row, r) => row.eachCell((c) => { const t = cellText(c.value); const m = t && LOOP.exec(t); if (m && !loops.some((l) => l.r === r)) loops.push({ r, name: m[1], max: m[2] ? parseInt(m[2]) : undefined }) }))
      for (const { r, name, max } of loops.sort((a, b) => b.r - a.r)) {
        const items = (data.lists[name] ?? []).slice(0, max)
        if (!items.length) { ws.spliceRows(r, 1); continue }
        if (items.length > 1) ws.duplicateRow(r, items.length - 1, true)
        items.forEach((item, i) => ws.getRow(r + i).eachCell((c) => {
          const t = cellText(c.value); if (t === null) return
          c.value = t.replace(TOKEN, (m, tok) => (tok.startsWith('#' + name) ? '' : tok.startsWith(name + '.') ? (item[tok.slice(name.length + 1)] ?? '') : (tok in data.scalars ? data.scalars[tok] : m)))
        }))
      }
      ws.eachRow((row) => row.eachCell((c) => {
        const t = cellText(c.value)
        if (t && t.includes('{{')) c.value = t.replace(TOKEN, (m, tok) => (tok in data.scalars ? data.scalars[tok] : m))
      }))
    }
    return (await wb.xlsx.writeBuffer()) as ArrayBuffer
  }
  const zip = await JSZip.loadAsync(buf)
  for (const name of Object.keys(zip.files)) {
    if (!partOk(kind, name)) continue
    zip.file(name, processXml(await zip.files[name].async('string'), data))
  }
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

/** List the placeholders found in a template and mark the ones this tool does not know. */
export async function scanTemplate(buf: ArrayBuffer, kind: TemplateKind): Promise<{ found: string[]; unknown: string[] }> {
  const found = new Set<string>()
  const grab = (t: string) => { for (const m of t.matchAll(TOKEN)) found.add(m[1]) }
  if (kind === 'xlsx') {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf)
    for (const ws of wb.worksheets) ws.eachRow((row) => row.eachCell((c) => { const t = cellText(c.value); if (t) grab(t) }))
  } else {
    const zip = await JSZip.loadAsync(buf)
    for (const name of Object.keys(zip.files)) {
      if (!partOk(kind, name)) continue
      const doc = new DOMParser().parseFromString(await zip.files[name].async('string'), 'text/xml')
      for (const p of desc(doc, 'p')) grab(textOf(p))
    }
  }
  const list = [...found].sort()
  return { found: list, unknown: list.filter((t) => !knownToken(t)) }
}

/** A tiny starter .docx that shows the placeholder style. */
export async function makeStarterDocx(): Promise<ArrayBuffer> {
  const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
  const p = (t: string, bold = false, size = 22) => `<w:p><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
  const cell = (t: string, bold = false) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${p(t, bold, 20)}</w:tc>`
  const row = (cells: string[], bold = false) => `<w:tr>${cells.map((c) => cell(c, bold)).join('')}</w:tr>`
  const tbl = (rows: string) => `<w:tbl><w:tblPr><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:color="BBBBBB"/>`).join('')}</w:tblBorders></w:tblPr>${rows}</w:tbl>`
  const body = [
    p('{{title}}', true, 36), p('{{company}}  |  {{website}}'), p('Reporting period: {{month_label}}'), p(''),
    p('Summary', true, 26), p('{{summary}}'), p(''),
    p('Key numbers', true, 26),
    tbl(row(['Search clicks', 'Impressions', 'Average position', 'Organic users'], true) + row(['{{clicks}}', '{{impressions}}', '{{position}}', '{{organic_users}}'])), p(''),
    p('Findings ({{findings_total}})', true, 26),
    tbl(row(['Priority', 'Area', 'Issue', 'Fix'], true) + row(['{{#findings}}{{findings.priority}}', '{{findings.area}}', '{{findings.issue}}', '{{findings.fix}}'])), p(''),
    p("Next month's plan", true, 26), p('{{next_actions}}'),
  ].join('')
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${w}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr></w:body></w:document>`)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}
