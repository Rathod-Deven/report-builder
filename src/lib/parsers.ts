import Papa from 'papaparse'
import JSZip from 'jszip'
import { Ga4Data, GscData, QueryRow, Sf4xx, SfData, SfImg, SfPage, AiRow } from '../types'
import { host, num } from './util'

type Row = Record<string, string>
const csv = (text: string): Row[] =>
  Papa.parse<Row>(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true }).data

const col = (row: Row, ...names: string[]): string => {
  const keys = Object.keys(row)
  for (const n of names) {
    const k = keys.find((x) => x.trim().toLowerCase() === n.toLowerCase())
    if (k !== undefined) return row[k] ?? ''
  }
  return ''
}
const hasCol = (rows: Row[], name: string) => rows.length > 0 && Object.keys(rows[0]).some((k) => k.trim().toLowerCase() === name.toLowerCase())

// ---------------- Google Search Console ----------------
async function gscTexts(files: File[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const z = await JSZip.loadAsync(await f.arrayBuffer())
      for (const name of Object.keys(z.files)) {
        if (/\.csv$/i.test(name)) out[name.split('/').pop()!.toLowerCase()] = await z.files[name].async('string')
      }
    } else if (/\.csv$/i.test(f.name)) {
      out[f.name.toLowerCase()] = await f.text()
    }
  }
  return out
}

export async function parseGsc(files: File[]): Promise<GscData> {
  const texts = await gscTexts(files)
  const names = Object.keys(texts)
  const find = (re: RegExp) => names.find((n) => re.test(n))
  const datesName = find(/^(dates|chart)/)
  const queriesName = find(/quer/)
  const pagesName = find(/pages/)
  const warnings: string[] = []
  if (!datesName && !queriesName) throw new Error('No Search Console files found. Upload the ZIP you get from Performance > Export > Download CSV (it contains Queries.csv, Pages.csv, Dates.csv).')

  let queries: QueryRow[] = []
  if (queriesName) {
    queries = csv(texts[queriesName]).map((r) => {
      const first = Object.values(r)[0] ?? ''
      return { q: first, clicks: num(col(r, 'Clicks')), impressions: num(col(r, 'Impressions')), ctr: num(col(r, 'CTR')) / 100, position: num(col(r, 'Position')) }
    }).filter((r) => r.q)
  }
  const pages = pagesName
    ? csv(texts[pagesName]).map((r) => ({ url: Object.values(r)[0] ?? '', clicks: num(col(r, 'Clicks')), impressions: num(col(r, 'Impressions')) })).filter((p) => p.url)
    : []

  let start = '', end = '', clicks = 0, impressions = 0, position = 0
  let daily: { date: string; clicks: number; impressions: number }[] = []
  let totalsFrom: 'dates' | 'queries' = 'dates'
  if (datesName) {
    const rows = csv(texts[datesName])
    const dates = rows.map((r) => col(r, 'Date')).filter(Boolean).sort()
    start = dates[0] ?? ''; end = dates[dates.length - 1] ?? ''
    let wPos = 0
    for (const r of rows) {
      const c = num(col(r, 'Clicks')), i = num(col(r, 'Impressions')), p = num(col(r, 'Position'))
      clicks += c; impressions += i; wPos += p * i
      const d = col(r, 'Date')
      if (d) daily.push({ date: d, clicks: c, impressions: i })
    }
    daily = daily.sort((a, b) => a.date.localeCompare(b.date))
    position = impressions ? wPos / impressions : 0
    if (!rows.length) warnings.push('Dates.csv has no rows: Search Console returned no data for this range.')
  } else {
    totalsFrom = 'queries'
    warnings.push('Dates.csv / Chart.csv was not found, so totals were summed from the Queries file. Google hides rare queries, so real totals can be a little higher.')
    let wPos = 0
    for (const q of queries) { clicks += q.clicks; impressions += q.impressions; wPos += q.position * q.impressions }
    position = impressions ? wPos / impressions : 0
  }
  if (!queries.length) warnings.push('No queries found in the export.')
  return { start, end, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position, queries, pages, daily, totalsFrom, warnings }
}

