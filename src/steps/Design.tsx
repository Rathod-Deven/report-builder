import { useState } from 'react'
import { CustomBlock, SECTION_TITLES, SHEET_NAMES, Snapshot, TemplateId, presetSections } from '../types'
import { buildModel, hasAeo, hasGeo } from '../lib/model'
import { monthLabel, prevMonth } from '../lib/util'
import { Alert, Card, Chip, Field } from '../ui'
import { StepProps } from './helpers'

const TEMPLATES: { id: TemplateId; name: string; desc: string; tag: string }[] = [
  { id: 'compact', name: 'One-page summary', desc: 'Everything on a single A4 page. KPI cards on top, two columns below. Best for clients who want a quick read.', tag: '1 page' },
  { id: 'detailed', name: 'Detailed report', desc: 'One column, full tables, many findings listed. Flows over several pages with page numbers.', tag: '2 to 4 pages' },
  { id: 'dashboard', name: 'Visual dashboard', desc: 'Large KPI tiles and charts first, then short sections. Best for showing trends.', tag: '1 to 2 pages' },
]

const num = (v: string): number | undefined => (v.trim() === '' || !Number.isFinite(parseFloat(v)) ? undefined : parseFloat(v))

export function DesignStep({ s, set }: StepProps) {
  const cfg = s.cfg
  const m = buildModel(s)
  const [nb, setNb] = useState<CustomBlock>({ id: '', kind: 'text', title: '', body: '' })
  const up = (p: Partial<typeof cfg>) => set({ cfg: { ...cfg, ...p } })
  const move = (i: number, d: -1 | 1) => {
    const a = [...cfg.sections]; const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]; up({ sections: a })
  }
  const avail = (id: string): string => {
    if (id.startsWith('custom:')) return ''
    switch (id) {
      case 'comparison': return m.compare.length ? '' : 'needs last month numbers (below)'
      case 'charts': return s.gsc?.daily.length || s.gsc?.queries.length || m.findings.length ? '' : 'needs Search Console or findings'
      case 'technical': return m.findings.length ? '' : 'needs audit data'
      case 'pages': return m.topPages.length ? '' : 'needs Search Console pages'
      case 'keywords': return s.keywords.length ? '' : 'no keywords yet'
      case 'competitors': return s.competitors.length ? '' : 'no competitors yet'
      case 'aeo_geo': return hasAeo(s) || hasGeo(s) ? '' : 'not in this package'
      case 'next': return m.next.length ? '' : 'needs data first'
      default: return ''
    }
  }
  const titleOf = (id: string) => (id.startsWith('custom:') ? cfg.custom.find((c) => 'custom:' + c.id === id)?.title || 'Custom block' : SECTION_TITLES[id] ?? id)

  const addCustom = () => {
    const id = Math.random().toString(36).slice(2, 8)
    up({ custom: [...cfg.custom, { ...nb, id }], sections: [...cfg.sections, { id: 'custom:' + id, on: true }] })
    setNb({ id: '', kind: 'text', title: '', body: '' })
  }
  const delCustom = (cid: string) => up({ custom: cfg.custom.filter((c) => c.id !== cid), sections: cfg.sections.filter((x) => x.id !== 'custom:' + cid) })

  const logo = (f?: File) => {
    if (!f) return
    if (f.size > 400_000) { alert('Please use a logo under 400 KB (PNG or JPG).'); return }
    const r = new FileReader(); r.onload = () => up({ logo: String(r.result) }); r.readAsDataURL(f)
  }

  const prev: Snapshot = s.prev ?? { month: prevMonth(s.project.month) }
  const upPrev = (p: Partial<Snapshot>) => set({ prev: { ...prev, ...p } })
  const pf: { k: keyof Snapshot; label: string; scale?: number }[] = [
    { k: 'clicks', label: 'Search clicks' }, { k: 'impressions', label: 'Impressions' }, { k: 'ctr', label: 'Average CTR (%)', scale: 100 },
    { k: 'position', label: 'Average position' }, { k: 'organicUsers', label: 'Organic users' }, { k: 'enquiries', label: 'Enquiries' },
    { k: 'mobileScore', label: 'Mobile speed score' }, { k: 'aiNamed', label: 'AI questions named' }, { k: 'answered', label: 'Questions answered' }, { k: 'findings', label: 'Open findings' },
  ]

  return (
    <div className="space-y-5">
      <Card title="1. Choose a template" subtitle="Pick the look. You can still change every section below.">
        <div className="grid gap-3 md:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => up({ template: t.id, sections: [...presetSections(t.id), ...cfg.sections.filter((x) => x.id.startsWith('custom:'))] })}
              className={`rounded-xl border-2 p-4 text-left transition ${cfg.template === t.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-500'}`}>
              <div className="mb-3 flex h-24 flex-col gap-1 rounded-lg bg-slate-100 p-2" aria-hidden>
                <div className="h-3 rounded" style={{ background: cfg.brand }} />
                <div className={`grid flex-1 gap-1 ${t.id === 'dashboard' ? 'grid-cols-3' : 'grid-cols-4'}`}>{Array.from({ length: t.id === 'dashboard' ? 6 : 8 }).map((_, i) => <div key={i} className="rounded bg-white" />)}</div>
                <div className={`grid flex-[1.2] gap-1 ${t.id === 'detailed' ? 'grid-cols-1' : 'grid-cols-2'}`}><div className="rounded bg-white" />{t.id !== 'detailed' && <div className="rounded bg-white" />}</div>
              </div>
              <div className="flex items-center justify-between"><p className="font-bold text-navy-800">{t.name}</p><Chip tone="info">{t.tag}</Chip></div>
              <p className="mt-1 text-xs text-slate-600">{t.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card title="2. Brand" subtitle="Colours, logo and title for your own agency or client.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Report title" hint="Leave empty for an automatic title."><input className="input" value={cfg.title} onChange={(e) => up({ title: e.target.value })} placeholder="Monthly SEO, AEO & GEO Report" /></Field>
          <Field label="Logo (PNG or JPG, under 400 KB)">
            <div className="flex items-center gap-3">
              <input type="file" accept="image/png,image/jpeg" onChange={(e) => logo(e.target.files?.[0])} className="text-sm" />
              {cfg.logo && <><img src={cfg.logo} alt="logo" className="h-9 rounded border bg-white p-1" /><button className="text-xs font-semibold text-red-600 underline" onClick={() => up({ logo: undefined })}>Remove</button></>}
            </div>
          </Field>
          <Field label="Main colour"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-slate-300" value={cfg.brand} onChange={(e) => up({ brand: e.target.value })} /></Field>
          <Field label="Accent colour"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-slate-300" value={cfg.accent} onChange={(e) => up({ accent: e.target.value })} /></Field>
        </div>
      </Card>

      <Card title="3. Sections" subtitle="Tick what you want in the report and move sections up or down. A section with no data is skipped, never filled with guesses.">
        {cfg.template !== 'detailed' && <p className="mb-3 text-xs text-slate-500">In the two-column templates, KPI cards, comparison and charts always sit at the top, full width.</p>}
        <ul className="divide-y divide-slate-100">
          {cfg.sections.map((x, i) => {
            const note = x.on ? avail(x.id) : ''
            return (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <input type="checkbox" checked={x.on} onChange={(e) => up({ sections: cfg.sections.map((y) => (y.id === x.id ? { ...y, on: e.target.checked } : y)) })} className="h-4 w-4" />
                <span className="flex-1 text-sm font-medium text-slate-800">{titleOf(x.id)}{x.id.startsWith('custom:') && <span className="ml-2"><Chip tone="info">Custom</Chip></span>}</span>
                {note && <Chip tone="warn">{note}</Chip>}
                <button className="rounded border px-2 text-sm disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">&uarr;</button>
                <button className="rounded border px-2 text-sm disabled:opacity-30" disabled={i === cfg.sections.length - 1} onClick={() => move(i, 1)} aria-label="Move down">&darr;</button>
                {x.id.startsWith('custom:') && <button className="text-xs font-semibold text-red-600 underline" onClick={() => delCustom(x.id.slice(7))}>Delete</button>}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card title="4. Add your own block" subtitle="Text, KPI cards or a table. It becomes a section you can reorder above.">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <select className="input" value={nb.kind} onChange={(e) => setNb({ ...nb, kind: e.target.value as CustomBlock['kind'] })}>
            <option value="text">Text (lines starting with - become bullets)</option><option value="kpi">KPI cards</option><option value="table">Table</option>
          </select>
          <input className="input" placeholder="Block title, e.g. Social media highlights" value={nb.title} onChange={(e) => setNb({ ...nb, title: e.target.value })} />
        </div>
        <textarea className="input mt-3 font-mono text-xs" rows={5} value={nb.body} onChange={(e) => setNb({ ...nb, body: e.target.value })}
          placeholder={nb.kind === 'kpi' ? 'One card per line: Label | Value | Note\nFollowers | 1,240 | +80 this month\nAd spend | 12,000 | Google Ads' : nb.kind === 'table' ? 'First line is the header. Separate columns with |\nCampaign | Spend | Clicks\nBrand | 4,000 | 820' : '- Posted 12 reels\n- Best post reached 8,000 people'} />
        <button className="btn btn-primary mt-3" disabled={!nb.title.trim() || !nb.body.trim()} onClick={addCustom}>Add block</button>
      </Card>

      <Card title="5. Last month, for comparison (optional)" subtitle={s.prev ? `Loaded for ${monthLabel(prev.month)}. You can edit the numbers.` : 'Type last month\'s numbers, or use "Start next month" at the top to load them from a saved file. Leave a box empty if you do not have it.'}>
        <div className="grid gap-3 sm:grid-cols-3">
          {pf.map((f) => {
            const raw = prev[f.k] as number | undefined
            return (
              <Field key={f.k} label={f.label}>
                <input className="input" inputMode="decimal" value={raw === undefined ? '' : String(f.scale ? Math.round(raw * f.scale * 100) / 100 : raw)}
                  onChange={(e) => { const n = num(e.target.value); upPrev({ [f.k]: n === undefined ? undefined : f.scale ? n / f.scale : n } as Partial<Snapshot>) }} />
              </Field>
            )
          })}
        </div>
        {s.prev && <button className="mt-3 text-xs font-semibold text-red-600 underline" onClick={() => set({ prev: undefined })}>Clear last month's numbers</button>}
      </Card>

      <Card title="6. Excel workbook sheets" subtitle="Choose which sheets go into the workbook.">
        <div className="grid gap-2 sm:grid-cols-2">
          {SHEET_NAMES.map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.sheets[n] !== false} onChange={(e) => up({ sheets: { ...cfg.sheets, [n]: e.target.checked } })} /> {n}</label>
          ))}
        </div>
        {SHEET_NAMES.some((n) => n !== 'Read Me' && cfg.sheets[n] === false) && cfg.sheets['Read Me'] !== false && (
          <div className="mt-3"><Alert tone="info">The Read Me sheet counts rows in the other sheets, so it will be left out when any other sheet is left out.</Alert></div>
        )}
      </Card>
    </div>
  )
}
