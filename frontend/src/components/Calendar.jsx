import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtTime, toISO, todayISO } from '../data/utils'
import { Button, cx } from './ui'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const YEARS = Array.from({ length: 111 }, (_, i) => 1990 + i)
const sel = 'h-9 rounded-lg border border-line bg-white px-2.5 text-sm font-semibold outline-none focus:border-brand-500'

export default function Calendar({ interviews, selected, onSelect }) {
  const now = new Date()
  const [y, setY] = useState(now.getFullYear())
  const [m, setM] = useState(now.getMonth())
  const first = new Date(y, m, 1).getDay()
  const total = new Date(y, m + 1, 0).getDate()
  const rows = Math.ceil((first + total) / 7) // only the weeks that belong to this month
  const start = new Date(y, m, 1 - first)
  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { d: d.getDate(), iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()), inMonth: d.getMonth() === m }
  })
  const by = useMemo(() => interviews.reduce((acc, i) => ((acc[i.date] = [...(acc[i.date] || []), i]), acc), {}), [interviews])
  const go = (d) => { let nm = m + d, ny = y; if (nm < 0) { nm = 11; ny-- } if (nm > 11) { nm = 0; ny++ } setM(nm); setY(ny) }
  const today = todayISO()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select className={sel} value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTHS.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
          <select className={sel} value={y} onChange={(e) => setY(Number(e.target.value))}>{YEARS.map((n) => <option key={n}>{n}</option>)}</select>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-9" onClick={() => { setY(now.getFullYear()); setM(now.getMonth()); onSelect(today) }}>Today</Button>
          <button onClick={() => go(-1)} className="rounded-lg border border-line p-2 hover:bg-surface"><ChevronLeft size={16} /></button>
          <button onClick={() => go(1)} className="rounded-lg border border-line p-2 hover:bg-surface"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#DCE6F5]">
        <div className="grid shrink-0 grid-cols-7 border-b border-[#DCE6F5] bg-surface text-center text-[11px] font-bold uppercase tracking-wide text-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
          {cells.map((c, idx) => {
            const ev = c.inMonth ? by[c.iso] || [] : []
            const isToday = c.iso === today
            const isSel = c.iso === selected && c.inMonth
            return (
              <button
                key={c.iso}
                onClick={() => onSelect(c.iso === selected ? null : c.iso)}
                className={cx('flex min-h-0 flex-col items-stretch gap-1 overflow-hidden border-[#EEF1F6] p-1.5 text-left transition', idx % 7 !== 6 && 'border-r', idx < (rows - 1) * 7 && 'border-b', c.inMonth ? 'bg-white hover:bg-brand-50/60' : 'bg-surface/60', isSel && '!bg-brand-50 shadow-[inset_0_0_0_2px_#3B7BF2]')}
              >
                <span className="flex items-center justify-between">
                  <span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', isToday ? 'bg-brand-600 text-white' : c.inMonth ? 'text-ink' : 'text-gray-400')}>{c.d}</span>
                  {ev.length > 0 && <span className="rounded-full bg-brand-100 px-1.5 text-[10px] font-bold text-brand-700">{ev.length}</span>}
                </span>
                {ev[0] && <span className="truncate rounded border-l-2 border-brand-500 bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">{fmtTime(ev[0].time)} · {ev[0].candidate.split(' ')[0]}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
