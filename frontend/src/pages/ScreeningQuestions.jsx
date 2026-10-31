import { useState } from 'react'
import { Check, Copy, ListChecks, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PageHeader, Button, Card, Field, inputCls } from '../components/ui'
import { api } from '../api'

export default function ScreeningQuestions() {
  const { opportunities, toast } = useApp()
  const [oppId, setOppId] = useState('')
  const [count, setCount] = useState('')
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(null)
  const opp = opportunities.find((o) => o.id === oppId)
  
  const generate = async (again = false) => {
    setBusy(true)
    try {
      const res = await api.post('/api/screening/generate', { opportunity_id: opp.dbId, count, regenerate: again })
      setItems(res.questions.map((q) => ({ q: q.question, hint: q.hints || [] })))
      if (!res.ai_used) toast('The AI is not available, so template questions were used')
    } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const copy = (txt, key) => { navigator.clipboard?.writeText(txt); setCopied(key); setTimeout(() => setCopied(null), 1400) }
  const copyAll = () => { navigator.clipboard?.writeText(items.map((x, i) => `${i + 1}. ${x.q}\n   Hints: ${x.hint.join(', ')}`).join('\n')); toast('All questions copied') }

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-4">
      <PageHeader eyebrow="AI screening questions" title="Generate screening questions" subtitle="Create role-specific questions with answer hints for your opportunity." />
      <Card className="p-5">
        <div className="flex items-end gap-4">
          <Field label="Opportunity ID" required className="flex-1">
            <select className={inputCls} value={oppId} onChange={(e) => { setOppId(e.target.value); setItems([]) }}>
              <option value="">Select opportunity</option>
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.role}</option>)}
            </select>
          </Field>
          <Field label="Number of questions" className="w-52">
            <select className={inputCls} value={count} onChange={(e) => setCount(e.target.value ? Number(e.target.value) : '')}><option value="">Select</option>{[5, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n} questions</option>)}</select>
          </Field>
          <Button variant="accent" disabled={!opp || !count || busy} onClick={() => generate(false)}>{busy ? <><Loader2 size={16} className="animate-spin" />Generating...</> : <><Sparkles size={16} />Generate with AI</>}</Button>
        </div>
        {opp && <p className="mt-3 text-xs text-muted">Based on <b className="text-ink">{opp.role}</b> · {opp.experience} · Skills: {opp.skills.join(', ')}</p>}
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {items.length ? (
          <>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="text-sm font-bold">Generated questions <span className="ml-1 font-medium text-muted">({items.length})</span></div>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => generate(true)} disabled={busy}><RefreshCw size={13} />Regenerate</Button><Button size="sm" variant="primary" onClick={copyAll}><Copy size={13} />Copy all</Button></div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-center text-sm">
                <thead className="sticky top-0 bg-surface text-[11px] font-bold uppercase tracking-wide text-muted"><tr><th className="w-12 px-5 py-2.5">#</th><th className="px-3 py-2.5">Question</th><th className="px-3 py-2.5">Answer hint (keywords / points)</th><th className="w-20 px-3 py-2.5">Action</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {items.map((x, i) => (
                    <tr key={x.q} className="align-top hover:bg-surface/60">
                      <td className="px-5 py-3 font-bold text-muted">{i + 1}</td>
                      <td className="px-3 py-3 font-semibold">{x.q}</td>
                      <td className="px-3 py-3"><div className="flex flex-wrap justify-center gap-1">{x.hint.map((h) => <span key={h} className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">{h}</span>)}</div></td>
                      <td className="px-3 py-3"><button onClick={() => copy(`${x.q}\nHints: ${x.hint.join(', ')}`, x.q)} className="mx-auto flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-surface">{copied === x.q ? <><Check size={12} className="text-emerald-500" />Copied</> : <><Copy size={12} />Copy</>}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted"><ListChecks size={34} className="mb-2 text-gray-300" />{busy ? 'Generating questions...' : <>Select an opportunity and the number of questions,<br />then generate role-specific screening questions with AI.</>}</div>
        )}
      </Card>
    </div>
  )
}
