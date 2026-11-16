import { AppState, Finding, Priority, SfPage, Snapshot } from '../types'
import { fmt, host, median, monthLabel, monthRange, normUrl, parseNums } from './util'

const pl = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
export const hasAeo = (s: AppState) => s.project.pkg.includes('AEO')
export const hasGeo = (s: AppState) => s.project.pkg.includes('GEO')
export const autoTitle = (s: AppState): string => {
  if (s.cfg.title.trim()) return s.cfg.title.trim()
  const kinds = ['SEO', hasAeo(s) ? 'AEO' : '', hasGeo(s) ? 'GEO' : ''].filter(Boolean)
  return `Monthly ${kinds.length > 1 ? kinds.slice(0, -1).join(', ') + ' & ' + kinds[kinds.length - 1] : kinds[0]} Report`
}

const archiveRe = /\/(category|tag|author|page|feed)\/|\/\d{4}(\/\d{2})*\/?$/i
export const isArchive = (u: string) => archiveRe.test(u)

export function psiNumbers(s: AppState) {
  const ms = parseNums(s.psi.mobileScores), ml = parseNums(s.psi.mobileLcp), mt = parseNums(s.psi.mobileTbt)
  const ds = parseNums(s.psi.desktopScores), dl = parseNums(s.psi.desktopLcp)
  return {
    mobileScore: median(ms), mobileRuns: ms.length, mobileLcp: median(ml), mobileLcpMin: ml.length ? Math.min(...ml) : undefined, mobileLcpMax: ml.length ? Math.max(...ml) : undefined,
    mobileTbt: median(mt),
    desktopScore: median(ds), desktopRuns: ds.length, desktopLcp: median(dl),
  }
}

export function aiScore(s: AppState): { named: number; asked: number; tools: string[]; runs: number } | undefined {
  if (!s.ai?.length) return undefined
  const qs = new Set(s.ai.map((r) => r.question.trim().toLowerCase()))
  const named = new Set(s.ai.filter((r) => r.named).map((r) => r.question.trim().toLowerCase()))
  const tools = [...new Set(s.ai.map((r) => r.tool))]
  return { named: named.size, asked: qs.size, tools, runs: Math.max(...s.ai.map((r) => r.run)) }
}

export function topCompetitors(s: AppState, n = 3): { name: string; count: number }[] {
  if (!s.ai?.length) return []
  const m = new Map<string, Set<string>>()
  for (const r of s.ai) for (const c of r.competitors.split(/[,;]+/).map((x) => x.trim()).filter(Boolean)) {
    if (!m.has(c)) m.set(c, new Set())
    m.get(c)!.add(r.question.trim().toLowerCase())
  }
  return [...m.entries()].map(([name, set]) => ({ name, count: set.size })).sort((a, b) => b.count - a.count).slice(0, n)
}

