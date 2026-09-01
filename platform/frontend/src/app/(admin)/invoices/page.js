'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { invoicesApi } from '@/lib/api';

const STATUS_BADGE = {
  issued: 'badge-yellow',
  paid: 'badge-green',
  overdue: 'badge-red',
  void: 'badge-gray',
  draft: 'badge-gray',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setInvoices((await invoicesApi.list()).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (id) => {
    try { await invoicesApi.markPaid(id); toast.success('Marked paid.'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Invoices</h1>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Tenant</th>
              <th>Period</th>
              <th>Model</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center text-gray-400 py-8">Loading…</td></tr>}
            {!loading && invoices.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No invoices yet.</td></tr>}
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="font-mono text-xs">{inv.invoice_number}</td>
                <td>{inv.tenant_name}</td>
                <td>{inv.period_start.slice(0, 7)}</td>
                <td className="capitalize">{inv.billing_model.replace('_', ' ')}</td>
                <td>{inv.currency} {inv.total_amount}</td>
                <td><span className={`badge ${STATUS_BADGE[inv.status] || 'badge-gray'}`}>{inv.status}</span></td>
                <td>
                  {inv.status === 'issued' && (
                    <button className="text-brand-600 hover:underline text-sm" onClick={() => markPaid(inv.id)}>Mark paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
