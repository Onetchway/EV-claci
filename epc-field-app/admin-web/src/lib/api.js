const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4100/api';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('epc_admin_token');
}

export function setSession(token, user) {
  window.localStorage.setItem('epc_admin_token', token);
  window.localStorage.setItem('epc_admin_user', JSON.stringify(user));
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('epc_admin_user');
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  window.localStorage.removeItem('epc_admin_token');
  window.localStorage.removeItem('epc_admin_user');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      clearSession();
      window.location.href = '/login';
    }
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}
