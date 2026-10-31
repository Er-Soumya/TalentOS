import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button, Card, ChipInput, Dropzone, Field, cx, inputCls } from '../components/ui'
import { EXPERIENCE_OPTIONS, MODES } from '../data/seed'

export default function OpportunityForm() {
  const { dataReady } = useApp()
  if (!dataReady) return <div className="py-16 text-center text-sm text-muted">Loading...</div>
  return <Form />
}

function Form() {
  const { id } = useParams()
  const nav = useNavigate()
  const { opportunities, addOpportunity, updateOpportunity, newOppCode, generateJd, extractJd, toast } = useApp()
  const existing = opportunities.find((o) => o.id === id)
  const [f, setF] = useState(existing || { id: '', recruiter: '', role: '', experience: '', skills: [], niceSkills: [], positions: 1, ctc: '', location: '', mode: '', status: 'Active', jd: '' })
  const [tab, setTab] = useState('paste')
  const [file, setFile] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (!existing) newOppCode().then((code) => setF((p) => ({ ...p, id: code }))).catch((e) => toast(e.message)) }, []) // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const onFile = async (files) => {
    const x = files[0]; setFile(x.name); setBusy(true)
    try { const text = await extractJd(x); setF((p) => ({ ...p, jd: text })); setTab('paste') } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const aiJd = async () => {
    setBusy(true)
    try { const r = await generateJd(f); setF((p) => ({ ...p, jd: r.jd })); if (!r.ai_used) toast('The AI is not available, so a template JD was used') } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const save = async () => {
    const pos = Number(f.positions)
    if (!f.recruiter || !f.role.trim() || !f.experience || !f.ctc.trim() || !f.location.trim() || !f.mode) return setErr('Please fill all required fields.')
    if (!f.skills.length) return setErr('Add at least one must-have skill.')
    if (!Number.isInteger(pos) || pos < 1) return setErr('No. of positions must be 1 or more.')
    const data = { ...f, positions: pos }
    setSaving(true); setErr('')
    try {
      if (existing) await updateOpportunity(f.id, data); else await addOpportunity(data)
      toast(existing ? 'Opportunity updated' : 'Opportunity created'); nav('/opportunities')
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav('/opportunities')} className="rounded-lg border border-line p-2 hover:bg-surface"><ArrowLeft size={16} /></button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Requirement management</p>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{existing ? 'Edit opportunity' : 'Create an opportunity'}</h2>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <Card className="col-span-7 overflow-auto p-5">
          <div className="mb-3 flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">01</span><div><div className="text-sm font-bold">Role details</div><div className="text-xs text-muted">Tell us who you are looking to hire</div></div></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Recruiter name" required>
              <input className={inputCls} placeholder="e.g. Sarah Mitchell" value={f.recruiter} onChange={set('recruiter')} />
            </Field>
            <Field label="Required role" required><input className={inputCls} placeholder="e.g. AI / ML Engineer" value={f.role} onChange={set('role')} /></Field>
            <Field label="Years of experience" required>
              <select className={inputCls} value={f.experience} onChange={set('experience')}><option value="">Select experience</option>{EXPERIENCE_OPTIONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="CTC / salary range" required><input className={inputCls} placeholder="e.g. ₹12–18 LPA" value={f.ctc} onChange={set('ctc')} /></Field>
            <Field label="Location" required><input className={inputCls} placeholder="e.g. Bhubaneswar" value={f.location} onChange={set('location')} /></Field>
            <Field label="Mode of work" required>
              <select className={inputCls} value={f.mode} onChange={set('mode')}><option value="">Select mode</option>{MODES.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="No. of positions" required><input type="number" min={1} className={inputCls} value={f.positions} onChange={set('positions')} /></Field>
            <Field label="Status"><select className={inputCls} value={f.status} onChange={set('status')}><option>Active</option><option>Hold</option><option>Closed</option></select></Field>
            <Field label="Must have skills" required><ChipInput value={f.skills} onChange={(skills) => setF({ ...f, skills })} placeholder="Type a skill, press Enter" /></Field>
            <Field label="Nice to have skills"><ChipInput value={f.niceSkills || []} onChange={(niceSkills) => setF({ ...f, niceSkills })} placeholder="Type a skill, press Enter" /></Field>
          </div>
        </Card>

        <Card className="col-span-5 flex min-h-0 flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">02</span><div className="text-sm font-bold">Job description</div></div>
            <Button size="sm" variant="outline" onClick={aiJd} disabled={busy || !f.role}><Sparkles size={13} className="text-brand-600" />{busy ? 'Generating...' : 'Generate with AI'}</Button>
          </div>
          <div className="mb-3 grid grid-cols-2 rounded-lg bg-surface p-1">
            {[['upload', 'Upload JD'], ['paste', 'Paste JD']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cx('rounded-md py-1.5 text-sm font-semibold', tab === k ? 'bg-white shadow-card' : 'text-muted')}>{l}</button>)}
          </div>
          {tab === 'upload' ? (
            <div className="flex-1"><Dropzone accept=".pdf,.doc,.docx,.txt" onFiles={onFile} title="Upload job description" hint="PDF, DOC, DOCX or TXT (max 10 MB)" className="h-full min-h-[160px]" /></div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {file && <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><FileText size={13} />Attached: {file}</div>}
              <textarea className="min-h-0 flex-1 resize-none rounded-lg border border-line p-3 text-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="Paste the job description here..." value={f.jd} onChange={set('jd')} />
            </div>
          )}
        </Card>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="w-64"><Field label="Opportunity ID (system generated)"><input readOnly className={`${inputCls} bg-surface font-bold text-brand-700`} value={f.id || 'Generating...'} /></Field></div>
        <div className="flex items-center gap-3">
          {err && <span className="text-xs font-medium text-rose-600">{err}</span>}
          <Button variant="outline" onClick={() => nav('/opportunities')}>Cancel</Button>
          <Button variant="accent" onClick={save} disabled={saving || !f.id}>{saving ? 'Saving...' : existing ? 'Save changes' : 'Create opportunity'}</Button>
        </div>
      </div>
    </div>
  )
}
