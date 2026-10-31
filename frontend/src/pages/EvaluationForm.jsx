import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Send, XCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../api'
import { Badge, Button, Card, Modal, PageHeader, cx } from '../components/ui'
import CandidateProfile from '../components/CandidateProfile'
import { RATINGS, SECTIONS, scoreTone } from '../data/utils'

const TAGS = ['Communication', 'Attitude', 'Soft skills', 'Leadership', 'Team fit']

export default function EvaluationForm() {
  const { section, appId } = useParams()
  const nav = useNavigate()
  const { opportunities, resumes, candidates, dataReady, refreshCandidates, toast } = useApp()
  const sec = SECTIONS[section]
  const cand = candidates.find((c) => String(c.appId) === appId)
  const opp = cand && opportunities.find((o) => o.id === cand.oppId)
  const resume = cand && resumes.find((r) => r.id === cand.resumeId)
  const [questions, setQuestions] = useState(null) // null = loading
  const [ratings, setRatings] = useState({})
  const [comments, setComments] = useState('')
  const [summary, setSummary] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!opp || !sec) return
    setQuestions(null)
    api.get(`/api/evaluations/questions?round=${section}&opportunity_id=${opp.dbId}`)
      .then((r) => setQuestions(r.questions)).catch((e) => { toast(e.message); setQuestions([]) })
  }, [section, opp?.dbId]) // eslint-disable-line

  if (!sec) return <Navigate to="/candidate-evaluation" replace />
  if (!dataReady) return <div className="py-16 text-center text-sm text-muted">Loading...</div>
  if (!cand || !opp || !resume) return <Navigate to="/candidate-evaluation" replace />

  const total = questions?.length || 0
  const answered = Object.keys(ratings).length
  const back = () => nav(`/candidate-evaluation/${section}`)

  const submit = async () => {
    if (!total || answered < total) return toast('Please rate every question before submitting')
    setBusy(true)
    try { setSummary(await api.post('/api/evaluations', { application_id: cand.appId, round: section, ratings, comments })) }
    catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const decide = async (yes) => {
    try {
      await api.post('/api/evaluations/decision', { application_id: cand.appId, go_ahead: yes })
      await refreshCandidates()
      toast(yes ? `${resume.name} moved to the next stage` : `${resume.name} was not taken forward`)
      setSummary(null); back()
    } catch (e) { toast(e.message) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <button onClick={back} className="mb-1 rounded-lg border border-line p-2 hover:bg-surface"><ArrowLeft size={16} /></button>
        <div className="flex-1">
          <PageHeader eyebrow={`${sec.label} evaluation`} title={resume.name} subtitle={`${opp.id} · ${opp.role}`}>
            <span className="text-xs font-semibold text-muted">{answered}/{total} rated</span>
            <Button variant="accent" className="h-10" onClick={submit} disabled={busy || !total}><Send size={15} />{busy ? 'Submitting...' : 'Submit evaluation'}</Button>
          </PageHeader>
        </div>
      </div>

      <div className="grid grid-cols-12 items-start gap-4">
        <Card className="col-span-4 p-5"><CandidateProfile resume={resume} match={cand.score != null ? Math.round(cand.score) : undefined} /></Card>
        <div className="col-span-8 space-y-4">
          <Card className="p-5">
            <div className="mb-1 flex items-center justify-between"><h3 className="text-base font-bold">{sec.label} interview questions</h3><Badge tone="brand">{total} questions</Badge></div>
            {questions === null && <p className="py-6 text-center text-sm text-muted">Preparing questions...</p>}
            <div>
              {(questions || []).map((q, i) => (
                <div key={q} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
                  <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span><p className="text-sm font-semibold leading-snug">{q}</p></div>
                  <div className="flex shrink-0 gap-1.5">
                    {Object.entries(RATINGS).map(([label, { cls }]) => (
                      <label key={label} className="cursor-pointer">
                        <input type="radio" name={`q${i}`} className="sr-only" checked={ratings[i] === label} onChange={() => setRatings({ ...ratings, [i]: label })} />
                        <span className={cx('block rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition', ratings[i] === label ? cls : 'border-line text-muted hover:bg-surface')}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="text-base font-bold">Additional comments</h3>
            <p className="mb-2 text-xs text-muted">Note communication, attitude, soft skills and anything else worth remembering.</p>
            <div className="mb-2 flex flex-wrap gap-1.5">{TAGS.map((t) => <button key={t} type="button" onClick={() => setComments((c) => `${c}${c && !c.endsWith('\n') ? '\n' : ''}${t}: `)} className="rounded-full border border-brand-200 bg-brand-50/60 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">+ {t}</button>)}</div>
            <textarea rows={4} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Write your observations here..." className="w-full resize-none rounded-lg border border-line p-3 text-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            <div className="mt-3 flex justify-end"><Button variant="accent" className="h-11 px-6" onClick={submit} disabled={busy || !total}><Send size={15} />Submit evaluation</Button></div>
          </Card>
        </div>
      </div>

      {summary && (
        <Modal width="max-w-lg" title="Evaluation summary" subtitle={`${sec.label} round submitted`} onClose={() => setSummary(null)}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[['Opportunity ID', summary.opportunity_code], ['Candidate', summary.candidate], ['Match percentage', summary.match != null ? `${Math.round(summary.match)}%` : '—'], ['ATS score', summary.ats ?? 'Not checked']].map(([k, v]) => <div key={k} className="rounded-lg border border-line bg-surface/60 p-3"><div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{k}</div><div className="mt-0.5 font-bold">{v}</div></div>)}
          </div>
          <div className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Round scores</div>
          <div className="mt-2 space-y-2">
            {summary.rounds.map((r) => <div key={r.round} className="flex items-center gap-2 text-xs"><span className="w-24 font-semibold">{SECTIONS[r.round].label}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"><div className={cx('h-full rounded-full', scoreTone(r.score).bar)} style={{ width: `${r.score}%` }} /></div><span className="w-24 text-right font-bold">{r.rating} · {Math.round(r.score)}</span></div>)}
          </div>
          <div className={cx('mt-4 flex items-center gap-3 rounded-xl border p-3.5', summary.recommended ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50')}>
            {summary.recommended ? <CheckCircle2 size={26} className="shrink-0 text-emerald-600" /> : <XCircle size={26} className="shrink-0 text-rose-600" />}
            <div className="flex-1"><div className={cx('text-sm font-extrabold', summary.recommended ? 'text-emerald-700' : 'text-rose-700')}>{summary.recommended ? 'Recommended' : 'Not recommended'}</div><div className="text-xs text-ink/70">Overall score <b className={scoreTone(summary.overall).text}>{summary.overall}/100</b> from match, interview rating{summary.ats != null ? ' and ATS score' : ''}.</div></div>
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <div className="text-sm font-bold">Do you want to go ahead with this candidate?</div>
            <div className="mt-3 flex gap-3"><Button variant="accent" className="flex-1" onClick={() => decide(true)}>Yes, go ahead</Button><Button variant="danger" className="flex-1" onClick={() => decide(false)}>No</Button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
