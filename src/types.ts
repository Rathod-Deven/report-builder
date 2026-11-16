export type Pkg = 'SEO' | 'SEO + AEO' | 'SEO + GEO' | 'SEO + AEO + GEO'
export type Priority = 'High' | 'Medium' | 'Low'

export interface Project {
  company: string
  website: string // https://example.com
  month: string // YYYY-MM
  pkg: Pkg
  preparedBy: string
}

export interface DailyRow { date: string; clicks: number; impressions: number }
export interface QueryRow { q: string; clicks: number; impressions: number; ctr: number; position: number }
export interface GscData {
  start: string
  end: string
  clicks: number
  impressions: number
  ctr: number // fraction
  position: number
  queries: QueryRow[]
  pages: { url: string; clicks: number; impressions: number }[]
  daily: DailyRow[]
  totalsFrom: 'dates' | 'queries'
  warnings: string[]
}

export interface Ga4Data {
  start: string
  end: string
  empty: boolean
  organicUsers?: number
  organicSessions?: number
  keyEventsAll?: number
  channels: { name: string; sessions: number; users?: number }[]
  warnings: string[]
}

export interface SfPage {
  url: string; status: number; indexable: boolean
  title: string; titleLen: number
  meta: string; metaLen: number
  h1: string; h1b: string
  words: number; inlinks: number
}
export interface SfData { pages: SfPage[]; warnings: string[]; crawledAt?: string }
export interface Sf4xx { rows: { url: string; status: number }[]; warnings: string[] }
export interface SfImg { total: number; own: number; external: number; externalHosts: Record<string, number>; warnings: string[] }

export interface AiRow { question: string; tool: string; run: number; named: boolean; source: boolean | null; competitors: string; date: string }

export interface KeywordRow { keyword: string; intent: 'Learn' | 'Compare' | 'Buy'; target: string; priority: Priority }
export interface CompRow { name: string; website: string; keyword: string; good: string; gap: string; notes: string }
export interface QRow { question: string; source: 'People Also Ask' | 'Google suggestions' | 'Search Console' | 'Customer'; target: string; answered: boolean }

export interface Psi { date: string; mobileScores: string; mobileLcp: string; mobileTbt: string; desktopScores: string; desktopLcp: string; fieldData: boolean }
export interface Security { ssl: string; headers: string; missingHeaders: string; httpsRedirect: '' | 'Yes' | 'No' }

export type TemplateId = 'compact' | 'detailed' | 'dashboard'
export interface SectionCfg { id: string; on: boolean }
export interface CustomBlock { id: string; kind: 'text' | 'kpi' | 'table'; title: string; body: string }
export interface ReportCfg {
  template: TemplateId
  brand: string
  accent: string
  logo?: string // data URL
  title: string // empty = automatic
  sections: SectionCfg[]
  custom: CustomBlock[]
  sheets: Record<string, boolean>
}
export interface Snapshot {
  month: string
  clicks?: number; impressions?: number; ctr?: number; position?: number
  organicUsers?: number; enquiries?: number; mobileScore?: number
  aiNamed?: number; aiAsked?: number; answered?: number; findings?: number
}

export interface AppState {
  project: Project
  gsc?: GscData
  ga4?: Ga4Data
  sf?: SfData
  sf4xx?: Sf4xx
  sfImg?: SfImg
  ai?: AiRow[]
  psi: Psi
  security: Security
  enquiries: string
  indexedPages: string
  keywords: KeywordRow[]
  competitors: CompRow[]
  questions: QRow[]
  workInPeriod: string
  workOutside: string
  notes: string
  aiQuestions: string[]
  cfg: ReportCfg
  prev?: Snapshot
}

export interface Finding {
  area: 'Crawl' | 'Speed' | 'Indexing' | 'Backlinks' | 'Security' | 'Content' | 'AEO' | 'GEO'
  issue: string; url: string; evidence: string; why: string; fix: string; priority: Priority
}

export const SECTION_TITLES: Record<string, string> = {
  summary: 'Executive summary', kpis: 'Performance overview (KPI cards)', comparison: 'Compared with last month',
  charts: 'Charts', work: 'Work completed', technical: 'Technical SEO findings', pages: 'Top pages (Search Console)',
  keywords: 'Keyword performance', competitors: 'Competitors', aeo_geo: 'AEO and GEO highlights', next: "Next month's action plan",
}
export const SHEET_NAMES = ['Read Me', 'Findings Log', 'Page Review', 'Keywords', 'Competitors', 'Questions', 'AI Check', 'Monthly Tracker']

export const presetSections = (t: TemplateId): SectionCfg[] => {
  const on: Record<TemplateId, string[]> = {
    compact: ['summary', 'kpis', 'work', 'technical', 'keywords', 'aeo_geo', 'next'],
    detailed: ['summary', 'kpis', 'comparison', 'charts', 'work', 'technical', 'pages', 'keywords', 'competitors', 'aeo_geo', 'next'],
    dashboard: ['summary', 'kpis', 'comparison', 'charts', 'technical', 'keywords', 'aeo_geo', 'next'],
  }
  const order = ['summary', 'kpis', 'comparison', 'charts', 'work', 'technical', 'pages', 'keywords', 'competitors', 'aeo_geo', 'next']
  return order.map((id) => ({ id, on: on[t].includes(id) }))
}
export const defaultCfg = (): ReportCfg => ({
  template: 'compact', brand: '#0F2A47', accent: '#1B8A8F', title: '',
  sections: presetSections('compact'), custom: [],
  sheets: Object.fromEntries(SHEET_NAMES.map((n) => [n, true])),
})

export const emptyState = (): AppState => {
  const d = new Date()
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  return {
    project: { company: '', website: '', month, pkg: 'SEO + AEO + GEO', preparedBy: '' },
    psi: { date: '', mobileScores: '', mobileLcp: '', mobileTbt: '', desktopScores: '', desktopLcp: '', fieldData: false },
    security: { ssl: '', headers: '', missingHeaders: '', httpsRedirect: '' },
    enquiries: '', indexedPages: '',
    keywords: [], competitors: [], questions: [],
    workInPeriod: '', workOutside: '', notes: '', aiQuestions: [], cfg: defaultCfg(),
  }
}
