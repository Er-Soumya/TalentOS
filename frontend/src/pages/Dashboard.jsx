import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Award, CalendarCheck, CheckCircle2, Eye, FileCheck, FileText, History, ShieldCheck, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Badge, Card, Modal, PageHeader, SectionCard, StatCard, cx } from '../components/ui'
import InterviewList from '../components/InterviewList'
import { STAGES } from '../data/seed'
import { statusTone, todayISO } from '../data/utils'

const TOP = [
  { key: 'screening', label: 'Screening', icon: Users, tone: 'blue' },
  { key: 'submitted', label: 'Submitted', icon: FileText, tone: 'amber' },
  { key: 'interviewed', label: 'Interviewed', icon: CalendarCheck, tone: 'violet' },
  { key: 'selected', label: 'Selected', icon: CheckCircle2, tone: 'green' },
  { key: 'offered', label: 'Offered', icon: FileCheck, tone: 'yellow' },
  { key: 'joined', label: 'Joined', icon: ShieldCheck, tone: 'teal' },
]
const GROUPS = { screening: ['screening'], interviewed: ['interviewed'], selected: ['selected'], offered: ['offered'], joined: ['joined'] }
const GROUP_LABEL = { screening: 'Screening candidates', interviewed: 'Interview completed', selected: 'Selected candidates', offered: 'Offered candidates', joined: 'Joined candidates' }
const sel = 'h-10 rounded-xl border border-[#DCE6F5] bg-white px-3.5 text-sm font-semibold outline-none focus:border-brand-500'
const miniSel = 'h-8 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold outline-none focus:border-brand-500'
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function Dashboard() {
  const { opportunities, interviews, candidates, stageCounts } = useApp()
  const nav = useNavigate()
  const [view, setView] = useState('recruiter')
  const [limit, setLimit] = useState(10)
  const [peek, setPeek] = useState(null) // { opp, key }
  const [detail, setDetail] = useState(null)
  const counts = stageCounts()
  const today = todayISO()
  const upcoming = interviews.filter((i) => i.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const todayCount = interviews.filter((i) => i.date === today).length
  const active = opportunities.filter((o) => o.status === 'Active').length
  const hold = opportunities.filter((o) => o.status === 'Hold').length
  const closed = opportunities.filter((o) => o.status === 'Closed').length
  const recent = [...opportunities].sort((a, b) => b.createdOn.localeCompare(a.createdOn)).slice(0, limit)
  const total = (o) => Object.values(stageCounts(o.id)).reduce((a, b) => a + b, 0)
  const inGroup = (o, key) => candidates.filter((c) => c.oppId === o.id && GROUPS[key].includes(c.stage))

  const Eye1 = ({ o, k }) => {
    const n = inGroup(o, k).length
    return <span className="inline-flex items-center gap-1"><b>{n}</b><button title="View candidates" onClick={() => setPeek({ o, k })} className="rounded-md p-1 text-brand-600 hover:bg-brand-50"><Eye size={14} /></button></span>
  }

  return (
    <div className="flex h-full min-h-[460px] flex-col gap-4">
      <PageHeader
        eyebrow={view === 'fulfilment' ? 'Fulfilment overview' : 'Recruiter dashboard'}
        title={view === 'fulfilment' ? 'Opening fulfilment' : 'Your hiring at a glance'}
        subtitle={view === 'fulfilment' ? 'Status of all active, hold and closed openings.' : 'A clear, real-time view of candidate progress and upcoming conversations.'}
      >
        <select className={sel} value={view} onChange={(e) => setView(e.target.value)}>
          <option value="recruiter">Recruiter Dashboard</option>
          <option value="fulfilment">Fulfilment</option>
        </select>
      </PageHeader>

      {view === 'recruiter' ? (
        <>
          <div className="grid grid-cols-6 gap-3">{TOP.map((s) => <StatCard key={s.key} icon={s.icon} label={s.label} value={counts[s.key]} tone={s.tone} />)}</div>
          <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
            <SectionCard className="col-span-8" flush icon={History} title="Recent Hiring" subtitle="Latest opportunities moving through hiring"
              action={<select className={miniSel} value={limit} onChange={(e) => setLimit(Number(e.target.value))}><option value={10}>Show 10</option><option value={20}>Show 20</option><option value={50}>Show 50</option></select>}>
              <table className="w-full text-center text-sm">
                <thead className="sticky top-0 bg-white text-[11px] font-bold uppercase tracking-wide text-muted shadow-[0_1px_0_#E5E9F0]"><tr>{['Opportunity', 'Role', 'Positions', 'Candidates', 'Status'].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {recent.map((o) => (
                    <tr key={o.id} className="cursor-pointer hover:bg-surface/60" onClick={() => nav(`/opportunities/${o.id}/edit`)}>
                      <td className="px-4 py-2.5 font-bold text-brand-700">{o.id}</td>
                      <td className="px-4 py-2.5 font-semibold">{o.role}</td>
                      <td className="px-4 py-2.5">{o.positions}</td>
                      <td className="px-4 py-2.5">{total(o)}</td>
                      <td className="px-4 py-2.5"><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
            <SectionCard className="col-span-4" icon={CalendarCheck} title="Upcoming interviews" subtitle="Stay ahead of your next conversations" action={<Link to="/#calendar" className="text-xs font-bold text-brand-600 hover:underline">Calendar</Link>}>
              <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-600"><CalendarCheck size={17} /></span>
                <div className="flex-1"><div className="text-xs font-bold">Interview schedule</div><div className="text-[11px] text-muted">{upcoming.length} conversations coming up</div></div>
                <Badge tone="green">{todayCount ? 'Today' : 'Upcoming'}</Badge>
              </div>
              <InterviewList items={upcoming.slice(0, 5)} empty="No upcoming interviews" />
            </SectionCard>
          </div>
        </>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <Award size={18} className="text-brand-600" />
            <span className="text-sm font-bold">All openings</span>
            <Badge tone="green">{active} Active</Badge><Badge tone="amber">{hold} Hold</Badge><Badge tone="gray">{closed} Closed</Badge>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed text-center text-sm">
              <colgroup><col className="w-[13%]" /><col className="w-[15%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[10%]" /><col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[8%]" /></colgroup>
              <thead className="sticky top-0 z-10 bg-surface text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <tr>{['Opportunity ID', 'Role', 'CTC', 'Openings', 'Screening', 'Interviewed', 'Selected', 'Offered', 'Joined', 'Status'].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {opportunities.map((o) => (
                  <tr key={o.id} className="hover:bg-surface/60">
                    <td className="px-3 py-2.5"><button onClick={() => setDetail(o)} className="font-bold text-brand-700 underline-offset-2 hover:underline">{o.id}</button></td>
                    <td className="px-3 py-2.5 font-semibold">{o.role}</td>
                    <td className="px-3 py-2.5 text-muted">{o.ctc}</td>
                    <td className="px-3 py-2.5 font-semibold">{o.positions}</td>
                    <td className="px-3 py-2.5"><Eye1 o={o} k="screening" /></td>
                    <td className="px-3 py-2.5"><Eye1 o={o} k="interviewed" /></td>
                    <td className="px-3 py-2.5"><Eye1 o={o} k="selected" /></td>
                    <td className="px-3 py-2.5"><Eye1 o={o} k="offered" /></td>
                    <td className="px-3 py-2.5"><Eye1 o={o} k="joined" /></td>
                    <td className="px-3 py-2.5"><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {peek && (
        <Modal title={GROUP_LABEL[peek.k]} subtitle={`${peek.o.id} · ${peek.o.role}`} onClose={() => setPeek(null)}>
          {inGroup(peek.o, peek.k).length ? (
            <ul className="max-h-72 divide-y divide-line overflow-auto">
              {inGroup(peek.o, peek.k).map((c) => <li key={c.id} className="flex items-center justify-between py-2.5 text-sm"><span className="font-semibold">{c.name}</span><Badge tone="brand">{cap(c.stage)}</Badge></li>)}
            </ul>
          ) : <p className="py-6 text-center text-sm text-muted">No candidates in this stage yet</p>}
        </Modal>
      )}

      {detail && (() => {
        const c = stageCounts(detail.id)
        const max = Math.max(...Object.values(c), 1)
        const pct = detail.positions ? Math.min(Math.round((c.joined / detail.positions) * 100), 100) : 0
        const list = candidates.filter((x) => x.oppId === detail.id)
        return (
          <Modal width="max-w-2xl" title={`${detail.id} · ${detail.role}`} subtitle={`${detail.location} · ${detail.mode} · ${detail.experience} · ${detail.ctc}`} onClose={() => setDetail(null)}>
            <div className="grid grid-cols-4 gap-3">
              {[['Openings', detail.positions], ['Joined', c.joined], ['Remaining', Math.max(detail.positions - c.joined, 0)], ['Status', detail.status]].map(([k, v]) => <div key={k} className="rounded-lg border border-line bg-surface/60 p-3"><div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{k}</div><div className="mt-1 text-xl font-extrabold">{v}</div></div>)}
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">Fulfilment progress</span><span className="font-bold text-brand-700">{pct}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">Pipeline stages</div>
                {STAGES.map((s) => <div key={s} className="flex items-center gap-2 text-xs"><span className="w-20 font-semibold">{cap(s)}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface"><div className={cx('h-full rounded-full bg-brand-500')} style={{ width: `${(c[s] / max) * 100}%` }} /></div><b className="w-5 text-right">{c[s]}</b></div>)}
              </div>
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Candidates ({list.length})</div>
                <ul className="max-h-40 divide-y divide-line overflow-auto text-sm">{list.map((x) => <li key={x.id} className="flex items-center justify-between py-1.5"><span className="font-semibold">{x.name}</span><Badge tone={x.stage === 'rejected' ? 'rose' : 'brand'}>{cap(x.stage)}</Badge></li>)}{!list.length && <li className="py-3 text-center text-muted">No candidates yet</li>}</ul>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
