import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, Search } from 'lucide-react'
import Sidebar from './Sidebar'
import ProfileMenu from './ProfileMenu'
import { useApp } from '../context/AppContext'

const titles = [
  ['/opportunities/new', 'New Opportunity', 'Define a hiring requirement'],
  ['/opportunities', 'Opportunity Creation', 'Create and manage your hiring requirements'],
  ['/dashboard', 'Dashboard', 'Manage your hiring workflow'],
  ['/resume-matcher', 'Resume Matcher', 'Rank resumes against an opportunity'],
  ['/ats-score', 'ATS Score Checker', 'Check how ATS-ready a resume is'],
  ['/screening-questions', 'Screening Questions', 'Generate role-specific questions with AI'],
  ['/resume-database', 'Resume Database', 'Reusable candidate repository'],
  ['/candidate-evaluation', 'Candidate Evaluation', 'Evaluate shortlisted candidates round by round'],
  ['/offers', 'Offers & Joining', 'Send offers and track who joins'],
  ['/', 'Overview', 'Your recruitment workspace'],
]

export default function Layout() {
  const { pathname } = useLocation()
  const { toastMsg } = useApp()
  const nav = useNavigate()
  const ref = useRef(null)
  const [, title, sub] = titles.find(([p]) => (p === '/' ? pathname === '/' : pathname.startsWith(p))) || titles[titles.length - 1]

  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center gap-6 border-b border-line px-6">
          <div className="w-52 shrink-0">
            <h1 className="text-[17px] font-bold leading-tight">{title}</h1>
            <p className="truncate text-xs text-muted">{sub}</p>
          </div>
          <div className="relative mx-auto hidden w-full max-w-md md:block">
            <Search size={16} className="absolute left-3.5 top-3 text-muted" />
            <input ref={ref} placeholder="Search opportunities, candidates..." onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) nav(`/opportunities?q=${encodeURIComponent(e.target.value.trim())}`) }} className="h-10 w-full rounded-xl border border-line bg-surface/70 pl-10 pr-14 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100" />
            <kbd className="absolute right-3 top-2.5 rounded-md border border-line bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted">Ctrl K</kbd>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line text-muted hover:bg-surface"><Bell size={18} /><span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-amber-400" /></button>
            <ProfileMenu />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6"><Outlet /></main>
      </div>
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-pop">
          <CheckCircle2 size={18} className="text-emerald-400" />{toastMsg}
        </div>
      )}
    </div>
  )
}
