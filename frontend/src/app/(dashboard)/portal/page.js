'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { franchisesApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import { Building2, TrendingUp, Wallet, Zap, FileText, Upload, Landmark, LifeBuoy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// The franchise partner's own self-service view — every section here
// (stage, documents, payments, bank details, support) mirrors
// crm/src/app/portal/[leadId]/page.tsx, Livanto's franchise/investor
// portal, adapted to this app's Postgres-backed franchises. Everything
// resolves to the caller's own franchise_id server-side (see
// backend/src/controllers/franchisePortal.controller.js), so there's no
// id to pick here, unlike the admin-facing /franchise page.

const STAGES = [
  { key: 'eoi',        label: 'EOI' },
  { key: 'agreement',  label: 'Agreement' },
  { key: 'payment',    label: 'Payment' },
  { key: 'site_setup', label: 'Site Setup' },
  { key: 'active',     label: 'Active' },
];

const DOC_KIND_LABEL = {
  pan: 'PAN Card', aadhaar: 'Aadhaar', gst_certificate: 'GST Certificate',
  cancelled_cheque: 'Cancelled Cheque', photograph: 'Photograph',
  electricity_bill: 'Electricity Bill', load_sanction: 'Load Sanction',
  property_proof: 'Property Proof', lease_agreement: 'Lease Agreement', site_photo: 'Site Photo',
  eoi_form: 'EOI Form', franchise_agreement: 'Franchise Agreement',
};
const KYC_KINDS = ['pan', 'aadhaar', 'gst_certificate', 'cancelled_cheque', 'photograph'];
const SITE_KINDS = ['electricity_bill', 'load_sanction', 'property_proof', 'lease_agreement', 'site_photo'];
const AGREEMENT_KINDS = ['eoi_form', 'franchise_agreement'];