export function buildFindings(s: AppState): Finding[] {
  const f: Finding[] = []
  const site = normUrl(s.project.website) || ''
  const when = s.psi.date || 'test date'
  const p = psiNumbers(s)

  if (p.mobileScore !== undefined) {
    const pr: Priority = p.mobileScore < 50 ? 'High' : p.mobileScore < 90 ? 'Medium' : 'Low'
    if (p.mobileScore < 90)
      f.push({ area: 'Speed', priority: pr, url: site + '/',
        issue: `Homepage mobile performance score is ${fmt(p.mobileScore)}/100 (median of ${p.mobileRuns} run${p.mobileRuns > 1 ? 's' : ''})` +
          (p.mobileLcp !== undefined ? `, LCP ${fmt(p.mobileLcp, 1)} s` + (p.mobileRuns > 1 && p.mobileLcpMin !== p.mobileLcpMax ? ` (runs ${fmt(p.mobileLcpMin!, 1)} to ${fmt(p.mobileLcpMax!, 1)} s)` : '') : '') +
          (p.mobileTbt !== undefined ? `, TBT ${fmt(p.mobileTbt)} ms` : ''),
        evidence: `PageSpeed Insights screenshots ${when} (${s.psi.fieldData ? 'field data available' : 'lab data, no field data'})`,
        why: 'Slow pages make visitors leave and hurt Google page experience',
        fix: 'Compress and resize images, use WebP, remove render-blocking scripts, cut unused CSS and JavaScript' })
  }
  if (p.desktopScore !== undefined && p.desktopScore < 90)
    f.push({ area: 'Speed', priority: p.desktopScore < 50 ? 'Medium' : 'Low', url: site + '/',
      issue: `Homepage desktop performance score is ${fmt(p.desktopScore)}/100` + (p.desktopLcp !== undefined ? `, LCP ${fmt(p.desktopLcp, 1)} s` : ''),
      evidence: `PageSpeed Insights screenshots ${when}`, why: 'Heavy scripts slow the page for desktop visitors', fix: 'Defer or remove unneeded scripts and review animations and layout shifts' })

  const sec = s.security
  if (sec.httpsRedirect === 'No')
    f.push({ area: 'Security', priority: 'High', url: site + '/', issue: 'http:// does not redirect to https://', evidence: 'Manual browser check', why: 'Visitors can land on the insecure version of the site', fix: 'Add a site-wide 301 redirect from http to https' })
  if (sec.ssl && !/^A/i.test(sec.ssl.trim()) )
    f.push({ area: 'Security', priority: /^[BC]/i.test(sec.ssl.trim()) ? 'Medium' : 'High', url: site + '/', issue: `SSL Labs grade is ${sec.ssl.trim().toUpperCase()}`, evidence: 'SSL Labs screenshot', why: 'Weak SSL settings can expose visitors', fix: 'Update the server TLS configuration' })
  if (sec.headers && !/^A/i.test(sec.headers.trim()))
    f.push({ area: 'Security', priority: 'Medium', url: site + '/', issue: `Security headers grade is ${sec.headers.trim().toUpperCase()}` + (sec.missingHeaders ? `; missing: ${sec.missingHeaders}` : ''), evidence: 'securityheaders.com screenshot', why: 'Headers add protection for visitors against some attacks', fix: 'Add the missing headers at server level or with a plugin' })

  if (s.sf) {
    const idx = s.sf.pages.filter((x) => x.status === 200 && x.indexable)
    const n = idx.length
    const ev = 'Screaming Frog Internal HTML export'
    const noMeta = idx.filter((x) => !x.meta)
    if (noMeta.length) f.push({ area: 'Crawl', priority: 'Medium', url: noMeta.length === n ? 'All pages' : `${noMeta.length} pages, see export`, issue: `${noMeta.length} of ${n} indexable pages have no meta description`, evidence: ev, why: 'Google writes its own text, which is often less clear', fix: 'Write a 150 to 155 character description for each page' })
    const noTitle = idx.filter((x) => !x.title)
    if (noTitle.length) f.push({ area: 'Crawl', priority: 'High', url: `${noTitle.length} pages, see export`, issue: `${pl(noTitle.length, 'indexable page')} ${noTitle.length === 1 ? 'has' : 'have'} no title`, evidence: ev, why: 'The title is the main text shown in Google results', fix: 'Write a unique title of about 60 characters for each page' })
    const longT = idx.filter((x) => x.titleLen > 60)
    if (longT.length) f.push({ area: 'Content', priority: 'Low', url: `${longT.length} pages, see export`, issue: `${pl(longT.length, 'page title')} ${longT.length === 1 ? 'is' : 'are'} longer than 60 characters`, evidence: ev, why: 'Long titles get cut off in Google results', fix: 'Shorten titles to about 60 characters' })
    const dupT = idx.filter((x) => x.title).reduce((m, x) => m.set(x.title, (m.get(x.title) ?? 0) + 1), new Map<string, number>())
    const dupN = [...dupT.values()].filter((c) => c > 1).length
    if (dupN) f.push({ area: 'Content', priority: 'Medium', url: 'See export', issue: `${dupN} titles are used on more than one page`, evidence: ev, why: 'Repeated titles make pages hard to tell apart', fix: 'Give every page a unique title' })
    const noH1 = idx.filter((x) => !x.h1)
    if (noH1.length) f.push({ area: 'Content', priority: 'Medium', url: 'See export', issue: `${pl(noH1.length, 'indexable page')} ${noH1.length === 1 ? 'has' : 'have'} no H1`, evidence: ev, why: 'The H1 tells Google and visitors what the page is about', fix: 'Add one clear H1 to each page' })
    const multi = idx.filter((x) => x.h1b)
    if (multi.length) f.push({ area: 'Content', priority: 'Low', url: 'See export', issue: `${pl(multi.length, 'page')} ${multi.length === 1 ? 'has' : 'have'} more than one H1`, evidence: ev, why: 'Several H1s make the page topic less clear', fix: 'Use exactly one H1 per page' })
    const h1c = idx.filter((x) => x.h1).reduce((m, x) => m.set(x.h1, (m.get(x.h1) ?? 0) + 1), new Map<string, number>())
    const sameH1 = [...h1c.entries()].filter(([h, c]) => c > 1 && !/nothing found/i.test(h)).sort((a, b) => b[1] - a[1])
    if (sameH1.length) f.push({ area: 'Content', priority: 'Low', url: 'See export', issue: `${sameH1[0][1]} pages share the same H1 "${sameH1[0][0]}"`, evidence: ev, why: 'Pages with the same H1 compete with each other', fix: 'Use a unique H1 per page' })
    const thin = idx.filter((x) => x.words > 0 && x.words < 100 && !isArchive(x.url))
    if (thin.length) f.push({ area: 'Content', priority: 'Low', url: 'See export', issue: `${pl(thin.length, 'page')} ${thin.length === 1 ? 'has' : 'have'} fewer than 100 words`, evidence: ev, why: 'Very short pages rarely answer a search well', fix: 'Add useful content or merge the page' })
    const empty = idx.filter((x) => /nothing found/i.test(x.h1))
    if (empty.length) f.push({ area: 'Indexing', priority: 'Low', url: 'See export', issue: `${pl(empty.length, 'indexable page')} ${empty.length === 1 ? 'shows' : 'show'} "Nothing Found" as H1 (empty archive pages)`, evidence: ev, why: 'Empty pages add no value and waste crawl effort', fix: 'Set empty pages to noindex or add content' })
    const bad = s.sf.pages.filter((x) => x.status >= 400)
    if (bad.length && !s.sf4xx) f.push({ area: 'Crawl', priority: 'Medium', url: 'See export', issue: `${pl(bad.length, 'URL')} ${bad.length === 1 ? 'returns' : 'return'} an error (4xx)`, evidence: ev, why: 'Broken links and files hurt visitors and crawling', fix: 'Fix or remove the broken URLs' })
  }
  if (s.sf4xx?.rows.length) {
    const r = s.sf4xx.rows
    const css = r.filter((x) => /\.(css|js)(\?|$)/i.test(x.url)).length
    const fonts = r.filter((x) => /fonts\.googleapis/i.test(x.url)).length
    f.push({ area: 'Crawl', priority: 'Medium', url: 'See evidence file',
      issue: `${pl(r.length, 'URL')} ${r.length === 1 ? 'returns a' : 'return'} 4xx error${r.length === 1 ? '' : 's'}` + (css || fonts ? ` (${css} CSS/JS ${css === 1 ? 'file' : 'files'}, ${fonts} font ${fonts === 1 ? 'link' : 'links'})` : ''),
      evidence: 'Screaming Frog Client Error (4xx) export', why: 'Broken links and files can affect page design, loading and crawling', fix: 'Remove or repair these links' })
  }
  if (s.sfImg && s.sfImg.total) {
    f.push({ area: 'Content', priority: 'Medium', url: 'All pages', issue: `${pl(s.sfImg.total, 'image')} ${s.sfImg.total === 1 ? 'has' : 'have'} no alt text` + (s.sfImg.external ? ` (${s.sfImg.own} on the site, ${s.sfImg.external} on other websites)` : ''), evidence: 'Screaming Frog Images: Missing Alt Text export', why: 'Alt text helps search engines and people who cannot see the image', fix: 'Add short alt text to every image' })
    const eh = Object.entries(s.sfImg.externalHosts).sort((a, b) => b[1] - a[1])[0]
    if (eh && eh[1] >= 3) f.push({ area: 'Crawl', priority: 'Medium', url: 'Pages using these images', issue: `At least ${eh[1]} images load from another website (${eh[0]})`, evidence: 'Screaming Frog Images export', why: 'Images depend on another site and can break or load slowly', fix: 'Download these images and host them on your own site' })
  }
  if (hasAeo(s) && s.questions.length) {
    const open = s.questions.filter((q) => !q.answered).length
    if (open) f.push({ area: 'AEO', priority: 'Medium', url: 'Target pages in Questions tab', issue: `${open} of ${s.questions.length} customer questions have no answer on the site yet`, evidence: 'Questions tab', why: 'Pages that answer questions clearly are more likely to be chosen as the answer', fix: 'Add each question as a heading with a 40 to 60 word answer on its target page' })
  }
  const ai = aiScore(s)
  if (hasGeo(s) && ai && ai.named < ai.asked) {
    const tc = topCompetitors(s, 2).map((c) => c.name)
    f.push({ area: 'GEO', priority: 'Medium', url: 'All pages', issue: `${s.project.company || 'The business'} was named in ${ai.named} of ${ai.asked} AI questions (${ai.tools.join(', ')}, ${ai.runs} run${ai.runs > 1 ? 's' : ''})` + (tc.length ? `. Competitors named most: ${tc.join(', ')}` : ''), evidence: 'AI Check tab', why: 'AI tools recommend the businesses they can find and understand', fix: 'Clear service pages, case studies, consistent business details and listings on trusted sites' })
  }
  const order: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }
  return f.sort((a, b) => order[a.priority] - order[b.priority])
}


