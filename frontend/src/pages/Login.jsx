import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Button, Field, cx, inputCls } from '../components/ui'
import { useApp } from '../context/AppContext'

export default function Login() {
  const { loginPassword, loginOtp, sendLoginOtp } = useApp()
  const loc = useLocation()
  const [mode, setMode] = useState('password')
  const [email, setEmail] = useState(loc.state?.email || '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [otpMode, setOtpMode] = useState('fixed')

  const switchMode = (m) => { setMode(m); setErr(''); setOtpSent(false); setOtp('') }
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid work email')
    setBusy(true)
    try {
      if (mode === 'otp' && !otpSent) {
        const r = await sendLoginOtp(email.trim())
        if (!r.ok) return setErr(r.error)
        setOtpMode(r.otpMode); setOtpSent(true); return
      }
      const r = mode === 'password' ? await loginPassword(email.trim(), password) : await loginOtp(email.trim(), otp)
      if (!r.ok) setErr(r.error)
    } finally { setBusy(false) }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-extrabold">Welcome back</h2>
      <p className="mb-5 mt-1 text-sm text-muted">Sign in to your TalentOS workspace.</p>
      {loc.state?.created && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Account created successfully. Please sign in to continue.</p>}
      <div className="mb-4 grid grid-cols-2 rounded-lg bg-surface p-1">
        {[['password', 'Password'], ['otp', 'Email OTP']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => switchMode(k)} className={cx('rounded-md py-1.5 text-sm font-semibold transition', mode === k ? 'bg-white shadow-card' : 'text-muted')}>{l}</button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Work email" required><input className={inputCls} type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {mode === 'password' ? (
          <Field label="Password" required>
            <div className="relative">
              <input className={inputCls} type={show ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-muted">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </Field>
        ) : otpSent ? (
          <Field label="Enter OTP" required>
            <input className={`${inputCls} tracking-[0.5em]`} maxLength={4} placeholder="••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
            <p className="mt-1.5 text-xs text-muted">{otpMode === 'fixed' ? <></> : 'We emailed you a 4-digit code.'}</p>
          </Field>
        ) : null}
        {err && <p className="text-xs font-medium text-rose-600">{err}</p>}
        <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? 'Please wait...' : mode === 'otp' && !otpSent ? 'Send OTP' : 'Sign in'}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">New to TalentOS? <Link to="/signup" className="font-semibold text-brand-700 hover:underline">Create organization account</Link></p>
    </AuthShell>
  )
}
