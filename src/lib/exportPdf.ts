import { jsPDF } from 'jspdf'
import { AppState, CustomBlock, TemplateId } from '../types'
import { SECTION_TITLES } from '../types'
import { Model, autoTitle, buildModel, hasAeo, hasGeo, topCompetitors } from './model'
import { fmt, monthLabel, monthRange } from './util'

const W = 595.28, H = 841.89, M = 28, GAP = 14
const BOTTOM = H - 46

const clean = (t: string) =>
  t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x20-\x7E\u00A0-\u00FF\u2022]/g, '')
const user = (t: string) => clean(t).replace(/</g, '(').replace(/>/g, ')')

interface Theme { brand: string; accent: string; grey: string; muted: string; line: string; ink: string; red: string; green: string; amber: string; white: string }
interface Block { h: (w: number) => number; d: (x: number, y: number, w: number) => void; keep?: boolean }
interface Sec { id: string; title: string; blocks: Block[] }
type Cell = string | { t: string; c?: string; b?: boolean }
interface Tpl { id: TemplateId; cols: 1 | 2; kpiCols: number; fit: boolean; headerH: number; bigKpi: boolean }

const TPL: Record<TemplateId, Tpl> = {
  compact: { id: 'compact', cols: 2, kpiCols: 4, fit: true, headerH: 78, bigKpi: false },
  detailed: { id: 'detailed', cols: 1, kpiCols: 4, fit: false, headerH: 86, bigKpi: false },
  dashboard: { id: 'dashboard', cols: 2, kpiCols: 3, fit: false, headerH: 104, bigKpi: true },
}

type Seg = { t: string; b: boolean }
const toSegs = (rich: string): Seg[] => {
  const out: Seg[] = []
  let b = false
  for (const part of rich.split(/(<\/?b>)/)) {
    if (part === '<b>') b = true
    else if (part === '</b>') b = false
    else if (part) out.push({ t: part, b })
  }
  return out
}

