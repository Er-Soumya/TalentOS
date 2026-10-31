import { Check } from 'lucide-react'
import { BrandText, PoweredBy, TalentLogo } from './Logo'

const WHAT = [
  { title: 'AI candidate matching', desc: 'Rank resumes against every opportunity by skills, experience and fit.' },
  { title: 'Resume intelligence & ATS analysis', desc: 'Score resumes and see exactly what to improve before applying.' },
  { title: 'Automated screening questions', desc: 'Generate role-specific questions with answer hints in seconds.' },
  { title: 'Interview evaluation & tracking', desc: 'Rate every round and follow candidates all the way to joining.' },
]
// CoEdge-style: deep indigo base, fine square grid, soft violet glow (top-right) and teal glow (bottom-left)
const base = { background: 'linear-gradient(160deg,#171845 0%,#1C1E5C 48%,#13153E 100%)' }
const grid = { backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)', backgroundSize: '40px 40px' }

export default function AuthShell({ width = 'max-w-[440px]', children }) {
  return (
    <div className="flex h-screen bg-white">
      <div className="relative hidden w-[55%] flex-col justify-between overflow-hidden p-10 lg:flex" style={base}>
        <span className="absolute inset-0" style={grid} />
        <span className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#6C73FF]/35 blur-3xl" />
        <span className="absolute -bottom-40 -left-24 h-[420px] w-[420px] rounded-full bg-teal-400/20 blur-3xl" />

        <div className="relative flex w-fit items-center gap-3.5"><TalentLogo size={76} round /><BrandText light large /></div>

        <div className="relative">
          <h1 className="whitespace-nowrap text-[30px] font-extrabold leading-tight tracking-tight text-white">Hire Smarter. Faster. Together.</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#AEB1E3]">One unified workspace for requirements, candidate matching, assessments, screening and interview evaluation.</p>
          <ul className="mt-6 space-y-4">
            {WHAT.map(({ title, desc }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8F93F5] text-white"><Check size={13} strokeWidth={3} /></span>
                <span><span className="block text-[14.5px] font-semibold text-white">{title}</span><span className="block text-[12.5px] leading-snug text-[#AEB1E3]">{desc}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative border-t border-white/15 pt-4"><PoweredBy size={36} light /></div>
      </div>

      <div className="flex w-full items-center justify-center overflow-auto bg-white px-6 py-8 lg:w-[45%]">
        <div className={`w-full ${width}`}>
          <div className="mb-5 flex justify-center lg:hidden"><div className="flex items-center gap-3"><TalentLogo size={52} /><BrandText /></div></div>
          <div className="rounded-2xl border border-[#DCE6F5] bg-white p-7 shadow-pop">{children}</div>
          <div className="mt-6 flex justify-center lg:hidden"><PoweredBy /></div>
        </div>
      </div>
    </div>
  )
}
