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
  lifecycle: (id, action) => client.post(`/tenants/${id}/lifecycle/${action}`),
  deletePermanently: (id) => client.delete(`/tenants/${id}/permanently`),
  rotateApiKey: (id) => client.post(`/tenants/${id}/rotate-key`),
  updateBranding: (id, data) => client.put(`/tenants/${id}/branding`, data),
  retryProvisioning: (id) => client.post(`/tenants/${id}/retry-provisioning`),
};

export const featuresApi = {
  catalog: () => client.get('/features/catalog'),
  forTenant: (tenantId) => client.get(`/features/tenants/${tenantId}`),
  setForTenant: (tenantId, featureKey, enabled) => client.put(`/features/tenants/${tenantId}/${featureKey}`, { enabled }),
  bulkSetForTenant: (tenantId, features) => client.put(`/features/tenants/${tenantId}`, { features }),
};

export const billingPlansApi = { ...resource('/billing-plans') };

export const modulesApi = {
  catalog: () => client.get('/modules/catalog'),
  updateCatalog: (key, data) => client.put(`/modules/catalog/${key}`, data),
  forTenant: (tenantId) => client.get(`/modules/tenants/${tenantId}`),
  setForTenant: (tenantId, moduleKey, enabled) => client.put(`/modules/tenants/${tenantId}/${moduleKey}`, { enabled }),
  bulkSetForTenant: (tenantId, modules) => client.put(`/modules/tenants/${tenantId}`, { modules }),
};

export const invoicesApi = {
  list: (params) => client.get(`/invoices${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  get: (id) => client.get(`/invoices/${id}`),
  preview: (tenantId, params) => client.get(`/invoices/tenants/${tenantId}/preview${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  generate: (tenantId, data) => client.post(`/invoices/tenants/${tenantId}/generate`, data),
  markPaid: (id) => client.patch(`/invoices/${id}/paid`),
  void: (id) => client.patch(`/invoices/${id}/void`),
  resendEmail: (id) => client.post(`/invoices/${id}/resend-email`),
};

export const addOnsApi = {
  catalog: () => client.get('/add-ons/catalog'),
  createCatalog: (data) => client.post('/add-ons/catalog', data),
  updateCatalog: (id, data) => client.put(`/add-ons/catalog/${id}`, data),
  removeCatalog: (id) => client.delete(`/add-ons/catalog/${id}`),
  forTenant: (tenantId) => client.get(`/add-ons/tenants/${tenantId}`),
  attachToTenant: (tenantId, addOnId, amountOverride) => client.post(`/add-ons/tenants/${tenantId}`, { add_on_id: addOnId, amount_override: amountOverride }),
  detachFromTenant: (tenantId, addOnId) => client.delete(`/add-ons/tenants/${tenantId}/${addOnId}`),
};

export const couponsApi = {
  list: () => client.get('/coupons'),
  create: (data) => client.post('/coupons', data),
  update: (id, data) => client.put(`/coupons/${id}`, data),
  forTenant: (tenantId) => client.get(`/coupons/tenants/${tenantId}`),
  assignToTenant: (tenantId, couponId) => client.post(`/coupons/tenants/${tenantId}`, { coupon_id: couponId }),
  unassignFromTenant: (tenantId, tenantCouponId) => client.delete(`/coupons/tenants/${tenantId}/${tenantCouponId}`),
};

export const creditsApi = {
  forTenant: (tenantId) => client.get(`/credits/tenants/${tenantId}`),
  addCredit: (tenantId, amount, reason) => client.post(`/credits/tenants/${tenantId}`, { amount, reason }),
};

export const paymentsApi = {
  forInvoice: (invoiceId) => client.get(`/payments/invoices/${invoiceId}`),
  createOrder: (invoiceId) => client.post(`/payments/invoices/${invoiceId}/order`),
  refund: (paymentId) => client.post(`/payments/${paymentId}/refund`),
};

export const usageApi = {
  forTenant: (tenantId) => client.get(`/usage/tenants/${tenantId}`),
};

export const adminsApi = {
  list: () => client.get('/admins'),
  create: (data) => client.post('/admins', data),
  update: (id, data) => client.put(`/admins/${id}`, data),
};

export const opsApi = {
  audit: (params) => client.get(`/ops/audit${buildQuery(params) ? `?${buildQuery(params)}` : ''}`),
  notifications: () => client.get('/ops/notifications'),
  markNotificationRead: (id) => client.patch(`/ops/notifications/${id}/read`),
  markAllNotificationsRead: () => client.patch('/ops/notifications/read-all'),
  jobs: () => client.get('/ops/jobs'),
  jobHistory: (name) => client.get(`/ops/jobs/${name}/history`),
  runJob: (name) => client.post(`/ops/jobs/${name}/run`),
  health: () => client.get('/ops/health'),
  tenantHealth: (tenantId) => client.get(`/ops/tenants/${tenantId}/health`),
  supportSessions: (tenantId) => client.get(`/ops/tenants/${tenantId}/support-sessions`),
  startSupportSession: (tenantId, reason, durationMinutes) => client.post(`/ops/tenants/${tenantId}/support-sessions`, { reason, duration_minutes: durationMinutes }),
  endSupportSession: (id) => client.patch(`/ops/support-sessions/${id}/end`),
};

export const provisioningApi = {
  provisionIsolatedDatabase: (tenantId) => client.post(`/provisioning/tenants/${tenantId}/isolated-database`),
};

export default client;
