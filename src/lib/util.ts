export const median = (nums: number[]): number | undefined => {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y)
  if (!a.length) return undefined
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
export const parseNums = (s: string): number[] =>
  s.split(/[\s,;]+/).map((x) => parseFloat(x)).filter((n) => Number.isFinite(n))
export const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/[,%\s]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}
export const host = (u: string): string => {
  try { return new URL(/^https?:/.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '') } catch { return '' }
}
export const normUrl = (u: string): string => {
  const t = u.trim()
  if (!t) return ''
  return /^https?:\/\//.test(t) ? t.replace(/\/+$/, '') : 'https://' + t.replace(/\/+$/, '')
}
export const monthLabel = (m: string): string => {
  const [y, mo] = m.split('-').map(Number)
  if (!y || !mo) return m
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export const monthRange = (m: string): { start: string; end: string } => {
  const [y, mo] = m.split('-').map(Number)
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return { start: `${y}-${p(mo)}-01`, end: `${y}-${p(mo)}-${p(last)}` }
}
export const fmt = (n: number, d = 0): string => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
export const todayIso = () => new Date().toISOString().slice(0, 10)
export const nextMonth = (m: string): string => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(Date.UTC(y, mo, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export const prevMonth = (m: string): string => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(Date.UTC(y, mo - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
