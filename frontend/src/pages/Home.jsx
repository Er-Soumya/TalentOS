import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Briefcase, CalendarCheck, FileCheck, FileSearch, LineChart, Plus, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button, Card, Donut, SectionCard, StatCard } from '../components/ui'
import Calendar from '../components/Calendar'
import InterviewList from '../components/InterviewList'
import { STAGES } from '../data/seed'
import { fmtDate, toISO, todayISO } from '../data/utils'

const smooth = (pts) => pts.reduce((d, p, i, a) => { if (i === 0) return `M${p[0]},${p[1]}`; const q = a[i - 1]; const cx = (q[0] + p[0]) / 2; return `${d} C${cx},${q[1]} ${cx},${p[1]} ${p[0]},${p[1]}` }, '')

// TODO(backend): replace with real hiring-activity data
function ActivityChart() {
  const [range, setRange] = useState(6)
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].slice(-range)
  const series = [
    { label: 'Applications', color: '#3B7BF2', data: [48, 62, 71, 66, 84, 92].slice(-range) },
    { label: 'Interviews', color: '#8B5CF6', data: [14, 19, 24, 22, 31, 35].slice(-range) },
  ]
  const W = 600, H = 180, pad = 12
  const x = (i) => pad + i * ((W - 2 * pad) / (months.length - 1))
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad)
  return (
    <SectionCard icon={LineChart} title="Hiring activity" subtitle="Applications and interviews over time"
      action={<select value={range} onChange={(e) => setRange(Number(e.target.value))} className="h-8 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold outline-none focus:border-brand-500"><option value={6}>Last 6 months</option><option value={3}>Last 3 months</option></select>}>
      <div className="flex gap-4">{series.map((s) => <span key={s.label} className="flex items-center gap-1.5 text-xs font-medium text-muted"><i className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-40 w-full">
        {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2={W} y1={pad + (i * (H - 2 * pad)) / 3} y2={pad + (i * (H - 2 * pad)) / 3} stroke="#EDF0F5" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        {series.map((s) => {
          const line = smooth(s.data.map((v, i) => [x(i), y(v)]))
          return (
            <g key={s.label}>
              <path d={`${line} L${x(months.length - 1)},${H} L${x(0)},${H} Z`} fill={s.color} opacity="0.08" />
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-xs font-semibold text-muted">{months.map((m) => <span key={m}>{m}</span>)}</div>
    </SectionCard>
  )
}

const sub = 'rounded-lg border border-line bg-surface/60 p-3'
const subLabel = 'text-[10.5px] font-bold uppercase tracking-wide text-muted'

export default function Home() {
  const { user, interviews, opportunities, candidates, stageCounts } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const today = todayISO()
  const [selected, setSelected] = useState(today)
  useEffect(() => { if (loc.hash === '#calendar') document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth' }) }, [loc])

  const hr = new Date().getHours()
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'
  const upcoming = interviews.filter((i) => i.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const wk = new Date(); wk.setDate(wk.getDate() + 7)
  const wkISO = toISO(wk.getFullYear(), wk.getMonth(), wk.getDate())
  const weekCount = upcoming.filter((i) => i.date <= wkISO).length
  const counts = stageCounts()
  const totalCand = STAGES.reduce((a, s) => a + counts[s], 0)
  const active = opportunities.filter((o) => o.status === 'Active')
  const positions = active.reduce((a, o) => a + (o.positions || 0), 0)
  const filled = candidates.filter((c) => c.stage === 'joined' && active.some((o) => o.id === c.oppId)).length
  const statuses = [['Active', '#10B981'], ['Hold', '#F59E0B'], ['Closed', '#94A3B8']].map(([k, color]) => ({ label: k, color, value: opportunities.filter((o) => o.status === k).length }))
  const modes = ['Onsite', 'Hybrid', 'Remote'].map((m) => [m, opportunities.filter((o) => o.mode === m).length])
  const dayItems = interviews.filter((i) => i.date === selected).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[#DCE6F5] bg-white p-6 shadow-card">
        <div className="relative flex items-center justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Recruiter overview</p>
            <h2 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{greet}, <span className="text-brand-600">{user.orgName}</span> 👋</h2>
            <p className="mt-1 text-sm text-ink/70">Here is a snapshot of your hiring workspace · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button variant="outline" className="h-11 px-5" onClick={() => nav('/resume-matcher')}><FileSearch size={16} />Match resumes</Button>
            <Button variant="accent" className="h-11 px-5 shadow-card" onClick={() => nav('/opportunities/new')}><Plus size={17} />Create new opportunity</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Active opportunities" value={active.length} tone="blue" />
        <StatCard icon={Users} label="Candidates in pipeline" value={totalCand} tone="violet" />
        <StatCard icon={CalendarCheck} label="Upcoming interviews" value={upcoming.length} tone="amber" />
        <StatCard icon={FileCheck} label="Offers extended" value={counts.offered + counts.joined} tone="green" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-4">
          <SectionCard icon={Briefcase} title="Opportunities" subtitle="Open positions, status and work mode">
            <div className="grid grid-cols-3 gap-3">
              <div className={sub}>
                <div className={subLabel}>Open positions</div>
                <div className="mt-1 text-3xl font-extrabold leading-none">{positions}</div>
                <div className="mt-1 text-xs text-muted">Across {active.length} active roles</div>
                <div className="mt-3 flex justify-between text-[11px]"><span className="text-muted">Filled</span><span className="font-semibold">{filled} / {positions}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-brand-500" style={{ width: `${positions ? Math.min((filled / positions) * 100, 100) : 0}%` }} /></div>
              </div>
              <div className={sub}>
                <div className={subLabel}>Opportunity status</div>
                <div className="mt-2 flex items-center gap-3">
                  <Donut total={opportunities.length} segments={statuses} size={78} />
                  <ul className="flex-1 space-y-1 text-xs">{statuses.map((s) => <li key={s.label} className="flex items-center justify-between"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span><b>{s.value}</b></li>)}</ul>
                </div>
              </div>
              <div className={sub}>
                <div className={subLabel}>By work mode</div>
                <ul className="mt-3 space-y-2.5 text-sm">{modes.map(([m, n]) => <li key={m} className="flex items-center justify-between"><span className="text-muted">{m}</span><b>{n}</b></li>)}</ul>
              </div>
            </div>
          </SectionCard>
          <ActivityChart />
        </div>

        <SectionCard className="col-span-4" icon={CalendarCheck} title="Interview schedule" subtitle="Your next conversations" action={<Link to="/dashboard" className="text-xs font-bold text-brand-600 hover:underline">View all</Link>}>
          <div className="rounded-xl bg-brand-600 p-4 text-white">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/75">Interviews this week</div>
            <div className="mt-1 text-3xl font-extrabold leading-none">{weekCount}</div>
            <div className="mt-1 text-xs text-white/80">Scheduled till {fmtDate(wkISO)}</div>
          </div>
          <InterviewList items={upcoming.slice(0, 4)} empty="No upcoming interviews" />
        </SectionCard>
      </div>

      <div id="calendar" className="grid scroll-mt-4 grid-cols-12 gap-4">
        <Card className="col-span-8 h-[500px] p-5"><Calendar interviews={interviews} selected={selected} onSelect={setSelected} /></Card>
        <Card className="col-span-4 flex h-[500px] flex-col p-5">
          <h3 className="text-base font-bold">{selected ? `Interviews on ${fmtDate(selected)}` : 'Select a date'}</h3>
          <p className="text-xs text-muted">{selected ? 'Scheduled for the selected day' : 'Pick a day on the calendar'}</p>
          <div className="mt-1 min-h-0 flex-1 overflow-auto"><InterviewList items={selected ? dayItems : []} empty={selected ? 'No interviews on this day' : 'No date selected'} /></div>
        </Card>
      </div>
    </div>
  )
}
