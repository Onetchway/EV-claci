'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  nakjmProjectsApi, nakjmTeamApi, nakjmQuotationsApi, nakjmBoqApi, nakjmPoApi, nakjmPiApi,
  nakjmPaymentsApi, nakjmReportsApi, nakjmVendorsApi, nakjmClientsApi, nakjmDocumentsApi,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import { Plus, X, Trash2, Upload, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = ['Overview', 'Quotations', 'BOQ', 'Purchase Orders', 'Proforma Invoices', 'Payments', 'Team', 'Site Reports'];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState('Overview');

  const loadHeader = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([nakjmProjectsApi.get(id), nakjmProjectsApi.analytics(id)]);
      setProject(p); setAnalytics(a);
    } catch (e) { toast.error(e.message); }
  }, [id]);

  useEffect(() => { loadHeader(); }, [loadHeader]);

  if (!project) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-gray-400 font-mono">{project.project_code}</p>
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500">{project.client_name} · {project.city}{project.city && project.state ? ', ' : ''}{project.state}</p>
          </div>
          <Badge status={project.status} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab project={project} analytics={analytics} />}
      {tab === 'Quotations' && <QuotationsTab projectId={id} clientId={project.client_id} />}
      {tab === 'BOQ' && <BoqTab projectId={id} />}
      {tab === 'Purchase Orders' && <PoTab projectId={id} />}
      {tab === 'Proforma Invoices' && <PiTab projectId={id} clientId={project.client_id} />}
      {tab === 'Payments' && <PaymentsTab projectId={id} clientId={project.client_id} onChange={loadHeader} />}
      {tab === 'Team' && <TeamTab projectId={id} />}
      {tab === 'Site Reports' && <SiteReportsTab projectId={id} onChange={loadHeader} />}
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────
function OverviewTab({ project, analytics }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Contract Value" value={formatCurrency(project.contract_value)} />
        <Stat label="Budget" value={formatCurrency(project.budget_amount)} />
        <Stat label="Est. Margin" value={formatCurrency(analytics?.estimated_margin)} good />
        <Stat label="Site Progress" value={`${analytics?.latest_site_progress_percent ?? 0}%`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-2">
          <h3 className="font-semibold text-gray-900">Client Collection</h3>
          <Row label="Invoiced" value={formatCurrency(analytics?.invoiced_to_client)} />
          <Row label="Collected" value={formatCurrency(analytics?.collected_from_client)} good />
          <Row label="Pending" value={formatCurrency(analytics?.collection_pending)} bad />
          <Row label="% of Contract" value={`${analytics?.collection_percent ?? 0}%`} />
        </div>
        <div className="card p-5 space-y-2">
          <h3 className="font-semibold text-gray-900">Vendor Spend</h3>
          <Row label="Committed (POs)" value={formatCurrency(analytics?.committed_to_vendors)} />
          <Row label="Paid" value={formatCurrency(analytics?.paid_to_vendors)} good />
          <Row label="Outstanding" value={formatCurrency(analytics?.vendor_outstanding)} bad />
          <Row label="Budget Utilization" value={`${analytics?.budget_utilization_percent ?? 0}%`} />
        </div>
      </div>
      <div className="card p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><p className="text-gray-400">Project Manager</p><p className="font-medium">{project.project_manager_name || '—'}</p></div>
        <div><p className="text-gray-400">POC</p><p className="font-medium">{project.poc_name || '—'}</p></div>
        <div><p className="text-gray-400">Start Date</p><p className="font-medium">{formatDate(project.start_date)}</p></div>
        <div><p className="text-gray-400">Target End</p><p className="font-medium">{formatDate(project.target_end_date)}</p></div>
      </div>
    </div>
  );
}

