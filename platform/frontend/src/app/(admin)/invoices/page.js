'use client';

import { Fragment, useEffect, useState } from 'react';
import Script from 'next/script';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { invoicesApi, paymentsApi } from '@/lib/api';

const STATUS_BADGE = {
  issued: 'badge-yellow',
  paid: 'badge-green',
  overdue: 'badge-red',
  void: 'badge-gray',
  draft: 'badge-gray',
};

const PAYMENT_BADGE = {
  created: 'badge-gray',
  paid: 'badge-green',
  failed: 'badge-red',
  refunded: 'badge-yellow',
};

function ReceiptModal({ paymentId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    paymentsApi.receipt(paymentId).then(setReceipt).catch((err) => setError(err.message));
  }, [paymentId]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm space-y-4">
        {error && <p className="text-sm text-danger-600">{error}</p>}
        {!error && !receipt && <p className="text-sm text-ink-400">Loading…</p>}
        {receipt && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-ink-900">Payment receipt</h2>
              <p className="text-xs text-ink-400 font-mono mt-0.5">{receipt.receipt_number}</p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Organization</dt><dd className="text-ink-800">{receipt.tenant_name}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Invoice</dt><dd className="text-ink-800 font-mono text-xs">{receipt.invoice_number}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Period</dt><dd className="text-ink-800">{receipt.period_start.slice(0, 10)} – {receipt.period_end.slice(0, 10)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Paid on</dt><dd className="text-ink-800">{new Date(receipt.paid_at).toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Method</dt><dd className="text-ink-800">{receipt.auto_charged ? 'Auto-charged' : 'Manual'}</dd></div>
              <div className="flex justify-between pt-2 border-t border-ink-100 font-semibold"><dt className="text-ink-900">Amount paid</dt><dd className="text-ink-900">{receipt.currency} {receipt.amount}</dd></div>
            </dl>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          {receipt && <button className="btn-secondary" onClick={() => window.print()}>Print</button>}
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function PaymentsRow({ invoice, onChanged }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiptFor, setReceiptFor] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setPayments((await paymentsApi.forInvoice(invoice.id)).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [invoice.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const payNow = async () => {
    try {
      const order = await paymentsApi.createOrder(invoice.id);
      if (typeof window === 'undefined' || !window.Razorpay) {
        toast.error('Razorpay checkout script not loaded yet — try again in a moment.');
        return;
      }
      const rzp = new window.Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Alpha',
        description: `Invoice ${order.invoice_number}`,
        handler: () => { toast.success('Payment submitted — it will confirm once Razorpay sends its webhook.'); load(); onChanged(); },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const refund = async (paymentId) => {
    try {
      await paymentsApi.refund(paymentId);
      toast.success('Refunded.');
      load();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Fragment>
    <tr>
      <td colSpan={7} className="bg-ink-50/50 px-8 py-3">
        {invoice.status === 'issued' && (
          <button className="btn-secondary mb-2" onClick={payNow}>Pay via Razorpay</button>
        )}
        {loading ? (
          <p className="text-sm text-ink-400">Loading payments…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-ink-400">No payment attempts yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span className="text-ink-600">
                  {new Date(p.created_at).toLocaleString()} — {p.gateway} {p.gateway_order_id}
                </span>
                <div className="flex items-center gap-3">
                  <span className={`badge ${PAYMENT_BADGE[p.status] || 'badge-gray'}`}>{p.status}</span>
                  <span className="font-medium text-ink-800">{p.currency} {p.amount}</span>
                  {p.status === 'paid' && (
                    <>
                      <button className="text-brand-600 hover:underline" onClick={() => setReceiptFor(p.id)}>Receipt</button>
                      <button className="text-danger-600 hover:underline" onClick={() => refund(p.id)}>Refund</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
    {receiptFor && <ReceiptModal paymentId={receiptFor} onClose={() => setReceiptFor(null)} />}
    </Fragment>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

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

  const resendEmail = async (id) => {
    try { await invoicesApi.resendEmail(id); toast.success('Invoice email sent.'); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <h1 className="text-xl font-semibold mb-6">Invoices</h1>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th></th>
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
            {loading && <tr><td colSpan={8} className="text-center text-gray-400 py-8">Loading…</td></tr>}
            {!loading && invoices.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-8">No invoices yet.</td></tr>}
            {invoices.map((inv) => (
              <Fragment key={inv.id}>
                <tr>
                  <td>
                    <button className="text-ink-400 hover:text-ink-700" onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                      {expanded === inv.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="font-mono text-xs">{inv.invoice_number}</td>
                  <td>{inv.tenant_name}</td>
                  <td>{inv.period_start.slice(0, 7)}</td>
                  <td className="capitalize">{inv.billing_model.replace('_', ' ')}</td>
                  <td>{inv.currency} {inv.total_amount}</td>
                  <td><span className={`badge ${STATUS_BADGE[inv.status] || 'badge-gray'}`}>{inv.status}</span></td>
                  <td>
                    <div className="flex items-center gap-3">
                      {inv.status === 'issued' && (
                        <button className="text-brand-600 hover:underline text-sm" onClick={() => markPaid(inv.id)}>Mark paid</button>
                      )}
                      <button className="text-ink-500 hover:underline text-sm" onClick={() => resendEmail(inv.id)}>Resend email</button>
                    </div>
                  </td>
                </tr>
                {expanded === inv.id && <PaymentsRow invoice={inv} onChanged={load} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
