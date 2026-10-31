import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Database, FileSearch, Gauge, Search, Trash2, Upload, UserPlus, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Badge, Button, Card, Modal, PageHeader, StatCard, cx, inputCls } from '../components/ui'
import CandidateProfile from '../components/CandidateProfile'
import { daysAgoISO, fmtDate, initials } from '../data/utils'

export default function ResumeDatabase() {
  const { resumes: allResumes, uploadResumes, deleteResume, addToQueue, setAtsTarget, toast } = useApp()
  const resumes = allResumes.filter((r) => r.inDb) // resumes still waiting for their match / ATS check are not shown yet
  const nav = useNavigate()
  const [params] = useSearchParams()
  const mode = params.get('for') // 'ats' | 'matcher' | null
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(new Set())
  const [view, setView] = useState(null)
  const [del, setDel] = useState(null)
  const list = resumes.filter((r) => `${r.name} ${r.title} ${r.skills.join(' ')} ${r.file}`.toLowerCase().includes(q.toLowerCase()))
  const scored = resumes.filter((r) => r.ats != null)
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + r.ats, 0) / scored.length) : 0
  const week = daysAgoISO(7)
  const allOn = list.length > 0 && list.every((r) => sel.has(r.id))
  const toggle = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toMatcher = (ids) => { addToQueue(ids); toast(`${ids.length} candidate(s) added to Resume Matcher`); nav('/resume-matcher') }
  const toAts = (id) => { setAtsTarget(id); nav('/ats-score') }
  const upload = async (files) => {
    try {
      const { created, errors } = await uploadResumes(files)
      toast(errors.length ? `${created.length} added. ${errors[0].file}: ${errors[0].error}` : `${created.length} resume(s) added to the database`)
    } catch (e) { toast(e.message) }
  }
  const atsTone = (s) => (s >= 80 ? 'green' : s >= 60 ? 'amber' : 'rose')

  return (
    <div className="flex h-full min-h-[460px] flex-col gap-4">
      <PageHeader eyebrow="Candidate repository" title="Resume Database" subtitle="Every resume uploaded in Resume Matcher or ATS Score is saved here for reuse across roles.">
        <div className="relative w-64"><Search size={16} className="absolute left-3 top-3 text-muted" /><input className={`${inputCls} pl-9`} placeholder="Search name, role or skill" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><Upload size={16} />Upload resumes<input type="file" hidden multiple accept=".pdf,.doc,.docx" onChange={(e) => { if (e.target.files.length) upload([...e.target.files]); e.target.value = '' }} /></label>
      </PageHeader>

      {mode && <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm"><span><b>{mode === 'ats' ? 'Select a resume' : 'Select candidates'}</b> {mode === 'ats' ? 'to open it in the ATS Score Checker.' : 'to add them to the Resume Matcher.'}</span><Link to={mode === 'ats' ? '/ats-score' : '/resume-matcher'} className="font-bold text-brand-600 hover:underline">Cancel</Link></div>}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Database} label="Total resumes" value={resumes.length} tone="blue" />
        <StatCard icon={Gauge} label="Average ATS score" value={avg || '—'} tone="green" />
        <StatCard icon={UserPlus} label="Added this week" value={resumes.filter((r) => r.uploaded >= week).length} tone="amber" />
        <StatCard icon={Users} label="Matched candidates" value={resumes.filter((r) => r.lastMatch).length} tone="violet" />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-3">
            <label className={cx('flex items-center gap-2 text-xs font-semibold text-muted', mode === 'ats' && 'invisible')}><input type="checkbox" className="accent-brand-600" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(list.map((r) => r.id)))} />Select all</label>
            <span className="text-sm font-bold">Saved resumes <span className="font-medium text-muted">({list.length})</span></span>
          </div>
          {sel.size > 0 && <div className="flex items-center gap-3"><span className="text-xs font-semibold text-muted">{sel.size} selected</span><Button size="sm" variant="accent" onClick={() => toMatcher([...sel])}><FileSearch size={14} />Add to Resume Matcher</Button></div>}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed text-center text-sm">
            <colgroup><col className="w-[4%]" /><col className="w-[23%]" /><col className="w-[14%]" /><col className="w-[20%]" /><col className="w-[7%]" /><col className="w-[13%]" /><col className="w-[19%]" /></colgroup>
            <thead className="sticky top-0 z-10 bg-surface text-[11px] font-bold uppercase tracking-wide text-muted"><tr><th className="px-3 py-2.5" />{['Candidate', 'Role / Exp.', 'Skills', 'ATS', 'Last match', 'Actions'].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.id} className={cx('hover:bg-surface/60', sel.has(r.id) && 'bg-brand-50/50')}>
                  <td className="px-3 py-2.5"><input type="checkbox" className={cx('accent-brand-600', mode === 'ats' && 'invisible')} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setView(r)} className="flex w-full items-center justify-center gap-2.5 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(r.name)}</span>
                      <span className="min-w-0"><span className="block truncate font-bold hover:text-brand-700">{r.name}</span><span className="block truncate text-[11px] text-muted">Added {fmtDate(r.uploaded)}</span></span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5"><span className="block truncate font-semibold">{r.title}</span><span className="text-[11px] text-muted">{r.exp} yrs</span></td>
                  <td className="px-3 py-2.5"><div className="flex flex-wrap justify-center gap-1">{r.skills.slice(0, 3).map((s) => <span key={s} className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium">{s}</span>)}{r.skills.length > 3 && <span className="text-[11px] text-muted">+{r.skills.length - 3}</span>}</div></td>
                  <td className="px-3 py-2.5">{r.ats != null ? <Badge tone={atsTone(r.ats)}>{r.ats}</Badge> : <span className="text-xs text-muted">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs">{r.lastMatch ? <><span className="block font-semibold">{r.lastMatch.score}%</span><span className="block truncate text-muted">{r.lastMatch.oppId}</span></> : <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center gap-1.5">
                      {mode !== 'ats' && <Button size="sm" variant={mode === 'matcher' ? 'accent' : 'outline'} title="Add to Resume Matcher" onClick={() => toMatcher([r.id])}><FileSearch size={13} />{mode === 'matcher' ? 'Add to Matcher' : 'Matcher'}</Button>}
                      {mode !== 'matcher' && <Button size="sm" variant={mode === 'ats' ? 'accent' : 'outline'} title="Open in ATS Score Checker" onClick={() => toAts(r.id)}><Gauge size={13} />{mode === 'ats' ? 'Use for ATS' : 'ATS'}</Button>}
                      <button title="Delete" onClick={() => setDel(r)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} className="py-12 text-center text-muted">No resumes found</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {view && <Modal title="Candidate profile" subtitle="Details extracted from the resume" onClose={() => setView(null)}><CandidateProfile resume={view} match={view.lastMatch?.score} /></Modal>}
      {del && (
        <Modal title="Delete resume?" subtitle={del.name} onClose={() => setDel(null)}>
          <p className="text-sm text-muted">This removes the resume from the database and from any pending match or ATS check.</p>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button className="!bg-rose-600 hover:!bg-rose-700" onClick={async () => { try { await deleteResume(del.id); toast('Resume deleted') } catch (e) { toast(e.message) } setDel(null) }}>Delete</Button></div>
        </Modal>
      )}
    </div>
  )
}
