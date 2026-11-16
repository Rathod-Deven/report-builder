import { useState } from 'react'
import { AppState } from '../types'
import { LIST_HELP, SCALAR_HELP, placeholderData } from '../lib/placeholders'
import { Alert, Card, Chip, DropZone, download } from '../ui'

const MIME: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function CustomTemplateCard({ s }: { s: AppState }) {
  const [file, setFile] = useState<{ name: string; buf: ArrayBuffer; kind: 'docx' | 'xlsx' | 'pptx' } | null>(null)
  const [scan, setScan] = useState<{ found: string[]; unknown: string[] } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)

  const load = async (f: File) => {
    setErr(''); setScan(null); setBusy(true)
    try {
      const { kindOf, scanTemplate } = await import('../lib/fillTemplate')
      const kind = kindOf(f.name)
      if (!kind) throw new Error('Use a Word (.docx), Excel (.xlsx) or PowerPoint (.pptx) file.')
      const buf = await f.arrayBuffer()
      setFile({ name: f.name, buf, kind })
      setScan(await scanTemplate(buf, kind))
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setFile(null) } finally { setBusy(false) }
  }
  const fill = async () => {
    if (!file) return
    setBusy(true); setErr('')
    try {
      const { fillTemplate } = await import('../lib/fillTemplate')
      const out = await fillTemplate(file.buf, file.kind, placeholderData(s))
      download(out, file.name.replace(/\.(docx|xlsx|pptx)$/i, '') + `-${s.project.month}-filled.${file.kind}`, MIME[file.kind])
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const starter = async () => {
    const { makeStarterDocx } = await import('../lib/fillTemplate')
    download(await makeStarterDocx(), 'starter-template.docx', MIME.docx)
  }

  return (
    <Card title="Use your own design" subtitle="Do not like the 3 built-in templates? Bring a Word, Excel or PowerPoint file. Type {{clicks}} or {{company}} where a value should go, and the tool fills it in. Your fonts, colours and layout stay exactly as you made them."
      right={<Chip tone="info">Word, Excel, PowerPoint</Chip>}>
      <div className="mb-4 flex flex-wrap gap-3">
        <button className="btn btn-ghost" onClick={starter}>Download a starter template (.docx)</button>
        <button className="btn btn-ghost" onClick={() => setHelp(!help)}>{help ? 'Hide' : 'Show'} the list of placeholders</button>
      </div>
      {help && (
        <div className="mb-4 max-h-80 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div>
            <p className="mb-2 font-semibold text-navy-800">Single values</p>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{SCALAR_HELP.map(([n, d]) => <p key={n}><code className="rounded bg-white px-1.5 py-0.5 text-teal-600 ring-1 ring-slate-200">{`{{${n}}}`}</code> <span className="text-slate-600">{d}</span></p>)}</div>
          </div>
          <div>
            <p className="mb-1 font-semibold text-navy-800">Repeating table rows</p>
            <p className="mb-2 text-slate-600">Put <code className="rounded bg-white px-1.5 py-0.5 text-teal-600 ring-1 ring-slate-200">{'{{#findings}}'}</code> in the first cell of a table row and use the fields in that same row. The row repeats once per item. Add a limit like <code className="rounded bg-white px-1.5 py-0.5 text-teal-600 ring-1 ring-slate-200">{'{{#findings:5}}'}</code> to show only the first 5 (useful on slides). Works in Word, PowerPoint and Excel.</p>
            <ul className="space-y-1">{LIST_HELP.map((l) => <li key={l.name}><code className="rounded bg-white px-1.5 py-0.5 text-teal-600 ring-1 ring-slate-200">{`{{#${l.name}}}`}</code> <span className="text-slate-600">{l.desc}: {l.fields.map((f) => `{{${l.name}.${f}}}`).join('  ')}</span></li>)}</ul>
          </div>
          <p className="text-slate-600">A value on its own line that has several lines (such as <code>{'{{next_actions}}'}</code>) becomes one paragraph per line in Word and PowerPoint. Missing data is filled with Pending, Not tracked or Not available.</p>
        </div>
      )}
      <DropZone label="Drop your template here" hint=".docx, .xlsx or .pptx" accept=".docx,.xlsx,.pptx" busy={busy} onFiles={(f) => load(f[0])} />
      {err && <div className="mt-3"><Alert tone="bad">{err}</Alert></div>}
      {file && scan && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700"><b>{file.name}</b>: {scan.found.length} placeholder{scan.found.length === 1 ? '' : 's'} found.</p>
          {scan.found.length === 0 && <Alert tone="warn">No placeholders found. Type something like {'{{company}}'} in your file where the value should appear.</Alert>}
          <div className="flex flex-wrap gap-1.5">{scan.found.map((t) => <Chip key={t} tone={scan.unknown.includes(t) ? 'bad' : 'ok'}>{`{{${t}}}`}</Chip>)}</div>
          {scan.unknown.length > 0 && <Alert tone="warn" title="Not recognised">These will stay as they are in the filled file. Check the spelling against the list of placeholders: {scan.unknown.map((t) => `{{${t}}}`).join(', ')}</Alert>}
          <button className="btn btn-primary" disabled={busy || scan.found.length === 0} onClick={fill}>{busy ? 'Filling...' : `Download filled ${file.kind.toUpperCase()}`}</button>
          {file.kind === 'xlsx' && <p className="text-xs text-slate-500">Excel files are re-saved by the tool. Plain data and formatting are kept, but charts and pictures inside the file may be lost.</p>}
          <p className="text-xs text-slate-500">To get a PDF, open the filled file and use Save as PDF.</p>
        </div>
      )}
    </Card>
  )
}
