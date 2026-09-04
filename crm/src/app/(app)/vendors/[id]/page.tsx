"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Plus, Star, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select,
  Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  PO_STATUS_COLOR, PO_STATUS_LABEL, VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL,
  VENDOR_STATUSES, type VendorCategory, type VendorStatus,
} from "@/lib/constants";
import { subscribePurchaseOrders } from "@/lib/db/purchase-orders";
import { subscribeVendor, trashVendor, updateVendor } from "@/lib/db/vendors";
import { rateVendor, subscribeVendorRatings } from "@/lib/db/vendor-ratings";
import { canManageVendors, canTrash } from "@/lib/permissions";
import type { PurchaseOrder, Vendor, VendorRating } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [ratings, setRatings] = useState<VendorRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateValue, setRateValue] = useState(5);
  const [rateNote, setRateNote] = useState("");
  const [form, setForm] = useState<Partial<Vendor>>({});
  const { busy, run } = useAsyncAction();
  const { busy: rating, run: runRate } = useAsyncAction();

  useEffect(
    () => subscribeVendor(params.id, (v) => { setVendor(v); setLoading(false); }, () => setLoading(false)),
    [params.id],
  );
  useEffect(() => subscribePurchaseOrders({ vendorId: params.id }, setPos), [params.id]);
  useEffect(() => subscribeVendorRatings(params.id, setRatings), [params.id]);

  async function submitRating() {
    if (!actor) return;
    await runRate(async () => {
      await rateVendor({ vendorId: params.id, rating: rateValue, note: rateNote }, actor);
      setRateOpen(false);
      setRateNote("");
      setRateValue(5);
    }, "Rating saved.");
  }

  if (loading) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (!vendor) {
    return (
      <EmptyState
        title="Vendor not found"
        action={<Link href="/vendors"><Button>Back to vendors</Button></Link>}
      />
    );
  }

  const outstanding = (vendor.totalOrdered ?? 0) - (vendor.totalPaid ?? 0);

  function startEdit() {
    setForm({
      name: vendor!.name, category: vendor!.category, contactName: vendor!.contactName,
      phone: vendor!.phone, email: vendor!.email, address: vendor!.address,
      gstin: vendor!.gstin, paymentTerms: vendor!.paymentTerms, notes: vendor!.notes,
      status: vendor!.status,
      accountName: vendor!.accountName, bankName: vendor!.bankName,
      accountNumber: vendor!.accountNumber, ifsc: vendor!.ifsc, branch: vendor!.branch,
    });
    setEditing(true);
  }

  return (
    <>
      <PageHeader
        title={vendor.name}
        description={`${vendor.code} · ${VENDOR_CATEGORY_LABEL[vendor.category]}`}
        actions={
          <>
            <Badge className={vendor.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
              {vendor.status}
            </Badge>
            {canManageVendors(viewer) && <Button onClick={startEdit}>Edit</Button>}
            {canManageVendors(viewer) && (
              <Link href={`/purchase-orders/new?vendorId=${vendor.id}`}>
                <Button variant="primary"><Plus className="h-4 w-4" /> New PO</Button>
              </Link>
            )}
            {canTrash(viewer) && (
              <Button variant="danger" onClick={() => setTrashOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </>
        }
      />

      <Modal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        title="Delete this vendor"
        description="Moves it to Trash — it disappears from every list, but an admin can restore it from Trash at any time. Nothing is permanently deleted."
        footer={
          <>
            <Button onClick={() => setTrashOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await trashVendor(vendor, actor!);
                  setTrashOpen(false);
                  router.push("/vendors");
                }, "Vendor moved to Trash.")
              }
            >
              <Trash2 className="h-4 w-4" /> Move to Trash
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{vendor.name} ({vendor.code})</p>
      </Modal>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Vendor details" className="lg:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Contact</dt><dd className="mt-0.5 text-sm">{vendor.contactName || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Phone</dt><dd className="mt-0.5 text-sm">{vendor.phone}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Email</dt><dd className="mt-0.5 text-sm">{vendor.email || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">GSTIN</dt><dd className="mt-0.5 text-sm">{vendor.gstin || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Payment terms</dt><dd className="mt-0.5 text-sm">{vendor.paymentTerms || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Address</dt><dd className="mt-0.5 text-sm">{vendor.address || "—"}</dd></div>
            {vendor.notes && (
              <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-ink-500">Notes</dt><dd className="mt-0.5 text-sm">{vendor.notes}</dd></div>
            )}
          </dl>

          {(vendor.accountName || vendor.bankName || vendor.accountNumber || vendor.ifsc || vendor.branch) && (
            <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-2">
              <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Bank details</div>
              {vendor.accountName && <div><dt className="text-xs uppercase tracking-wide text-ink-500">Account holder</dt><dd className="mt-0.5 text-sm">{vendor.accountName}</dd></div>}
              {vendor.bankName && <div><dt className="text-xs uppercase tracking-wide text-ink-500">Bank</dt><dd className="mt-0.5 text-sm">{vendor.bankName}</dd></div>}
              {vendor.accountNumber && <div><dt className="text-xs uppercase tracking-wide text-ink-500">Account number</dt><dd className="mt-0.5 text-sm">{vendor.accountNumber}</dd></div>}
              {vendor.ifsc && <div><dt className="text-xs uppercase tracking-wide text-ink-500">IFSC</dt><dd className="mt-0.5 text-sm">{vendor.ifsc}</dd></div>}
              {vendor.branch && <div><dt className="text-xs uppercase tracking-wide text-ink-500">Branch</dt><dd className="mt-0.5 text-sm">{vendor.branch}</dd></div>}
            </dl>
          )}
        </Card>

        <Card title="Spend summary">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Total ordered</p>
              <p className="text-lg font-semibold">{formatINR(vendor.totalOrdered)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Total paid</p>
              <p className="text-lg font-semibold text-emerald-600">{formatINR(vendor.totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Outstanding</p>
              <p className="text-lg font-semibold text-amber-600">{formatINR(outstanding)}</p>
            </div>
            <div className="border-t border-ink-100 pt-3">
              <p className="text-xs uppercase tracking-wide text-ink-500">Rating</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-lg font-semibold">{vendor.ratingCount ? vendor.avgRating!.toFixed(1) : "—"}</span>
                <span className="text-xs text-ink-500">({vendor.ratingCount ?? 0})</span>
              </div>
              {canManageVendors(viewer) && (
                <Button size="sm" className="mt-2" onClick={() => setRateOpen(true)}>
                  <Star className="h-3.5 w-3.5" /> Rate vendor
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {ratings.length > 0 && (
        <Card title="Rating history" className="mt-4">
          <ul className="space-y-2">
            {ratings.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 border-b border-ink-100 pb-2 text-sm last:border-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-ink-200"}`} />
                    ))}
                    {r.poNo && <span className="ml-1 text-xs text-ink-500">— {r.poNo}</span>}
                  </div>
                  {r.note && <p className="mt-1 text-ink-600">{r.note}</p>}
                </div>
                <span className="shrink-0 text-xs text-ink-400">{formatDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="Rate this vendor"
        footer={(
          <>
            <Button onClick={() => setRateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={rating} onClick={() => void submitRating()}>Save rating</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Rating">
            <div className="flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <button key={i} type="button" onClick={() => setRateValue(i + 1)}>
                  <Star className={`h-6 w-6 ${i < rateValue ? "fill-amber-400 text-amber-400" : "text-ink-200"}`} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Note (optional)"><Textarea value={rateNote} onChange={(e) => setRateNote(e.target.value)} /></Field>
        </div>
      </Modal>

      <Card title="Purchase orders" subtitle={`${pos.length} order${pos.length === 1 ? "" : "s"}`} className="mt-4">
        {pos.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No purchase orders yet"
            action={canManageVendors(viewer) ? <Link href={`/purchase-orders/new?vendorId=${vendor.id}`}><Button variant="primary"><Plus className="h-4 w-4" /> New PO</Button></Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">PO Number</th>
                  <th className="th">Status</th>
                  <th className="th">Project</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Paid</th>
                  <th className="th text-right">Due</th>
                  <th className="th">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pos.map((po) => (
                  <tr key={po.id} className="hover:bg-ink-50">
                    <td className="td">
                      <Link href={`/purchase-orders/${po.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="td"><Badge className={PO_STATUS_COLOR[po.status]}>{PO_STATUS_LABEL[po.status]}</Badge></td>
                    <td className="td text-ink-600">{po.linkedProjectCode || "—"}</td>
                    <td className="td text-right font-medium tabular-nums">{formatINR(po.total)}</td>
                    <td className="td text-right tabular-nums text-emerald-600">{formatINR(po.paidAmount)}</td>
                    <td className="td text-right tabular-nums text-amber-600">{formatINR(po.dueAmount)}</td>
                    <td className="td text-ink-500">{formatDate(po.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit vendor"
        footer={
          <>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!actor) return;
                  await updateVendor(vendor.id, form, actor);
                  setEditing(false);
                }, "Vendor updated.")
              }
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Category">
            <Select
              value={form.category ?? "OTHER"}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VendorCategory }))}
              options={VENDOR_CATEGORIES.map((c) => ({ value: c, label: VENDOR_CATEGORY_LABEL[c] }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status ?? "ACTIVE"}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VendorStatus }))}
              options={VENDOR_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Contact person">
            <Input value={form.contactName ?? ""} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          </Field>
          <Field label="Phone" required>
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="GSTIN">
            <Input value={form.gstin ?? ""} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))} />
          </Field>
          <Field label="Payment terms">
            <Input value={form.paymentTerms ?? ""} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>

          <div className="sm:col-span-2">
            <p className="label mb-2">Bank details <span className="font-normal normal-case text-ink-400">— printed on purchase orders for payment</span></p>
          </div>
          <Field label="Account holder name">
            <Input value={form.accountName ?? ""} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} />
          </Field>
          <Field label="Bank name">
            <Input value={form.bankName ?? ""} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
          </Field>
          <Field label="Account number">
            <Input value={form.accountNumber ?? ""} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} />
          </Field>
          <Field label="IFSC code">
            <Input value={form.ifsc ?? ""} onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))} />
          </Field>
          <Field label="Branch" className="sm:col-span-2">
            <Input value={form.branch ?? ""} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} />
          </Field>

          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