export interface CompareRow { label: string; cur: string; prev: string; delta: string; tone: 'good' | 'bad' | 'flat' }

function snapshotFrom(s: AppState, m: { gscOk: boolean; organic?: number; enquiriesNum?: number; p: ReturnType<typeof psiNumbers>; ai?: ReturnType<typeof aiScore>; answered: number; findings: Finding[] }): Snapshot {
  return {
    month: s.project.month,
    clicks: m.gscOk ? s.gsc!.clicks : undefined, impressions: m.gscOk ? s.gsc!.impressions : undefined,
    ctr: m.gscOk ? s.gsc!.ctr : undefined, position: m.gscOk ? s.gsc!.position : undefined,
    organicUsers: m.organic, enquiries: m.enquiriesNum, mobileScore: m.p.mobileScore,
    aiNamed: m.ai?.named, aiAsked: m.ai?.asked, answered: s.questions.length ? m.answered : undefined, findings: m.findings.length || undefined,
  }
}

function compareRows(cur: Snapshot, prev?: Snapshot): CompareRow[] {
  if (!prev) return []
  const rows: CompareRow[] = []
  const add = (label: string, a: number | undefined, b: number | undefined, o: { lowerBetter?: boolean; dec?: number; suffix?: string; scale?: number; points?: boolean } = {}) => {
    if (a === undefined || b === undefined) return
    const k = o.scale ?? 1, d = o.dec ?? 0, suf = o.suffix ?? ''
    const diff = a - b
    let delta: string
    if (o.points) delta = `${diff > 0 ? '+' : ''}${fmt(diff * k, 2)} pts`
    else if (b !== 0 && !o.dec) delta = `${diff > 0 ? '+' : ''}${fmt((diff / b) * 100, 0)}% (${diff > 0 ? '+' : ''}${fmt(diff, d)})`
    else delta = `${diff > 0 ? '+' : ''}${fmt(diff, d || 0)}`
    const eps = Math.abs(diff) < 1e-9
    const good = o.lowerBetter ? diff < 0 : diff > 0
    rows.push({ label, cur: fmt(a * k, d) + suf, prev: fmt(b * k, d) + suf, delta: eps ? 'No change' : delta, tone: eps ? 'flat' : good ? 'good' : 'bad' })
  }
  add('Search clicks', cur.clicks, prev.clicks)
  add('Impressions', cur.impressions, prev.impressions)
  add('Average CTR', cur.ctr, prev.ctr, { scale: 100, dec: 2, suffix: '%', points: true })
  add('Average position', cur.position, prev.position, { dec: 1, lowerBetter: true })
  add('Organic users', cur.organicUsers, prev.organicUsers)
  add('Enquiries', cur.enquiries, prev.enquiries)
  add('Mobile speed score', cur.mobileScore, prev.mobileScore)
  add('AI mentions (questions named)', cur.aiNamed, prev.aiNamed)
  add('Questions answered', cur.answered, prev.answered)
  add('Open findings', cur.findings, prev.findings, { lowerBetter: true })
  return rows
}

