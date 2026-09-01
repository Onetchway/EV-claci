import axios from 'axios';
import { getSession } from 'next-auth/react';

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
});

client.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.backendToken) config.headers.Authorization = `Bearer ${session.backendToken}`;
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(new Error(err.response?.data?.error || err.message || 'Request failed'))
);

const buildQuery = (params = {}) => {
  const usable = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return new URLSearchParams(usable).toString();
};

const resource = (base) => ({
  list:   (params) => client.get(`${base}${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  get:    (id) => client.get(`${base}/${id}`),
  create: (data) => client.post(base, data),
  update: (id, data) => client.put(`${base}/${id}`, data),
  delete: (id) => client.delete(`${base}/${id}`),
});

// ── EV / CSMS APIs (existing platform) ──────────────────────────────────
export const stationsApi = { ...resource('/stations') };
export const chargersApi = {
  ...resource('/chargers'),
  remoteStart: (id, data) => client.post(`/chargers/${id}/start`, data),
  remoteStop:  (id) => client.post(`/chargers/${id}/stop`),
};
export const bssApi = { ...resource('/bss') };
export const franchisesApi = {
  ...resource('/franchises'),
  dashboard: (id) => client.get(`/franchises/${id}/dashboard`),
  // The logged-in franchise partner's own portal (role "franchise") — no id
  // needed anywhere here, it's always resolved from the caller's own
  // franchise_id server-side. Mirrors crm/'s Livanto franchise/investor
  // portal sections.
  portalDashboard:  () => client.get('/franchises/portal/dashboard'),
  portalDocuments:  () => client.get('/franchises/portal/documents'),
  uploadDocument:   (kind, file) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    return client.post('/franchises/portal/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  // The download route needs the Bearer token, so a plain <a href> won't
  // work — fetch it as a blob and hand the browser a local object URL.
  downloadDocument: async (id, fileName) => {
    const res = await client.get(`/franchises/documents/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res);
    const a = document.createElement('a');
    a.href = url; a.download = fileName || 'document';
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  },
  portalPayments:   () => client.get('/franchises/portal/payments'),
  getBankDetails:   () => client.get('/franchises/portal/bank-details'),
  saveBankDetails:  (data) => client.put('/franchises/portal/bank-details', data),
  portalSupport:    () => client.get('/franchises/portal/support'),
  submitSupport:    (data) => client.post('/franchises/portal/support', data),
  // Admin-side management of a specific franchise (see franchise/page.js).
  setStage:         (id, stage) => client.put(`/franchises/${id}/stage`, { stage }),
  listPayments:     (id) => client.get(`/franchises/${id}/payments`),
  createPayment:    (id, data) => client.post(`/franchises/${id}/payments`, data),
  markPaymentPaid:  (id, paymentId) => client.put(`/franchises/${id}/payments/${paymentId}/paid`),
};
export const sessionsApi = { ...resource('/sessions') };
export const revenueApi = {
  list:    (params) => client.get(`/revenue${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  summary: (params) => client.get(`/revenue/summary${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  pnl:     (params) => client.get(`/revenue/pnl${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  compute: (data) => client.post('/revenue/compute', data),
  export:  (params) => `${client.defaults.baseURL}/revenue/export${buildQuery(params) ? `?${buildQuery(params)}` : ''}`,
};
export const settlementsApi = {
  ...resource('/settlements'),
  generate:     (data) => client.post('/settlements/generate', data),
  updateStatus: (id, data) => client.put(`/settlements/${id}`, data),
};
export const usersApi = { ...resource('/users') };
export const dashboardApi = {
  admin:   () => client.get('/dashboard/admin'),
  station: (id) => client.get(`/dashboard/station/${id}`),
};

// ── NAKJM EPC APIs ───────────────────────────────────────────────────────
export const nakjmClientsApi  = { ...resource('/nakjm/clients') };
export const nakjmVendorsApi  = { ...resource('/nakjm/vendors') };
export const nakjmTeamApi     = {
  ...resource('/nakjm/team'),
  listByProject:  (projectId) => client.get(`/nakjm/projects/${projectId}/team`),
  assign:         (projectId, data) => client.post(`/nakjm/projects/${projectId}/team`, data),
  unassign:       (projectId, teamMemberId) => client.delete(`/nakjm/projects/${projectId}/team/${teamMemberId}`),
};
export const nakjmProjectsApi = {
  ...resource('/nakjm/projects'),
  analytics: (id) => client.get(`/nakjm/projects/${id}/analytics`),
};
export const nakjmQuotationsApi = { ...resource('/nakjm/quotations') };
export const nakjmBoqApi        = { ...resource('/nakjm/boq') };
export const nakjmPoApi         = { ...resource('/nakjm/po') };
export const nakjmPiApi         = { ...resource('/nakjm/pi') };
export const nakjmPaymentsApi = {
  listClient:   (params) => client.get(`/nakjm/payments/client${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  createClient: (data) => client.post('/nakjm/payments/client', data),
  deleteClient: (id) => client.delete(`/nakjm/payments/client/${id}`),
  listVendor:   (params) => client.get(`/nakjm/payments/vendor${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  createVendor: (data) => client.post('/nakjm/payments/vendor', data),
  deleteVendor: (id) => client.delete(`/nakjm/payments/vendor/${id}`),
};
export const nakjmDocumentsApi = {
  list: (params) => client.get(`/nakjm/documents${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  upload: ({ file, project_id, doc_type = 'other', notes }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (project_id) fd.append('project_id', project_id);
    fd.append('doc_type', doc_type);
    if (notes) fd.append('notes', notes);
    return client.post('/nakjm/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  downloadUrl: (id) => `${client.defaults.baseURL}/nakjm/documents/${id}/download`,
  delete: (id) => client.delete(`/nakjm/documents/${id}`),
  parseBoq: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return client.post('/nakjm/documents/parse-boq', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
export const nakjmReportsApi = {
  list:   (params) => client.get(`/nakjm/reports${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  create: (data) => client.post('/nakjm/reports', data),
  delete: (id) => client.delete(`/nakjm/reports/${id}`),
};
export const nakjmDashboardApi = {
  overview: () => client.get('/nakjm/dashboard'),
};

export default client;
