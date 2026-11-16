import { AppState, emptyState } from '../types'
import { buildModel } from './model'
import { nextMonth } from './util'

const uniq = (a: string[]) => [...new Set(a.filter(Boolean))]

/** A report file is plain JSON. It holds the whole project so you can reopen it next month. */
export function serialize(s: AppState): string {
  const aiQuestions = uniq([...(s.ai?.map((r) => r.question) ?? []), ...s.aiQuestions])
  return JSON.stringify({ app: 'seo-report-builder', version: 1, state: { ...s, aiQuestions } }, null, 1)
}

export function parseSaved(text: string): AppState {
  let j: unknown
  try { j = JSON.parse(text) } catch { throw new Error('This file is not a saved report (it is not valid JSON).') }
  const o = j as { app?: string; state?: Partial<AppState> }
  if (o?.app !== 'seo-report-builder' || !o.state) throw new Error('This file was not saved by SEO Report Builder.')
  const base = emptyState()
  return { ...base, ...o.state, cfg: { ...base.cfg, ...(o.state.cfg ?? {}) }, project: { ...base.project, ...(o.state.project ?? {}) }, psi: { ...base.psi, ...(o.state.psi ?? {}) }, security: { ...base.security, ...(o.state.security ?? {}) } }
}

/** Keep the setup (project, design, keywords, competitors, questions). Clear this month's data. Last month's numbers become the comparison. */
export function startNextMonth(old: AppState): AppState {
  const m = buildModel(old)
  const base = emptyState()
  return {
    ...base,
    project: { ...old.project, month: nextMonth(old.project.month) },
    cfg: old.cfg,
    keywords: old.keywords,
    competitors: old.competitors,
    questions: old.questions,
    aiQuestions: uniq([...(old.ai?.map((r) => r.question) ?? []), ...old.aiQuestions]),
    prev: m.snapshot,
  }
}
