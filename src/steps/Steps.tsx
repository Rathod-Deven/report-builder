import { useState } from 'react'
import { AiRow, CompRow, KeywordRow, QRow } from '../types'
import { parseAiCsv, parseGa4, parseGsc, parseSf4xx, parseSfImages, parseSfInternal } from '../lib/parsers'
import { buildModel, hasAeo, hasGeo, isArchive } from '../lib/model'
import { fmt, monthLabel, monthRange, todayIso } from '../lib/util'
import { Alert, Card, Chip, DropZone, Field, HowTo, Stat, Warnings, download } from '../ui'
import { StepProps, lines } from './helpers'
import { CustomTemplateCard } from './CustomTemplate'

const useBusy = () => {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return { busy, err, run }
}
const Remove = ({ onClick }: { onClick: () => void }) => <button onClick={onClick} className="text-xs font-semibold text-red-600 underline">Remove file data</button>

// ------------------------------------------------------------------ 1 Project
export function ProjectStep({ s, set }: StepProps) {
  const p = s.project
  const up = (patch: Partial<typeof p>) => set({ project: { ...p, ...patch } })
  const r = monthRange(p.month)
  return (
    <div className="space-y-5">
      <Card title="Project details" subtitle="These appear in the workbook and on the PDF header.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company or client name"><input className="input" value={p.company} onChange={(e) => up({ company: e.target.value })} placeholder="e.g. Acme Pvt Ltd" /></Field>
          <Field label="Website address" hint="Used to tell your own images from other websites' images."><input className="input" value={p.website} onChange={(e) => up({ website: e.target.value })} placeholder="https://example.com" /></Field>
          <Field label="Reporting month" hint={`Always use a full calendar month: ${r.start} to ${r.end}.`}><input type="month" className="input" value={p.month} onChange={(e) => up({ month: e.target.value })} /></Field>
          <Field label="Package">
            <select className="input" value={p.pkg} onChange={(e) => up({ pkg: e.target.value as typeof p.pkg })}>
              {['SEO', 'SEO + AEO', 'SEO + GEO', 'SEO + AEO + GEO'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
        </div>
      </Card>
      <Alert tone="info" title="What the three letters mean">
        SEO helps the site show up in Google. AEO writes pages so they become the direct answer. GEO helps AI tools like ChatGPT and Gemini find and recommend the business. The package decides which steps you see.
      </Alert>
    </div>
  )
}

// ------------------------------------------------------------------ 2 Search Console
export function GscStep({ s, set }: StepProps) {
  const { busy, err, run } = useBusy()
  const g = s.gsc
  const { start, end } = monthRange(s.project.month)
  const covers = g && g.start <= start && g.end >= end
  return (
    <div className="space-y-5">
      <HowTo
        steps={[
          <>Open <b>Google Search Console</b> and choose the website property.</>,
          <>Go to <b>Performance &rarr; Search results</b>.</>,
          <>Click <b>Date &rarr; Custom</b> and set <b>{start}</b> to <b>{end}</b>. Switch on all four boxes: clicks, impressions, CTR, position. Add no filters.</>,
          <>Click <b>Export &rarr; Download CSV</b>. You get a ZIP file. Do not unzip it.</>,
          <>If Search Console says <b>"Processing data"</b>, skip the upload. The report will show Pending instead of guessing.</>,
        ]}
        links={[{ label: 'Open Search Console', href: 'https://search.google.com/search-console' }, { label: 'Official guide', href: 'https://support.google.com/webmasters/answer/7576553' }]}
      />
      <Card title="Upload the Search Console export" right={g ? <Chip tone={g.impressions ? (covers ? 'ok' : 'warn') : 'bad'}>{g.impressions ? (covers ? 'Verified' : 'Check date range') : 'No data'}</Chip> : <Chip>Not added</Chip>}>
        <DropZone label="Drop the ZIP (or the CSV files) here" accept=".zip,.csv" multiple busy={busy}
          onFiles={(f) => run(async () => set({ gsc: await parseGsc(f) }))} />
        {err && <div className="mt-3"><Alert tone="bad">{err}</Alert></div>}
        {g && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Clicks" value={fmt(g.clicks)} /><Stat label="Impressions" value={fmt(g.impressions)} />
              <Stat label="Average CTR" value={fmt(g.ctr * 100, 2) + '%'} /><Stat label="Average position" value={fmt(g.position, 1)} />
            </div>
            <p className="text-sm text-slate-600">Dates in file: <b>{g.start || 'unknown'}</b> to <b>{g.end || 'unknown'}</b> &middot; {g.queries.length} queries &middot; {g.pages.length} pages</p>
            {!covers && g.impressions > 0 && <Alert tone="warn">The file does not cover the full month {start} to {end}. Export again with the full month so months can be compared fairly.</Alert>}
            <Warnings items={g.warnings} />
            <Remove onClick={() => set({ gsc: undefined })} />
          </div>
        )}
      </Card>
      <Card title="Pages indexed (optional)" subtitle="Search Console &rarr; Indexing &rarr; Pages. Type the number of indexed pages.">
        <input className="input max-w-xs" inputMode="numeric" value={s.indexedPages} onChange={(e) => set({ indexedPages: e.target.value })} placeholder="e.g. 85" />
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ 3 GA4
export function Ga4Step({ s, set }: StepProps) {
  const { busy, err, run } = useBusy()
  const g = s.ga4
  const { start, end } = monthRange(s.project.month)
  return (
    <div className="space-y-5">
      <HowTo
        steps={[
          <>Open <b>Google Analytics 4</b> and choose the property.</>,
          <>Go to <b>Reports &rarr; Acquisition &rarr; User acquisition</b> (this report has the <b>Users</b> column the monthly tracker needs).</>,
          <>Set the date range to <b>{start}</b> to <b>{end}</b>.</>,
          <>Click the share icon at the top right and choose <b>Download file &rarr; CSV</b>.</>,
          <>Do not count <b>Direct</b> traffic as organic. Only the <b>Organic Search</b> row counts.</>,
        ]}
        links={[{ label: 'Open Google Analytics', href: 'https://analytics.google.com/' }]}
      />
      <Card title="Upload the GA4 export" right={g ? <Chip tone={g.empty ? 'warn' : g.organicUsers !== undefined ? 'ok' : 'warn'}>{g.empty ? 'No data in file' : g.organicUsers !== undefined ? 'Verified' : 'Check file'}</Chip> : <Chip>Not added</Chip>}>
        <DropZone label="Drop the GA4 CSV here" accept=".csv" busy={busy} onFiles={(f) => run(async () => set({ ga4: await parseGa4(f[0]) }))} />
        {err && <div className="mt-3"><Alert tone="bad">{err}</Alert></div>}
        {g && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">Dates in file: <b>{g.start || 'unknown'}</b> to <b>{g.end || 'unknown'}</b></p>
            {!g.empty && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Organic users" value={g.organicUsers !== undefined ? fmt(g.organicUsers) : 'Not read'} />
                <Stat label="Organic sessions" value={g.organicSessions !== undefined ? fmt(g.organicSessions) : 'n/a'} />
                <Stat label="Key events (all channels)" value={g.keyEventsAll !== undefined ? fmt(g.keyEventsAll) : 'n/a'} />
              </div>
            )}
            <Warnings items={g.warnings} />
            <Remove onClick={() => set({ ga4: undefined })} />
          </div>
        )}
      </Card>
      <Card title="Enquiries (optional)" subtitle="Contact form sent + phone clicks + WhatsApp clicks, from GA4 key events, or the number the client confirms. Leave empty if you do not have it.">
        <input className="input max-w-xs" inputMode="numeric" value={s.enquiries} onChange={(e) => set({ enquiries: e.target.value })} placeholder="e.g. 9" />
        {g?.keyEventsAll ? <p className="mt-2 text-xs text-slate-500">The file shows {fmt(g.keyEventsAll)} key events across all channels. Check what they count before using that as enquiries.</p> : null}
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ 4 Crawl
export function CrawlStep({ s, set }: StepProps) {
  const a = useBusy(), b = useBusy(), c = useBusy()
  const sf = s.sf
  const idx = sf?.pages.filter((p) => p.status === 200 && p.indexable) ?? []
  return (
    <div className="space-y-5">
      <HowTo
        steps={[
          <>Install <b>Screaming Frog SEO Spider</b> (the free version crawls up to 500 URLs). Enter your website address and press <b>Start</b>.</>,
          <>When it reaches 100%: open the <b>Internal</b> tab, choose filter <b>HTML</b>, click <b>Export</b>.</>,
          <><b>Response Codes</b> tab &rarr; filter <b>Client Error (4xx)</b> &rarr; Export. (If the list is empty, there is nothing to upload.)</>,
          <><b>Images</b> tab &rarr; filter <b>Missing Alt Text</b> &rarr; Export.</>,
        ]}
        links={[{ label: 'Get Screaming Frog', href: 'https://www.screamingfrog.co.uk/seo-spider/' }]}
      />
      <Card title="1. Internal HTML export (needed)" right={sf ? <Chip tone="ok">Verified</Chip> : <Chip>Not added</Chip>}>
        <DropZone label="Drop internal_html.csv here" accept=".csv" busy={a.busy} onFiles={(f) => a.run(async () => set({ sf: await parseSfInternal(f[0]) }))} />
        {a.err && <div className="mt-3"><Alert tone="bad">{a.err}</Alert></div>}
        {sf && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="URLs crawled" value={fmt(sf.pages.length)} /><Stat label="Indexable pages" value={fmt(idx.length)} />
              <Stat label="Missing meta description" value={fmt(idx.filter((p) => !p.meta).length)} tone={idx.some((p) => !p.meta) ? 'bad' : 'ok'} />
              <Stat label="Missing H1" value={fmt(idx.filter((p) => !p.h1).length)} tone={idx.some((p) => !p.h1) ? 'bad' : 'ok'} />
            </div>
            {sf.crawledAt && <p className="text-sm text-slate-600">Crawl date in file: <b>{sf.crawledAt}</b></p>}
            <Warnings items={sf.warnings} />
            <Remove onClick={() => set({ sf: undefined })} />
          </div>
        )}
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="2. Client Error (4xx) export" right={s.sf4xx ? <Chip tone="ok">Added</Chip> : <Chip>Optional</Chip>}>
          <DropZone label="Drop the 4xx CSV here" accept=".csv" busy={b.busy} onFiles={(f) => b.run(async () => set({ sf4xx: await parseSf4xx(f[0]) }))} />
          {b.err && <div className="mt-3"><Alert tone="bad">{b.err}</Alert></div>}
          {s.sf4xx && <div className="mt-3 space-y-2"><p className="text-sm">{s.sf4xx.rows.length} error URLs found.</p><Warnings items={s.sf4xx.warnings} /><Remove onClick={() => set({ sf4xx: undefined })} /></div>}
        </Card>
        <Card title="3. Missing alt text export" right={s.sfImg ? <Chip tone="ok">Added</Chip> : <Chip>Optional</Chip>}>
          <DropZone label="Drop the images CSV here" accept=".csv" busy={c.busy} onFiles={(f) => c.run(async () => set({ sfImg: await parseSfImages(f[0], s.project.website) }))} />
          {c.err && <div className="mt-3"><Alert tone="bad">{c.err}</Alert></div>}
          {s.sfImg && <div className="mt-3 space-y-2"><p className="text-sm">{s.sfImg.total} images without alt text ({s.sfImg.own} own, {s.sfImg.external} on other websites).</p><Warnings items={s.sfImg.warnings} /><Remove onClick={() => set({ sfImg: undefined })} /></div>}
        </Card>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ 5 Speed + security
export function SpeedStep({ s, set }: StepProps) {
  const psi = s.psi, sec = s.security
  const up = (p: Partial<typeof psi>) => set({ psi: { ...psi, ...p } })
  const us = (p: Partial<typeof sec>) => set({ security: { ...sec, ...p } })
  const grades = ['', 'A+', 'A', 'B', 'C', 'D', 'E', 'F']
  return (
    <div className="space-y-5">
      <HowTo title="How to run PageSpeed (2 minutes, free, no login)" steps={[
        <>Open <a className="font-medium text-teal-600 underline" href="https://pagespeed.web.dev/" target="_blank" rel="noreferrer">pagespeed.web.dev</a>, type the homepage address and press Analyze.</>,
        <>Read the Performance score and the LCP and TBT numbers on the <b>Mobile</b> tab. Run mobile <b>3 times</b>, because scores move between runs. The report uses the median.</>,
        <>Open the <b>Desktop</b> tab and note the same numbers.</>,
        <>Keep a screenshot of each run as evidence.</>,
      ]} />
      <Card title="PageSpeed numbers" subtitle="Type the numbers from your runs.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date of the test"><input type="date" className="input" value={psi.date} onChange={(e) => up({ date: e.target.value })} /></Field>
          <Field label="Mobile performance scores" hint="Comma separated, e.g. 38, 42, 38"><input className="input" value={psi.mobileScores} onChange={(e) => up({ mobileScores: e.target.value })} /></Field>
          <Field label="Mobile LCP (seconds)" hint="Good is under 2.5"><input className="input" value={psi.mobileLcp} onChange={(e) => up({ mobileLcp: e.target.value })} placeholder="25.2, 47.0, 49.1" /></Field>
          <Field label="Mobile TBT (ms), optional"><input className="input" value={psi.mobileTbt} onChange={(e) => up({ mobileTbt: e.target.value })} /></Field>
          <Field label="Desktop performance scores"><input className="input" value={psi.desktopScores} onChange={(e) => up({ desktopScores: e.target.value })} /></Field>
          <Field label="Desktop LCP (seconds)"><input className="input" value={psi.desktopLcp} onChange={(e) => up({ desktopLcp: e.target.value })} /></Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={psi.fieldData} onChange={(e) => up({ fieldData: e.target.checked })} /> PageSpeed showed real-user (field) data for this site</label>
      </Card>
      <Card title="Security check" subtitle="Takes 5 minutes, no login needed.">
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li><a className="font-medium text-teal-600 underline" href="https://www.ssllabs.com/ssltest/" target="_blank" rel="noreferrer">SSL Labs</a>: enter the domain, wait 2 to 3 minutes, note the grade.</li>
          <li><a className="font-medium text-teal-600 underline" href="https://securityheaders.com/" target="_blank" rel="noreferrer">securityheaders.com</a>: scan the site, note the grade and the red (missing) headers.</li>
          <li>Type the address with <b>http://</b> in a browser. Does it jump to https?</li>
        </ul>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="SSL Labs grade"><select className="input" value={sec.ssl} onChange={(e) => us({ ssl: e.target.value })}>{grades.map((g) => <option key={g} value={g}>{g || 'Not checked'}</option>)}</select></Field>
          <Field label="Security headers grade"><select className="input" value={sec.headers} onChange={(e) => us({ headers: e.target.value })}>{grades.map((g) => <option key={g} value={g}>{g || 'Not checked'}</option>)}</select></Field>
          <Field label="http redirects to https?"><select className="input" value={sec.httpsRedirect} onChange={(e) => us({ httpsRedirect: e.target.value as typeof sec.httpsRedirect })}><option value="">Not checked</option><option>Yes</option><option>No</option></select></Field>
        </div>
        <div className="mt-4"><Field label="Missing headers (optional)" hint="Copy the red ones, e.g. Strict-Transport-Security, X-Frame-Options"><input className="input" value={sec.missingHeaders} onChange={(e) => us({ missingHeaders: e.target.value })} /></Field></div>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ 6 Keywords + competitors
export function KeywordStep({ s, set }: StepProps) {
  const rows = s.keywords
  const upd = (i: number, p: Partial<KeywordRow>) => set({ keywords: rows.map((r, j) => (j === i ? { ...r, ...p } : r)) })
  const importQ = () => {
    const top = [...(s.gsc?.queries ?? [])].sort((a, b) => b.impressions - a.impressions).slice(0, 30)
    const have = new Set(rows.map((r) => r.keyword.toLowerCase()))
    const add: KeywordRow[] = top.filter((q) => !have.has(q.q.toLowerCase())).map((q, i) => ({ keyword: q.q, intent: 'Compare', target: '', priority: i < 10 ? 'High' : 'Medium' }))
    set({ keywords: [...rows, ...add] })
  }
  const comp = s.competitors
  const updC = (i: number, p: Partial<CompRow>) => set({ competitors: comp.map((r, j) => (j === i ? { ...r, ...p } : r)) })
  return (
    <div className="space-y-5">
      <Card title="Keywords" subtitle="30 to 50 phrases customers type into Google. Buy = ready to contact, Compare = choosing, Learn = wants information. Mark your 10 most important as High."
        right={<button className="btn btn-ghost" disabled={!s.gsc?.queries.length} onClick={importQ} title={s.gsc ? '' : 'Add the Search Console export first'}>Import top queries</button>}>
        {rows.length === 0 && <p className="mb-3 text-sm text-slate-500">No keywords yet. Add them by hand, or import the top queries from Search Console (a 3-month export gives the best list).</p>}
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[2fr_1fr_2fr_1fr_auto]">
              <input className="input" placeholder="Keyword" value={r.keyword} onChange={(e) => upd(i, { keyword: e.target.value })} />
              <select className="input" value={r.intent} onChange={(e) => upd(i, { intent: e.target.value as KeywordRow['intent'] })}><option>Buy</option><option>Compare</option><option>Learn</option></select>
              <input className="input" placeholder="Target page URL" value={r.target} onChange={(e) => upd(i, { target: e.target.value })} />
              <select className="input" value={r.priority} onChange={(e) => upd(i, { priority: e.target.value as KeywordRow['priority'] })}><option>High</option><option>Medium</option><option>Low</option></select>
              <button className="px-2 text-sm font-semibold text-red-600" onClick={() => set({ keywords: rows.filter((_, j) => j !== i) })}>Delete</button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost mt-3" onClick={() => set({ keywords: [...rows, { keyword: '', intent: 'Buy', target: '', priority: 'Medium' }] })}>+ Add keyword</button>
      </Card>
      <Card title="Competitors" subtitle="Search your top 5 keywords on Google (in a private window). The business websites that appear again and again are the competitors. Write only what you saw on their site.">
        <div className="space-y-3">
          {comp.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
              <input className="input" placeholder="Competitor name" value={r.name} onChange={(e) => updC(i, { name: e.target.value })} />
              <input className="input" placeholder="Website" value={r.website} onChange={(e) => updC(i, { website: e.target.value })} />
              <input className="input sm:col-span-2" placeholder="Keyword where they rank" value={r.keyword} onChange={(e) => updC(i, { keyword: e.target.value })} />
              <textarea className="input" rows={2} placeholder="What they do well" value={r.good} onChange={(e) => updC(i, { good: e.target.value })} />
              <textarea className="input" rows={2} placeholder="Gap we can fill" value={r.gap} onChange={(e) => updC(i, { gap: e.target.value })} />
              <input className="input sm:col-span-2" placeholder="Notes (optional)" value={r.notes} onChange={(e) => updC(i, { notes: e.target.value })} />
              <button className="text-left text-sm font-semibold text-red-600" onClick={() => set({ competitors: comp.filter((_, j) => j !== i) })}>Delete competitor</button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost mt-3" onClick={() => set({ competitors: [...comp, { name: '', website: '', keyword: '', good: '', gap: '', notes: '' }] })}>+ Add competitor</button>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ 7 AEO
export function AeoStep({ s, set }: StepProps) {
  const [bulk, setBulk] = useState('')
  const [target, setTarget] = useState('')
  const [source, setSource] = useState<QRow['source']>('People Also Ask')
  const qs = s.questions
  const upd = (i: number, p: Partial<QRow>) => set({ questions: qs.map((r, j) => (j === i ? { ...r, ...p } : r)) })
  const add = () => {
    const have = new Set(qs.map((q) => q.question.toLowerCase()))
    const rows: QRow[] = lines(bulk).filter((q) => !have.has(q.toLowerCase())).map((question) => ({ question, source, target, answered: false }))
    set({ questions: [...qs, ...rows] }); setBulk('')
  }
  return (
    <div className="space-y-5">
      <HowTo title="How to find the questions" steps={[
        <>Search the main service words in Google. Open the <b>People also ask</b> box and click each question: Google adds more.</>,
        <>Type <b>how, what, why, cost, best</b> plus the topic in the search box and note the suggestions.</>,
        <>Ask the owner which questions customers ask by phone or WhatsApp. Those are the most valuable.</>,
        <>Aim for 15 to 20 questions customers would really ask a business. Skip learner and career questions.</>,
      ]} />
      <Card title="Add questions" subtitle="One question per line, in the customer's words.">
        <textarea className="input" rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'How much does a website cost in India?\nHow long does it take to build an app?'} />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select className="input" value={source} onChange={(e) => setSource(e.target.value as QRow['source'])}>{['People Also Ask', 'Google suggestions', 'Search Console', 'Customer'].map((x) => <option key={x}>{x}</option>)}</select>
          <input className="input sm:col-span-2" placeholder="Target page URL where the answer goes (optional, change later)" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <button className="btn btn-primary mt-3" disabled={!lines(bulk).length} onClick={add}>Add {lines(bulk).length || ''} questions</button>
      </Card>
      {qs.length > 0 && (
        <Card title={`Questions (${qs.length})`} subtitle="Tick Answered once the answer is live on the website.">
          <div className="space-y-2">
            {qs.map((q, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[3fr_2fr_auto_auto] sm:items-center">
                <input className="input" value={q.question} onChange={(e) => upd(i, { question: e.target.value })} />
                <input className="input" placeholder="Target page URL" value={q.target} onChange={(e) => upd(i, { target: e.target.value })} />
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={q.answered} onChange={(e) => upd(i, { answered: e.target.checked })} /> Answered</label>
                <button className="px-2 text-sm font-semibold text-red-600" onClick={() => set({ questions: qs.filter((_, j) => j !== i) })}>Delete</button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ 8 GEO
export function AiStep({ s, set }: StepProps) {
  const { busy, err, run } = useBusy()
  const [paste, setPaste] = useState('')
  const [tool, setTool] = useState('Gemini')
  const [runNo, setRunNo] = useState('1')
  const [date, setDate] = useState(todayIso())
  const m = buildModel(s)
  const addPaste = () => {
    const rows: AiRow[] = lines(paste).map((l) => {
      const c = l.split(/\t|\|/).map((x) => x.trim())
      return { question: c[0], tool, run: parseInt(runNo) || 1, named: /^(y|yes|true|1)$/i.test(c[1] ?? ''), source: c[2] ? /^(y|yes|true|1)$/i.test(c[2]) : null, competitors: c[3] ?? '', date }
    }).filter((r) => r.question)
    const all = [...(s.ai ?? []), ...rows]
    set({ ai: all, aiQuestions: [...new Set(all.map((r) => r.question))] }); setPaste('')
  }
  const sample = 'Date,Question,Tool,Run,Business named,Our website shown as a source,Competitors named\n2026-11-03,Which is the best web development company in your city?,Gemini,1,No,No,Competitor A; Competitor B\n'
  return (
    <div className="space-y-5">
      <HowTo title="How to run the AI check" steps={[
        <>Write 20 questions a customer might ask an AI tool: some with the city name, some without, some with only the service name. Use the <b>same 20 every month</b>.</>,
        <>Open ChatGPT, Gemini, Perplexity and Google AI Mode in a private window. Ask each question in a <b>new chat</b>, twice (Run 1 and Run 2), because answers change.</>,
        <>For each answer note: was the business named? Was the website shown as a source? Which competitors appeared?</>,
        <>The score is how many questions named the business at least once. Look at the trend over months, not one result.</>,
      ]} />
      <Card title="Paste results" subtitle="One line per question, separated by a | (or paste straight from Excel): Question | Named (Yes/No) | Website shown as source (Yes/No, optional) | Competitors (optional)">
        {s.aiQuestions.length > 0 && !paste && <button className="btn btn-ghost mb-3" onClick={() => setPaste(s.aiQuestions.map((q) => `${q} | | |`).join('\n'))}>Use the {s.aiQuestions.length} questions from last time</button>}
        <textarea className="input font-mono text-xs" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Which company builds AI chatbots for factories? | No | | Competitor A, Competitor B'} />
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <select className="input" value={tool} onChange={(e) => setTool(e.target.value)}>{['ChatGPT', 'Gemini', 'Perplexity', 'Google AI Mode'].map((x) => <option key={x}>{x}</option>)}</select>
          <select className="input" value={runNo} onChange={(e) => setRunNo(e.target.value)}><option value="1">Run 1</option><option value="2">Run 2</option></select>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-primary" disabled={!lines(paste).length} onClick={addPaste}>Add results</button>
        </div>
      </Card>
      <Card title="Or upload a CSV" right={<button className="btn btn-ghost" onClick={() => download(new Blob([sample], { type: 'text/csv' }), 'ai-check-template.csv', 'text/csv')}>Download template</button>}>
        <DropZone label="Drop the AI check CSV here" accept=".csv" busy={busy} onFiles={(f) => run(async () => { const all = [...(s.ai ?? []), ...(await parseAiCsv(f[0]))]; set({ ai: all, aiQuestions: [...new Set(all.map((r) => r.question))] }) })} />
        {err && <div className="mt-3"><Alert tone="bad">{err}</Alert></div>}
      </Card>
      {s.ai && s.ai.length > 0 && m.ai && (
        <Card title="Result so far" right={<button className="text-xs font-semibold text-red-600 underline" onClick={() => set({ ai: undefined })}>Clear all</button>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Business named in" value={`${m.ai.named} of ${m.ai.asked}`} tone={m.ai.named ? 'ok' : 'bad'} />
            <Stat label="Tools" value={m.ai.tools.join(', ')} /><Stat label="Runs" value={String(m.ai.runs)} /><Stat label="Rows" value={String(s.ai.length)} />
          </div>
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ 9 Work
export function WorkStep({ s, set }: StepProps) {
  return (
    <div className="space-y-5">
      <Card title={`Work completed in ${monthLabel(s.project.month)}`} subtitle="One line per task, only what was really done inside the reporting month. If nothing was done, leave it empty and the report will say no work was recorded.">
        <textarea className="input" rows={6} value={s.workInPeriod} onChange={(e) => set({ workInPeriod: e.target.value })} placeholder={'Rewrote titles and meta descriptions on 4 service pages\nPublished 1 new blog post'} />
      </Card>
      <Card title="Other work, outside the month or date not recorded" subtitle="Shown separately so the month's report stays honest.">
        <textarea className="input" rows={4} value={s.workOutside} onChange={(e) => set({ workOutside: e.target.value })} />
      </Card>
      <Card title="Notes for the Monthly Tracker (optional)" subtitle="Anything unusual: a redesign, the site being down, a big jump in a number and what you think caused it.">
        <textarea className="input" rows={3} value={s.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ 10 Review + export
export function ReviewStep({ s, set, onReset }: StepProps & { onReset: () => void }) {
  const m = buildModel(s)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [pages, setPages] = useState(0)
  const name = (s.project.company || 'Project').replace(/[^\w]+/g, '-')
  const { start, end } = monthRange(s.project.month)

  const xlsx = async () => {
    setBusy('xlsx'); setErr('')
    try {
      const [{ buildWorkbook }, tpl] = await Promise.all([import('../lib/exportXlsx'), fetch(import.meta.env.BASE_URL + 'template.xlsx').then((r) => { if (!r.ok) throw new Error('Template file not found'); return r.arrayBuffer() })])
      download(await buildWorkbook(s, tpl), `${name}-SEO-Workbook-${monthLabel(s.project.month).replace(' ', '-')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy('') }
  }
  const pdf = async (save: boolean) => {
    setBusy('pdf'); setErr('')
    try {
      const { buildPdfDetailed } = await import('../lib/exportPdf')
      const { buf, pages } = buildPdfDetailed(s)
      setPages(pages)
      const blob = new Blob([buf], { type: 'application/pdf' })
      if (save) download(blob, `${name}-Monthly-SEO-Report-${monthLabel(s.project.month).replace(' ', '-')}.pdf`, 'application/pdf')
      else { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(URL.createObjectURL(blob)) }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy('') }
  }

  const gscOk = m.gscOk, ga = s.ga4
  const items: { name: string; tone: 'ok' | 'warn' | 'idle' | 'bad'; text: string; need: boolean }[] = [
    { name: 'Project details', need: true, tone: s.project.company && s.project.website ? 'ok' : 'bad', text: s.project.company && s.project.website ? 'Done' : 'Add company and website' },
    { name: 'Search Console', need: true, tone: gscOk ? 'ok' : 'warn', text: gscOk ? `Added (${s.gsc!.start} to ${s.gsc!.end})` : 'Pending: clicks, impressions, CTR and position will show Pending' },
    { name: 'Google Analytics 4', need: true, tone: ga && !ga.empty ? 'ok' : 'warn', text: ga ? (ga.empty ? 'File had no data: organic visitors Not tracked' : 'Added') : 'Pending: organic visitors will show Pending' },
    { name: 'Enquiries', need: false, tone: s.enquiries.trim() ? 'ok' : 'idle', text: s.enquiries.trim() ? 'Entered' : 'Not available' },
    { name: 'Site crawl (Screaming Frog)', need: true, tone: s.sf ? 'ok' : 'warn', text: s.sf ? 'Added' : 'Missing: no crawl findings or page review' },
    { name: 'PageSpeed', need: true, tone: m.p.mobileScore !== undefined ? 'ok' : 'warn', text: m.p.mobileScore !== undefined ? 'Added' : 'Missing' },
    { name: 'Security check', need: false, tone: s.security.ssl || s.security.headers ? 'ok' : 'idle', text: s.security.ssl || s.security.headers ? 'Added' : 'Not checked' },
    { name: 'Keywords', need: true, tone: s.keywords.length ? (s.keywords.length >= 30 ? 'ok' : 'warn') : 'warn', text: s.keywords.length ? `${s.keywords.length} listed (playbook: 30 to 50)` : 'None added' },
    { name: 'Competitors', need: true, tone: s.competitors.length >= 3 ? 'ok' : 'warn', text: `${s.competitors.length} added (aim for 3 to 5)` },
  ]
  if (hasAeo(s)) items.push({ name: 'AEO questions', need: true, tone: s.questions.length >= 15 ? 'ok' : 'warn', text: `${s.questions.length} added (aim for 15 to 20)` })
  if (hasGeo(s)) items.push({ name: 'AI check', need: true, tone: m.ai ? 'ok' : 'warn', text: m.ai ? `${m.ai.named} of ${m.ai.asked} named` : 'Not added' })
  const done = items.filter((i) => i.tone === 'ok').length

  return (
    <div className="space-y-5">
      <Card title="Data checklist" subtitle={`${done} of ${items.length} ready. Missing items are marked Pending, never filled with guesses.`}>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-teal-500" style={{ width: `${(done / items.length) * 100}%` }} /></div>
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((i) => (
            <li key={i.name} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{i.name}</span>
              <span className="flex items-center gap-2 text-right text-slate-600">{i.text}<Chip tone={i.tone}>{i.tone === 'ok' ? 'Ready' : i.tone === 'bad' ? 'Needed' : i.tone === 'warn' ? 'Pending' : 'Optional'}</Chip></span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Report preview" subtitle={`${monthLabel(s.project.month)} (${start} to ${end})`}>
        <p className="mb-4 text-sm text-slate-700">{m.summary}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {m.kpis.map((k) => <Stat key={k.label} label={k.label} value={k.value} tone={k.real ? (k.bad ? 'bad' : 'idle') : 'idle'} />)}
        </div>
        {m.findings.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-3">Priority</th><th className="py-2 pr-3">Area</th><th className="py-2">Finding</th></tr></thead>
              <tbody>{m.findings.map((f, i) => (<tr key={i} className="border-b border-slate-100 align-top"><td className="py-2 pr-3"><Chip tone={f.priority === 'High' ? 'bad' : f.priority === 'Medium' ? 'warn' : 'idle'}>{f.priority}</Chip></td><td className="py-2 pr-3 text-slate-600">{f.area}</td><td className="py-2">{f.issue}</td></tr>))}</tbody></table>
          </div>
        )}
      </Card>

      <CustomTemplateCard s={s} />

      <Card title="Download">
        {err && <div className="mb-3"><Alert tone="bad">{err}</Alert></div>}
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={!!busy} onClick={xlsx}>{busy === 'xlsx' ? 'Building...' : 'Download Excel workbook'}</button>
          <button className="btn btn-dark" disabled={!!busy} onClick={() => pdf(true)}>{busy === 'pdf' ? 'Building...' : 'Download one-page PDF'}</button>
          <button className="btn btn-ghost" disabled={!!busy} onClick={() => pdf(false)}>Preview PDF</button>
          <button className="btn btn-ghost ml-auto" onClick={() => { if (confirm('Delete all data in this browser and start again?')) onReset() }}>Start a new report</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Everything runs in your browser. Your files are not uploaded to any server. The workbook uses the original template: sheets, dropdowns and formulas are kept. Add file links in the Evidence column and set Owner before sending.</p>
        {pages > 0 && <p className="mt-3 text-sm font-medium text-slate-700">The PDF has {pages} page{pages > 1 ? 's' : ''}{s.cfg.template === 'compact' && pages > 1 ? '. The content is too long for one page, so it continues on page 2. Turn off a section in Report design to fit one page.' : '.'}</p>}
        {pdfUrl && <iframe title="PDF preview" src={pdfUrl} className="mt-4 h-[780px] w-full rounded-xl border border-slate-200" />}
      </Card>
    </div>
  )
}
void isArchive
