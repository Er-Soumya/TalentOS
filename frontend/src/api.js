// Tiny client for the TalentOS backend. The address comes from VITE_API_URL (see .env.example).
const BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const KEY = 'talentos_token'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY))

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function request(method, path, { json, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let body
  if (form) body = form // FormData: the browser adds the multipart boundary itself
  else if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json) }

  let res
  try {
    res = await fetch(BASE + path, { method, headers, body })
  } catch {
    throw new Error(`Cannot reach the server at ${BASE}. Is the backend running?`)
  }
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/api/auth/login')) onUnauthorized()
    const d = data && data.detail
    const msg = typeof d === 'string' ? d
      : Array.isArray(d) ? d.map((e) => `${e.loc ? e.loc.slice(1).join('.') + ': ' : ''}${e.msg}`).join('; ')
      : `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, json) => request('POST', p, { json }),
  put: (p, json) => request('PUT', p, { json }),
  patch: (p, json) => request('PATCH', p, { json }),
  del: (p) => request('DELETE', p),
  upload: (p, form) => request('POST', p, { form }),
}
