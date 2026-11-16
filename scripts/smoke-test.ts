/* Smoke test with small made-up data (no real client data). Run: npm test */
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { emptyState, AppState } from '../src/types'
import { parseGa4, parseGsc, parseSf4xx, parseSfImages, parseSfInternal } from '../src/lib/parsers'
import { buildModel } from '../src/lib/model'
import { buildWorkbook } from '../src/lib/exportXlsx'
import { buildPdf, buildPdfDetailed } from '../src/lib/exportPdf'
import { parseSaved, serialize, startNextMonth } from '../src/lib/saveload'
import { presetSections } from '../src/types'
import React from 'react'
import { renderToString } from 'react-dom/server'
import * as Steps from '../src/steps/Steps'
import * as Design from '../src/steps/Design'
import ExcelJS from 'exceljs'
import { fillTemplate, scanTemplate, makeStarterDocx } from '../src/lib/fillTemplate'
import { placeholderData } from '../src/lib/placeholders'

const f = (name: string, text: string) => new File([text], name)
const ok = (cond: boolean, msg: string) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1 } else console.log('ok  :', msg) }

const sfHead = 'Address,Status Code,Indexability,Title 1,Title 1 Length,Meta Description 1,Meta Description 1 Length,H1-1,H1-2,Word Count,Inlinks,Crawl Timestamp'
const sf = [sfHead,
  'https://demo.test/,200,Indexable,Demo Co home page that is deliberately made longer than sixty characters ok,80,A short description of the demo company.,40,,,900,50,2026-11-03 10:00:00',
  'https://demo.test/services/,200,Indexable,Services - Demo,15,,0,Our services,Why us,400,40,2026-11-03 10:00:00',
  'https://demo.test/contact/,200,Indexable,Contact - Demo,15,,0,Contact,,60,40,2026-11-03 10:00:00',
  'https://demo.test/category/news/,200,Indexable,News,4,,0,Nothing Found,,95,10,2026-11-03 10:00:00',
  'https://demo.test/old/,404,Non-Indexable,,0,,0,,,0,0,2026-11-03 10:00:00'].join('\n')

