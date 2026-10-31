import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, FileCheck, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../api'
import { Badge, Button, Card, Modal, PageHeader, cx, inputCls } from '../components/ui'
import { SECTIONS, fmtDate, initials } from '../data/utils'

const COLS = [
  { key: 'selected', title: 'Ready for offer', sub: 'Completed all 3 rounds', icon: CheckCircle2, tone: ['#E5F7EC', '#10B981'] },
  { key: 'offered', title: 'Offered', sub: 'Offer sent, waiting to join', icon: FileCheck, tone: ['#FFF6D6', '#D9A400'] },
  { key: 'joined', title: 'Joined', sub: 'Confirmed by HR', icon: ShieldCheck, tone: ['#E3F6EF', '#14B8A6'] },
]
const ASK = {
  send: (n, r) => ({ title: 'Send offer?', text: `${n} will receive an offer for ${r} and move to the Offered list.`, note: 'Email notification will be added once email (SMTP) is set up in the backend.', btn: 'Send offer' }),
  join: (n) => ({ title: 'Confirm joining?', text: `Mark ${n} as joined. The candidate moves to the Joined list and counts as a filled position.`, btn: 'Confirm joining' }),
  decline: (n) => ({ title: 'Remove this candidate?', text: `${n} will be marked as rejected (offer declined or not offered).`, btn: 'Yes, remove', danger: true }),
}
const DONE = { send: (n) => `Offer sent to ${n}`, join: (n) => `${n} is now marked as joined`, decline: (n) => `${n} was removed from the offer list` }

export default function Offers() {
  const { opportunities, refreshCandidates, toast } = useApp()
  const [oppId, setOppId] = useState('') // '' = all opportunities
  const [data, setData] = useState(null)
  const [confirm, setConfirm] = useState(null) // { item, action }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const o = opportunities.find((x) => x.id === oppId)
    try { setData(await api.get(`/api/offers${o ? `?opportunity_id=${o.dbId}` : ''}`)) }
    catch (e) { toast(e.message); setData({ selected: [], offered: [], joined: [] }) }
  }, [oppId, opportunities, toast])
  useEffect(() => { load() }, [load])

  const run = async () => {
    const { item, action } = confirm
    setBusy(true)
    try {
      await api.post(`/api/offers/${item.application_id}/${action}`)
      toast(DONE[action](item.resume.name))
      setConfirm(null)
      await Promise.all([load(), refreshCandidates()])
    } catch (e) { toast(e.message) } finally { setBusy(false) }
  }

  const buttons = (it) => {
    if (it.stage === 'selected') return (<>
      <Button size="sm" variant="accent" className="flex-1" disabled={!it.can_send_offer} title={it.can_send_offer ? '' : 'All three rounds must be evaluated first'} onClick={() => setConfirm({ item: it, action: 'send' })}>Send offer</Button>
      <Button size="sm" variant="danger" onClick={() => setConfirm({ item: it, action: 'decline' })}>Not offering</Button></>)
    if (it.stage === 'offered') return (<>
      <Button size="sm" variant="accent" className="flex-1" onClick={() => setConfirm({ item: it, action: 'join' })}>Confirm joining</Button>
      <Button size="sm" variant="danger" onClick={() => setConfirm({ item: it, action: 'decline' })}>Declined</Button></>)
    return null
  }

  return (
    <div className="flex h-full min-h-[460px] flex-col gap-4">
      <PageHeader eyebrow="Offer management" title="Offers & Joining" subtitle="Send offers to candidates who completed every round, then confirm who joins.">
        <select className={cx(inputCls, 'w-72 font-semibold')} value={oppId} onChange={(e) => setOppId(e.target.value)}>
          <option value="">All opportunities</option>
          {opportunities.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.role}</option>)}
        </select>
      </PageHeader>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        {COLS.map(({ key, title, sub, icon: Icon, tone: [bg, fg] }) => {
          const items = data?.[key] || []
          return (
            <Card key={key} className="flex min-h-0 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: bg, color: fg }}><Icon size={18} /></span>
                <div className="flex-1"><div className="text-sm font-bold leading-tight">{title}</div><div className="text-[11px] text-muted">{sub}</div></div>
                <Badge tone="brand">{items.length}</Badge>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {data === null && <p className="py-8 text-center text-sm text-muted">Loading...</p>}
                {data !== null && !items.length && <p className="py-8 text-center text-sm text-muted">No candidates here yet</p>}
                {items.map((it) => (
                  <div key={it.application_id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(it.resume.name)}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{it.resume.name}</div><div className="truncate text-xs text-muted">{it.role} · {it.opportunity_code}</div></div>
                      <div className="text-right"><div className="text-sm font-extrabold">{it.overall}</div><div className="text-[10px] text-muted">overall</div></div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.keys(SECTIONS).map((r) => {
                        const ok = it.rounds_done.includes(r)
                        return <span key={r} className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-medium', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-muted')}>{SECTIONS[r].label}{ok ? ` ${Math.round(it.rounds[r])}` : ' —'}</span>
                      })}
                    </div>
                    <div className="mt-2 text-[11px] text-muted">
                      Match {it.match != null ? `${Math.round(it.match)}%` : '—'} · ATS {it.ats ?? '—'}
                      {it.offered_on && ` · Offered ${fmtDate(it.offered_on)}`}{it.joined_on && ` · Joined ${fmtDate(it.joined_on)}`}
                    </div>
                    {it.stage !== 'joined' && <div className="mt-3 flex gap-2">{buttons(it)}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      {confirm && (() => {
        const a = ASK[confirm.action](confirm.item.resume.name, confirm.item.role)
        return (
          <Modal title={a.title} onClose={() => setConfirm(null)}>
            <p className="text-sm text-ink/80">{a.text}</p>
            {a.note && <p className="mt-3 rounded-lg bg-brand-50 p-3 text-xs text-ink/70">{a.note}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant={a.danger ? 'danger' : 'accent'} disabled={busy} onClick={run}>{busy ? 'Please wait...' : a.btn}</Button>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}