import { clsx } from 'clsx';

export function cn(...inputs) {
  return clsx(inputs);
}

export function formatCurrency(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value) || 0);
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  maintenance: 'bg-amber-100 text-amber-700',
  available: 'bg-green-100 text-green-700',
  charging: 'bg-blue-100 text-blue-700',
  fault: 'bg-red-100 text-red-700',
  offline: 'bg-gray-100 text-gray-600',
  reserved: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  processed: 'bg-blue-100 text-blue-700',
  disputed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  faulted: 'bg-red-100 text-red-700',
  // NAKJM EPC statuses
  lead: 'bg-gray-100 text-gray-600',
  quotation: 'bg-purple-100 text-purple-700',
  approved: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  negotiation: 'bg-purple-100 text-purple-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-red-100 text-red-700',
  revised: 'bg-amber-100 text-amber-700',
  issued: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-purple-100 text-purple-700',
  partially_delivered: 'bg-amber-100 text-amber-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  blacklisted: 'bg-red-100 text-red-700',
  received: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
};
