import { useEffect, useMemo, useState } from 'react'
import { AppState, emptyState } from './types'
import { buildModel, hasAeo, hasGeo } from './lib/model'
import { monthLabel } from './lib/util'
import { APP_NAME, APP_TAGLINE } from './brand'
import { DesignStep } from './steps/Design'
import { parseSaved, serialize, startNextMonth } from './lib/saveload'
import { download } from './ui'
import { AeoStep, AiStep, CrawlStep, Ga4Step, GscStep, KeywordStep, ProjectStep, ReviewStep, SpeedStep, WorkStep } from './steps/Steps'

const KEY = 'seo-report-builder-v1'
const load = (): AppState => {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...emptyState(), ...JSON.parse(raw) } } catch { /* ignore */ }
  return emptyState()
}

type StepId = 'project' | 'gsc' | 'ga4' | 'crawl' | 'speed' | 'keywords' | 'aeo' | 'ai' | 'work' | 'design' | 'review'
const STEPS: { id: StepId; title: string; sub: string; show?: (s: AppState) => boolean }[] = [
  { id: 'project', title: 'Project', sub: 'Name, site, month, package' },
  { id: 'gsc', title: 'Search Console', sub: 'Clicks, impressions, position' },
  { id: 'ga4', title: 'Google Analytics', sub: 'Organic users, enquiries' },
  { id: 'crawl', title: 'Site crawl', sub: 'Titles, meta, H1, alt, 404' },
  { id: 'speed', title: 'Speed and security', sub: 'PageSpeed, SSL, headers' },
  { id: 'keywords', title: 'Keywords and competitors', sub: 'What customers search' },
  { id: 'aeo', title: 'Customer questions', sub: 'AEO answers', show: hasAeo },
  { id: 'ai', title: 'AI visibility', sub: 'GEO check in AI tools', show: hasGeo },
  { id: 'work', title: 'Work done', sub: 'What was completed' },
  { id: 'design', title: 'Report design', sub: 'Template, sections, brand' },
  { id: 'review', title: 'Review and export', sub: 'Excel workbook and PDF' },
]

