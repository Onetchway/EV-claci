import axios from 'axios';

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100/api',
});

client.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('platform_token');
      localStorage.removeItem('platform_admin');
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(new Error(err.response?.data?.error || err.message || 'Request failed'));
  }
);

const buildQuery = (params = {}) => {
  const usable = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return new URLSearchParams(usable).toString();
};

const resource = (base) => ({
  list: (params) => client.get(`${base}${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  get: (id) => client.get(`${base}/${id}`),
  create: (data) => client.post(base, data),
  update: (id, data) => client.put(`${base}/${id}`, data),
  delete: (id) => client.delete(`${base}/${id}`),
});

export const dashboardApi = {
  overview: () => client.get('/dashboard'),
};

export const authApi = {
  login: (data) => client.post('/auth/login', data),
  me: () => client.get('/auth/me'),
};

export const tenantsApi = {
  ...resource('/tenants'),
  setStatus: (id, status) => client.patch(`/tenants/${id}/status`, { status }),
  rotateApiKey: (id) => client.post(`/tenants/${id}/rotate-key`),
};

export const featuresApi = {
  catalog: () => client.get('/features/catalog'),
  forTenant: (tenantId) => client.get(`/features/tenants/${tenantId}`),
  setForTenant: (tenantId, featureKey, enabled) => client.put(`/features/tenants/${tenantId}/${featureKey}`, { enabled }),
};

export const billingPlansApi = { ...resource('/billing-plans') };

export const invoicesApi = {
  list: (params) => client.get(`/invoices${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  get: (id) => client.get(`/invoices/${id}`),
  generate: (tenantId, data) => client.post(`/invoices/tenants/${tenantId}/generate`, data),
  markPaid: (id) => client.patch(`/invoices/${id}/paid`),
  void: (id) => client.patch(`/invoices/${id}/void`),
};

export const usageApi = {
  forTenant: (tenantId) => client.get(`/usage/tenants/${tenantId}`),
};

export const provisioningApi = {
  provisionIsolatedDatabase: (tenantId) => client.post(`/provisioning/tenants/${tenantId}/isolated-database`),
};

export default client;