const e0 = () => emptyState()
async function main() {
  const s: AppState = emptyState()
  s.project = { company: 'Demo Co', website: 'https://demo.test', month: '2026-10', pkg: 'SEO + AEO + GEO', preparedBy: '' }

  // GA4 with only headers must be detected as "no data"
  const ga = await parseGa4(f('ga.csv', '# Traffic acquisition\n# Start date: 20261001\n# End date: 20261031\nSession primary channel group (Default channel group),Sessions,Engaged sessions,Key events\n'))
  ok(ga.empty === true && ga.start === '2026-10-01', 'GA4 header-only file is flagged as empty, not as zero visitors')
  const ga2 = await parseGa4(f('ga2.csv', '# Start date: 20261001\n# End date: 20261031\nSession primary channel group (Default channel group),Sessions,Total users,Key events\nOrganic Search,120,90,4\nDirect,300,250,1\n'))
  ok(ga2.organicUsers === 90 && ga2.organicSessions === 120, 'GA4 Organic Search row is read (Direct is not counted)')
  s.ga4 = ga2

  // Search Console zip
  const z = new JSZip()
  z.file('Dates.csv', 'Date,Clicks,Impressions,CTR,Position\n2026-10-01,10,100,10%,5\n2026-10-31,20,300,6.67%,9\n')
  z.file('Queries.csv', 'Top queries,Clicks,Impressions,CTR,Position\ndemo keyword,25,350,7%,7.2\nother phrase,5,50,10%,12\n')
  z.file('Pages.csv', 'Top pages,Clicks,Impressions,CTR,Position\nhttps://demo.test/,30,400,7.5%,7\n')
  const zip = await z.generateAsync({ type: 'uint8array' })
  s.gsc = await parseGsc([new File([zip as unknown as BlobPart], 'export.zip')])
  ok(s.gsc.clicks === 30 && s.gsc.impressions === 400 && Math.abs(s.gsc.position - 8) < 0.01, 'Search Console totals and weighted position are right')

  s.sf = await parseSfInternal(f('internal_html.csv', sf))
  s.sf4xx = await parseSf4xx(f('4xx.csv', 'Address,Status Code\nhttps://demo.test/a.css,404\nhttps://fonts.googleapis.com/css?family=X+:,400\n'))
  s.sfImg = await parseSfImages(f('img.csv', 'Address,Size (Bytes)\nhttps://demo.test/a.png,1000\nhttps://cdn.other.com/b.png,2000\nhttps://cdn.other.com/c.png,2000\nhttps://cdn.other.com/d.png,2000\n'), s.project.website)
  ok(s.sfImg.own === 1 && s.sfImg.external === 3, 'Own and external images are separated')

  s.psi = { date: '2026-11-03', mobileScores: '38, 42, 38', mobileLcp: '25.2, 47.0, 49.1', mobileTbt: '790, 630, 760', desktopScores: '47', desktopLcp: '2.2', fieldData: false }
  s.security = { ssl: 'A', headers: 'D', missingHeaders: 'Strict-Transport-Security, X-Frame-Options', httpsRedirect: 'Yes' }
  s.keywords = [{ keyword: 'demo keyword', intent: 'Buy', target: 'https://demo.test/services/', priority: 'High' }, { keyword: 'not in export', intent: 'Learn', target: '', priority: 'Low' }]
  s.competitors = [{ name: 'Rival', website: 'https://rival.test', keyword: 'demo keyword', good: 'Case studies', gap: 'No local office', notes: '' }]
  s.questions = [{ question: 'How much does a demo cost?', source: 'People Also Ask', target: 'https://demo.test/services/', answered: false }]
  s.ai = [{ question: 'Best demo company?', tool: 'Gemini', run: 1, named: false, source: null, competitors: 'Rival, Other', date: '2026-11-03' }]
  s.enquiries = ''

  const m = buildModel(s)
  ok(m.p.mobileScore === 38 && m.p.mobileLcp === 47, 'PageSpeed median is used (38 and 47.0)')
  ok(m.findings.some((x) => x.area === 'Speed' && x.priority === 'High'), 'Mobile score under 50 gives a High speed finding')
  ok(m.findings.some((x) => /no meta description/.test(x.issue)), 'Missing meta descriptions are found')
  ok(m.kpis.find((k) => k.label === 'Enquiries / conversions')!.value === 'Not available', 'Missing enquiries show Not available, not zero')

  const out = path.resolve('test-output'); fs.mkdirSync(out, { recursive: true })
  const tpl = fs.readFileSync('public/template.xlsx')
  const xlsx = await buildWorkbook(s, tpl)
  fs.writeFileSync(path.join(out, 'workbook.xlsx'), Buffer.from(xlsx))
  const pdf = buildPdf(s)
  fs.writeFileSync(path.join(out, 'report.pdf'), Buffer.from(pdf))
  ok(xlsx.byteLength > 5000 && pdf.byteLength > 2000, `files written to ${out}`)

  // ---- report design: templates, custom blocks, comparison, save and next month ----
  s.cfg.custom = [
    { id: 'a1', kind: 'text', title: 'Highlights', body: '- Launched a new landing page\n- Fixed the contact form' },
    { id: 'k1', kind: 'kpi', title: 'Social media', body: 'Followers | 1,240 | +80 this month\nPosts | 12 | ' },
    { id: 't1', kind: 'table', title: 'Campaigns', body: 'Campaign | Spend | Clicks\nBrand | 4,000 | 820\nRetarget | 1,500 | 310' },
  ]
  s.prev = { month: '2026-09', clicks: 20, impressions: 500, ctr: 0.04, position: 9.5, mobileScore: 30, findings: 20 }
  const mm = buildModel(s)
  ok(mm.compare.some((r) => r.label === 'Search clicks' && /\+50%/.test(r.delta)), 'Comparison shows +50% for clicks (20 to 30)')
  ok(mm.compare.find((r) => r.label === 'Average position')!.tone === 'good', 'A lower average position counts as better')
  for (const tpl of ['compact', 'detailed', 'dashboard'] as const) {
    s.cfg = { ...s.cfg, template: tpl, sections: [...presetSections(tpl), ...s.cfg.custom.map((c) => ({ id: 'custom:' + c.id, on: true }))] }
    const r = buildPdfDetailed(s)
    fs.writeFileSync(path.join(out, `report-${tpl}.pdf`), Buffer.from(r.buf))
    ok(r.pages >= 1 && (tpl !== 'compact' || r.pages >= 1), `Template ${tpl}: ${r.pages} page(s), scale ${r.scale}`)
  }
  s.cfg.template = 'compact'; s.cfg.sections = presetSections('compact')
  ok(buildPdfDetailed(s).pages === 1, 'The compact template fits one page with the default sections')
  const xl = await buildWorkbook({ ...s, cfg: { ...s.cfg, sheets: { ...s.cfg.sheets, 'Competitors': false } } }, tpl)
  fs.writeFileSync(path.join(out, 'workbook-no-competitors.xlsx'), Buffer.from(xl))
  const saved = parseSaved(serialize(s))
  ok(saved.project.company === 'Demo Co' && saved.cfg.custom.length === 3, 'Save and open keeps the project and the design')
  const nx = startNextMonth(saved)
  ok(nx.project.month === '2026-11' && !nx.gsc && !nx.sf && nx.keywords.length === 2 && nx.prev?.clicks === 30 && nx.aiQuestions.length === 1, 'Start next month: month +1, data cleared, setup kept, last month becomes the comparison')

  // ---- your own template (docx, xlsx, pptx) ----
  const data = placeholderData(s)
  const starter = await makeStarterDocx()
  const sc = await scanTemplate(starter, 'docx')
  ok(sc.unknown.length === 0 && sc.found.includes('#findings'), 'Starter template: all placeholders are recognised')
  const filled = await JSZip.loadAsync(await fillTemplate(starter, 'docx', data))
  const dx = await filled.file('word/document.xml')!.async('string')
  ok(!dx.includes('{{') && dx.includes('Demo Co'), 'Word: placeholders are replaced')
  ok((dx.match(/<w:tr[ >]/g) ?? []).length === 3 + data.lists.findings.length, 'Word: the findings row repeats once per finding')
  const split = new JSZip()
  split.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hi {{com</w:t></w:r><w:r><w:t>pany}}!</w:t></w:r></w:p><w:p><w:r><w:t>{{next_actions}}</w:t></w:r></w:p></w:body></w:document>')
  const sp = await JSZip.loadAsync(await fillTemplate(await split.generateAsync({ type: 'arraybuffer' }), 'docx', data))
  const sx = await sp.file('word/document.xml')!.async('string')
  ok(sx.includes('Hi Demo Co!'), 'Word: a placeholder split across runs still works')
  ok((sx.match(/<w:p[ >]/g) ?? []).length === 1 + data.scalars.next_actions.split('\n').length, 'Word: a multi-line value becomes one paragraph per line')
  const ppt = new JSZip()
  ppt.file('ppt/slides/slide1.xml', '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Priority</a:t></a:r></a:p></a:txBody></a:tc></a:tr><a:tr><a:tc><a:txBody><a:p><a:r><a:t>{{#findings:2}}{{findings.priority}}</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></p:sld>')
  const px = await (await JSZip.loadAsync(await fillTemplate(await ppt.generateAsync({ type: 'arraybuffer' }), 'pptx', data))).file('ppt/slides/slide1.xml')!.async('string')
  ok((px.match(/<a:tr[ >]/g) ?? []).length === 3 && !px.includes('{{'), 'PowerPoint: row limit {{#findings:2}} shows only 2 rows')
  const xw = new ExcelJS.Workbook(); const xs = xw.addWorksheet('R')
  xs.getCell('A1').value = '{{company}} {{month_label}}'; xs.getRow(3).values = ['{{#findings:2}}{{findings.priority}}', '{{findings.issue}}']; xs.getCell('A4').value = 'Total: {{findings_total}}'
  const xo = new ExcelJS.Workbook(); await xo.xlsx.load(await fillTemplate(await xw.xlsx.writeBuffer() as ArrayBuffer, 'xlsx', data))
  const xr = xo.getWorksheet('R')!
  ok(xr.getCell('A1').value === 'Demo Co October 2026' && xr.getCell('A3').value === data.lists.findings[0].priority && xr.getCell('A4').value === data.lists.findings[1].priority && xr.getCell('A5').value === `Total: ${data.scalars.findings_total}`, 'Excel: values and the repeating row (limited to 2) are filled')

  // every wizard step must render without throwing, with data and without
  for (const st of [s, e0()]) {
    const props = { s: st, set: () => {} }
    for (const C of [Steps.ProjectStep, Design.DesignStep, Steps.GscStep, Steps.Ga4Step, Steps.CrawlStep, Steps.SpeedStep, Steps.KeywordStep, Steps.AeoStep, Steps.AiStep, Steps.WorkStep])
      renderToString(React.createElement(C, props))
    renderToString(React.createElement(Steps.ReviewStep, { ...props, onReset: () => {} }))
  }
  ok(true, 'All wizard steps render (with data and empty)')

  // empty project must also export without crashing
  const e = emptyState()
  await buildWorkbook(e, tpl); buildPdf(e)
  ok(true, 'An empty project exports without errors (everything Pending)')
}
main().catch((e) => { console.error(e); process.exit(1) })
