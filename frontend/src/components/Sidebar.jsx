import { NavLink } from 'react-router-dom'
import { BadgeCheck, Briefcase, ClipboardCheck, Database, FileSearch, Gauge, Home, LayoutDashboard, ListChecks, LogOut } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { BrandText, PoweredBy, TalentLogo } from './Logo'

const groups = [
  { label: 'Workspace', items: [{ to: '/', label: 'Overview', icon: Home, end: true }, { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Hiring', items: [
    { to: '/opportunities', label: 'Opportunity Creation', icon: Briefcase },
    { to: '/resume-matcher', label: 'Resume Matcher', icon: FileSearch },
    { to: '/ats-score', label: 'ATS Score', icon: Gauge },
    { to: '/resume-database', label: 'Resume Database', icon: Database },
    { to: '/screening-questions', label: 'Screening Question', icon: ListChecks },
  ] },
    { label: 'Evaluation', items: [{ to: '/candidate-evaluation', label: 'Candidate Evaluation', icon: ClipboardCheck }, { to: '/offers', label: 'Offers & Joining', icon: BadgeCheck }] },
]

export default function Sidebar() {
  const { logout } = useApp()
  return (
    <aside className="flex h-full w-[14rem] shrink-0 flex-col border-r border-line bg-white">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <TalentLogo size={50} />
        <BrandText />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((g) => (
          <div key={g.label} className="mb-1.5">
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">{g.label}</p>
            <div>
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-semibold transition ${isActive ? 'bg-brand-600 text-white shadow-card' : 'text-ink/75 hover:bg-surface hover:text-ink'}`}>
                  <Icon size={17} /><span className="flex-1">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line px-4 py-2">
        <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg border border-line px-3 py-1 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"><LogOut size={16} />Logout</button>
        <PoweredBy size={28} />
      </div>
    </aside>
  )
}