const Stat = ({ label, value, good }) => (
  <div className="card p-4 text-center"><p className="text-xs text-gray-500">{label}</p><p className={`text-lg font-bold ${good ? 'text-green-600' : 'text-gray-900'}`}>{value}</p></div>
);
const Row = ({ label, value, good, bad }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-gray-500">{label}</span>
    <span className={`font-semibold ${good ? 'text-green-600' : bad ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
  </div>
);

// ── Line item editor (shared by Quotation / BOQ / PO / PI forms) ─────────
function ItemsEditor({ items, setItems, fields }) {
  const addRow = () => setItems([...items, Object.fromEntries(fields.map(f => [f.key, f.default ?? '']))]);
  const updateRow = (i, key, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  const removeRow = (i) => setItems(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="table-wrapper">
        <table>
          <thead><tr>{fields.map(f => <th key={f.key}>{f.label}</th>)}<th /></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                {fields.map(f => (
                  <td key={f.key}>
                    <input className="input !py-1" type={f.type || 'text'} value={it[f.key] ?? ''}
                      onChange={e => updateRow(i, f.key, e.target.value)} />
                  </td>
                ))}
                <td><button type="button" onClick={() => removeRow(i)}><Trash2 className="w-4 h-4 text-red-500" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={fields.length + 1} className="text-center text-gray-400 py-4">No line items yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-secondary" onClick={addRow}><Plus className="w-4 h-4" /> Add Line</button>
    </div>
  );
}

const ITEM_FIELDS = [
  { key: 'description', label: 'Description' },
  { key: 'unit', label: 'Unit' },
  { key: 'qty', label: 'Qty', type: 'number', default: 1 },
  { key: 'rate', label: 'Rate (₹)', type: 'number', default: 0 },
];
const BOQ_FIELDS = [
  { key: 'section', label: 'Section' },
  { key: 'description', label: 'Description' },
  { key: 'make_oem', label: 'Make/OEM' },
  { key: 'unit', label: 'Unit' },
  { key: 'qty', label: 'Qty', type: 'number', default: 1 },
  { key: 'supply_rate', label: 'Supply Rate', type: 'number', default: 0 },
  { key: 'installation_rate', label: 'Install Rate', type: 'number', default: 0 },
];

function Modal({ title, onClose, children, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8" onClick={onClose}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        {children}
      </form>
    </div>
  );
}

// ── Quotations ──────────────────────────────────────────────────────────
function QuotationsTab({ projectId, clientId }) {
  const [list, setList] = useState([]);
  const [boqs, setBoqs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ quotation_no: '', valid_until: '', tax_percent: 18, notes: '' });
  const [items, setItems] = useState([]);
  const [sourceBoqId, setSourceBoqId] = useState(null);

  const load = useCallback(async () => {
    try { const res = await nakjmQuotationsApi.list({ project_id: projectId, limit: 50 }); setList(res.data || []); }
    catch (e) { toast.error(e.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { nakjmBoqApi.list({ project_id: projectId, limit: 50 }).then(r => setBoqs(r.data || [])).catch(() => {}); }, [projectId]);

  const nextVersion = () => (list.reduce((max, q) => Math.max(max, q.version || 1), 0) || 0) + 1;

  const openBlank = () => { setSourceBoqId(null); setItems([]); setForm({ quotation_no: '', valid_until: '', tax_percent: 18, notes: '' }); setShowForm(true); };

  const generateFromBoq = async (boqId) => {
    if (!boqId) return;
    try {
      const boq = await nakjmBoqApi.get(boqId);
      const mapped = (boq.items || []).map(it => ({
        description: [it.section, it.description].filter(Boolean).join(' — '),
        unit: it.unit || '', qty: it.qty, rate: it.unit_rate, category: it.category, remarks: it.remarks,
      }));
      setSourceBoqId(boqId);
      setItems(mapped);
      setForm({ quotation_no: `${boq.boq_no}-Q${nextVersion()}`, valid_until: '', tax_percent: 18, notes: `Generated from BOQ ${boq.boq_no} (v${boq.version})` });
      setShowForm(true);
      toast.success(`Prefilled ${mapped.length} line items from ${boq.boq_no}`);
    } catch (e) { toast.error(e.message); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await nakjmQuotationsApi.create({ ...form, project_id: projectId, client_id: clientId, version: nextVersion(), source_boq_id: sourceBoqId, items });
      toast.success('Quotation created!'); setShowForm(false); setItems([]); setSourceBoqId(null); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 items-center flex-wrap">
        {boqs.length > 0 && (
          <select className="input max-w-xs" defaultValue="" onChange={e => generateFromBoq(e.target.value)}>
            <option value="" disabled>Generate from BOQ…</option>
            {boqs.map(b => <option key={b.id} value={b.id}>{b.boq_no} (v{b.version})</option>)}
          </select>
        )}
        <button className="btn-primary" onClick={openBlank}><Plus className="w-4 h-4" /> New Quotation</button>
      </div>
      {showForm && (
        <Modal title={`New Quotation (v${nextVersion()}${sourceBoqId ? ' · from BOQ' : ''})`} onClose={() => setShowForm(false)} onSubmit={handleCreate}>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Quotation No.*</label><input className="input" required value={form.quotation_no} onChange={e => setForm(f => ({ ...f, quotation_no: e.target.value }))} /></div>
            <div><label className="label">Valid Until</label><input className="input" type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
            <div><label className="label">Tax %</label><input className="input" type="number" value={form.tax_percent} onChange={e => setForm(f => ({ ...f, tax_percent: e.target.value }))} /></div>
          </div>
          <ItemsEditor items={items} setItems={setItems} fields={ITEM_FIELDS} />
          <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn-primary">Create</button></div>
        </Modal>
      )}
      <div className="table-wrapper">
        <table>
          <thead><tr><th>No.</th><th>Version</th><th>Status</th><th>Date</th><th>Valid Until</th><th>Total</th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={6} className="text-center text-gray-400 py-6">No quotations yet — all versions of a quotation appear here as they're created.</td></tr> :
              list.sort((a, b) => b.version - a.version).map(q => (
                <tr key={q.id}><td className="font-medium">{q.quotation_no}</td><td>v{q.version}</td><td><Badge status={q.status} /></td><td>{formatDate(q.quotation_date)}</td><td>{formatDate(q.valid_until)}</td><td>{formatCurrency(q.total_amount)}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BOQ ─────────────────────────────────────────────────────────────────
function BoqTab({ projectId }) {
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ boq_no: '', site_name: '', notes: '' });
  const [items, setItems] = useState([]);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try { const res = await nakjmBoqApi.list({ project_id: projectId, limit: 50 }); setList(res.data || []); }
    catch (e) { toast.error(e.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await nakjmBoqApi.create({ ...form, project_id: projectId, items });
      toast.success('BOQ created!'); setShowForm(false); setForm({ boq_no: '', site_name: '', notes: '' }); setItems([]); load();
    } catch (e) { toast.error(e.message); }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const { items: parsed } = await nakjmDocumentsApi.parseBoq(file);
      setItems(parsed.map(it => ({ ...it, qty: it.qty || 0, supply_rate: it.supply_rate || 0, installation_rate: it.installation_rate || 0 })));
      setForm(f => ({ ...f, boq_no: f.boq_no || file.name.replace(/\.[^.]+$/, '') }));
      setShowForm(true);
      toast.success(`Imported ${parsed.length} line items — review before saving.`);
    } catch (e) { toast.error(e.message); }
    finally { setImporting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <label className="btn-secondary cursor-pointer">
          <Upload className="w-4 h-4" /> {importing ? 'Importing…' : 'Import from Excel'}
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing} onChange={handleFileSelect} />
        </label>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New BOQ</button>
      </div>
      {showForm && (
        <Modal title="New BOQ" onClose={() => setShowForm(false)} onSubmit={handleCreate}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">BOQ No.*</label><input className="input" required value={form.boq_no} onChange={e => setForm(f => ({ ...f, boq_no: e.target.value }))} /></div>
            <div><label className="label">Site Name</label><input className="input" value={form.site_name} onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))} /></div>
          </div>
          <ItemsEditor items={items} setItems={setItems} fields={BOQ_FIELDS} />
          <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn-primary">Create</button></div>
        </Modal>
      )}
      <div className="table-wrapper">
        <table>
          <thead><tr><th>No.</th><th>Site</th><th>Status</th><th>Date</th><th>Total</th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={5} className="text-center text-gray-400 py-6">No BOQs yet.</td></tr> :
              list.map(b => (
                <tr key={b.id}><td className="font-medium">{b.boq_no}</td><td>{b.site_name || '—'}</td><td><Badge status={b.status} /></td><td>{formatDate(b.boq_date)}</td><td>{formatCurrency(b.total_amount)}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Purchase Orders ─────────────────────────────────────────────────────
function PoTab({ projectId }) {
  const [list, setList] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ po_no: '', vendor_id: '', delivery_date: '', notes: '' });
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try { const res = await nakjmPoApi.list({ project_id: projectId, limit: 50 }); setList(res.data || []); }
    catch (e) { toast.error(e.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { nakjmVendorsApi.list({ limit: 200 }).then(r => setVendors(r.data || [])).catch(() => {}); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await nakjmPoApi.create({ ...form, project_id: projectId, items });
      toast.success('Purchase order created!'); setShowForm(false); setForm({ po_no: '', vendor_id: '', delivery_date: '', notes: '' }); setItems([]); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New PO</button></div>
      {showForm && (
        <Modal title="New Purchase Order" onClose={() => setShowForm(false)} onSubmit={handleCreate}>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">PO No.*</label><input className="input" required value={form.po_no} onChange={e => setForm(f => ({ ...f, po_no: e.target.value }))} /></div>
            <div>
              <label className="label">Vendor*</label>
              <select className="input" required value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}>
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div><label className="label">Delivery Date</label><input className="input" type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} /></div>
          </div>
          <ItemsEditor items={items} setItems={setItems} fields={ITEM_FIELDS} />
          <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn-primary">Create</button></div>
        </Modal>
      )}
      <div className="table-wrapper">
        <table>
          <thead><tr><th>No.</th><th>Vendor</th><th>Status</th><th>Date</th><th>Total</th><th>Paid</th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={6} className="text-center text-gray-400 py-6">No purchase orders yet.</td></tr> :
              list.map(po => (
                <tr key={po.id}><td className="font-medium">{po.po_no}</td><td>{po.vendor_name}</td><td><Badge status={po.status} /></td><td>{formatDate(po.po_date)}</td><td>{formatCurrency(po.total_amount)}</td><td className="text-green-600">{formatCurrency(po.paid_amount)}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Proforma Invoices ───────────────────────────────────────────────────
function PiTab({ projectId, clientId }) {
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ pi_no: '', due_date: '', milestone: '', notes: '' });
  const [items, setItems] = useState([]);
  const [poFile, setPoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try { const res = await nakjmPiApi.list({ project_id: projectId, limit: 50 }); setList(res.data || []); }
    catch (e) { toast.error(e.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let source_document_id = null;
      if (poFile) {
        const doc = await nakjmDocumentsApi.upload({ file: poFile, project_id: projectId, doc_type: 'client_po' });
        source_document_id = doc.id;
      }
      await nakjmPiApi.create({ ...form, project_id: projectId, client_id: clientId, source_document_id, items });
      toast.success('Proforma invoice created!'); setShowForm(false); setForm({ pi_no: '', due_date: '', milestone: '', notes: '' }); setItems([]); setPoFile(null); load();
    } catch (e) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New PI</button></div>
      {showForm && (
        <Modal title="New Proforma Invoice" onClose={() => setShowForm(false)} onSubmit={handleCreate}>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">PI No.*</label><input className="input" required value={form.pi_no} onChange={e => setForm(f => ({ ...f, pi_no: e.target.value }))} /></div>
            <div><label className="label">Due Date</label><input className="input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <div><label className="label">Milestone</label><input className="input" value={form.milestone} onChange={e => setForm(f => ({ ...f, milestone: e.target.value }))} /></div>
            <div className="col-span-3">
              <label className="label">Client PO / Work Order (optional — generates this PI against it)</label>
              <input className="input" type="file" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*" onChange={e => setPoFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <ItemsEditor items={items} setItems={setItems} fields={ITEM_FIELDS} />
          <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Saving…' : 'Create'}</button></div>
        </Modal>
      )}
      <div className="table-wrapper">
        <table>
          <thead><tr><th>No.</th><th>Milestone</th><th>Status</th><th>Due</th><th>Total</th><th>Paid</th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={6} className="text-center text-gray-400 py-6">No proforma invoices yet.</td></tr> :
              list.map(pi => (
                <tr key={pi.id}><td className="font-medium">{pi.pi_no}</td><td>{pi.milestone || '—'}</td><td><Badge status={pi.status} /></td><td>{formatDate(pi.due_date)}</td><td>{formatCurrency(pi.total_amount)}</td><td className="text-green-600">{formatCurrency(pi.paid_amount)}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Payments ────────────────────────────────────────────────────────────
function PaymentsTab({ projectId, clientId, onChange }) {
  const [clientPayments, setClientPayments] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [clientForm, setClientForm] = useState({ amount: '', mode: 'bank_transfer', reference_no: '', milestone: '' });
  const [vendorForm, setVendorForm] = useState({ vendor_id: '', amount: '', mode: 'bank_transfer', reference_no: '' });

  const load = useCallback(async () => {
    try {
      const [cp, vp] = await Promise.all([
        nakjmPaymentsApi.listClient({ project_id: projectId, limit: 50 }),
        nakjmPaymentsApi.listVendor({ project_id: projectId, limit: 50 }),
      ]);
      setClientPayments(cp.data || []); setVendorPayments(vp.data || []);
    } catch (e) { toast.error(e.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { nakjmVendorsApi.list({ limit: 200 }).then(r => setVendors(r.data || [])).catch(() => {}); }, []);

  const submitClient = async (e) => {
    e.preventDefault();
    try {
      await nakjmPaymentsApi.createClient({ ...clientForm, project_id: projectId, client_id: clientId, amount: parseFloat(clientForm.amount) });
      toast.success('Payment recorded!'); setShowClientForm(false); setClientForm({ amount: '', mode: 'bank_transfer', reference_no: '', milestone: '' }); load(); onChange?.();
    } catch (e) { toast.error(e.message); }
  };

  const submitVendor = async (e) => {
    e.preventDefault();
    try {
      await nakjmPaymentsApi.createVendor({ ...vendorForm, project_id: projectId, amount: parseFloat(vendorForm.amount) });
      toast.success('Payout recorded!'); setShowVendorForm(false); setVendorForm({ vendor_id: '', amount: '', mode: 'bank_transfer', reference_no: '' }); load(); onChange?.();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-3">
        <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-900">Client Collections</h3><button className="btn-secondary" onClick={() => setShowClientForm(true)}><Plus className="w-4 h-4" /> Record</button></div>
        {showClientForm && (
          <Modal title="Record Client Payment" onClose={() => setShowClientForm(false)} onSubmit={submitClient}>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Amount (₹)*</label><input className="input" type="number" required value={clientForm.amount} onChange={e => setClientForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div>
                <label className="label">Mode</label>
                <select className="input" value={clientForm.mode} onChange={e => setClientForm(f => ({ ...f, mode: e.target.value }))}>
                  {['bank_transfer', 'cheque', 'upi', 'cash', 'other'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Reference No.</label><input className="input" value={clientForm.reference_no} onChange={e => setClientForm(f => ({ ...f, reference_no: e.target.value }))} /></div>
              <div><label className="label">Milestone</label><input className="input" value={clientForm.milestone} onChange={e => setClientForm(f => ({ ...f, milestone: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowClientForm(false)}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
          </Modal>
        )}
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th>Amount</th><th>Mode</th></tr></thead>
            <tbody>
              {clientPayments.length === 0 ? <tr><td colSpan={3} className="text-center text-gray-400 py-4">None yet.</td></tr> :
                clientPayments.map(p => <tr key={p.id}><td>{formatDate(p.payment_date)}</td><td className="text-green-600 font-medium">{formatCurrency(p.amount)}</td><td className="capitalize">{p.mode.replace(/_/g, ' ')}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-900">Vendor Payouts</h3><button className="btn-secondary" onClick={() => setShowVendorForm(true)}><Plus className="w-4 h-4" /> Record</button></div>
        {showVendorForm && (
          <Modal title="Record Vendor Payment" onClose={() => setShowVendorForm(false)} onSubmit={submitVendor}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Vendor*</label>
                <select className="input" required value={vendorForm.vendor_id} onChange={e => setVendorForm(f => ({ ...f, vendor_id: e.target.value }))}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div><label className="label">Amount (₹)*</label><input className="input" type="number" required value={vendorForm.amount} onChange={e => setVendorForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div>
                <label className="label">Mode</label>
                <select className="input" value={vendorForm.mode} onChange={e => setVendorForm(f => ({ ...f, mode: e.target.value }))}>
                  {['bank_transfer', 'cheque', 'upi', 'cash', 'other'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label">Reference No.</label><input className="input" value={vendorForm.reference_no} onChange={e => setVendorForm(f => ({ ...f, reference_no: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowVendorForm(false)}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
          </Modal>
        )}
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th>Vendor</th><th>Amount</th></tr></thead>
            <tbody>
              {vendorPayments.length === 0 ? <tr><td colSpan={3} className="text-center text-gray-400 py-4">None yet.</td></tr> :
                vendorPayments.map(p => <tr key={p.id}><td>{formatDate(p.payment_date)}</td><td>{p.vendor_name}</td><td className="text-red-600 font-medium">{formatCurrency(p.amount)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Team ────────────────────────────────────────────────────────────────
function TeamTab({ projectId }) {
  const [assigned, setAssigned] = useState([]);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ team_member_id: '', project_role: '' });

  const load = useCallback(async () => {
    try { setAssigned(await nakjmTeamApi.listByProject(projectId)); } catch (e) { toast.error(e.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { nakjmTeamApi.list({ limit: 200 }).then(r => setMembers(r.data || [])).catch(() => {}); }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await nakjmTeamApi.assign(projectId, form);
      toast.success('Assigned!'); setShowForm(false); setForm({ team_member_id: '', project_role: '' }); load();
    } catch (e) { toast.error(e.message); }
  };

  const unassign = async (memberId) => {
    try { await nakjmTeamApi.unassign(projectId, memberId); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Assign Member</button></div>
      {showForm && (
        <Modal title="Assign Team Member" onClose={() => setShowForm(false)} onSubmit={handleAssign}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Team Member*</label>
              <select className="input" required value={form.team_member_id} onChange={e => setForm(f => ({ ...f, team_member_id: e.target.value }))}>
                <option value="">Select…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.designation}</option>)}
              </select>
            </div>
            <div><label className="label">Project Role</label><input className="input" value={form.project_role} onChange={e => setForm(f => ({ ...f, project_role: e.target.value }))} /></div>
          </div>
          <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn-primary">Assign</button></div>
        </Modal>
      )}
      <div className="table-wrapper">
        <table>
          <thead><tr><th>Name</th><th>Designation</th><th>Project Role</th><th>Assigned</th><th /></tr></thead>
          <tbody>
            {assigned.length === 0 ? <tr><td colSpan={5} className="text-center text-gray-400 py-6">No one assigned yet.</td></tr> :
              assigned.map(m => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}</td><td>{m.designation || '—'}</td><td>{m.project_role || '—'}</td><td>{formatDate(m.assigned_date)}</td>
                  <td><button onClick={() => unassign(m.id)}><Trash2 className="w-4 h-4 text-red-500" /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Site Reports ────────────────────────────────────────────────────────
function SiteReportsTab({ projectId, onChange }) {
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ report_type: 'daily', progress_percent: '', work_done: '', issues: '', manpower_count: '', visible_to_client: false });

  const load = useCallback(async () => {
    try { const res = await nakjmReportsApi.list({ project_id: projectId, limit: 30 }); setReports(res.data || []); }
    catch (e) { toast.error(e.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await nakjmReportsApi.create({ ...form, project_id: projectId, progress_percent: parseFloat(form.progress_percent) || 0, manpower_count: parseInt(form.manpower_count) || 0 });
      toast.success('Report submitted!'); setShowForm(false); setForm({ report_type: 'daily', progress_percent: '', work_done: '', issues: '', manpower_count: '', visible_to_client: false }); load(); onChange?.();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Report</button></div>
      {showForm && (
        <Modal title="New Site Report" onClose={() => setShowForm(false)} onSubmit={handleCreate}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
                {['daily', 'weekly', 'milestone', 'issue'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Progress %</label><input className="input" type="number" min="0" max="100" value={form.progress_percent} onChange={e => setForm(f => ({ ...f, progress_percent: e.target.value }))} /></div>
            <div><label className="label">Manpower Count</label><input className="input" type="number" value={form.manpower_count} onChange={e => setForm(f => ({ ...f, manpower_count: e.target.value }))} /></div>
            <div className="col-span-3"><label className="label">Work Done</label><textarea className="input" rows={3} value={form.work_done} onChange={e => setForm(f => ({ ...f, work_done: e.target.value }))} /></div>
            <div className="col-span-3"><label className="label">Issues</label><textarea className="input" rows={2} value={form.issues} onChange={e => setForm(f => ({ ...f, issues: e.target.value }))} /></div>
            <label className="col-span-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visible_to_client} onChange={e => setForm(f => ({ ...f, visible_to_client: e.target.checked }))} /> Visible to client</label>
          </div>
          <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn-primary">Submit</button></div>
        </Modal>
      )}
      <div className="space-y-2">
        {reports.length === 0 && <p className="text-sm text-gray-400">No site reports yet.</p>}
        {reports.map(r => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">{r.report_type} report — {formatDate(r.report_date)}</span>
              <span className="text-sm font-semibold">{r.progress_percent}% complete</span>
            </div>
            {r.work_done && <p className="text-sm text-gray-600 mt-1">{r.work_done}</p>}
            {r.issues && <p className="text-sm text-red-600 mt-1">⚠ {r.issues}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
