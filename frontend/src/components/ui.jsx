import { useEffect, useState } from 'react'
import { Upload, X } from 'lucide-react'

export const cx = (...a) => a.filter(Boolean).join(' ')
export const inputCls = 'w-full h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export function Button({ variant = 'primary', size = 'md', className, ...p }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    accent: 'bg-brand-600 text-white hover:bg-brand-700',
    outline: 'border border-line bg-white text-ink hover:bg-surface',
    ghost: 'text-muted hover:bg-surface hover:text-ink',
    danger: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
  }
  const s = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm' }
  return <button className={cx('inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', v[variant], s[size], className)} {...p} />
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
        <h2 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </div>
  )
}

export const Card = ({ className, ...p }) => <div className={cx('rounded-xl border border-[#DCE6F5] bg-white shadow-card', className)} {...p} />

export function Field({ label, required, children, className }) {
  return (
    <div className={className}>
      <span className="mb-1.5 block text-xs font-semibold text-ink/80">{label}{required && <span className="text-brand-600"> *</span>}</span>
      {children}
    </div>
  )
}

const tones = { green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', brand: 'bg-brand-50 text-brand-700', gray: 'bg-slate-100 text-slate-600' }
export const Badge = ({ tone = 'gray', children }) => <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold', tones[tone])}>{children}</span>

export function Modal({ title, subtitle, onClose, children, width = 'max-w-md' }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-pop', width)}>
        <div className="flex shrink-0 items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

export function ChipInput({ value, onChange, placeholder }) {
  const [t, setT] = useState('')
  const add = () => { const v = t.trim().replace(/,$/, ''); if (v && !value.includes(v)) onChange([...value, v]); setT('') }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {v}<button type="button" onClick={() => onChange(value.filter((x) => x !== v))}><X size={12} /></button>
        </span>
      ))}
      <input
        value={t} onChange={(e) => setT(e.target.value)} onBlur={add} placeholder={value.length ? '' : placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } else if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1)) }}
        className="min-w-[120px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-gray-400"
      />
    </div>
  )
}

export function Dropzone({ onFiles, multiple, accept = '.pdf,.doc,.docx', title = 'Drag and drop or click to upload', hint = 'PDF, DOC or DOCX (max 10 MB)', compact, cta = 'Browse', className }) {
  const [over, setOver] = useState(false)
  const handle = (fl) => { const f = [...fl]; if (f.length) onFiles(f) }
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files) }}
      className={cx('group flex cursor-pointer items-center rounded-xl border-2 border-dashed transition', compact ? 'gap-3 px-3 py-2.5' : 'flex-col justify-center gap-2 px-4 py-6 text-center', over ? 'border-brand-500 bg-brand-100/60' : 'border-brand-200 bg-brand-50/50 hover:border-brand-500 hover:bg-brand-50', className)}
    >
      <span className={cx('flex shrink-0 items-center justify-center rounded-full border border-brand-100 bg-white text-brand-600 shadow-card', compact ? 'h-9 w-9' : 'h-12 w-12')}><Upload size={compact ? 16 : 20} /></span>
      <span className={compact ? 'min-w-0 flex-1' : ''}><span className="block text-sm font-bold">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
      <span className="inline-flex h-8 shrink-0 items-center rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white group-hover:bg-brand-700">{cta}</span>
      <input type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { handle(e.target.files); e.target.value = '' }} />
    </label>
  )
}

const STAT = { blue: ['#EAF2FF', '#3B82F6'], violet: ['#EFECFF', '#8B5CF6'], amber: ['#FFF0E2', '#F59E0B'], green: ['#E5F7EC', '#10B981'], yellow: ['#FFF6D6', '#D9A400'], teal: ['#E3F6EF', '#14B8A6'], rose: ['#FFE9EE', '#F43F5E'] }
export function StatCard({ icon: Icon, label, value, sub, tone = 'blue' }) {
  const [bg, fg] = STAT[tone]
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#DCE6F5] bg-white p-3 shadow-card">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: bg, color: fg }}><Icon size={18} /></span>
      <div className="min-w-0">
        <div className="truncate text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</div>
        <div className="text-xl font-extrabold leading-tight">{value}</div>
        {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  )
}


export function SectionCard({ icon: Icon, title, subtitle, badge, action, flush, children, className }) {
  return (
    <Card className={cx('flex flex-col overflow-hidden', className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon size={16} /></span>
          <div><div className="text-sm font-bold leading-tight">{title}</div><div className="text-[11px] text-muted">{subtitle}</div></div>
        </div>
        <div className="flex items-center gap-2">{action}{badge}</div>
      </div>
      <div className={cx('min-h-0 flex-1 overflow-auto', !flush && 'p-4')}>{children}</div>
    </Card>
  )
}

export function Donut({ total, segments, size = 84 }) {
  const r = 34, c = 2 * Math.PI * r
  let off = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#E8EEF7" strokeWidth="9" />
        {total > 0 && segments.map((s, i) => { const len = (s.value / total) * c; const el = <circle key={i} cx="40" cy="40" r={r} fill="none" stroke={s.color} strokeWidth="9" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />; off += len; return el })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none"><span className="text-base font-extrabold">{total}</span><span className="text-[9px] text-muted">total</span></div>
    </div>
  )
}
