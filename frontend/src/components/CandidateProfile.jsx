import { Mail, MapPin, Phone } from 'lucide-react'
import { initials, profileOf } from '../data/utils'
import { Badge } from './ui'

const Block = ({ label, children }) => (
  <div className="mt-4"><div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</div><div className="mt-1 text-sm leading-relaxed">{children}</div></div>
)

export default function CandidateProfile({ resume, match }) {
  const p = profileOf(resume)
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{initials(resume.name)}</span>
        <div className="min-w-0"><div className="truncate text-base font-bold">{resume.name}</div><div className="text-xs text-muted">{resume.title} · {resume.exp} yrs experience</div></div>
      </div>
      {(match != null || resume.ats != null) && (
        <div className="mt-3 flex gap-2">{match != null && <Badge tone="brand">Match {match}%</Badge>}{resume.ats != null && <Badge tone="green">ATS {resume.ats}</Badge>}</div>
      )}
      <div className="mt-4 space-y-2 text-sm">
        {[[Mail, p.email], [Phone, p.phone], [MapPin, p.location]].map(([I, t]) => <div key={t} className="flex items-center gap-2.5"><I size={15} className="shrink-0 text-brand-600" /><span className="truncate">{t}</span></div>)}
      </div>
      <Block label="Education">{p.education}</Block>
      <Block label="Profile summary">{p.summary}</Block>
      <Block label="Skills"><div className="flex flex-wrap gap-1.5">{resume.skills.map((s) => <span key={s} className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{s}</span>)}</div></Block>
      <Block label="Resume file">{resume.file}</Block>
    </div>
  )
}
