import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../api'
import { STAGES } from '../data/seed'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

// ---- backend -> frontend shapes (the pages keep using the same field names as before) ----
const toUser = (u) => ({ id: u.id, orgName: u.org_name, email: u.email, phone: u.phone || '' })
const toOpp = (o) => ({
  id: o.code, dbId: o.id, recruiter: o.recruiter, role: o.role, experience: o.experience, skills: o.must_skills || [],
  niceSkills: o.nice_skills || [], positions: o.positions, ctc: o.ctc, location: o.location, mode: o.mode, status: o.status,
  jd: o.jd_text || '', createdOn: o.created_on || '',
})
const fromOpp = (f) => ({
  code: f.id, recruiter: f.recruiter, role: f.role, experience: f.experience, ctc: f.ctc, location: f.location, mode: f.mode,
  positions: Number(f.positions) || 1, status: f.status, must_skills: f.skills || [], nice_skills: f.niceSkills || [], jd_text: f.jd || '',
})
const toResume = (r) => ({
  id: r.id, name: r.name || r.file, title: r.title || '', exp: r.years ?? 0, skills: r.skills || [], file: r.file, uploaded: r.uploaded || '',
  ats: r.ats, lastMatch: r.last_match ? { oppId: r.last_match.code, score: r.last_match.score } : null,
  email: r.email, phone: r.phone, location: r.location, summary: r.summary, education: r.education || [], parsedWith: r.parsed_with, inDb: r.in_database !== false,
})
const toInterview = (i) => ({ id: i.id, appId: i.application_id, candidate: i.candidate, role: i.role, oppId: i.opportunity_code, date: i.date, time: i.time, round: i.round, link: i.link, participants: i.participants || [] })
const toEntry = (report, resume, appId) => ({
  resumeId: resume.id, appId, name: resume.name, score: report.score,
  matched: [...report.must_matched, ...report.nice_matched], missing: [...report.must_missing, ...report.nice_missing],
  mustMatched: report.must_matched, mustMissing: report.must_missing, niceMatched: report.nice_matched, niceMissing: report.nice_missing,
  skillPct: report.skill_pct, expFit: report.exp_fit, report,
})

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!getToken())
  const [dataReady, setDataReady] = useState(false)
  const [opportunities, setOpportunities] = useState([])
  const [resumes, setResumes] = useState([])
  const [interviews, setInterviews] = useState([])
  const [candidates, setCandidates] = useState([]) // one per application (candidate inside an opportunity)
  const [matches, setMatches] = useState({}) // { [opportunity code or 'custom']: [ranking entries] }
  const [queue, setQueue] = useState([]) // resume ids waiting in the Resume Matcher
  const [atsTarget, setAtsTarget] = useState(null) // resume id loaded into the ATS checker
  const [matcherDraft, setMatcherDraft] = useState({ oppId: '', jd: '' })
  const [toastMsg, setToastMsg] = useState(null)
  const oppsRef = useRef([])
  useEffect(() => { oppsRef.current = opportunities }, [opportunities])

  const toast = useCallback((m) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 3200) }, [])
  const clearData = () => { setOpportunities([]); setResumes([]); setInterviews([]); setCandidates([]); setMatches({}); setQueue([]); setAtsTarget(null); setMatcherDraft({ oppId: '', jd: '' }); setDataReady(false) }

  const loadCandidates = useCallback(async (opps) => {
    const apps = await api.get('/api/applications')
    const code = Object.fromEntries(opps.map((o) => [o.dbId, o.id]))
    setCandidates(apps.map((a) => ({ id: a.id, appId: a.id, oppId: code[a.opportunity_id], name: a.resume.name, stage: a.stage, resumeId: a.resume_id, score: a.match_score })))
  }, [])
  const refreshCandidates = useCallback(() => loadCandidates(oppsRef.current), [loadCandidates])

  const loadAll = useCallback(async () => {
    const [o, r, i] = await Promise.all([api.get('/api/opportunities'), api.get('/api/resumes'), api.get('/api/interviews')])
    const opps = o.map(toOpp)
    setOpportunities(opps); setResumes(r.map(toResume)); setInterviews(i.map(toInterview))
    await loadCandidates(opps)
    setDataReady(true)
  }, [loadCandidates])

  // restore the session on page load
  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(null); setUser(null); clearData() })
    if (!getToken()) { setBooting(false); return }
    api.get('/api/auth/me')
      .then(async (u) => { setUser(toUser(u)); await loadAll() })
      .catch(() => { setToken(null); setUser(null) })
      .finally(() => setBooting(false))
  }, [loadAll])

  // ---------------------------------------------------------------- auth
  const afterLogin = async (res) => {
    setToken(res.access_token); setUser(toUser(res.user))
    try { await loadAll() } catch (e) { toast(e.message) }
  }
  const attempt = async (fn) => { try { return { ok: true, ...(await fn()) } } catch (e) { return { ok: false, error: e.message } } }
  const sendSignupOtp = (email) => attempt(async () => ({ otpMode: (await api.post('/api/auth/signup/otp', { email })).otp_mode }))
  const register = (d) => attempt(async () => { await api.post('/api/auth/signup', { org_name: d.orgName, email: d.email, phone: d.phone, password: d.password, otp: d.otp }); return {} })
  const loginPassword = (email, password) => attempt(async () => { await afterLogin(await api.post('/api/auth/login', { email, password })); return {} })
  const sendLoginOtp = (email) => attempt(async () => ({ otpMode: (await api.post('/api/auth/login/otp', { email })).otp_mode }))
  const loginOtp = (email, otp) => attempt(async () => { await afterLogin(await api.post('/api/auth/login/otp/verify', { email, otp })); return {} })
  const logout = () => { setToken(null); setUser(null); clearData() }
  const updateProfile = (patch) => attempt(async () => { setUser(toUser(await api.patch('/api/auth/me', { org_name: patch.orgName, phone: patch.phone }))); return {} })
  const changePassword = (cur, next) => attempt(async () => { await api.post('/api/auth/change-password', { current_password: cur, new_password: next }); return {} })

  // ------------------------------------------------------- opportunities
  const newOppCode = async () => (await api.get('/api/opportunities/new-code')).code
  const addOpportunity = async (f) => { const o = toOpp(await api.post('/api/opportunities', fromOpp(f))); setOpportunities((p) => [o, ...p]); return o }
  const updateOpportunity = async (code, f) => {
    const cur = oppsRef.current.find((o) => o.id === code)
    const o = toOpp(await api.put(`/api/opportunities/${cur.dbId}`, fromOpp({ ...cur, ...f, id: cur.id })))
    setOpportunities((p) => p.map((x) => (x.id === code ? o : x))); return o
  }
  const deleteOpportunity = async (code) => {
    const cur = oppsRef.current.find((o) => o.id === code)
    await api.del(`/api/opportunities/${cur.dbId}`)
    setOpportunities((p) => p.filter((o) => o.id !== code)); setCandidates((p) => p.filter((c) => c.oppId !== code))
  }
  const generateJd = (f) => api.post('/api/opportunities/generate-jd', { role: f.role, experience: f.experience, must_skills: f.skills || [], nice_skills: f.niceSkills || [], location: f.location, mode: f.mode })
  const extractJd = async (file) => { const fd = new FormData(); fd.append('file', file); return (await api.upload('/api/opportunities/extract-jd', fd)).text }

  // ------------------------------------------------------ resume database
  const upsertResume = (raw) => { const r = toResume(raw); setResumes((p) => (p.some((x) => x.id === r.id) ? p.map((x) => (x.id === r.id ? r : x)) : [r, ...p])); return r }
  // stage: true = the Matcher page. The resume only joins the Resume Database after matching is complete.
  const uploadResumes = async (files, { stage = false } = {}) => {
    const fd = new FormData(); files.forEach((f) => fd.append('files', f))
    const res = await api.upload(`/api/resumes/upload${stage ? '?stage=true' : ''}`, fd)
    return { created: res.resumes.map(upsertResume), errors: res.errors || [] }
  }
  const deleteResume = async (id) => {
    await api.del(`/api/resumes/${id}`)
    setResumes((p) => p.filter((r) => r.id !== id)); setQueue((q) => q.filter((x) => x !== id)); setAtsTarget((t) => (t === id ? null : t))
  }
  const addToQueue = (ids) => setQueue((q) => [...new Set([...q, ...ids])])
  const removeFromQueue = (id) => {
    setQueue((q) => q.filter((x) => x !== id))
    const r = resumes.find((x) => x.id === id)
    if (r && !r.inDb) { api.del(`/api/resumes/${id}`).catch(() => {}); setResumes((p) => p.filter((x) => x.id !== id)) } // never saved: throw it away
  }

  // --------------------------------------------------------------- matcher
  const loadRanking = async (oppCode) => {
    const o = oppsRef.current.find((x) => x.id === oppCode)
    if (!o) return
    const res = await api.get(`/api/matching/${o.dbId}`)
    setMatches((m) => ({ ...m, [oppCode]: res.results.filter((x) => x.report).map((x) => toEntry(x.report, x.resume, x.id)) }))
  }
  const runMatch = async ({ oppCode, jd, resumeIds }) => {
    const o = oppsRef.current.find((x) => x.id === oppCode)
    const res = await api.post('/api/matching/run', { opportunity_id: o ? o.dbId : null, jd_text: jd || null, resume_ids: resumeIds })
    setMatches((m) => ({ ...m, [oppCode || 'custom']: res.results.map((x) => toEntry(x.report, x.resume, x.application_id)) }))
    res.results.forEach((x) => upsertResume(x.resume))
    if (o) await loadCandidates(oppsRef.current)
    return res
  }

  // ------------------------------------------------------------ interviews
  const addInterview = async (iv) => {
    const o = oppsRef.current.find((x) => x.id === iv.oppId)
    const res = await api.post('/api/interviews', {
      resume_id: iv.resumeId || null, opportunity_id: o ? o.dbId : null, candidate_name: iv.candidate, role: iv.role,
      date: iv.date, time: iv.time, round: iv.round, meeting_link: iv.link, participants: iv.participants || [],
    })
    setInterviews((p) => [...p, toInterview(res)])
  }

  const stageCounts = (oppId) => {
    const c = Object.fromEntries(STAGES.map((s) => [s, 0]))
    candidates.forEach((x) => { if ((!oppId || x.oppId === oppId) && c[x.stage] !== undefined) c[x.stage]++ })
    return c
  }

  return (
    <Ctx.Provider value={{
      user, booting, dataReady, toast, toastMsg,
      sendSignupOtp, register, loginPassword, sendLoginOtp, loginOtp, logout, updateProfile, changePassword,
      opportunities, newOppCode, addOpportunity, updateOpportunity, deleteOpportunity, generateJd, extractJd,
      resumes, uploadResumes, upsertResume, deleteResume, queue, addToQueue, removeFromQueue, atsTarget, setAtsTarget,
      matches, loadRanking, runMatch, matcherDraft, setMatcherDraft, interviews, addInterview,
      candidates, stageCounts, refreshCandidates,
    }}>
      {children}
    </Ctx.Provider>
  )
}