export interface Kpi { label: string; value: string; sub: string; real: boolean; bad?: boolean }

export function buildModel(s: AppState) {
  const findings = buildFindings(s)
  const { start, end } = monthRange(s.project.month)
  const p = psiNumbers(s)
  const ai = aiScore(s)
  const gscOk = !!s.gsc && s.gsc.impressions + s.gsc.clicks > 0
  const gscCovers = !!s.gsc && s.gsc.start <= start && s.gsc.end >= end
  const ga = s.ga4
  const organic = ga && !ga.empty ? ga.organicUsers : undefined

  const answered = s.questions.filter((q) => q.answered).length
  const enquiriesNum = s.enquiries.trim() !== '' && Number.isFinite(parseFloat(s.enquiries)) ? parseFloat(s.enquiries) : undefined

  const gscSub = !s.gsc ? 'Search Console data not added' : gscCovers ? 'Search Console' : `Search Console (${s.gsc.start} to ${s.gsc.end})`
  const kpis: Kpi[] = [
    { label: 'Organic users', value: organic !== undefined ? fmt(organic) : ga?.empty ? 'Not tracked' : 'Pending', sub: organic !== undefined ? 'GA4, Organic Search' : ga?.empty ? 'GA4 had no data' : 'GA4 data not added', real: organic !== undefined },
    { label: 'Search clicks', value: gscOk ? fmt(s.gsc!.clicks) : 'Pending', sub: gscOk ? gscSub : 'Search Console data not added', real: gscOk },
    { label: 'Impressions', value: gscOk ? fmt(s.gsc!.impressions) : 'Pending', sub: gscOk ? gscSub : 'Search Console data not added', real: gscOk },
    { label: 'Average CTR', value: gscOk ? fmt(s.gsc!.ctr * 100, 2) + '%' : 'Pending', sub: gscOk ? gscSub : 'Search Console data not added', real: gscOk },
    { label: 'Average position', value: gscOk ? fmt(s.gsc!.position, 1) : 'Pending', sub: gscOk ? gscSub : 'Search Console data not added', real: gscOk },
    { label: 'Enquiries / conversions', value: enquiriesNum !== undefined ? fmt(enquiriesNum) : 'Not available', sub: enquiriesNum !== undefined ? 'Confirmed by client' : 'No figure provided', real: enquiriesNum !== undefined },
    { label: 'Mobile speed score', value: p.mobileScore !== undefined ? `${fmt(p.mobileScore)} / 100` : 'Pending', sub: p.mobileScore !== undefined ? `Homepage, median of ${p.mobileRuns} run${p.mobileRuns > 1 ? 's' : ''}` : 'PageSpeed not added', real: p.mobileScore !== undefined, bad: (p.mobileScore ?? 100) < 50 },
  ]
  if (hasGeo(s)) kpis.push({ label: `AI mentions (${ai ? ai.tools.join(', ') : 'AI tools'})`, value: ai ? `${ai.named} of ${ai.asked}` : 'Pending', sub: ai ? `${ai.runs} run${ai.runs > 1 ? 's' : ''}, ${s.ai![0].date || 'date not set'}` : 'AI check not added', real: !!ai, bad: !!ai && ai.named === 0 })
  else if (hasAeo(s)) kpis.push({ label: 'Questions answered', value: `${answered} of ${s.questions.length}`, sub: 'On the website', real: true, bad: s.questions.length > 0 && answered === 0 })
  else kpis.push({ label: 'Pages indexed', value: s.indexedPages.trim() ? s.indexedPages.trim() : 'Pending', sub: 'Search Console', real: !!s.indexedPages.trim() })

  const counts = { High: 0, Medium: 0, Low: 0 } as Record<Priority, number>
  findings.forEach((x) => counts[x.priority]++)

  // Notes for tracker
  const notes: string[] = []
  if (!gscOk) notes.push('Search Console data not added (it may still be processing), so clicks, impressions and position are pending.')
  else if (!gscCovers) notes.push(`Search Console data covers ${s.gsc!.start} to ${s.gsc!.end}, not the full month.`)
  if (ga?.empty) notes.push('GA4 returned no data for the period, so organic visitors are not tracked.')
  if (!ga) notes.push('GA4 data not added.')
  if (enquiriesNum === undefined) notes.push('Enquiries: no figure provided.')
  if (p.mobileScore !== undefined) notes.push(`Mobile speed score is the homepage median of ${p.mobileRuns} lab run${p.mobileRuns > 1 ? 's' : ''}${s.psi.date ? ' on ' + s.psi.date : ''}${s.psi.date && s.psi.date.slice(0, 7) !== s.project.month ? ', not a value from the reporting month' : ''}.`)
  if (ai && hasGeo(s)) notes.push(`AI mentions: ${ai.tools.join(', ')} only, ${ai.runs} run${ai.runs > 1 ? 's' : ''}.`)
  if (s.notes.trim()) notes.push(s.notes.trim())

  const checkDates = [s.psi.date, s.ai?.[0]?.date, s.sf?.crawledAt].filter(Boolean) as string[]
  const outside = checkDates.some((d) => d.slice(0, 7) !== s.project.month)

  // Summary
  const company = s.project.company || 'the website'
  const parts: string[] = []
  const missing: string[] = []
  if (!gscOk) missing.push('Search Console data')
  if (!organic && organic !== 0) missing.push('GA4 visitor data')
  if (missing.length) parts.push(`${missing.join(' and ')} for ${monthLabel(s.project.month)} ${missing.length > 1 ? 'are' : 'is'} not available, so ${missing.length > 1 ? 'those numbers are' : 'that number is'} shown as pending rather than guessed.`)
  else parts.push(`Search clicks were ${fmt(s.gsc!.clicks)} from ${fmt(s.gsc!.impressions)} impressions, with an average position of ${fmt(s.gsc!.position, 1)}.`)
  if (outside) parts.push('Speed, crawl and AI checks were run outside the reporting month, so this report works as a baseline audit.')
  if (findings.length) parts.push(`The audit found ${pl(findings.length, 'issue')} (${counts.High} High, ${counts.Medium} Medium, ${counts.Low} Low).`)
  if (p.mobileScore !== undefined) parts.push(`The homepage scores ${fmt(p.mobileScore)}/100 for mobile speed.`)
  if (hasGeo(s) && ai) parts.push(`${company} was named in ${ai.named} of ${ai.asked} AI questions.`)
  if (hasAeo(s) && s.questions.length) parts.push(`${answered} of ${pl(s.questions.length, 'customer question')} ${s.questions.length === 1 ? 'has' : 'have'} an answer on the site.`)
  const summary = parts.join(' ')

  // Next actions
  const next: string[] = []
  const top = findings.filter((f) => f.priority !== 'Low')
  const pick = (area: string) => top.find((f) => f.area === area)
  const sp = pick('Speed'); if (sp) next.push(`<b>Speed:</b> ${sp.fix}.`)
  const cr = findings.find((f) => /meta description/.test(f.issue) || /H1/.test(f.issue)); if (cr) next.push('<b>On-page:</b> add meta descriptions and one unique H1 per page; add alt text.')
  if (hasAeo(s) && s.questions.some((q) => !q.answered)) next.push(`<b>AEO:</b> answer the ${pl(s.questions.filter((q) => !q.answered).length, 'open customer question')} on their target pages.`)
  if (!gscOk || !organic) next.push('<b>Tracking:</b> confirm Search Console and GA4 data, and record a full month of visitors and enquiries.')
  const sc = findings.find((f) => f.area === 'Security'); if (sc) next.push(`<b>Security:</b> ${sc.fix}.`)
  if (hasGeo(s) && ai) next.push(`<b>GEO:</b> repeat the AI check${ai.runs < 2 ? ' (Run 2)' : ''}${ai.tools.length < 4 ? ' in more tools' : ''} and add clearer service pages and case studies.`)
  const nextFinal = next.slice(0, 5)

  // Keywords with performance
  const q = new Map((s.gsc?.queries ?? []).map((x) => [x.q.trim().toLowerCase(), x]))
  const keywords = s.keywords.map((k) => {
    const hit = q.get(k.keyword.trim().toLowerCase())
    return { ...k, clicks: hit?.clicks, impressions: hit?.impressions, position: hit?.position }
  })

  // Page review rows
  const homeUrl = normUrl(s.project.website)
  const pages: (SfPage & { keyword: string; action: string; purpose: string })[] = (s.sf?.pages ?? [])
    .filter((x) => x.status === 200 && x.indexable && !isArchive(x.url))
    .sort((a, b) => (normUrl(a.url) === homeUrl ? -1 : normUrl(b.url) === homeUrl ? 1 : b.inlinks - a.inlinks))
    .slice(0, 30)
    .map((x) => {
      const acts: string[] = []
      if (!x.title) acts.push('Add a title'); else if (x.titleLen > 60) acts.push(`Shorten title (${x.titleLen} chars)`)
      if (!x.meta) acts.push('Add meta description')
      if (!x.h1) acts.push('Add one H1'); else if (x.h1b) acts.push('Reduce to one H1')
      const kw = s.keywords.find((k) => normUrl(k.target) === normUrl(x.url) && k.priority === 'High') ?? s.keywords.find((k) => normUrl(k.target) === normUrl(x.url))
      return { ...x, keyword: kw?.keyword ?? '', action: acts.join('. ') || 'No issue found in crawl', purpose: (x.title.split(/\s[-|]\s/)[0] || '').trim() }
    })

  const snapshot = snapshotFrom(s, { gscOk, organic, enquiriesNum, p, ai, answered, findings })
  const compare = compareRows(snapshot, s.prev)
  const topPages = [...(s.gsc?.pages ?? [])].sort((a, b) => b.clicks - a.clicks).slice(0, 8)
  return { snapshot, compare, topPages, findings, counts, kpis, notes: notes.join(' '), summary, next: nextFinal, keywords, pages, answered, ai, p, outside, gscOk, organic, enquiriesNum, start, end, host: host(s.project.website) }
}
export type Model = ReturnType<typeof buildModel>
