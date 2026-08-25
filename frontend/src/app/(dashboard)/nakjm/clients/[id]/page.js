'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { nakjmClientsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';

export default function ClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    nakjmClientsApi.get(id).then(setClient).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>;
  if (!client) return null;

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-sm text-gray-500 uppercase">{client.client_type} · {client.city}{client.city && client.state ? ', ' : ''}{client.state}</p>
          </div>
          <Badge status={client.status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100 text-sm">
          <div><p className="text-gray-400">Contact</p><p className="font-medium">{client.contact_name || '—'}</p></div>
          <div><p className="text-gray-400">Email</p><p className="font-medium">{client.contact_email || '—'}</p></div>
          <div><p className="text-gray-400">Phone</p><p className="font-medium">{client.contact_phone || '—'}</p></div>
          <div><p className="text-gray-400">GSTIN</p><p className="font-medium">{client.gstin || '—'}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 text-center">
          <p className="text-xs text-gray-500">Total Collected</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(client.total_collected)}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-gray-500">Total Projects</p>
          <p className="text-2xl font-bold text-gray-900">{client.projects?.length || 0}</p>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Projects</h3></div>
        <div className="table-wrapper border-0">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Contract Value</th><th>Start</th><th>Target End</th></tr></thead>
            <tbody>
              {client.projects?.map(p => (
                <tr key={p.id}>
                  <td><Link href={`/nakjm/projects/${p.id}`} className="text-brand-600 font-medium">{p.project_code}</Link></td>
                  <td>{p.name}</td>
                  <td><Badge status={p.status} /></td>
                  <td>{formatCurrency(p.contract_value)}</td>
                  <td>{formatDate(p.start_date)}</td>
                  <td>{formatDate(p.target_end_date)}</td>
                </tr>
              ))}
              {(!client.projects || client.projects.length === 0) && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-6">No projects yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