function kit(doc: jsPDF, th: Theme, sc: number) {
  const font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size) }
  const ink = (hex: string) => doc.setTextColor(hex)
  const fill = (hex: string) => doc.setFillColor(hex)

  const wrap = (rich: string, w: number, size: number, indent: number, baseBold: boolean) => {
    const words: { t: string; b: boolean }[] = []
    for (const seg of toSegs(rich)) for (const wd of seg.t.split(/(\s+)/)) if (wd) words.push({ t: wd, b: seg.b || baseBold })
    const lines: { t: string; b: boolean; w: number }[][] = []
    let line: { t: string; b: boolean; w: number }[] = [], lw = 0
    const maxW = w - indent
    for (const wd of words) {
      font(size, wd.b ? 'bold' : 'normal')
      const ww = doc.getTextWidth(wd.t)
      if (/^\s+$/.test(wd.t)) { if (line.length) { line.push({ ...wd, w: ww }); lw += ww } continue }
      if (lw + ww > maxW && line.length) {
        while (line.length && /^\s+$/.test(line[line.length - 1].t)) line.pop()
        lines.push(line); line = []; lw = 0
      }
      line.push({ ...wd, w: ww }); lw += ww
    }
    if (line.length) lines.push(line)
    return lines
  }

  const para = (rich: string, size: number, color: string, o: { bullet?: string; indent?: number; after?: number; bold?: boolean } = {}): Block => {
    const s = size * sc, lead = s * 1.3, ind = o.indent ?? 0, after = o.after ?? 2
    return {
      h: (w) => Math.max(1, wrap(rich, w, s, ind, !!o.bold).length) * lead + after,
      d: (x, y, w) => {
        const lines = wrap(rich, w, s, ind, !!o.bold)
        if (o.bullet) { font(s, 'normal'); ink(color); doc.text(o.bullet, x, y + s) }
        lines.forEach((ln, i) => {
          let cx = x + ind
          for (const p of ln) { font(s, p.b ? 'bold' : 'normal'); ink(color); doc.text(p.t, cx, y + s + i * lead); cx += p.w }
        })
      },
    }
  }
  const heading = (n: number, title: string): Block => {
    const s = 8.8 * sc
    return {
      keep: true, h: () => s + 15,
      d: (x, y) => { font(s, 'bold'); ink(th.accent); doc.text(String(n), x, y + 6 + s); ink(th.brand); doc.text(title.toUpperCase(), x + (n >= 10 ? 17 : 11), y + 6 + s) },
    }
  }
  const spacer = (hh: number): Block => ({ h: () => hh, d: () => {} })

  const table = (head: string[], rows: Cell[][], ratios: number[], size: number): Block[] => {
    const s = size * sc, pad = 2.4
    const cellText = (c: Cell) => (typeof c === 'string' ? c : c.t)
    const rowH = (cells: string[], w: number, bold: boolean) => {
      font(s, bold ? 'bold' : 'normal')
      return Math.max(...cells.map((c, i) => doc.splitTextToSize(c, ratios[i] * w - 6).length)) * s * 1.25 + pad * 2
    }
    const drawRow = (cells: Cell[], x: number, y: number, w: number, bg: string | null, color: string, bold: boolean) => {
      const texts = cells.map(cellText)
      const h = rowH(texts, w, bold)
      if (bg) { fill(bg); doc.rect(x, y, w, h, 'F') }
      doc.setDrawColor(th.line); doc.setLineWidth(0.3); doc.line(x, y + h, x + w, y + h)
      let cx = x
      cells.forEach((c, i) => {
        const o: { t?: string; c?: string; b?: boolean } = typeof c === 'string' ? {} : c
        font(s, bold || o.b ? 'bold' : 'normal'); ink(o.c ?? color)
        doc.text(doc.splitTextToSize(texts[i], ratios[i] * w - 6), cx + 3, y + pad + s, { lineHeightFactor: 1.25 })
        cx += ratios[i] * w
      })
    }
    const out: Block[] = [{ keep: true, h: (w) => rowH(head, w, true), d: (x, y, w) => drawRow(head, x, y, w, th.brand, th.white, true) }]
    rows.forEach((r, i) => out.push({ h: (w) => rowH(r.map(cellText), w, false), d: (x, y, w) => drawRow(r, x, y, w, i % 2 ? th.grey : th.white, th.ink, false) }))
    return out
  }

  interface K { label: string; value: string; sub: string; real: boolean; bad?: boolean }
  const kpiGrid = (items: K[], cols: number, big: boolean): Block => {
    const ch = big ? 56 : 44
    const rows = Math.ceil(items.length / cols)
    return {
      h: () => rows * ch + (rows - 1) * 6 + 4,
      d: (x, y, w) => {
        const cw = (w - (cols - 1) * 6) / cols
        items.forEach((k, i) => {
          const r = Math.floor(i / cols), c = i % cols
          const cx = x + c * (cw + 6), cy = y + r * (ch + 6)
          fill(th.grey); doc.setDrawColor(th.line); doc.setLineWidth(0.6); doc.roundedRect(cx, cy, cw, ch, 4, 4, 'FD')
          fill(k.real ? (k.bad ? th.red : th.brand) : th.accent); doc.rect(cx, cy + 1, 3, ch - 2, 'F')
          font(7, 'normal'); ink(th.muted); doc.text(doc.splitTextToSize(user(k.label), cw - 14)[0], cx + 9, cy + 12)
          font(k.real ? (big ? 17 : 12.5) : (big ? 12.5 : 10.5), k.real ? 'bold' : 'italic'); ink(k.real ? (k.bad ? th.red : th.brand) : th.muted)
          doc.text(doc.splitTextToSize(user(k.value), cw - 14)[0], cx + 9, cy + (big ? 33 : 28))
          font(6.3, 'normal'); ink(th.muted); doc.text(doc.splitTextToSize(user(k.sub), cw - 14)[0], cx + 9, cy + ch - 6)
        })
      },
    }
  }

  // ---- charts ----
  const compact = (n: number) => (n >= 10000 ? fmt(n / 1000, 0) + 'k' : n >= 1000 ? fmt(n / 1000, 1) + 'k' : fmt(n, 0))
  const lineChart = (x: number, y: number, w: number, h: number, title: string, vals: number[], first: string, last: string) => {
    font(7.6, 'bold'); ink(th.brand); doc.text(title, x, y + 8)
    const px = x + 26, py = y + 16, pw = w - 30, ph = h - 32
    const max = Math.max(1, ...vals)
    doc.setDrawColor(th.line); doc.setLineWidth(0.4)
    ;[0, 0.5, 1].forEach((f) => {
      const gy = py + ph - ph * f
      doc.line(px, gy, px + pw, gy)
      font(6, 'normal'); ink(th.muted); doc.text(compact(max * f), px - 3, gy + 2, { align: 'right' })
    })
    doc.setDrawColor(th.accent); doc.setLineWidth(1.3)
    vals.forEach((v, i) => {
      if (i === 0) return
      const x1 = px + (pw * (i - 1)) / (vals.length - 1), x2 = px + (pw * i) / (vals.length - 1)
      doc.line(x1, py + ph - (ph * vals[i - 1]) / max, x2, py + ph - (ph * v) / max)
    })
    font(6, 'normal'); ink(th.muted); doc.text(first, px, py + ph + 10); doc.text(last, px + pw, py + ph + 10, { align: 'right' })
  }
  const barChart = (x: number, y: number, w: number, h: number, title: string, items: { label: string; value: number; color?: string }[]) => {
    font(7.6, 'bold'); ink(th.brand); doc.text(title, x, y + 8)
    const max = Math.max(1, ...items.map((i) => i.value))
    const rowH = Math.min(15, (h - 16) / Math.max(1, items.length))
    const lw = w * 0.46
    items.forEach((it, i) => {
      const ry = y + 16 + i * rowH
      font(6.4, 'normal'); ink(th.ink); doc.text(doc.splitTextToSize(user(it.label), lw - 4)[0], x, ry + rowH * 0.62)
      fill(it.color ?? th.accent); doc.rect(x + lw, ry + 1.5, Math.max(1.5, ((w - lw - 28) * it.value) / max), rowH - 4, 'F')
      font(6.4, 'bold'); ink(th.muted); doc.text(fmt(it.value), x + lw + Math.max(1.5, ((w - lw - 28) * it.value) / max) + 3, ry + rowH * 0.62)
    })
  }
  return { font, ink, fill, para, heading, spacer, table, kpiGrid, lineChart, barChart, wrap }
}

