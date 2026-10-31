import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Button, Field, inputCls } from '../components/ui'
import { useApp } from '../context/AppContext'

export default function Signup() {
  const { register, sendSignupOtp } = useApp()
  const nav = useNavigate()
  const [f, setF] = useState({ orgName: '', email: '', phone: '', password: '', confirm: '' })
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [verified, setVerified] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [otpMode, setOtpMode] = useState('fixed')
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (k === 'email') { setOtpSent(false); setVerified(false); setOtp('') } }
  const emailOk = /^\S+@\S+\.\S+$/.test(f.email)

  const sendOtp = async () => {
    setErr(''); setBusy(true)
    const r = await sendSignupOtp(f.email.trim())
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    setOtpMode(r.otpMode); setOtpSent(true)
  }
  // the real OTP check happens on the server when the account is created
  const verify = () => { if (otp.length === 4) { setVerified(true); setErr('') } else setErr('Enter the 4-digit OTP') }
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!f.orgName.trim()) return setErr('Organization name is required')
    if (!emailOk) return setErr('Enter a valid work email')
    if (!/^[+\d][\d\s-]{7,}$/.test(f.phone)) return setErr('Enter a valid phone number')
    if (!verified) return setErr('Please verify your email with the OTP')
    if (f.password.length < 8) return setErr('Password must be at least 8 characters')
    if (f.password !== f.confirm) return setErr('Passwords do not match')
    setBusy(true)
    const r = await register({ orgName: f.orgName.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password, otp })
    setBusy(false)
    if (!r.ok) { setErr(r.error); if (/otp/i.test(r.error)) setVerified(false) }
    else nav('/login', { state: { created: true, email: f.email.trim() } })
  }

  return (
    <AuthShell width="max-w-[470px]">
      <h2 className="text-2xl font-extrabold">Create your organization</h2>
      <p className="mb-5 mt-1 text-sm text-muted">Set up your workspace to start hiring with AI.</p>
      <form onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-3.5">
        <Field label="Organization name" required><input className={inputCls} placeholder="e.g. Aurelia Technologies" value={f.orgName} onChange={set('orgName')} /></Field>
        <Field label="Phone number" required><input className={inputCls} placeholder="+91 98765 43210" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Work email" required className="col-span-2">
          <div className="flex gap-2">
            <input className={inputCls} type="email" placeholder="name@company.com" value={f.email} onChange={set('email')} />
            {verified ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-sm font-semibold text-emerald-700"><BadgeCheck size={16} />Verified</span>
            ) : (
              <Button type="button" variant="outline" disabled={!emailOk || busy} onClick={sendOtp}>{otpSent ? 'Resend OTP' : 'Verify email'}</Button>
            )}
          </div>
        </Field>
        {otpSent && !verified && (
          <Field label="Enter OTP sent to your email" className="col-span-2">
            <div className="flex gap-2">
              <input className={`${inputCls} tracking-[0.5em]`} maxLength={4} placeholder="••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
              <Button type="button" variant="primary" onClick={verify}>Confirm OTP</Button>
            </div>
            <p className="mt-1.5 text-xs text-muted">{otpMode === 'fixed' ? <></> : 'We emailed you a 4-digit code.'}</p>
          </Field>
        )}
        <Field label="Create password" required><input className={inputCls} type="password" placeholder="Min. 8 characters" value={f.password} onChange={set('password')} /></Field>
        <Field label="Confirm password" required><input className={inputCls} type="password" placeholder="Re-enter password" value={f.confirm} onChange={set('confirm')} /></Field>
        {err && <p className="col-span-2 text-xs font-medium text-rose-600">{err}</p>}
        <Button type="submit" variant="accent" className="col-span-2" disabled={busy}>{busy ? 'Please wait...' : 'Create account'}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">Already registered? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in to your workspace</Link></p>
    </AuthShell>
  )
}
