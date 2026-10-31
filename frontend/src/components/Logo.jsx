import { BRAND } from '../data/seed'

export function BrandText({ className = '', light, large }) {
  return (
    <div className={className}>
      <div className={`${large ? 'text-[42px] leading-none' : 'text-[23px] leading-tight'} font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        {BRAND.name.replace(/OS$/, '')}<span className={light ? 'text-orange-400' : 'text-orange-500'}>OS</span>
      </div>
      <div className={`${large ? 'mt-1.5 text-[13px]' : 'text-[10.5px]'} font-semibold leading-tight tracking-wide ${light ? 'text-white/85' : 'text-ink'}`}>{BRAND.tagline}</div>
    </div>
  )
}

export const TalentLogo = ({ size = 40, round }) => <img src="/talentos-logo.png" alt="TalentOS" width={size} height={size} className={`shrink-0 object-contain ${round ? 'rounded-full bg-white shadow-pop' : ''}`} />

const CompanyLogo = ({ size = 32 }) => <img src="/logo.png" alt="TechGenius Balaji Solutions Pvt. Ltd." width={size} height={size} className="shrink-0 rounded-full object-cover" />

export function PoweredBy({ size = 30, light }) {
  return (
    <div className="flex items-center gap-2.5">
      <CompanyLogo size={size} />
      <div className="leading-tight">
        <div className={`text-[10px] font-medium uppercase tracking-wide ${light ? 'text-white/70' : 'text-muted'}`}>Powered by</div>
        <div className={`text-xs font-bold ${light ? 'text-white' : ''}`}>TechGenius Balaji Solutions Pvt. Ltd.</div>
      </div>
    </div>
  )
}