function sectionsFor(doc: jsPDF, s: AppState, m: Model, th: Theme, sc: number, tpl: Tpl): { full: Sec[]; col: Sec[] } {
  const k = kit(doc, th, sc)
  const detailed = tpl.id === 'detailed'
  const bl = (t: string) => k.para(t, 8.4, th.ink, { bullet: '\u2022', indent: 9, after: 1.5 })
  const pri = (p: string) => ({ t: p, c: p === 'High' ? th.red : p === 'Medium' ? th.amber : th.muted, b: true })
  const company = s.project.company || 'The business'

  const make = (id: string): { blocks: Block[]; full: boolean } | null => {
    switch (id) {
      case 'summary':
        return m.summary ? { full: false, blocks: [k.para(user(m.summary), 8.6, th.ink, { after: 4 })] } : null
      case 'kpis':
        return { full: true, blocks: [k.kpiGrid(m.kpis.map((x) => ({ ...x })), tpl.kpiCols, tpl.bigKpi), k.para(`Pending = not yet available. Not tracked = tracking had no data for the period.${m.outside ? ' Speed, crawl and AI checks were run outside the reporting month (lab data).' : ''}`, 6.8, th.muted, { after: 3 })] }
      case 'comparison': {
        if (!m.compare.length) return null
        const rows: Cell[][] = m.compare.map((r) => [r.label, r.cur, r.prev, { t: r.delta, b: true, c: r.tone === 'good' ? th.green : r.tone === 'bad' ? th.red : th.muted }])
        return { full: true, blocks: [...k.table(['Metric', 'This month', `Last month (${s.prev ? monthLabel(s.prev.month) : ''})`, 'Change'], rows, [0.34, 0.2, 0.26, 0.2], 7.8)] }
      }
      case 'charts': {
        const items: ((x: number, y: number, w: number, h: number) => void)[] = []
        const g = s.gsc
        if (g && g.daily.length > 1) items.push((x, y, w, h) => k.lineChart(x, y, w, h, 'Daily search clicks', g.daily.map((d) => d.clicks), g.daily[0].date, g.daily[g.daily.length - 1].date))
        if (g && g.queries.length) {
          const top = [...g.queries].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 6)
          const byClicks = top.some((q) => q.clicks > 0)
          items.push((x, y, w, h) => k.barChart(x, y, w, h, byClicks ? 'Top queries by clicks' : 'Top queries by impressions', top.map((q) => ({ label: q.q, value: byClicks ? q.clicks : q.impressions }))))
        }
        if (m.findings.length) items.push((x, y, w, h) => k.barChart(x, y, w, h, 'Findings by priority', [{ label: 'High', value: m.counts.High, color: th.red }, { label: 'Medium', value: m.counts.Medium, color: th.amber }, { label: 'Low', value: m.counts.Low, color: th.muted }]))
        if (!items.length) return null
        const ch = 112
        return { full: true, blocks: [{ h: () => ch + 4, d: (x, y, w) => { const cw = (w - (items.length - 1) * 12) / items.length; items.forEach((fn, i) => fn(x + i * (cw + 12), y, cw, ch)) } }] }
      }
      case 'work': {
        const inP = s.workInPeriod.split('\n').map((x) => x.trim()).filter(Boolean)
        const blocks: Block[] = inP.length ? inP.slice(0, 8).map((t) => bl(user(t))) : [bl(`<b>${monthLabel(s.project.month)}:</b> no work recorded.`)]
        if (m.outside) {
          const ds = [...new Set([s.psi.date, s.ai?.[0]?.date, s.sf?.crawledAt].filter(Boolean) as string[])]
          const did = [s.sf ? 'site crawl' : '', m.p.mobileScore !== undefined ? 'PageSpeed test' : '', s.security.ssl || s.security.headers ? 'security check' : '', s.competitors.length ? `review of ${s.competitors.length} competitor ${s.competitors.length === 1 ? 'site' : 'sites'}` : '', s.questions.length ? `research of ${s.questions.length} customer ${s.questions.length === 1 ? 'question' : 'questions'}` : '', m.ai ? `AI check (${m.ai.asked} ${m.ai.asked === 1 ? 'question' : 'questions'})` : ''].filter(Boolean)
          if (did.length) blocks.push(bl(`<b>Audit and checks (${ds.join(', ') || 'dates not set'}):</b> ${did.join(', ')}.`))
        }
        s.workOutside.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5).forEach((t) => blocks.push(bl(`<b>Outside the month / date not recorded:</b> ${user(t)}`)))
        return { full: false, blocks }
      }
      case 'technical': {
        if (!m.findings.length) return null
        const limit = detailed ? 15 : 7
        const rows: Cell[][] = m.findings.slice(0, limit).map((f) => [pri(f.priority), user(detailed || f.issue.length <= 110 ? f.issue : f.issue.slice(0, 107) + '...')])
        const more = m.findings.length > limit ? [k.para(`+ ${m.findings.length - limit} more in the Findings Log.`, 7, th.muted, { after: 2 })] : []
        return { full: false, blocks: [{ ...k.para(`<b>Identified:</b> ${m.findings.length}    <b>Fixed:</b> none recorded    <b>Outstanding:</b> ${m.findings.length}`, 8.6, th.ink, { after: 3 }), keep: true }, ...k.table(['Priority', 'Issue found'], rows, [0.17, 0.83], 7.8), ...more] }
      }
      case 'pages': {
        if (!m.topPages.length) return null
        const rows: Cell[][] = m.topPages.map((p) => [user(p.url.replace(/^https?:\/\//, '')), fmt(p.clicks), fmt(p.impressions)])
        return { full: false, blocks: k.table(['Page', 'Clicks', 'Impressions'], rows, [0.6, 0.18, 0.22], 7.8) }
      }
      case 'keywords': {
        if (!m.keywords.length) return null
        const ord: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
        const sorted = [...m.keywords].sort((a, b) => ord[a.priority] - ord[b.priority] || (b.impressions ?? -1) - (a.impressions ?? -1)).slice(0, detailed ? 15 : 6)
        const rows: Cell[][] = sorted.map((x) => [user(x.keyword), x.priority, x.impressions !== undefined ? `${fmt(x.clicks!)} clicks, pos ${fmt(x.position!, 1)}` : s.gsc ? 'Not in export' : { t: 'Pending', c: th.muted }])
        return { full: false, blocks: [...k.table(['Target keyword', 'Priority', 'Performance'], rows, [0.5, 0.15, 0.35], 7.8), k.para(`${m.keywords.length} keywords listed. ${s.gsc ? 'Performance comes from the Search Console export.' : 'Clicks, impressions and position are pending Search Console data.'}`, 7, th.muted, { after: 3 })] }
      }
      case 'competitors': {
        if (!s.competitors.length) return null
        const rows: Cell[][] = s.competitors.slice(0, 6).map((c) => [{ t: user(c.name), b: true }, user(c.good), user(c.gap)])
        return { full: false, blocks: k.table(['Competitor', 'Does well', 'Gap we can fill'], rows, [0.22, 0.39, 0.39], 7.4) }
      }
      case 'aeo_geo': {
        if (!hasAeo(s) && !hasGeo(s)) return null
        const blocks: Block[] = []
        if (hasAeo(s)) blocks.push(bl(s.questions.length ? `<b>AEO:</b> ${s.questions.length} customer ${s.questions.length === 1 ? 'question' : 'questions'} found. Answers added: <b>${m.answered}</b>.` : '<b>AEO:</b> no customer questions added yet.'))
        if (hasGeo(s)) {
          if (m.ai) {
            blocks.push(bl(`<b>GEO:</b> ${m.ai.asked} ${m.ai.asked === 1 ? 'question' : 'questions'} checked in ${m.ai.tools.join(', ')} (${m.ai.runs} run${m.ai.runs > 1 ? 's' : ''}). ${user(company)} named in <b>${m.ai.named} of ${m.ai.asked}</b>.`))
            const tc = topCompetitors(s, 2)
            if (tc.length) blocks.push(bl(`<b>Named most often instead:</b> ${tc.map((c) => `${user(c.name)} (${c.count})`).join(', ')}.`))
            if (m.ai.tools.length < 4 || m.ai.runs < 2) blocks.push(bl(`Limits: ${m.ai.tools.length} tool${m.ai.tools.length > 1 ? 's' : ''}, ${m.ai.runs} run${m.ai.runs > 1 ? 's' : ''}. AI answers change, so trends matter more than one result.`))
          } else blocks.push(bl('<b>GEO:</b> AI check not added yet.'))
        }
        return { full: false, blocks }
      }
      case 'next':
        return m.next.length ? { full: false, blocks: m.next.map((t, i) => k.para(clean(t), 8.4, th.ink, { bullet: `${i + 1}.`, indent: 11, after: 1.8 })) } : null
      default: {
        if (!id.startsWith('custom:')) return null
        const cb = s.cfg.custom.find((c) => 'custom:' + c.id === id)
        return cb ? customBlock(cb, k, th, tpl) : null
      }
    }
  }

  const collected: { id: string; title: string; blocks: Block[]; full: boolean }[] = []
  const known = new Set(s.cfg.sections.map((x) => x.id))
  const extras = s.cfg.custom.filter((x) => !known.has('custom:' + x.id)).map((x) => ({ id: 'custom:' + x.id, on: true }))
  for (const c of s.cfg.sections.filter((x) => x.on).concat(extras)) {
    const r = make(c.id)
    if (!r || !r.blocks.length) continue
    const title = c.id === 'kpis' ? 'Performance overview' : c.id.startsWith('custom:') ? user(s.cfg.custom.find((x) => 'custom:' + x.id === c.id)?.title || 'Notes') : SECTION_TITLES[c.id]
    collected.push({ id: c.id, title, blocks: r.blocks, full: r.full || tpl.cols === 1 })
  }
  const out: { full: Sec[]; col: Sec[] } = { full: [], col: [] }
  let n = 0
  for (const grp of [collected.filter((x) => x.full), collected.filter((x) => !x.full)]) {
    for (const c of grp) {
      n++
      ;(c.full ? out.full : out.col).push({ id: c.id, title: c.title, blocks: [k.heading(n, c.title), ...c.blocks] })
    }
  }
  return out
}

function customBlock(cb: CustomBlock, k: ReturnType<typeof kit>, th: Theme, tpl: Tpl): { blocks: Block[]; full: boolean } | null {
  const lines = cb.body.split('\n').map((x) => x.trim()).filter(Boolean)
  if (!lines.length) return null
  const split = (l: string) => l.split(/\t|\|/).map((x) => user(x.trim()))
  if (cb.kind === 'kpi') {
    const items = lines.map(split).map((c) => ({ label: c[0] ?? '', value: c[1] || 'Pending', sub: c[2] ?? '', real: !!c[1] }))
    return { full: true, blocks: [k.kpiGrid(items, tpl.kpiCols, tpl.bigKpi)] }
  }
  if (cb.kind === 'table') {
    const rows = lines.map(split)
    const cols = Math.max(...rows.map((r) => r.length))
    const norm = rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''))
    return { full: false, blocks: k.table(norm[0], norm.slice(1), Array.from({ length: cols }, () => 1 / cols), 7.8) }
  }
  return { full: false, blocks: lines.map((l) => (l.startsWith('- ') ? k.para(user(l.slice(2)), 8.4, th.ink, { bullet: '\u2022', indent: 9, after: 1.5 }) : k.para(user(l), 8.6, th.ink, { after: 3 }))) }
}