export default function App() {
  const [s, setS] = useState<AppState>(load)
  const [step, setStep] = useState<StepId>('project')
  const set = (p: Partial<AppState>) => setS((prev) => ({ ...prev, ...p }))

  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage full or blocked */ } }, 400)
    return () => clearTimeout(t)
  }, [s])

  const steps = STEPS.filter((x) => !x.show || x.show(s))
  const idx = Math.max(0, steps.findIndex((x) => x.id === step))
  const cur = steps[idx] ?? steps[0]
  const m = useMemo(() => buildModel(s), [s])

  const status = (id: StepId): 'done' | 'warn' | 'idle' => {
    switch (id) {
      case 'project': return s.project.company && s.project.website ? 'done' : 'idle'
      case 'gsc': return m.gscOk ? 'done' : s.gsc ? 'warn' : 'idle'
      case 'ga4': return s.ga4 ? (s.ga4.empty ? 'warn' : 'done') : 'idle'
      case 'crawl': return s.sf ? 'done' : 'idle'
      case 'speed': return m.p.mobileScore !== undefined ? 'done' : 'idle'
      case 'keywords': return s.keywords.length || s.competitors.length ? 'done' : 'idle'
      case 'aeo': return s.questions.length ? 'done' : 'idle'
      case 'ai': return s.ai?.length ? 'done' : 'idle'
      case 'work': return s.workInPeriod || s.workOutside ? 'done' : 'idle'
      case 'design': return 'done'
      default: return 'idle'
    }
  }

  const readFile = (accept: string, fn: (text: string) => void) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept
    i.onchange = async () => { const f = i.files?.[0]; if (!f) return; try { fn(await f.text()) } catch (e) { alert(e instanceof Error ? e.message : String(e)) } }
    i.click()
  }
  const save = () => download(new Blob([serialize(s)], { type: 'application/json' }), `${(s.project.company || 'report').replace(/[^\w]+/g, '-')}-${s.project.month}.report.json`, 'application/json')
  const open = () => readFile('.json,application/json', (txt) => { setS(parseSaved(txt)); setStep('project') })
  const next = () => readFile('.json,application/json', (txt) => { setS(startNextMonth(parseSaved(txt))); setStep('gsc') })

  const props = { s, set }
  const body = () => {
    switch (cur.id) {
      case 'project': return <ProjectStep {...props} />
      case 'gsc': return <GscStep {...props} />
      case 'ga4': return <Ga4Step {...props} />
      case 'crawl': return <CrawlStep {...props} />
      case 'speed': return <SpeedStep {...props} />
      case 'keywords': return <KeywordStep {...props} />
      case 'aeo': return <AeoStep {...props} />
      case 'ai': return <AiStep {...props} />
      case 'work': return <WorkStep {...props} />
      case 'design': return <DesignStep {...props} />
      default: return <ReviewStep {...props} onReset={() => { localStorage.removeItem(KEY); setS(emptyState()); setStep('project') }} />
    }
  }

  const doneCount = steps.filter((x) => status(x.id) === 'done').length
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="shrink-0 bg-gradient-to-b from-navy-900 via-navy-800 to-[#0c3c52] text-white lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:overflow-y-auto">
        <div className="flex items-center gap-3 px-6 pb-4 pt-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-300 text-navy-900 shadow-lg shadow-teal-500/30">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></svg>
          </div>
          <div><p className="text-base font-extrabold leading-tight tracking-tight">{APP_NAME}</p><p className="text-xs text-white/55">{APP_TAGLINE}</p></div>
        </div>
        <div className="mx-6 mb-3 hidden lg:block">
          <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-white/50"><span>Progress</span><span>{pct}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-300 transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible lg:pb-8">
          {steps.map((x, i) => {
            const st = status(x.id), active = x.id === cur.id
            return (
              <button key={x.id} onClick={() => setStep(x.id)}
                className={`relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition lg:w-full ${active ? 'bg-white/12 ring-1 ring-white/15' : 'hover:bg-white/8'}`}>
                {active && <span className="absolute left-0 top-2 hidden h-[calc(100%-1rem)] w-1 rounded-full bg-teal-500 lg:block" />}
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${st === 'done' ? 'bg-emerald-400/90 text-navy-900' : st === 'warn' ? 'bg-amber-300 text-navy-900' : active ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}>
                  {st === 'done' ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg> : i + 1}
                </span>
                <span className="hidden min-w-0 lg:block"><span className="block truncate text-sm font-semibold">{x.title}</span><span className="block truncate text-xs text-white/50">{x.sub}</span></span>
                <span className="text-sm font-semibold lg:hidden">{x.title}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 px-6 py-4 backdrop-blur-md lg:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-600">Step {idx + 1} of {steps.length}{s.project.company ? ` \u00b7 ${s.project.company}, ${monthLabel(s.project.month)}` : ''}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-800">{cur.title}</h1>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" onClick={save} title="Download this project as a file">Save report file</button>
              <button className="btn btn-ghost" onClick={open} title="Open a saved report file">Open file</button>
              <button className="btn btn-dark" onClick={next} title="Load last month's saved file and start the next month">Start next month</button>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-4xl space-y-5 px-6 py-7 lg:px-10">
          {cur.id === 'project' && (
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-700 to-teal-600 p-7 text-white shadow-xl shadow-navy-800/20">
              <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Monthly reports, without the copy-paste.</h2>
              <p className="mt-2 max-w-xl text-sm text-white/80">Upload your exports, let the tool check them, and download a ready workbook and PDF. Missing data is never guessed. Everything stays in your browser.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                {['Free', 'Runs on your device', 'No login', '3 templates + your own design'].map((x) => <span key={x} className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/20">{x}</span>)}
              </div>
            </section>
          )}
          {body()}
          <div className="flex justify-between pt-2">
            <button className="btn btn-ghost" disabled={idx === 0} onClick={() => { setStep(steps[idx - 1].id); window.scrollTo(0, 0) }}>&larr; Back</button>
            {idx < steps.length - 1 && <button className="btn btn-primary" onClick={() => { setStep(steps[idx + 1].id); window.scrollTo(0, 0) }}>Next &rarr;</button>}
          </div>
          <p className="pb-8 text-center text-xs text-slate-400">Free and open source. Your data stays in this browser. Missing data is marked Pending, never invented.</p>
        </div>
      </main>
    </div>
  )
}