function SectionCard({ title, icon: Icon, action, children }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Icon className="h-4 w-4 text-brand-600" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function StageTracker({ stage }) {
  const activeIdx = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              i < activeIdx ? 'bg-green-500 text-white' : i === activeIdx ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {i < activeIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-[11px] ${i === activeIdx ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
          </div>
          {i < STAGES.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${i < activeIdx ? 'bg-green-500' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );
}

function DocGroup({ title, kinds, docs, onUpload, uploading }) {
  const fileInputs = useRef({});
  const byKind = Object.fromEntries((docs || []).map((d) => [d.kind, d]));
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {kinds.map((kind) => {
          const doc = byKind[kind];
          return (
            <div key={kind} className="border border-gray-200 rounded-lg p-2.5 text-center">
              <p className="text-xs font-medium text-gray-700 truncate mb-1.5">{DOC_KIND_LABEL[kind]}</p>
              {doc ? (
                <button
                  className="text-xs text-brand-600 hover:underline flex items-center justify-center gap-1 w-full"
                  onClick={() => franchisesApi.downloadDocument(doc.id, doc.file_name)}
                >
                  <FileText className="w-3.5 h-3.5" /> View
                </button>
              ) : (
                <>
                  <input
                    ref={(el) => (fileInputs.current[kind] = el)}
                    type="file" className="hidden"
                    onChange={(e) => e.target.files[0] && onUpload(kind, e.target.files[0])}
                  />
                  <button
                    disabled={uploading === kind}
                    className="text-xs text-gray-400 hover:text-brand-600 flex items-center justify-center gap-1 w-full disabled:opacity-50"
                    onClick={() => fileInputs.current[kind]?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" /> {uploading === kind ? 'Uploading…' : 'Upload'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BankDetailsSection({ bank, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    account_holder_name: bank?.account_holder_name || '', bank_name: bank?.bank_name || '',
    account_number: bank?.account_number || '', ifsc: bank?.ifsc || '', branch: bank?.branch || '',
  });
  const [saving, setSaving] = useState(false);

  if (!editing && bank) {
    return (
      <div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-[11px] uppercase text-gray-400">Account Holder</dt><dd className="mt-0.5">{bank.account_holder_name}</dd></div>
          <div><dt className="text-[11px] uppercase text-gray-400">Bank</dt><dd className="mt-0.5">{bank.bank_name}</dd></div>
          <div><dt className="text-[11px] uppercase text-gray-400">Account No.</dt><dd className="mt-0.5 font-mono">{bank.account_number}</dd></div>
          <div><dt className="text-[11px] uppercase text-gray-400">IFSC</dt><dd className="mt-0.5 font-mono">{bank.ifsc}</dd></div>
          {bank.branch && <div><dt className="text-[11px] uppercase text-gray-400">Branch</dt><dd className="mt-0.5">{bank.branch}</dd></div>}
        </dl>
        <button className="text-xs text-brand-600 hover:underline mt-3" onClick={() => setEditing(true)}>Edit</button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {!bank && <p className="text-xs text-gray-400 mb-1">No refund/payout account on file yet — add one so we have somewhere to send it.</p>}
      {[['account_holder_name', 'Account Holder Name'], ['bank_name', 'Bank Name'], ['account_number', 'Account Number'], ['ifsc', 'IFSC'], ['branch', 'Branch (optional)']].map(([k, l]) => (
        <input key={k} className="input text-sm" placeholder={l} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
      ))}
      <div className="flex gap-2">
        <button
          disabled={saving}
          className="btn-primary text-xs px-3 py-1.5"
          onClick={async () => { setSaving(true); await onSave(form); setSaving(false); setEditing(false); }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {bank && <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </div>
  );
}

export default function FranchisePortalPage() {
  const { data: session } = useSession();
  const [data, setData]         = useState(null);
  const [docs, setDocs]         = useState([]);
  const [payments, setPayments] = useState([]);
  const [bank, setBank]         = useState(null);
  const [support, setSupport]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(null);
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' });
  const [submittingSupport, setSubmittingSupport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, documents, pays, bankDetails, supportReqs] = await Promise.all([
        franchisesApi.portalDashboard(), franchisesApi.portalDocuments(), franchisesApi.portalPayments(),
        franchisesApi.getBankDetails(), franchisesApi.portalSupport(),
      ]);
      setData(dashboard); setDocs(documents); setPayments(pays); setBank(bankDetails); setSupport(supportReqs);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (kind, file) => {
    setUploading(kind);
    try { await franchisesApi.uploadDocument(kind, file); setDocs(await franchisesApi.portalDocuments()); toast.success('Uploaded'); }
    catch (e) { toast.error(e.message); }
    finally { setUploading(null); }
  };

  const handleSaveBank = async (form) => {
    try { setBank(await franchisesApi.saveBankDetails(form)); toast.success('Bank details saved'); }
    catch (e) { toast.error(e.message); }
  };

  const handleSubmitSupport = async (e) => {
    e.preventDefault();
    if (!supportForm.subject.trim() || !supportForm.message.trim()) return;
    setSubmittingSupport(true);
    try {
      await franchisesApi.submitSupport(supportForm);
      setSupport(await franchisesApi.portalSupport());
      setSupportForm({ subject: '', message: '' });
      toast.success('Support request submitted');
    } catch (e) { toast.error(e.message); }
    finally { setSubmittingSupport(false); }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>;
  if (!data) return <p className="text-gray-400 text-sm">No franchise linked to this account.</p>;

  const { franchise, assets, total_investment, total_earnings, projected_earnings, roi_percent, recent_settlements } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-50"><Building2 className="w-5 h-5 text-orange-500" /></div>
        <div>
          <h1 className="text-lg font-semibold">{franchise.name}</h1>
          <p className="text-xs text-gray-500">Welcome back, {session?.user?.name}</p>
        </div>
      </div>

      <SectionCard title="Your Progress" icon={TrendingUp}>
        <StageTracker stage={franchise.stage} />
      </SectionCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-gray-500">Invested</p><p className="text-lg font-bold text-gray-900">{formatCurrency(total_investment)}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Earned to date</p><p className="text-lg font-bold text-green-600">{formatCurrency(total_earnings)}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Projected (current)</p><p className="text-lg font-bold text-blue-600">{formatCurrency(projected_earnings)}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">ROI</p><p className="text-lg font-bold text-orange-600">{roi_percent}%</p></div>
      </div>

      <SectionCard title="Documents" icon={FileText}>
        <DocGroup title="KYC" kinds={KYC_KINDS} docs={docs} onUpload={handleUpload} uploading={uploading} />
        <DocGroup title="Site" kinds={SITE_KINDS} docs={docs} onUpload={handleUpload} uploading={uploading} />
        <DocGroup title="Agreement" kinds={AGREEMENT_KINDS} docs={docs} onUpload={handleUpload} uploading={uploading} />
      </SectionCard>

      <SectionCard title="Payments" icon={Wallet}>
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{formatCurrency(p.amount)} <span className="text-xs text-gray-400 font-normal">({p.kind})</span></p>
                <p className="text-xs text-gray-400">{p.status === 'paid' ? `Paid ${formatDate(p.paid_at)}` : `Due ${p.due_date ? formatDate(p.due_date) : '—'}`}</p>
              </div>
              <Badge status={p.status} />
            </div>
          ))}
          {!payments.length && <p className="text-xs text-gray-400">No payments yet.</p>}
        </div>
      </SectionCard>

      <SectionCard title="Bank Details" icon={Landmark}>
        <BankDetailsSection bank={bank} onSave={handleSaveBank} />
      </SectionCard>

      <SectionCard title="My Assets" icon={Zap}>
        <div className="space-y-2">
          {assets?.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <div><p className="font-medium">{a.name}</p><p className="text-xs text-gray-400">{a.station_name} · {a.city}</p></div>
              <Badge status={a.status} />
            </div>
          ))}
          {!assets?.length && <p className="text-xs text-gray-400">No assets yet.</p>}
        </div>
      </SectionCard>

      <SectionCard title="Settlements" icon={Wallet}>
        <div className="space-y-2">
          {recent_settlements?.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <div><p className="font-medium">{formatCurrency(s.franchise_share)}</p><p className="text-xs text-gray-400">{formatDate(s.created_at)}</p></div>
              <Badge status={s.status} />
            </div>
          ))}
          {!recent_settlements?.length && <p className="text-xs text-gray-400">No settlements yet.</p>}
        </div>
      </SectionCard>

      <SectionCard title="Support" icon={LifeBuoy}>
        <form onSubmit={handleSubmitSupport} className="space-y-2 mb-4">
          <input className="input text-sm" placeholder="Subject" value={supportForm.subject} onChange={(e) => setSupportForm((f) => ({ ...f, subject: e.target.value }))} />
          <textarea className="input text-sm" rows={2} placeholder="How can we help?" value={supportForm.message} onChange={(e) => setSupportForm((f) => ({ ...f, message: e.target.value }))} />
          <button disabled={submittingSupport} className="btn-primary text-xs px-3 py-1.5">{submittingSupport ? 'Submitting…' : 'Submit Request'}</button>
        </form>
        <div className="space-y-2">
          {support.map((s) => (
            <div key={s.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{s.subject}</p>
                <Badge status={s.status} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{s.message}</p>
              <p className="text-[11px] text-gray-400 mt-1">{formatDate(s.created_at)}</p>
            </div>
          ))}
          {!support.length && <p className="text-xs text-gray-400">No support requests yet.</p>}
        </div>
      </SectionCard>
    </div>
  );
}
