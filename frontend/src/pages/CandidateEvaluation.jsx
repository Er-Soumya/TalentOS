import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Code2, FileSearch, Target, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../api'
import { Badge, Button, Card, PageHeader, cx, inputCls } from '../components/ui'
import { SECTIONS, fmtDate, initials, ratingLabel, scoreTone } from '../data/utils'

const ICONS = { hr: Users, technical: Code2, managerial: Target }
const TINT = { hr: ['#EAF2FF', '#3B82F6'], technical: ['#EFECFF', '#8B5CF6'], managerial: ['#E5F7EC', '#10B981'] }
const BADGE = { hr: 'brand', technical: 'amber', managerial: 'green' }
const RANK = ['bg-amber-400 text-white', 'bg-slate-400 text-white', 'bg-orange-500 text-white']
const miniSel = 'h-8 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold outline-none focus:border-brand-500'

export default function CandidateEvaluation() {
  const { section } = useParams()
  const nav = useNavigate()
  const { opportunities, toast } = useApp()
  const valid = !!(section && SECTIONS[section])
  const [oppId, setOppId] = useState('')
  const [limit, setLimit] = useState(10)
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [list, setList] = useState(null) // ranked candidates of the chosen opportunity (null = not loaded)
  useEffect(() => { setOppId('') }, [section]) // every round starts with the default "Select"

  useEffect(() => { // overview: counts + recent evaluations
    if (valid) return
    Promise.all([api.get('/api/evaluations/stats'), api.get(`/api/evaluations/recent?limit=${limit}`)])
      .then(([s, r]) => { setStats(s); setRecent(r) }).catch((e) => toast(e.message))
  }, [valid, limit]) // eslint-disable-line

  useEffect(() => { // round page: ranked candidates from the Resume Matcher
    const o = opportunities.find((x) => x.id === oppId)
    if (!valid || !o) { setList(null); return }
    setList(null)
    api.get(`/api/evaluations/candidates?opportunity_id=${o.dbId}&round=${section}`).then((r) => setList(r.candidates)).catch((e) => { toast(e.message); setList([]) })
  }, [valid, section, oppId]) // eslint-disable-line

  if (!valid) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Interview evaluation" title="Candidate Evaluation" subtitle="Choose an evaluation round to review ranked candidates and record feedback." />
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(SECTIONS).map(([k, s]) => {
            const Icon = ICONS[k]; const [bg, fg] = TINT[k]
            const st = stats?.[k]
            return (
              <Card key={k} className="p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: bg, color: fg }}><Icon size={22} /></span>
                  <div><div className="text-lg font-extrabold leading-tight">{s.label} round</div><div className="text-xs text-muted">{s.label} screening</div></div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div><div className="text-3xl font-extrabold leading-none">{st?.count ?? 0}</div><div className="mt-1 text-xs font-semibold text-muted">Candidates screened</div></div>
                  <div className="text-right text-xs text-muted">Last evaluated<div className="font-semibold text-ink">{st?.last ? fmtDate(st.last) : '—'}</div></div>
                </div>
                <Button variant="accent" className="mt-4 w-full" onClick={() => nav(`/candidate-evaluation/${k}`)}>Evaluate now<ArrowRight size={15} /></Button>
              </Card>
            )
          })}
        </div>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div><div className="text-sm font-bold">Recent evaluations</div><div className="text-xs text-muted">Candidates screened in each round, most recent first</div></div>
            <select className={miniSel} value={limit} onChange={(e) => setLimit(Number(e.target.value))}><option value={10}>Show 10</option><option value={20}>Show 20</option><option value={50}>Show 50</option></select>
          </div>
          <table className="w-full table-fixed text-center text-sm">
            <thead className="bg-surface text-[11px] font-bold uppercase tracking-wide text-muted"><tr>{['Candidate', 'Opportunity ID', 'Round', 'Rating', 'Date'].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {recent.map((x) => (
                <tr key={`${x.opportunity_code}${x.candidate}${x.round}`} className="hover:bg-surface/60">
                  <td className="px-4 py-3"><div className="flex items-center justify-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(x.candidate)}</span><span className="font-bold">{x.candidate}</span></div></td>
                  <td className="px-4 py-3 font-semibold text-brand-700">{x.opportunity_code}</td>
                  <td className="px-4 py-3"><Badge tone={BADGE[x.round]}>{SECTIONS[x.round].label}</Badge></td>
                  <td className="px-4 py-3"><span className={cx('font-bold', scoreTone(x.score).text)}>{x.rating} · {Math.round(x.score)}</span></td>
                  <td className="px-4 py-3 text-muted">{x.date ? fmtDate(x.date) : '—'}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={5} className="py-10 text-center text-muted">No evaluations recorded yet</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    )
  }

  const sec = SECTIONS[section]
  const opp = opportunities.find((o) => o.id === oppId)
  const ranked = list || []

  return (
    <div className="flex h-full min-h-[460px] flex-col gap-4">
      <div className="flex items-end gap-3">
        <button onClick={() => nav('/candidate-evaluation')} className="mb-1 rounded-lg border border-line p-2 hover:bg-surface"><ArrowLeft size={16} /></button>
        <div className="flex-1">
          <PageHeader eyebrow={`${sec.label} evaluation`} title={`${sec.label} round`} subtitle="Select an opportunity to see candidates ranked by the Resume Matcher.">
            <select className={cx(inputCls, 'w-72 font-semibold')} value={oppId} onChange={(e) => setOppId(e.target.value)}>
              <option value="">Select Opportunity ID</option>
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.role}</option>)}
            </select>
          </PageHeader>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!oppId ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted"><ClipboardCheck size={34} className="mb-2 text-gray-300" />Select an Opportunity ID to view the candidate ranking.</div>
        ) : list === null ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading candidates...</div>
        ) : !ranked.length ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted">
            <FileSearch size={34} className="mb-2 text-gray-300" />No ranking found for {oppId}.<br />Run the Resume Matcher for this opportunity first.
            <Button variant="accent" className="mt-4" onClick={() => nav('/resume-matcher')}>Open Resume Matcher</Button>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3"><span className="text-sm font-bold">{opp?.role} <span className="font-medium text-muted">· {ranked.length} ranked candidates</span></span></div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-center text-sm">
                <thead className="sticky top-0 bg-surface text-[11px] font-bold uppercase tracking-wide text-muted"><tr>{['Rank', 'Candidate', 'Experience', 'Match', 'ATS', `${sec.label} status`, 'Action'].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {ranked.map((x) => {
                    const ev = x.evaluation
                    return (
                      <tr key={x.application_id} className="hover:bg-surface/60">
                        <td className="px-4 py-3"><span className={cx('mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold', RANK[x.rank - 1] || 'bg-brand-50 text-brand-700')}>{x.rank}</span></td>
                        <td className="px-4 py-3"><div className="flex items-center justify-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(x.resume.name)}</span><span className="text-left"><span className="block font-bold">{x.resume.name}</span><span className="block text-xs text-muted">{x.resume.title}</span></span></div></td>
                        <td className="px-4 py-3">{x.resume.years ?? '—'} yrs</td>
                        <td className="px-4 py-3">{x.match != null ? <span className={cx('font-extrabold', scoreTone(x.match).text)}>{Math.round(x.match)}%</span> : '—'}</td>
                        <td className="px-4 py-3">{x.ats != null ? <b>{x.ats}</b> : <span className="text-xs text-muted">Not checked</span>}</td>
                        <td className="px-4 py-3">{ev ? <span className="flex items-center justify-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /><Badge tone="green">{ev.rating || ratingLabel(ev.score)} · {Math.round(ev.score)}</Badge></span> : <Badge tone="amber">Pending</Badge>}</td>
                        <td className="px-4 py-3"><Button size="sm" variant="accent" className="mx-auto" onClick={() => nav(`/candidate-evaluation/${section}/${x.application_id}`)}>{ev ? 'Re-evaluate' : 'Evaluate'}<ArrowRight size={13} /></Button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
