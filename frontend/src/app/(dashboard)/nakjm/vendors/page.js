'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { nakjmVendorsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Truck, Plus, X, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = ['electrical', 'civil', 'cabling', 'transformer', 'ht_works', 'equipment_supply', 'logistics', 'manpower', 'other'];
const EMPTY = { name: '', category: 'other', contact_name: '', contact_email: '', contact_phone: '', gstin: '', bank_account_no: '', bank_ifsc: '', bank_name: '' };

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await nakjmVendorsApi.list({ page, limit: 12 });
      setVendors(res.data || []); setPagination(res.pagination);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await nakjmVendorsApi.create(form);
      toast.success('Vendor added!'); setShowForm(false); setForm(EMPTY); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Vendor</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Vendor</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Vendor Name*</label><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">GSTIN</label><input className="input" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} /></div>
              {[['contact_name', 'Contact Name'], ['contact_email', 'Contact Email'], ['contact_phone', 'Phone']].map(([k, l]) => (
                <div key={k}><label className="label">{l}</label><input className="input" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
              ))}
              <div><label className="label">Bank Account No.</label><input className="input" value={form.bank_account_no} onChange={e => setForm(f => ({ ...f, bank_account_no: e.target.value }))} /></div>
              <div><label className="label">IFSC</label><input className="input" value={form.bank_ifsc} onChange={e => setForm(f => ({ ...f, bank_ifsc: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label">Bank Name</label><input className="input" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Vendor</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vendors.map(v => (
            <Link key={v.id} href={`/nakjm/vendors/${v.id}`} className="card p-5 hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-50"><Truck className="w-5 h-5 text-orange-500" /></div>
                  <div>
                    <p className="font-semibold text-gray-900">{v.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{v.category.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <Badge status={v.status} />
              </div>
              <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1 text-gray-500"><Star className="w-3.5 h-3.5" /> {v.rating || 0}</span>
                <span className="text-gray-500">{v.po_count} PO(s)</span>
                <span className="font-semibold text-green-600">{formatCurrency(v.total_paid)}</span>
              </div>
            </Link>
          ))}
          {vendors.length === 0 && <p className="text-sm text-gray-400 col-span-full">No vendors yet.</p>}
        </div>
      )}
      {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
    </div>
  );
}
