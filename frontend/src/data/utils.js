
export const initials = (n) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const toISO = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
export const todayISO = () => { const d = new Date(); return toISO(d.getFullYear(), d.getMonth(), d.getDate()) }
export const daysAgoISO = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toISO(d.getFullYear(), d.getMonth(), d.getDate()) }
export const dayOf = (iso) => String(Number(iso.slice(8, 10)))
export const monOf = (iso) => MON[Number(iso.slice(5, 7)) - 1]
export const fmtDate = (iso) => `${dayOf(iso)} ${monOf(iso)} ${iso.slice(0, 4)}`
export const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
export const scoreTone = (s) => (s >= 80 ? { bar: 'bg-emerald-500', text: 'text-emerald-600', hex: '#10b981' } : s >= 60 ? { bar: 'bg-amber-500', text: 'text-amber-600', hex: '#f59e0b' } : { bar: 'bg-rose-500', text: 'text-rose-600', hex: '#f43f5e' })
export const statusTone = (s) => (s === 'Active' ? 'green' : s === 'Hold' ? 'amber' : 'gray')


// Contact / profile details come from the parsed resume. Missing values show as a dash (never made-up data).
export function profileOf(r) {
  const edu = (r.education || [])[0]
  const eduText = edu ? [edu.degree, edu.institution, edu.end_year ? `(${edu.end_year})` : ''].filter(Boolean).join(', ') : ''
  return { email: r.email || '—', phone: r.phone || '—', location: r.location || '—', education: eduText || '—', summary: r.summary || '—' }
}

export const SECTIONS = {
  hr: { label: 'HR', desc: 'Culture fit, communication, expectations and joining readiness.', focus: ['Communication', 'Attitude', 'Culture fit'] },
  technical: { label: 'Technical', desc: 'Role-specific skills, problem solving and project depth.', focus: ['Core skills', 'Problem solving', 'Project depth'] },
  managerial: { label: 'Managerial', desc: 'Leadership, ownership, decision making and stakeholder handling.', focus: ['Leadership', 'Ownership', 'Decision making'] },
}
export const RATINGS = {
  Excellent: { v: 100, cls: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  Good: { v: 75, cls: 'border-brand-500 bg-brand-50 text-brand-700' },
  Average: { v: 50, cls: 'border-amber-500 bg-amber-50 text-amber-700' },
  Poor: { v: 25, cls: 'border-rose-500 bg-rose-50 text-rose-700' },
}
export const ratingLabel = (s) => (s >= 88 ? 'Excellent' : s >= 63 ? 'Good' : s >= 38 ? 'Average' : 'Poor')
