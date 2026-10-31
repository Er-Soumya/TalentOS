import { ChevronRight, Clock } from 'lucide-react'
import { dayOf, fmtTime, monOf } from '../data/utils'

const TONES = [['#EAF2FF', '#2F6BE0'], ['#EFECFF', '#7C5CE6'], ['#FFF0E2', '#E08A1E'], ['#E5F7EC', '#12A36E']]

export default function InterviewList({ items, empty = 'No interviews scheduled' }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-line">
      {items.map((i, idx) => {
        const [bg, fg] = TONES[idx % TONES.length]
        const Row = i.link ? 'a' : 'div'
        return (
          <li key={i.id}>
            <Row {...(i.link ? { href: i.link, target: '_blank', rel: 'noreferrer' } : {})} className="flex items-center gap-3.5 py-3.5 transition hover:opacity-80">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none" style={{ background: bg, color: fg }}>
                <span className="text-lg font-extrabold">{dayOf(i.date)}</span>
                <span className="mt-0.5 text-[10px] font-bold uppercase">{monOf(i.date)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{i.candidate}</div>
                <div className="truncate text-xs text-muted">{i.role}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-brand-700"><Clock size={11} />{fmtTime(i.time)}<span className="font-medium text-muted"> · {i.round || 'Technical round'}</span></div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </Row>
          </li>
        )
      })}
    </ul>
  )
}
