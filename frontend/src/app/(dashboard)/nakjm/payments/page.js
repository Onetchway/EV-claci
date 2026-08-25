'use client';
import { useEffect, useState, useCallback } from 'react';
import { nakjmPaymentsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaymentsPage() {
  const [tab, setTab] = useState('client');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === 'client' ? await nakjmPaymentsApi.listClient({ limit: 50 }) : await nakjmPaymentsApi.listVendor({ limit: 50 });
      setPayments(res.data || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const total = payments.reduce((s, p) => s + parseFloat(p.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => setTab('client')} className={`btn-secondary ${tab === 'client' ? '!bg-brand-600 !text-white !border-brand-600' : ''}`}>
          <ArrowDownCircle className="w-4 h-4" /> Client Collections
        </button>
        <button onClick={() => setTab('vendor')} className={`btn-secondary ${tab === 'vendor' ? '!bg-brand-600 !text-white !border-brand-600' : ''}`}>
          <ArrowUpCircle className="w-4 h-4" /> Vendor Payouts
        </button>
      </div>

      <div className="card p-5 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand-50"><Wallet className="w-5 h-5 text-brand-600" /></div>
        <div>
          <p className="text-xs text-gray-500">Total {tab === 'client' ? 'Collected' : 'Paid'} (latest 50)</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>{tab === 'client' ? 'Client' : 'Vendor'}</th>
              <th>Mode</th>
              <th>Reference</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-6">Loading…</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-6">No payments recorded yet.</td></tr>
            ) : payments.map(p => (
              <tr key={p.id}>
                <td>{formatDate(p.payment_date)}</td>
                <td>{p.project_name}</td>
                <td>{tab === 'client' ? p.client_name : p.vendor_name}</td>
                <td className="capitalize">{p.mode.replace(/_/g, ' ')}</td>
                <td>{p.reference_no || '—'}</td>
                <td className={`font-semibold ${tab === 'client' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">Record new payments from within a project's detail page.</p>
    </div>
  );
}
