import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Badge, Button, Card, Modal, PageHeader, inputCls } from '../components/ui'
import { fmtDate, statusTone } from '../data/utils'

export default function Opportunities() {
  const { opportunities, deleteOpportunity, toast } = useApp()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [del, setDel] = useState(null)
  useEffect(() => { setQ(params.get('q') || '') }, [params])
  const rows = opportunities.filter((o) => `${o.id} ${o.role} ${o.recruiter} ${o.location}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-4">
      <PageHeader eyebrow="Requirement management" title="Your opportunities" subtitle="Create, edit and track every hiring requirement in one place.">
        <div className="relative w-72"><Search size={16} className="absolute left-3 top-3 text-muted" /><input className={`${inputCls} pl-9`} placeholder="Search by ID, role, recruiter..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button variant="accent" className="h-10" onClick={() => nav('/opportunities/new')}><Plus size={16} />Add New</Button>
      </PageHeader>
      <Card className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed text-center text-sm">
          <colgroup><col className="w-[16%]" /><col className="w-[17%]" /><col className="w-[14%]" /><col className="w-[10%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[9%]" /><col className="w-[8%]" /></colgroup>
          <thead className="sticky top-0 z-10 bg-surface text-[11px] font-bold uppercase tracking-wide text-muted">
            <tr>{['Opportunity ID', 'Role', 'Recruiter', 'Positions', 'CTC', 'Location / Mode', 'Status', 'Actions'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-surface/60">
                <td className="px-3 py-3 font-bold text-brand-700">{o.id}<div className="text-[11px] font-medium text-muted">{fmtDate(o.createdOn)}</div></td>
                <td className="px-3 py-3 font-semibold">{o.role}<div className="text-[11px] font-medium text-muted">{o.experience}</div></td>
                <td className="px-3 py-3 text-muted">{o.recruiter}</td>
                <td className="px-3 py-3 font-semibold">{o.positions}</td>
                <td className="px-3 py-3">{o.ctc}</td>
                <td className="px-3 py-3">{o.location}<div className="text-[11px] font-medium text-muted">{o.mode}</div></td>
                <td className="px-3 py-3"><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
                <td className="px-3 py-3">
                  <div className="flex justify-center gap-1.5">
                    <button title="Edit" onClick={() => nav(`/opportunities/${o.id}/edit`)} className="rounded-lg border border-line p-2 text-muted hover:bg-surface hover:text-ink"><Pencil size={14} /></button>
                    <button title="Delete" onClick={() => setDel(o)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="py-12 text-center text-muted">No opportunities found</td></tr>}
          </tbody>
        </table>
      </Card>
      {del && (
        <Modal title="Delete opportunity?" subtitle={`${del.id} · ${del.role}`} onClose={() => setDel(null)}>
          <p className="text-sm text-muted">This will permanently remove the opportunity from your workspace.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDel(null)}>Cancel</Button>
            <Button variant="accent" className="!bg-rose-600 hover:!bg-rose-700" onClick={async () => { try { await deleteOpportunity(del.id); toast('Opportunity deleted') } catch (e) { toast(e.message) } setDel(null) }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
