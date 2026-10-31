import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Eye, EyeOff, KeyRound, LogOut, Pencil, User } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { initials } from '../data/utils'
import { Button, Field, Modal, inputCls } from './ui'

function ProfileModal({ mode, onClose }) {
  const { user, updateProfile, changePassword, toast } = useApp()
  const [f, setF] = useState({ orgName: user.orgName, phone: user.phone || '', cur: '', next: '', conf: '' })
  const [err, setErr] = useState('')
  const [show, setShow] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const saveProfile = async () => {
    if (!f.orgName.trim()) return setErr('Organization name is required')
    const r = await updateProfile({ orgName: f.orgName.trim(), phone: f.phone.trim() })
    if (!r.ok) return setErr(r.error)
    toast('Profile updated'); onClose()
  }
  const savePwd = async () => {
    if (f.next.length < 8) return setErr('New password must be at least 8 characters')
    if (f.next !== f.conf) return setErr('Passwords do not match')
    const r = await changePassword(f.cur, f.next)
    if (!r.ok) return setErr(r.error)
    toast('Password changed'); onClose()
  }

  if (mode === 'view')
    return (
      <Modal title="Profile" subtitle="Your organization account" onClose={onClose}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-base font-bold text-brand-700">{initials(user.orgName)}</span>
          <div><div className="font-bold">{user.orgName}</div><div className="text-xs text-muted">Recruiter admin</div></div>
        </div>
        {[['Work email', user.email], ['Phone', user.phone || '—']].map(([k, v]) => (
          <div key={k} className="flex justify-between border-t border-line py-2.5 text-sm"><span className="text-muted">{k}</span><span className="font-semibold">{v}</span></div>
        ))}
      </Modal>
    )

  if (mode === 'edit')
    return (
      <Modal title="Edit profile" onClose={onClose}>
        <div className="space-y-3">
          <Field label="Organization name" required><input className={inputCls} value={f.orgName} onChange={set('orgName')} /></Field>
          <Field label="Work email"><input className={`${inputCls} bg-surface`} value={user.email} readOnly /></Field>
          <Field label="Phone number"><input className={inputCls} value={f.phone} onChange={set('phone')} /></Field>
          {err && <p className="text-xs font-medium text-rose-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={saveProfile}>Save changes</Button></div>
        </div>
      </Modal>
    )

  return (
    <Modal title="Change password" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Current password" required><input type="password" className={inputCls} value={f.cur} onChange={set('cur')} /></Field>
        <Field label="New password" required>
          <div className="relative">
            <input type={show ? 'text' : 'password'} className={inputCls} value={f.next} onChange={set('next')} />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-muted">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </Field>
        <Field label="Confirm new password" required><input type="password" className={inputCls} value={f.conf} onChange={set('conf')} /></Field>
        {err && <p className="text-xs font-medium text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={savePwd}>Update password</Button></div>
      </div>
    </Modal>
  )
}

export default function ProfileMenu() {
  const { user, logout } = useApp()
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (m) => { setOpen(false); setModal(m) }
  const row = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-surface'

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 rounded-xl border border-line bg-white py-1.5 pl-1.5 pr-3 shadow-card transition hover:bg-surface">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{initials(user.orgName)}</span>
        <span className="text-left leading-tight">
          <span className="block max-w-[150px] truncate text-sm font-bold">{user.orgName}</span>
          <span className="block text-[11px] text-muted">Recruiter admin</span>
        </span>
        <ChevronDown size={16} className={`text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-line bg-white p-1.5 shadow-pop">
          <button className={row} onClick={() => pick('view')}><User size={16} className="text-muted" />View Profile</button>
          <button className={row} onClick={() => pick('edit')}><Pencil size={16} className="text-muted" />Edit Profile</button>
          <button className={row} onClick={() => pick('password')}><KeyRound size={16} className="text-muted" />Change Password</button>
          <div className="my-1.5 border-t border-line" />
          <button className={`${row} text-rose-600 hover:bg-rose-50`} onClick={logout}><LogOut size={16} />Logout</button>
        </div>
      )}
      {modal && <ProfileModal mode={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