function run(doc: jsPDF, s: AppState, m: Model, th: Theme, tpl: Tpl, sc: number, draw: boolean): number {
  const k = kit(doc, th, sc)
  void k
  const { full, col } = sectionsFor(doc, s, m, th, sc, tpl)
  const topN = 34
  let page = 1
  let y = tpl.headerH + 14
  const title = autoTitle(s)

  const header = () => {
    if (!draw) return
    const hh = tpl.headerH
    doc.setFillColor(th.brand); doc.rect(0, 0, W, hh - 4, 'F'); doc.setFillColor(th.accent); doc.rect(0, hh - 4, W, 4, 'F')
    let tx = M
    if (s.cfg.logo) {
      try {
        const props = doc.getImageProperties(s.cfg.logo)
        const lh = Math.min(40, hh - 24), lw = Math.min(110, (props.width / props.height) * lh)
        doc.setFillColor('#FFFFFF'); doc.roundedRect(M, (hh - 4 - lh) / 2 - 3, lw + 8, lh + 6, 4, 4, 'F')
        doc.addImage(s.cfg.logo, /^data:image\/png/i.test(s.cfg.logo) ? 'PNG' : 'JPEG', M + 4, (hh - 4 - lh) / 2, lw, lh)
        tx = M + lw + 20
      } catch { /* bad logo: skip */ }
    }
    const big = tpl.id === 'dashboard'
    doc.setTextColor('#FFFFFF'); doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 22 : 19); doc.text(user(title), tx, (hh - 4) / 2 + (big ? 2 : 0))
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    const host = m.host
    doc.text(user(`${s.project.company || 'Company name'}   |   Website: ${host || 'your-website.com'}`), tx, (hh - 4) / 2 + (big ? 20 : 18))
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Reporting period', W - M, (hh - 4) / 2 - 8, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.text(monthLabel(s.project.month), W - M, (hh - 4) / 2 + 9, { align: 'right' })
    const r = monthRange(s.project.month)
    doc.setFontSize(8); doc.text(`${parseInt(r.start.slice(8))} to ${parseInt(r.end.slice(8))} ${monthLabel(s.project.month).split(' ')[0]} ${s.project.month.slice(0, 4)}`, W - M, (hh - 4) / 2 + 21, { align: 'right' })
  }
  const newPage = () => {
    doc.addPage(); page++; y = topN
    if (draw) { doc.setFillColor(th.brand); doc.rect(0, 0, W, 22, 'F'); doc.setTextColor('#FFFFFF'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(user(`${s.project.company} | ${title} | ${monthLabel(s.project.month)}`), M, 14) }
  }
  header()

  interface ColMode { next: () => boolean; x: () => number; reset: () => void }
  const flow = (sec: Sec, x: number, w: number, colMode?: ColMode) => {
    sec.blocks.forEach((b, i) => {
      const hh = b.h(w)
      let need = hh
      if (b.keep) {
        let j = i + 1
        while (j < sec.blocks.length) { need += sec.blocks[j].h(w); if (!sec.blocks[j].keep) break; j++ }
      }
      if (y + need > BOTTOM && y > topN + 1) {
        if (!(colMode && colMode.next())) { newPage(); if (colMode) colMode.reset() }
      }
      if (draw) b.d(colMode ? colMode.x() : x, y, w)
      y += hh
    })
  }

  const fw = W - 2 * M
  for (const sec of full) flow(sec, M, fw)

  if (col.length) {
    const cw = (fw - GAP) / 2
    let colIdx = 0
    let colTop = y
    const totals = col.map((sec) => sec.blocks.reduce((a, b) => a + b.h(cw), 0))
    const total = totals.reduce((a, b) => a + b, 0)
    const balance = total <= 2 * (BOTTOM - colTop) * 0.98
    const mode: ColMode = {
      next: () => { if (colIdx < 1) { colIdx = 1; y = colTop; return true } return false },
      x: () => M + colIdx * (cw + GAP),
      reset: () => { colIdx = 0; colTop = topN },
    }
    col.forEach((sec, i) => {
      if (balance && colIdx === 0 && y > colTop && (y - colTop) + totals[i] / 2 >= total / 2) { colIdx = 1; y = colTop }
      flow(sec, 0, cw, mode)
    })
  }
  return page
}

