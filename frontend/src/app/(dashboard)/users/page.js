'use client';
import { useEffect, useState, useCallback } from 'react';
import { usersApi } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Search, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ROLES = ['ADMIN', 'OPERATIONS', 'FINANCE', 'FRANCHISE'];

export default function UsersPage() {
  const [users, setUsers]         = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters]     = useState({ page: 1, search: '', role: '' });
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await usersApi.list(filters); setUsers(res.data || []); setPagination(res.pagination); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const saveUser = async (id) => {
    try { await usersApi.update(id, editing[id]); toast.success('User updated!'); setEditing(e => { const n = {...e}; delete n[id]; return n; }); load(); }
    catch (e) { toast.error(e.message); }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    try { await usersApi.delete(id); toast.success('User deleted.'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input className="input pl-9 w-52" placeholder="Search name / email…" value={filters.search}
            onChange={e => setFilters(f => ({...f, search: e.target.value, page: 1}))} />
        </div>
        <select className="input w-36" value={filters.role} onChange={e => setFilters(f => ({...f, role: e.target.value, page: 1}))}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-center text-gray-400 py-8">Loading…</td></tr> :
               users.map(u => {
                const edit = editing[u.id] || {};
                return (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name}</td>
                    <td className="text-gray-500 text-xs">{u.email}</td>
                    <td>
                      <select className="input py-1 text-xs w-32" value={edit.role ?? u.role}
                        onChange={e => setEditing(ed => ({...ed, [u.id]: {...(ed[u.id]||{}), role: e.target.value}}))}>
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="input py-1 text-xs w-24" value={edit.isActive ?? u.isActive ? 'true' : 'false'}
                        onChange={e => setEditing(ed => ({...ed, [u.id]: {...(ed[u.id]||{}), isActive: e.target.value === 'true'}}))}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </td>
                    <td className="text-xs text-gray-400">{format(new Date(u.createdAt), 'dd MMM yyyy')}</td>
                    <td>
                      <div className="flex gap-1">
                        {editing[u.id] && (
                          <button className="p-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100" onClick={() => saveUser(u.id)}>
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100" onClick={() => deleteUser(u.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={p => setFilters(f => ({...f, page: p}))} />
      </div>
    </div>
  );
}
