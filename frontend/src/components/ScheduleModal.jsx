import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Button, ChipInput, Field, Modal, inputCls } from './ui'

export default function ScheduleModal({ target, onClose }) {
  const { addInterview, toast } = useApp()
  const [f, setF] = useState({ date: '', time: '', link: '', participants: [], round: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    if (!f.date || !f.time) return setErr('Please choose a date and time')
    if (!f.link.trim()) return setErr('Please add a meeting link')
    try {
      await addInterview({ candidate: target.candidate, role: target.role, oppId: target.oppId, resumeId: target.resumeId, date: f.date, time: f.time, link: f.link, participants: f.participants, round: f.round || 'Technical round' })
    } catch (e) { return setErr(e.message) }
    toast('Interview scheduled and added to the calendar'); onClose(true)
  }
  return (
    <Modal title="Schedule interview" subtitle={`${target.candidate} · ${target.role}`} onClose={() => onClose(false)}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required><input type="date" className={inputCls} value={f.date} onChange={set('date')} /></Field>
          <Field label="Time" required><input type="time" className={inputCls} value={f.time} onChange={set('time')} /></Field>
        </div>
        <Field label="Interview round"><select className={inputCls} value={f.round} onChange={set('round')}><option value="">Select round</option>{['Technical round', 'HR round', 'Hiring manager', 'Final round'].map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Meeting link" required><input className={inputCls} placeholder="https://meet.google.com/..." value={f.link} onChange={set('link')} /></Field>
        <Field label="Participants"><ChipInput value={f.participants} onChange={(participants) => setF({ ...f, participants })} placeholder="Type a name and press Enter" /></Field>
        {err && <p className="text-xs font-medium text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1"><Button variant="outline" onClick={() => onClose(false)}>Cancel</Button><Button variant="accent" onClick={save}>Schedule</Button></div>
      </div>
    </Modal>
  )
}