export interface PdfResult { buf: ArrayBuffer; pages: number; scale: number }

export function buildPdfDetailed(s: AppState): PdfResult {
  const m = buildModel(s)
  const th: Theme = { brand: s.cfg.brand || '#0F2A47', accent: s.cfg.accent || '#1B8A8F', grey: '#F2F5F8', muted: '#6B7785', line: '#D5DCE3', ink: '#1E2A36', red: '#B83A2E', green: '#1F7A4C', amber: '#B26A00', white: '#FFFFFF' }
  const tpl = TPL[s.cfg.template] ?? TPL.compact
  let scale = 1
  if (tpl.fit) {
    scale = 0.9
    for (const sc of [1.15, 1.1, 1.05, 1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64]) {
      const probe = new jsPDF({ unit: 'pt', format: 'a4' })
      if (run(probe, s, m, th, tpl, sc, false) === 1) { scale = sc; break }
    }
  }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.setProperties({ title: `${s.project.company} Monthly Report ${s.project.month}`, author: s.project.company })
  const pages = run(doc, s, m, th, tpl, scale, true)
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(th.line); doc.setLineWidth(0.6); doc.line(M, H - 40, W - M, H - 40)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(th.muted)
    doc.text(user(`Source: SEO Workbook, ${monthLabel(s.project.month)} (detailed records). Only verified data is shown; missing data is marked Pending or Not tracked.`), M, H - 30)
    doc.text('No ranking or AI mention can be promised; results depend on Google and the AI tools.', M, H - 20)
    doc.text(user(`${s.project.company || ''}${s.project.company && m.host ? '  |  ' : ''}${m.host}   |   Page ${p} of ${pages}`), W - M, H - 20, { align: 'right' })
  }
  return { buf: doc.output('arraybuffer'), pages, scale }
}
export const buildPdf = (s: AppState): ArrayBuffer => buildPdfDetailed(s).buf
