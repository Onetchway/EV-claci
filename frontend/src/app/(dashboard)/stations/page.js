'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { stationsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Plus, Search, MapPin, Zap, TrendingUp, X } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPES = ['', 'PUBLIC', 'FLEET', 'FRANCHISE', 'BSS_HUB'];

export default function StationsPage() {
  const [stations, setStations]   = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters]     = useState({ page: 1, city: '', stationType: '' });
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', stationType: 'PUBLIC', electricityRate: 6.5, sellingRate: 14.0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stationsApi.list(filters);
      setStations(res.data || []);
      setPagination(res.pagination);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await stationsApi.create({ ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), electricityRate: parseFloat(form.electricityRate), sellingRate: parseFloat(form.sellingRate) });
      toast.success('Station created!');
      setShowForm(false);
      setForm({ name: '', address: '', city: '', state: '', latitude: '', longitude: '', stationType: 'PUBLIC', electricityRate: 6.5, sellingRate: 14.0 });
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9 w-44" placeholder="Search city..." value={filters.city}
              onChange={e => setFilters(f => ({ ...f, city: e.target.value, page: 1 }))} />
          </div>
          <select className="input w-40" value={filters.stationType} onChange={e => setFilters(f => ({ ...f, stationType: e.target.value, page: 1 }))}>
            {TYPES.map(t => <option key={t} value={t}>{t || 'All Types'}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Add Station
        </button>
      </div>

      {/* Add Station Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Charging Station</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['name','Name*'],['address','Address*'],['city','City*'],['state','State*']].map(([k,l]) => (
                <div key={k} className={k==='address'?'col-span-2':''}>
                  <label className="label">{l}</label>
                  <input className="input" required value={form[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label className="label">Latitude</label>
                <input className="input" type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({...f,latitude:e.target.value}))} />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input className="input" type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({...f,longitude:e.target.value}))} />
              </div>
              <div>
                <label className="label">Station Type</label>
                <select className="input" value={form.stationType} onChange={e => setForm(f => ({...f,stationType:e.target.value}))}>
                  {TYPES.filter(Boolean).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Electricity Rate (₹/kWh)</label>
                <input className="input" type="number" step="0.01" value={form.electricityRate} onChange={e => setForm(f => ({...f,electricityRate:e.target.value}))} />
              </div>
              <div>
                <label className="label">Selling Rate (₹/kWh)</label>
                <input className="input" type="number" step="0.01" value={form.sellingRate} onChange={e => setForm(f => ({...f,sellingRate:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Station</button>
            </div>
          </form>
        </div>
      )}

      {/* Station Grid */}
      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stations.map(s => (
            <Link key={s.id} href={`/stations/${s.id}`} className="card p-5 hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{s.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{s.city}, {s.state}
                  </p>
                </div>
                <Badge status={s.stationType} label={s.stationType?.replace('_', ' ')} className="text-xs" />
              </div>
              <p className="text-xs text-gray-500 mb-3 truncate">{s.address}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <Zap className="w-3 h-3 mx-auto text-brand-500 mb-0.5" />
                  <p className="text-xs font-semibold">{s._count?.assets || 0}</p>
                  <p className="text-xs text-gray-400">Assets</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <TrendingUp className="w-3 h-3 mx-auto text-blue-500 mb-0.5" />
                  <p className="text-xs font-semibold">₹{s.sellingRate}/kWh</p>
                  <p className="text-xs text-gray-400">Sell Rate</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <TrendingUp className="w-3 h-3 mx-auto text-orange-500 mb-0.5" />
                  <p className="text-xs font-semibold">₹{s.electricityRate}/kWh</p>
                  <p className="text-xs text-gray-400">Buy Rate</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination pagination={pagination} onPageChange={p => setFilters(f => ({...f, page: p}))} />
    </div>
  );
}
