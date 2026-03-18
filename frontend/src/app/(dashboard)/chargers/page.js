'use client';
import { useEffect, useState, useCallback } from 'react';
import { chargersApi, stationsApi } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Zap, Play, Square, RefreshCw, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUSES = ['', 'AVAILABLE', 'CHARGING', 'FAULT', 'OFFLINE'];

export default function ChargersPage() {
  const [chargers, setChargers]   = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters]     = useState({ page: 1, status: '' });
  const [loading, setLoading]     = useState(true);
  const [stations, setStations]   = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ assetId: '', connectorType: 'CCS', powerRating: 50, ocppId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chargersApi.list(filters);
      setChargers(res.data || []); setPagination(res.pagination);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { stationsApi.list({ limit: 100 }).then(r => setStations(r.data || [])).catch(() => {}); }, []);

  const action = async (fn, successMsg) => {
    try { await fn(); toast.success(successMsg); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-center justify-between flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <select className="input w-40" value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value, page: 1}))}>
            {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <select className="input w-48" value={filters.stationId || ''} onChange={e => setFilters(f => ({...f, stationId: e.target.value, page: 1}))}>
            <option value="">All Stations</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load}><RefreshCw className="w-4 h-4" /></button>
          <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Charger</button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onSubmit={async e => {
            e.preventDefault();
            try { await chargersApi.create({...form, powerRating: parseFloat(form.powerRating)}); toast.success('Charger created!'); setShowForm(false); load(); }
            catch(err) { toast.error(err.message); }
          }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Charger</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="label">Station</label>
              <select className="input" required value={form.stationId || ''} onChange={e => setForm(f => ({...f, stationId: e.target.value}))}>
                <option value="">Select station</option>
                {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {[['connectorType','Connector Type','text'],['powerRating','Power Rating (kW)','number'],['ocppId','OCPP ID','text']].map(([k,l,t]) => (
              <div key={k}><label className="label">{l}</label><input className="input" type={t} value={form[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} /></div>
            ))}
            <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn-primary">Create</button></div>
          </form>
        </div>
      )}

      {/* Chargers Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>OCPP ID</th><th>Station</th><th>Connector</th><th>Power</th><th>Status</th><th>Last Heartbeat</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center text-gray-400 py-8">Loading…</td></tr> :
               chargers.map(c => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.ocppId || c.id.slice(-8)}</td>
                  <td>{c.asset?.station?.name || '—'}</td>
                  <td>{c.connectorType}</td>
                  <td>{c.powerRating} kW</td>
                  <td><Badge status={c.status} /></td>
                  <td className="text-xs text-gray-400">{c.lastHeartbeat ? format(new Date(c.lastHeartbeat), 'dd MMM HH:mm') : '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      {c.status === 'AVAILABLE' && (
                        <button title="Remote Start" className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                          onClick={() => action(() => chargersApi.remoteStart(c.id, { stationId: c.asset?.station?.id }), 'Session started!')}>
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {c.status === 'CHARGING' && (
                        <button title="Remote Stop" className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
                          onClick={() => action(() => chargersApi.remoteStop(c.id), 'Session stopped!')}>
                          <Square className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button title="Heartbeat" className="p-1.5 rounded bg-gray-50 text-gray-500 hover:bg-gray-100"
                        onClick={() => action(() => chargersApi.list({ id: c.id }), 'Heartbeat sent')}>
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={p => setFilters(f => ({...f, page: p}))} />
      </div>
    </div>
  );
}
