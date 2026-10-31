import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar as CalIcon, CheckCircle2, Database, FileText, Loader2, Sparkles, Trophy, Users, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button, Card, Dropzone, Field, Modal, PageHeader, cx, inputCls } from '../components/ui'
import ScheduleModal from '../components/ScheduleModal'
import { initials, scoreTone } from '../data/utils'

const RANK = ['bg-amber-400 text-white', 'bg-slate-400 text-white', 'bg-orange-500 text-white']
const chip = (c) => `rounded-md px-1.5 py-0.5 text-[11px] font-medium ${c}`

export default function ResumeMatcher() {
  const { opportunities, resumes, uploadResumes, extractJd, queue, addToQueue, removeFromQueue, matches, runMatch, loadRanking, interviews, matcherDraft, setMatcherDraft, toast } = useApp()
  const { oppId, jd } = matcherDraft
  const setJd = (v) => setMatcherDraft((d) => ({ ...d, jd: v }))
  const [tab, setTab] = useState('queue')
  const [running, setRunning] = useState(false)
  const [target, setTarget] = useState(null)
  const [report, setReport] = useState(null)
  const opp = opportunities.find((o) => o.id === oppId)
  const key = oppId || 'custom'
  const queued = queue.map((id) => resumes.find((r) => r.id === id)).filter(Boolean)
  const ranked = (matches[key] || []).map((m) => ({ ...m, r: resumes.find((x) => x.id === m.resumeId) })).filter((x) => x.r)

  const pickOpp = (id) => {
    setMatcherDraft({ oppId: id, jd: opportunities.find((o) => o.id === id)?.jd || '' })
    if (id) loadRanking(id).catch(() => {}) // show the saved ranking, if this opportunity was matched before
  }
  const upload = async (files) => {
    try {
      const { created, errors } = await uploadResumes(files, { stage: true })
      addToQueue(created.map((r) => r.id))
      toast(errors.length ? `${created.length} saved. ${errors[0].file}: ${errors[0].error}` : `${created.length} resume(s) added. They are saved to the Resume Database after matching.`
    );
  } catch (e) { toast(e.message) }
  }
  const uploadJd = async (files) => {
    try { setJd(await extractJd(files[0])) } catch (e) { toast(e.message) }
  }
  const run = async () => {
    setRunning(true)
    try {
      const res = await runMatch({ oppCode: oppId, jd, resumeIds: queued.map((r) => r.id) })
      setTab('rank')
      toast(res.ai_used ? 'Matching complete (Gemini)' : 'Matching complete')
    } catch (e) { toast(e.message) } finally { setRunning(false) }
  }
  const tabBtn = (k, icon, label) => <button onClick={() => setTab(k)} className={cx('flex items-center justify-center gap-2 rounded-md py-1.5 text-sm font-semibold', tab === k ? 'bg-white shadow-card' : 'text-muted')}>{icon}{label}</button>

  return (
    <div className="flex h-full min-h-[460px] flex-col gap-4">
      <PageHeader eyebrow="AI candidate matching" title="Resume Matcher" subtitle="Rank resumes against an opportunity and schedule interviews." />
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <Card className="col-span-5 flex min-h-0 flex-col p-4">
          <Field label="Opportunity ID" required>
            <select className={inputCls} value={oppId} onChange={(e) => pickOpp(e.target.value)}>
              <option value="">Select opportunity</option>
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.role}</option>)}
            </select>
          </Field>
          <div className="mb-1.5 mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink/80">Job description <span className="font-normal text-muted">(editable)</span></span>
            {jd && <button onClick={() => setJd('')} className="text-xs font-semibold text-muted hover:text-ink">Clear</button>}
          </div>
          <textarea className="min-h-[70px] flex-1 resize-none rounded-lg border border-line p-3 text-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="Select an opportunity to load its JD, or paste a fresh JD here..." value={jd} onChange={(e) => setJd(e.target.value)} />
          <Dropzone compact accept=".pdf,.doc,.docx,.txt" onFiles={uploadJd} title="Upload new JD" hint="PDF, DOC, DOCX or TXT" className="mt-3" />
          <Button variant="accent" className="mt-3 h-11 w-full shrink-0" disabled={!jd.trim() || !queued.length || running} onClick={run}>
            {running ? <><Loader2 size={16} className="animate-spin" />Matching with AI...</> : <><Sparkles size={16} />Match {queued.length || ''} resume{queued.length === 1 ? '' : 's'} with AI</>}
          </Button>
        </Card>

        <Card className="col-span-7 flex min-h-0 flex-col p-4">
          <div className="mb-3 grid shrink-0 grid-cols-2 rounded-lg bg-surface p-1">
            {tabBtn('queue', <Users size={15} />, `Candidates to match (${queued.length})`)}
            {tabBtn('rank', <Trophy size={15} />, `Ranking${ranked.length ? ` (${ranked.length})` : ''}`)}
          </div>

          {tab === 'queue' ? (
            <>
              <Dropzone compact multiple onFiles={upload} title="Upload resumes" hint="Saved to the Resume Database after matching" />
              <div className="mb-1 mt-3 flex shrink-0 items-center justify-between text-xs">
                <span className="font-semibold text-muted">Added to this match</span>
                <Link to="/resume-database?for=matcher" className="flex items-center gap-1 font-bold text-brand-600 hover:underline"><Database size={13} />Add from Resume Database</Link>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-line overflow-auto rounded-lg border border-line">
                {queued.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(r.name)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{r.name}</span><span className="block truncate text-xs text-muted">{r.title} · {r.exp} yrs · {r.file}</span></span>
                    <button title="Remove" onClick={() => removeFromQueue(r.id)} className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-rose-600"><X size={15} /></button>
                  </div>
                ))}
                {!queued.length && <div className="flex h-full min-h-[90px] flex-col items-center justify-center px-6 text-center text-sm text-muted"><FileText size={26} className="mb-1.5 text-gray-300" />No candidates added yet. Upload resumes or add saved candidates from the Resume Database.</div>}
              </div>
            </>
          ) : ranked.length ? (
            <div className="min-h-0 flex-1 divide-y divide-line overflow-auto rounded-lg border border-line">
              {ranked.map((x, idx) => {
                const t = scoreTone(x.score)
                const done = interviews.some((i) => i.candidate === x.r.name && i.oppId === key)
                return (
                  <div key={x.resumeId} className="grid grid-cols-[30px_1fr_84px_118px] items-center gap-3 px-3 py-3">
                    <span className={cx('flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold', RANK[idx] || 'bg-brand-50 text-brand-700')}>{idx + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{x.r.name}</span>
                      <span className="block truncate text-xs text-muted">{x.r.title} · {x.r.exp} yrs</span>
                      <span className="mt-1 flex flex-wrap gap-1">{x.matched.slice(0, 3).map((s) => <span key={s} className={chip('bg-emerald-50 text-emerald-700')}>{s}</span>)}</span>
                    </span>
                    <span><span className={cx('block text-right text-sm font-extrabold', t.text)}>{x.score}%</span><span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface"><span className={cx('block h-full rounded-full', t.bar)} style={{ width: `${x.score}%` }} /></span></span>
                    <span className="flex flex-col gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setReport(x)}><FileText size={13} />Full report</Button>
                      {done ? <span className="flex h-8 items-center justify-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={14} />Scheduled</span>
                        : <Button size="sm" variant="accent" onClick={() => setTarget({ candidate: x.r.name, role: opp?.role || x.r.title, oppId: key, resumeId: x.r.id })}><CalIcon size={13} />Schedule</Button>}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted"><Trophy size={30} className="mb-2 text-gray-300" />No ranking yet.<br />Add candidates and run the AI match.</div>
          )}
        </Card>
      </div>

      {report && (() => {
        const { r, score, mustMatched, mustMissing, niceMatched, niceMissing, skillPct, expFit } = report
        const rep = report.report || {}
        const t = scoreTone(score)
        const verdict = score >= 75 ? 'Strong match' : score >= 60 ? 'Good match' : 'Weak match'
        return (
          <Modal width="max-w-xl" title="Full match report" subtitle={`${r.name} · ${opp?.role || r.title}${oppId ? ` · ${oppId}` : ''}`} onClose={() => setReport(null)}>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-4 text-center" style={{ borderColor: t.hex }}><span className="text-2xl font-extrabold leading-none">{score}%</span></div>
              <div className="flex-1 space-y-2">
                <div className={cx('text-sm font-extrabold', t.text)}>{verdict}</div>
                {[['Skills match', skillPct], ['Experience fit', expFit], ['Overall match', score]].map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs"><span className="w-28 font-semibold text-muted">{k}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"><div className={cx('h-full rounded-full', scoreTone(v).bar)} style={{ width: `${v}%` }} /></div><b className="w-9 text-right">{v}%</b></div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[['Must have', mustMatched, mustMissing], ['Nice to have', niceMatched, niceMissing]].map(([label, ok, miss]) => (
                <div key={label} className="rounded-lg border border-line p-3">
                  <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</div>
                  <div className="flex flex-wrap gap-1">{ok.map((s) => <span key={s} className={chip('bg-emerald-50 text-emerald-700')}>{s}</span>)}{miss.map((s) => <span key={s} className={chip('bg-rose-50 text-rose-700 line-through')}>{s}</span>)}{!ok.length && !miss.length && <span className="text-xs text-muted">None defined</span>}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm leading-relaxed"><b>{rep.ai_used ? 'AI summary: ' : 'Summary: '}</b>{rep.summary}</p>
            {(rep.strengths?.length > 0 || rep.concerns?.length > 0) && (
              <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px] leading-snug">
                <ul className="space-y-1 text-emerald-800">{(rep.strengths || []).map((t) => <li key={t}>+ {t}</li>)}</ul>
                <ul className="space-y-1 text-rose-700">{(rep.concerns || []).map((t) => <li key={t}>− {t}</li>)}</ul>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReport(null)}>Close</Button>
              <Button variant="accent" onClick={() => { setReport(null); setTarget({ candidate: r.name, role: opp?.role || r.title, oppId: key, resumeId: r.id }) }}><CalIcon size={14} />Schedule interview</Button>
            </div>
          </Modal>
        )
      })()}
      {target && <ScheduleModal target={target} onClose={() => setTarget(null)} />}
    </div>
  )
}
