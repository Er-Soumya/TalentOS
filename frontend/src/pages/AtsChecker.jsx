import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Database, FileText, Loader2, ScanSearch, ShieldCheck, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button, Card, Dropzone, Field, PageHeader, cx, inputCls } from '../components/ui'
import { api } from '../api'
import { initials, scoreTone } from '../data/utils'

function Ring({ score, hex }) {
  const r = 52, c = 2 * Math.PI * r
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#EAF0F8" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={hex} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-extrabold leading-none">{score}</span><span className="mt-1 text-[10px] font-semibold text-muted">OUT OF 100</span></div>
    </div>
  )
}

export default function AtsChecker() {
  const { resumes, upsertResume, atsTarget, setAtsTarget, toast } = useApp()
  const [file, setFile] = useState(null)
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const target = resumes.find((r) => r.id === atsTarget)
  const chosen = target?.file || file?.name

  // The server reads the resume, scores it and saves the score (and the resume itself, if it is new) in the Resume Database.
  const analyze = async () => {
    setBusy(true)
    try {
      const fd = new FormData()
      if (target) fd.append('resume_id', String(target.id)); else fd.append('file', file)
      fd.append('target_role', role.trim())
      const out = await api.upload('/api/ats/check', fd)
      const r = upsertResume(out.resume)
      if (!target) { setAtsTarget(r.id); setFile(null); toast('Resume saved to the Resume Database') }
      setRes({ ...out.report, file: r.file, role: role.trim() })
    } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const show = res && res.file === chosen

  return (
    <div className="flex h-full min-h-[460px] flex-col gap-4">
      <PageHeader eyebrow="Resume intelligence" title="ATS Score Checker" subtitle="Evaluate resume readiness before a candidate or recruiter submits an application." />
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <Card className="col-span-4 flex min-h-0 flex-col p-4">
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="mb-1.5 text-xs font-semibold text-ink/80">Resume <span className="text-brand-600">*</span></div>
            {target ? (
              <div className="rounded-xl border-2 border-brand-200 bg-brand-50/50 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-700 shadow-card">{initials(target.name)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{target.name}</span><span className="block truncate text-xs text-muted">{target.title} · {target.file}</span></span>
                  <button title="Remove" onClick={() => { setAtsTarget(null); setRes(null) }} className="rounded-md p-1.5 text-muted hover:bg-white hover:text-rose-600"><X size={15} /></button>
                </div>
                {target.ats != null && <div className="mt-2 text-xs text-muted">Last ATS score: <b className={scoreTone(target.ats).text}>{target.ats}</b></div>}
              </div>
            ) : (
              <>
                <Dropzone onFiles={(f) => setFile(f[0])} title="Upload resume" hint="PDF, DOC or DOCX (max 10 MB)" className="py-5" />
                {file && <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm font-medium"><FileText size={15} className="text-brand-600" /><span className="truncate">{file.name}</span></div>}
              </>
            )}
            <Link to="/resume-database?for=ats" className="mt-2 flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:underline"><Database size={13} />{target ? 'Choose another from Resume Database' : 'Or pick a saved resume from the Resume Database'}</Link>
            <Field label="Target role (optional)" className="mt-4"><input className={inputCls} placeholder="e.g. Data Scientist" value={role} onChange={(e) => setRole(e.target.value)} /></Field>
          </div>
          <Button variant="accent" className="mt-3 h-11 w-full shrink-0" disabled={!chosen || busy} onClick={analyze}>{busy ? <><Loader2 size={16} className="animate-spin" />Analysing...</> : <><ScanSearch size={16} />Calculate ATS score</>}</Button>
        </Card>

        <Card className="col-span-8 min-h-0 overflow-auto p-5">
          {!show ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted"><ShieldCheck size={34} className="mb-2 text-gray-300" />Your ATS report will appear here.<br />Choose a resume and calculate the score.</div>
          ) : (() => {
            const t = scoreTone(res.score)
            return (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-5">
                  <Ring score={res.score} hex={t.hex} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">Performance summary</div>
                    <p className="text-sm leading-relaxed">This resume scored <b>{res.score}/100</b> and is rated <b className={t.text}>{res.grade}</b>{res.role ? <> for <b>{res.role}</b></> : ''}. {res.score >= 80 ? 'It should pass most ATS filters.' : 'Formatting and keyword gaps may block it in high-volume ATS filters.'}</p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-surface p-2.5"><div className="text-[10px] font-bold uppercase tracking-wide text-muted">Distortion risk</div><div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold"><CheckCircle2 size={14} className="text-emerald-500" />{res.distortion}</div></div>
                      <div className="rounded-lg bg-surface p-2.5"><div className="text-[10px] font-bold uppercase tracking-wide text-muted">File analysed</div><div className="mt-0.5 truncate text-sm font-bold">{res.file}</div></div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Section breakdown</div>
                  <div className="grid grid-cols-5 gap-2">
                    {res.sections.map((s) => { const x = scoreTone(s.score); return (
                      <div key={s.label} className="rounded-lg border border-line p-2"><div className="flex items-baseline justify-between gap-1"><span className="truncate text-[11px] font-semibold text-muted">{s.label}</span><span className={cx('text-sm font-extrabold', x.text)}>{s.score}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface"><div className={cx('h-full rounded-full', x.bar)} style={{ width: `${s.score}%` }} /></div></div>
                    ) })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold"><AlertTriangle size={15} className="text-rose-500" />Limitations</div>
                    <ul className="space-y-1.5 text-[13px] leading-snug text-ink/80">{res.limitations.map((l) => <li key={l} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />{l}</li>)}</ul>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold"><CheckCircle2 size={15} className="text-emerald-500" />Improvements</div>
                    <ul className="space-y-1.5 text-[13px] leading-snug text-ink/80">{res.improvements.map((l) => <li key={l} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{l}</li>)}</ul>
                  </div>
                </div>
              </div>
            )
          })()}
        </Card>
      </div>
    </div>
  )
}
