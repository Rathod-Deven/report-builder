import React, { useRef, useState } from 'react'

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'idle'
const tones: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-900 ring-amber-200',
  bad: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  idle: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export const Chip = ({ tone = 'idle', children }: { tone?: Tone; children: React.ReactNode }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>{children}</span>
)

export const Card = ({ title, subtitle, right, children }: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <section className="card-shadow rounded-2xl border border-slate-200/80 bg-white/95 p-5 backdrop-blur sm:p-6">
    {(title || right) && (
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          {title && <h3 className="text-[15px] font-bold tracking-tight text-navy-800">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </header>
    )}
    {children}
  </section>
)

export const Alert = ({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: React.ReactNode }) => (
  <div className={`rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${tones[tone]}`}>
    {title && <p className="font-semibold">{title}</p>}
    {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
  </div>
)

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
  </label>
)

export const HowTo = ({ title = 'How to get this data', steps, links }: { title?: string; steps: React.ReactNode[]; links?: { label: string; href: string }[] }) => (
  <details className="group rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" open>
    <summary className="cursor-pointer select-none font-semibold text-navy-800">{title}</summary>
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-slate-700">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
    {links && (
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {links.map((l) => <a key={l.href} className="font-medium text-teal-600 underline" href={l.href} target="_blank" rel="noreferrer">{l.label}</a>)}
      </p>
    )}
  </details>
)

export function DropZone({ label, hint, accept, multiple, onFiles, busy }: { label: string; hint?: string; accept: string; multiple?: boolean; onFiles: (f: File[]) => void; busy?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = [...e.dataTransfer.files]; if (f.length) onFiles(f) }}
      onClick={() => ref.current?.click()}
      className={`group cursor-pointer rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${over ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-slate-50/60 hover:border-teal-500 hover:bg-teal-50/40'}`}
    >
      <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-white text-teal-600 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
      </div>
      <input ref={ref} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { const f = [...(e.target.files ?? [])]; if (f.length) onFiles(f); e.target.value = '' }} />
      <p className="text-sm font-semibold text-navy-800">{busy ? 'Reading file...' : label}</p>
      <p className="mt-1 text-xs text-slate-500">{hint ?? 'Drop the file here or click to choose'}</p>
    </div>
  )
}

export const Stat = ({ label, value, tone = 'idle' }: { label: string; value: string; tone?: Tone }) => (
  <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 px-3.5 py-2.5 shadow-sm">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`text-lg font-extrabold tracking-tight ${tone === 'bad' ? 'text-red-700' : tone === 'ok' ? 'text-emerald-700' : 'text-navy-800'}`}>{value}</p>
  </div>
)

export const Warnings = ({ items }: { items: string[] }) =>
  items.length ? <div className="space-y-2">{items.map((w, i) => <Alert key={i} tone="warn">{w}</Alert>)}</div> : null

export const download = (data: ArrayBuffer | Blob, name: string, type: string) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
