'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { nakjmVendorsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';

export default function VendorDetailPage() {
  const { id } = useParams();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    nakjmVendorsApi.get(id).then(setVendor).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>;
  if (!vendor) return null;

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
            <p className="text-sm text-gray-500 capitalize">{vendor.category.replace(/_/g, ' ')}</p>
          </div>
          <Badge status={vendor.status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100 text-sm">
          <div><p className="text-gray-400">Contact</p><p className="font-medium">{vendor.contact_name || '—'}</p></div>
          <div><p className="text-gray-400">Email</p><p className="font-medium">{vendor.contact_email || '—'}</p></div>
          <div><p className="text-gray-400">Phone</p><p className="font-medium">{vendor.contact_phone || '—'}</p></div>
          <div><p className="text-gray-400">GSTIN</p><p className="font-medium">{vendor.gstin || '—'}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 text-center"><p className="text-xs text-gray-500">PO Value</p><p className="text-xl font-bold text-gray-900">{formatCurrency(vendor.total_po_value)}</p></div>
        <div className="card p-5 text-center"><p className="text-xs text-gray-500">Paid</p><p className="text-xl font-bold text-green-600">{formatCurrency(vendor.total_paid)}</p></div>
        <div className="card p-5 text-center"><p className="text-xs text-gray-500">Outstanding</p><p className="text-xl font-bold text-red-600">{formatCurrency(vendor.outstanding)}</p></div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Purchase Orders</h3></div>
        <div className="table-wrapper border-0">
          <table>
            <thead><tr><th>PO No.</th><th>Project</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>
              {vendor.purchase_orders?.map(po => (
                <tr key={po.id}>
                  <td className="font-medium">{po.po_no}</td>
                  <td>{po.project_name}</td>
                  <td><Badge status={po.status} /></td>
                  <td>{formatCurrency(po.total_amount)}</td>
                  <td>{formatDate(po.po_date)}</td>
                </tr>
              ))}
              {(!vendor.purchase_orders || vendor.purchase_orders.length === 0) && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-6">No purchase orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Payment History</h3></div>
        <div className="table-wrapper border-0">
          <table>
            <thead><tr><th>Date</th><th>Project</th><th>Mode</th><th>Reference</th><th>Amount</th></tr></thead>
            <tbody>
              {vendor.payments?.map(p => (
                <tr key={p.id}>
                  <td>{formatDate(p.payment_date)}</td>
                  <td>{p.project_name}</td>
                  <td className="capitalize">{p.mode.replace(/_/g, ' ')}</td>
                  <td>{p.reference_no || '—'}</td>
                  <td className="font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
              {(!vendor.payments || vendor.payments.length === 0) && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-6">No payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