// ---------------- GA4 ----------------
export async function parseGa4(file: File): Promise<Ga4Data> {
  const text = (await file.text()).replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  const meta = lines.filter((l) => l.startsWith('#'))
  const get = (label: string) => (meta.find((l) => l.toLowerCase().includes(label)) ?? '').split(':')[1]?.trim() ?? ''
  const iso = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s)
  const rows = csv(lines.filter((l) => !l.startsWith('#')).join('\n'))
  const warnings: string[] = []
  const start = iso(get('start date')), end = iso(get('end date'))
  if (!rows.length) {
    return { start, end, empty: true, channels: [], warnings: ['GA4 returned no rows for this date range. This usually means GA4 was not collecting data then (for example the property was created after the period). Do not report this as zero visitors.'] }
  }
  const nameKey = Object.keys(rows[0])[0]
  const channels = rows.map((r) => ({
    name: r[nameKey], sessions: num(col(r, 'Sessions')),
    users: hasCol(rows, 'Total users') ? num(col(r, 'Total users')) : hasCol(rows, 'Users') ? num(col(r, 'Users')) : undefined,
  }))
  const organic = rows.find((r) => (r[nameKey] || '').trim().toLowerCase() === 'organic search')
  let organicUsers: number | undefined
  let organicSessions: number | undefined
  if (organic) {
    organicSessions = num(col(organic, 'Sessions'))
    const u = col(organic, 'Total users', 'Users')
    if (u) organicUsers = num(u)
    else warnings.push('This export has Sessions but no Users column. Organic users were not read. In GA4 use Reports > Acquisition > User acquisition, or add the Users column, then export again.')
  } else warnings.push('No "Organic Search" row found. Check the date range, filters and tracking setup before concluding there is no organic traffic. Do not count Direct traffic as Organic.')
  const keyEventsAll = rows.reduce((s, r) => s + num(col(r, 'Key events')), 0)
  return { start, end, empty: false, organicUsers, organicSessions, keyEventsAll: hasCol(rows, 'Key events') ? keyEventsAll : undefined, channels, warnings }
}

// ---------------- Screaming Frog ----------------
export async function parseSfInternal(file: File): Promise<SfData> {
  const rows = csv(await file.text())
  const warnings: string[] = []
  if (!rows.length) throw new Error('The file has no rows. In Screaming Frog open Internal, filter HTML, then Export.')
  for (const need of ['Address', 'Status Code', 'Indexability', 'Title 1', 'Meta Description 1', 'H1-1'])
    if (!hasCol(rows, need)) warnings.push(`Column "${need}" not found. Screaming Frog column names can differ by version; some checks will be skipped.`)
  const pages: SfPage[] = rows.map((r) => ({
    url: col(r, 'Address'), status: num(col(r, 'Status Code')), indexable: col(r, 'Indexability').toLowerCase() === 'indexable',
    title: col(r, 'Title 1'), titleLen: num(col(r, 'Title 1 Length')) || col(r, 'Title 1').length,
    meta: col(r, 'Meta Description 1'), metaLen: num(col(r, 'Meta Description 1 Length')) || col(r, 'Meta Description 1').length,
    h1: col(r, 'H1-1'), h1b: col(r, 'H1-2'), words: num(col(r, 'Word Count')), inlinks: num(col(r, 'Inlinks')),
  })).filter((p) => p.url)
  const ts = col(rows[0], 'Crawl Timestamp')
  return { pages, warnings, crawledAt: ts ? ts.slice(0, 10) : undefined }
}

export async function parseSf4xx(file: File): Promise<Sf4xx> {
  const text = (await file.text()).replace(/^\uFEFF/, '')
  const rows = csv(text)
  const warnings: string[] = []
  if (!rows.length) warnings.push('The file is empty. That is fine if Screaming Frog found no 4xx errors. Keep a screenshot as evidence.')
  return { rows: rows.map((r) => ({ url: col(r, 'Address'), status: num(col(r, 'Status Code')) })).filter((r) => r.url), warnings }
}

export async function parseSfImages(file: File, website: string): Promise<SfImg> {
  const rows = csv(await file.text())
  const h = host(website)
  let own = 0
  const externalHosts: Record<string, number> = {}
  for (const r of rows) {
    const u = col(r, 'Address')
    const hh = host(u)
    if (hh && h && (hh === h || hh.endsWith('.' + h))) own++
    else if (hh) externalHosts[hh] = (externalHosts[hh] ?? 0) + 1
  }
  const warnings: string[] = []
  if (!h) warnings.push('Enter the website address in step 1 so own and external images can be separated.')
  return { total: rows.length, own, external: rows.length - own, externalHosts, warnings }
}

// ---------------- AI check CSV ----------------
export async function parseAiCsv(file: File): Promise<AiRow[]> {
  const rows = csv(await file.text())
  if (!rows.length) throw new Error('No rows found.')
  const yes = (s: string) => /^(y|yes|true|1)$/i.test(s.trim())
  return rows.map((r) => ({
    date: col(r, 'Date'), question: col(r, 'Question'), tool: col(r, 'Tool') || 'Gemini', run: num(col(r, 'Run')) || 1,
    named: yes(col(r, 'Business named', 'Named')),
    source: col(r, 'Our website shown as a source', 'Source') ? yes(col(r, 'Our website shown as a source', 'Source')) : null,
    competitors: col(r, 'Competitors named', 'Competitors'),
  })).filter((r) => r.question)
}
