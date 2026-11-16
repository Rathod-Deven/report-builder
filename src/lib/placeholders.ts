import { AppState } from '../types'
import { autoTitle, buildModel, hasAeo, hasGeo } from './model'
import { fmt, monthLabel, monthRange } from './util'

export type Scalars = Record<string, string>
export type Lists = Record<string, Record<string, string>[]>

/** Everything a custom template can use. Missing data becomes Pending / Not tracked / Not available, never a guess. */
export function placeholderData(s: AppState): { scalars: Scalars; lists: Lists } {
  const m = buildModel(s)
  const g = s.gsc
  const pend = 'Pending'
  const kp = (label: string) => m.kpis.find((k) => k.label.startsWith(label))
  const { start, end } = monthRange(s.project.month)
  const scalars: Scalars = {
    company: s.project.company || '',
    website: s.project.website || '',
    host: m.host,
    prepared_by: s.project.preparedBy || '',
    month: s.project.month,
    month_label: monthLabel(s.project.month),
    period_start: start,
    period_end: end,
    title: autoTitle(s),
    package: s.project.pkg,
    summary: m.summary,
    clicks: kp('Search clicks')!.value,
    impressions: kp('Impressions')!.value,
    ctr: kp('Average CTR')!.value,
    position: kp('Average position')!.value,
    organic_users: kp('Organic users')!.value,
    enquiries: kp('Enquiries')!.value,
    mobile_score: m.p.mobileScore !== undefined ? fmt(m.p.mobileScore) : pend,
    mobile_lcp: m.p.mobileLcp !== undefined ? fmt(m.p.mobileLcp, 1) : pend,
    desktop_score: m.p.desktopScore !== undefined ? fmt(m.p.desktopScore) : pend,
    pages_indexed: s.indexedPages.trim() || pend,
    ai_named: m.ai ? String(m.ai.named) : pend,
    ai_asked: m.ai ? String(m.ai.asked) : pend,
    ai_score: m.ai ? `${m.ai.named} of ${m.ai.asked}` : pend,
    ai_tools: m.ai ? m.ai.tools.join(', ') : pend,
    questions_total: hasAeo(s) ? String(s.questions.length) : 'Not in package',
    questions_answered: hasAeo(s) ? String(m.answered) : 'Not in package',
    findings_total: String(m.findings.length),
    findings_high: String(m.counts.High),
    findings_medium: String(m.counts.Medium),
    findings_low: String(m.counts.Low),
    work_in_period: s.workInPeriod.trim() || `No work recorded for ${monthLabel(s.project.month)}.`,
    work_outside: s.workOutside.trim(),
    notes: m.notes,
    next_actions: m.next.map((t, i) => `${i + 1}. ${t.replace(/<\/?b>/g, '')}`).join('\n'),
    gsc_dates: g ? `${g.start} to ${g.end}` : pend,
  }
  const lists: Lists = {
    kpis: m.kpis.map((k) => ({ label: k.label, value: k.value, sub: k.sub })),
    findings: m.findings.map((f, i) => ({ no: String(i + 1), priority: f.priority, area: f.area, issue: f.issue, url: f.url, evidence: f.evidence, why: f.why, fix: f.fix })),
    keywords: m.keywords.map((k) => ({ keyword: k.keyword, intent: k.intent, target: k.target, priority: k.priority, clicks: k.clicks !== undefined ? fmt(k.clicks) : pend, impressions: k.impressions !== undefined ? fmt(k.impressions) : pend, position: k.position !== undefined ? fmt(k.position, 1) : pend })),
    competitors: s.competitors.map((c) => ({ name: c.name, website: c.website, keyword: c.keyword, good: c.good, gap: c.gap, notes: c.notes })),
    questions: s.questions.map((q) => ({ question: q.question, source: q.source, target: q.target, status: q.answered ? 'Done' : 'Open' })),
    compare: m.compare.map((r) => ({ label: r.label, cur: r.cur, prev: r.prev, delta: r.delta })),
    pages: m.topPages.map((p) => ({ url: p.url, clicks: fmt(p.clicks), impressions: fmt(p.impressions) })),
    ai: hasGeo(s) ? (s.ai ?? []).map((r) => ({ question: r.question, tool: r.tool, run: String(r.run), named: r.named ? 'Yes' : 'No', competitors: r.competitors })) : [],
  }
  return { scalars, lists }
}

export const SCALAR_HELP: [string, string][] = [
  ['company', 'Company or client name'], ['website', 'Website address'], ['host', 'Domain only'], ['prepared_by', 'Your name'],
  ['month', 'YYYY-MM'], ['month_label', 'For example October 2026'], ['period_start', 'First day'], ['period_end', 'Last day'],
  ['title', 'Report title'], ['package', 'SEO, AEO, GEO package'], ['summary', 'Executive summary text'],
  ['clicks', 'Search clicks'], ['impressions', 'Impressions'], ['ctr', 'Average CTR'], ['position', 'Average position'],
  ['organic_users', 'Organic users (GA4)'], ['enquiries', 'Enquiries'], ['mobile_score', 'Mobile speed score (median)'], ['mobile_lcp', 'Mobile LCP in seconds'],
  ['desktop_score', 'Desktop speed score'], ['pages_indexed', 'Pages indexed'], ['ai_score', 'For example 6 of 20'], ['ai_named', 'Questions that named the business'],
  ['ai_asked', 'Questions asked'], ['ai_tools', 'AI tools used'], ['questions_total', 'Customer questions found'], ['questions_answered', 'Customer questions answered'],
  ['findings_total', 'Number of findings'], ['findings_high', 'High priority count'], ['findings_medium', 'Medium priority count'], ['findings_low', 'Low priority count'],
  ['work_in_period', 'Work completed (one line per task)'], ['work_outside', 'Other work, outside the month'], ['notes', 'Notes about the numbers'],
  ['next_actions', "Next month's plan (one line per task)"], ['gsc_dates', 'Dates covered by the Search Console file'],
]
export const LIST_HELP: { name: string; fields: string[]; desc: string }[] = [
  { name: 'kpis', fields: ['label', 'value', 'sub'], desc: 'KPI cards' },
  { name: 'findings', fields: ['no', 'priority', 'area', 'issue', 'url', 'evidence', 'why', 'fix'], desc: 'Audit findings' },
  { name: 'keywords', fields: ['keyword', 'intent', 'target', 'priority', 'clicks', 'impressions', 'position'], desc: 'Keywords' },
  { name: 'competitors', fields: ['name', 'website', 'keyword', 'good', 'gap', 'notes'], desc: 'Competitors' },
  { name: 'questions', fields: ['question', 'source', 'target', 'status'], desc: 'Customer questions' },
  { name: 'compare', fields: ['label', 'cur', 'prev', 'delta'], desc: 'Compared with last month' },
  { name: 'pages', fields: ['url', 'clicks', 'impressions'], desc: 'Top pages from Search Console' },
  { name: 'ai', fields: ['question', 'tool', 'run', 'named', 'competitors'], desc: 'AI check rows' },
]
export const knownToken = (tok: string): boolean => {
  if (SCALAR_HELP.some(([n]) => n === tok)) return true
  if (tok.startsWith('#')) return LIST_HELP.some((l) => l.name === tok.slice(1).split(':')[0])
  const [l, f] = tok.split('.')
  return LIST_HELP.some((x) => x.name === l && x.fields.includes(f))
}
