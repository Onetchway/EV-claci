"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, LogIn, LogOut, MapPin, Plus, Trash2, XCircle,
} from "lucide-react";

import { useActor, useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, StatCard,
  Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import { performCheckIn, performCheckOut } from "@/lib/attendance-actions";
import {
  markAttendance, subscribeAttendanceRange, subscribeMyAttendanceMonth,
} from "@/lib/db/attendance";
import { ymd } from "@/lib/dates";
import {
  createOfficeLocation, deleteOfficeLocation, subscribeOfficeLocations, updateOfficeLocation,
} from "@/lib/db/office-locations";
import { subscribeUsers } from "@/lib/db/users";
import {
  applyForLeave, cancelLeaveRequest, createLeaveType, daysBetween, decideLeaveRequest,
  setLeaveTypeActive, subscribeAllLeaveRequests, subscribeLeaveTypes, subscribeMyLeaveRequests,
} from "@/lib/db/leave";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getCurrentCoords } from "@/lib/geo";
import { canManageHrms, canManageHrmsSetup, isAdmin } from "@/lib/permissions";
import type {
  AppUser, AttendanceRecord, AttendanceStatus, LeaveRequest, LeaveType, OfficeLocation,
} from "@/lib/types";
import { downloadCsv, formatDate, formatDateTime } from "@/lib/utils";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present", ABSENT: "Absent", HALF_DAY: "Half day", ON_LEAVE: "On leave", WEEK_OFF: "Week off", HOLIDAY: "Holiday",
};
const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  ABSENT: "bg-rose-100 text-rose-800 ring-rose-200",
  HALF_DAY: "bg-amber-100 text-amber-800 ring-amber-200",
  ON_LEAVE: "bg-violet-100 text-violet-800 ring-violet-200",
  WEEK_OFF: "bg-ink-100 text-ink-600 ring-ink-200",
  HOLIDAY: "bg-sky-100 text-sky-800 ring-sky-200",
};

const LEAVE_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
  CANCELLED: "bg-ink-100 text-ink-600 ring-ink-200",
};

function monthRange(cursor: Date): { start: string; end: string; label: string } {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return {
    start: ymd(start),
    end: ymd(end),
    label: cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
}

// ---------------------------------------------------------------------------
// My attendance
// ---------------------------------------------------------------------------

function MyAttendanceTab() {
  const { profile, role } = useAuth();
  const actor = useActor();
  const { push } = useToast();
  const { busy: punching, run: runPunch } = useAsyncAction();
  const { busy: applying, run: runApply } = useAsyncAction();

  const [monthCursor, setMonthCursor] = useState(new Date());
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState(ymd(new Date()));
  const [toDate, setToDate] = useState(ymd(new Date()));
  const [reason, setReason] = useState("");

  const { start, end, label } = useMemo(() => monthRange(monthCursor), [monthCursor]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    return subscribeMyAttendanceMonth(
      profile.uid, start, end,
      (r) => { setRows(r); setError(null); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
  }, [profile, start, end]);

  useEffect(() => subscribeOfficeLocations(setOffices), []);
  useEffect(() => subscribeLeaveTypes(setLeaveTypes), []);
  useEffect(() => {
    if (!profile) return;
    return subscribeMyLeaveRequests(profile.uid, setMyLeaves);
  }, [profile]);

  const today = ymd(new Date());
  const todayRecord = rows.find((r) => r.date === today) ?? null;

  const balances = useMemo(() => {
    const year = new Date().getFullYear();
    return leaveTypes.filter((t) => t.active).map((t) => {
      const used = myLeaves
        .filter((l) => l.leaveTypeId === t.id && l.status === "APPROVED" && new Date(l.fromDate).getFullYear() === year)
        .reduce((a, l) => a + l.days, 0);
      return { ...t, used, remaining: Math.max(0, t.annualQuota - used) };
    });
  }, [leaveTypes, myLeaves]);

  async function doCheckIn() {
    if (!profile) return;
    await performCheckIn(profile, actor, offices, role);
  }

  async function doCheckOut() {
    if (!profile) return;
    await performCheckOut(profile, actor, offices, role);
  }

  async function submitLeave() {
    if (!profile) return;
    const type = leaveTypes.find((t) => t.id === leaveTypeId);
    if (!type) throw new Error("Choose a leave type.");
    if (toDate < fromDate) throw new Error("End date can't be before the start date.");
    await applyForLeave({
      uid: profile.uid, userName: profile.name,
      leaveTypeId: type.id, leaveTypeLabel: type.label,
      fromDate, toDate, reason,
    }, actor);
    setLeaveModalOpen(false);
    setReason("");
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
          <p className="mt-1 text-xs">
            A missing-index or permission-denied error here usually means the Firestore rules/composite
            indexes for the `attendance` collection haven't been deployed yet — run{" "}
            <code>firebase deploy --only firestore:rules,firestore:indexes</code>. Check-out stays disabled
            below until today's check-in can actually be read back, which this error is blocking.
          </p>
        </div>
      )}
      <Card title="Today" subtitle={formatDate(new Date())}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-600">Check in</span>
            {todayRecord?.checkIn?.at ? (
              <Badge className={todayRecord.checkIn.withinGeofence ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}>
                {formatDateTime(todayRecord.checkIn.at)}
                {todayRecord.checkIn.officeName ? ` · ${todayRecord.checkIn.officeName}` : ""}
              </Badge>
            ) : (
              <Button size="sm" loading={punching} onClick={() => void runPunch(doCheckIn, "Checked in.")}>
                <LogIn className="h-3.5 w-3.5" /> Check in
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-600">Check out</span>
            {todayRecord?.checkOut?.at ? (
              <Badge className="bg-ink-100 text-ink-700 ring-ink-200">{formatDateTime(todayRecord.checkOut.at)}</Badge>
            ) : (
              <Button
                size="sm"
                loading={punching}
                disabled={!todayRecord?.checkIn?.at}
                onClick={() => void runPunch(doCheckOut, "Checked out.")}
              >
                <LogOut className="h-3.5 w-3.5" /> Check out
              </Button>
            )}
          </div>
        </div>
      </Card>

      {balances.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {balances.map((b) => (
            <StatCard key={b.id} label={b.label} value={`${b.remaining}/${b.annualQuota}`} sub="days remaining" />
          ))}
        </div>
      )}

      <Card
        title="Leave requests"
        actions={<Button size="sm" variant="primary" onClick={() => setLeaveModalOpen(true)}><Plus className="h-3.5 w-3.5" /> Apply for leave</Button>}
      >
        {myLeaves.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">No leave requests yet.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Type</th>
                  <th className="th">Dates</th>
                  <th className="th text-right">Days</th>
                  <th className="th">Reason</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {myLeaves.map((l) => (
                  <tr key={l.id}>
                    <td className="td">{l.leaveTypeLabel}</td>
                    <td className="td text-ink-600">{formatDate(l.fromDate)} – {formatDate(l.toDate)}</td>
                    <td className="td text-right tabular-nums">{l.days}</td>
                    <td className="td max-w-[220px] truncate text-ink-500">{l.reason || "—"}</td>
                    <td className="td"><Badge className={LEAVE_STATUS_STYLE[l.status]}>{l.status}</Badge></td>
                    <td className="td text-right">
                      {l.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => void cancelLeaveRequest(l.id).then(() => push("Leave request cancelled.", "success"))}
                          className="text-xs font-medium text-rose-600 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Attendance"
        subtitle={label}
        actions={
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>Prev</Button>
            <Button size="sm" onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Next</Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">No attendance recorded this month.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Status</th>
                  <th className="th">Check in</th>
                  <th className="th">Check out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {[...rows].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                  <tr key={r.id}>
                    <td className="td">{formatDate(r.date)}</td>
                    <td className="td"><Badge className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                    <td className="td text-ink-600">{r.checkIn?.at ? formatDateTime(r.checkIn.at) : "—"}</td>
                    <td className="td text-ink-600">{r.checkOut?.at ? formatDateTime(r.checkOut.at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title="Apply for leave"
        footer={
          <>
            <Button onClick={() => setLeaveModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={applying} onClick={() => void runApply(submitLeave, "Leave request submitted.")}>Submit</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Leave type" required>
            <Select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              placeholder="Select a leave type…"
              options={leaveTypes.filter((t) => t.active).map((t) => ({ value: t.id, label: `${t.label} (${t.annualQuota}/yr)` }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field>
            <Field label="To" required><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></Field>
          </div>
          {toDate >= fromDate && <p className="text-xs text-ink-500">{daysBetween(fromDate, toDate)} day(s)</p>}
          <Field label="Reason"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team tab (managers+)
// ---------------------------------------------------------------------------

function TeamTab() {
  const actor = useActor();
  const { push } = useToast();
  const [date, setDate] = useState(ymd(new Date()));
  const [users, setUsers] = useState<AppUser[]>([]);
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markTarget, setMarkTarget] = useState<AppUser | null>(null);
  const [markStatus, setMarkStatus] = useState<AttendanceStatus>("ABSENT");
  const [markNote, setMarkNote] = useState("");
  const { busy: marking, run: runMark } = useAsyncAction();

  const [downloadMonth, setDownloadMonth] = useState(ymd(new Date()).slice(0, 7));

  useEffect(() => subscribeUsers(setUsers), []);
  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribeAttendanceRange(
      date, date,
      (r) => { setRows(r); setError(null); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
  }, [date]);

  const byUid = useMemo(() => new Map(rows.map((r) => [r.uid, r])), [rows]);
  const activeUsers = useMemo(() => users.filter((u) => u.active !== false), [users]);

  async function saveMark() {
    if (!markTarget) return;
    await markAttendance(markTarget.uid, markTarget.name, date, markStatus, actor, markNote);
    setMarkTarget(null);
    setMarkNote("");
  }

  async function downloadMonthly() {
    const [y, m] = downloadMonth.split("-").map(Number);
    const from = ymd(new Date(y!, (m ?? 1) - 1, 1));
    const to = ymd(new Date(y!, m ?? 1, 0));
    await new Promise<void>((resolve, reject) => {
      const unsub = subscribeAttendanceRange(from, to, (monthRows) => {
        unsub();
        const byUser = new Map<string, Map<string, AttendanceRecord>>();
        for (const r of monthRows) {
          if (!byUser.has(r.uid)) byUser.set(r.uid, new Map());
          byUser.get(r.uid)!.set(r.date, r);
        }
        const days: string[] = [];
        for (let d = new Date(y!, (m ?? 1) - 1, 1); d <= new Date(y!, m ?? 1, 0); d.setDate(d.getDate() + 1)) {
          days.push(ymd(d));
        }
        const header = ["Employee", ...days];
        const csvRows = [header, ...activeUsers.map((u) => [
          u.name,
          ...days.map((d) => STATUS_LABEL[byUser.get(u.uid)?.get(d)?.status ?? "ABSENT"] ?? ""),
        ])];
        downloadCsv(`livanto-attendance-${downloadMonth}.csv`, csvRows);
        push("Attendance CSV downloaded.", "success");
        resolve();
      }, (e) => { unsub(); reject(e); });
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
          <p className="mt-1 text-xs">
            A missing-index or permission-denied error here usually means the Firestore rules/composite
            indexes for the `attendance` collection haven't been deployed yet — run{" "}
            <code>firebase deploy --only firestore:rules,firestore:indexes</code>.
          </p>
        </div>
      )}
      <Card
        title="Team attendance"
        actions={<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />}
      >
        {loading ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Employee</th>
                  <th className="th">Status</th>
                  <th className="th">Check in</th>
                  <th className="th">Check out</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {activeUsers.map((u) => {
                  const r = byUid.get(u.uid);
                  return (
                    <tr key={u.uid}>
                      <td className="td font-medium text-ink-900">{u.name}</td>
                      <td className="td">
                        {r ? <Badge className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</Badge> : <Badge className="bg-ink-100 text-ink-500 ring-ink-200">Not marked</Badge>}
                      </td>
                      <td className="td text-ink-600">{r?.checkIn?.at ? formatDateTime(r.checkIn.at) : "—"}</td>
                      <td className="td text-ink-600">{r?.checkOut?.at ? formatDateTime(r.checkOut.at) : "—"}</td>
                      <td className="td text-right">
                        <button
                          type="button"
                          onClick={() => { setMarkTarget(u); setMarkStatus(r?.status ?? "ABSENT"); setMarkNote(r?.note ?? ""); }}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          Mark
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Download monthly attendance">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Month"><Input type="month" value={downloadMonth} onChange={(e) => setDownloadMonth(e.target.value)} /></Field>
          <Button onClick={() => void downloadMonthly()}>Download CSV</Button>
        </div>
      </Card>

      <Modal
        open={!!markTarget}
        onClose={() => setMarkTarget(null)}
        title={`Mark attendance — ${markTarget?.name ?? ""}`}
        description={formatDate(date)}
        footer={
          <>
            <Button onClick={() => setMarkTarget(null)}>Cancel</Button>
            <Button variant="primary" loading={marking} onClick={() => void runMark(saveMark, "Attendance updated.")}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Status">
            <Select
              value={markStatus}
              onChange={(e) => setMarkStatus(e.target.value as AttendanceStatus)}
              options={(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </Field>
          <Field label="Note"><Textarea rows={3} value={markNote} onChange={(e) => setMarkNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approvals tab (managers+)
// ---------------------------------------------------------------------------

function ApprovalsTab() {
  const actor = useActor();
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisionTarget, setDecisionTarget] = useState<{ req: LeaveRequest; status: "APPROVED" | "REJECTED" } | null>(null);
  const [note, setNote] = useState("");
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeAllLeaveRequests((r) => { setRows(r); setLoading(false); }, () => setLoading(false)), []);

  const pending = rows.filter((r) => r.status === "PENDING");
  const decided = rows.filter((r) => r.status !== "PENDING");

  async function decide() {
    if (!decisionTarget) return;
    await decideLeaveRequest(decisionTarget.req.id, decisionTarget.status, actor, note);
    setDecisionTarget(null);
    setNote("");
  }

  return (
    <div className="space-y-4">
      <Card title="Pending approvals" subtitle={`${pending.length} waiting`}>
        {loading ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : pending.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">Nothing pending.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Employee</th>
                  <th className="th">Type</th>
                  <th className="th">Dates</th>
                  <th className="th text-right">Days</th>
                  <th className="th">Reason</th>
                  <th className="th text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td className="td font-medium text-ink-900">{r.userName}</td>
                    <td className="td">{r.leaveTypeLabel}</td>
                    <td className="td text-ink-600">{formatDate(r.fromDate)} – {formatDate(r.toDate)}</td>
                    <td className="td text-right tabular-nums">{r.days}</td>
                    <td className="td max-w-[220px] truncate text-ink-500">{r.reason || "—"}</td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setDecisionTarget({ req: r, status: "APPROVED" })} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button type="button" onClick={() => setDecisionTarget({ req: r, status: "REJECTED" })} className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline">
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Decided" subtitle="Most recent first">
        {decided.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">No decisions yet.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Employee</th>
                  <th className="th">Type</th>
                  <th className="th">Dates</th>
                  <th className="th">Status</th>
                  <th className="th">Decided by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {decided.slice(0, 100).map((r) => (
                  <tr key={r.id}>
                    <td className="td">{r.userName}</td>
                    <td className="td">{r.leaveTypeLabel}</td>
                    <td className="td text-ink-600">{formatDate(r.fromDate)} – {formatDate(r.toDate)}</td>
                    <td className="td"><Badge className={LEAVE_STATUS_STYLE[r.status]}>{r.status}</Badge></td>
                    <td className="td text-ink-500">{r.decidedBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!decisionTarget}
        onClose={() => setDecisionTarget(null)}
        title={`${decisionTarget?.status === "APPROVED" ? "Approve" : "Reject"} leave — ${decisionTarget?.req.userName ?? ""}`}
        footer={
          <>
            <Button onClick={() => setDecisionTarget(null)}>Cancel</Button>
            <Button
              variant={decisionTarget?.status === "REJECTED" ? "danger" : "primary"}
              loading={busy}
              onClick={() => void run(decide, "Leave request updated.")}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Field label="Note (optional)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup tab (admin only)
// ---------------------------------------------------------------------------

async function patchUserGeofence(uid: string, bypassGeofence: boolean) {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch(`/api/users/${uid}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ bypassGeofence }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
}

function SetupTab() {
  const actor = useActor();
  const { push } = useToast();
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [officeForm, setOfficeForm] = useState({ name: "", address: "", lat: "", lng: "", radiusMeters: "200" });
  const [leaveForm, setLeaveForm] = useState({ code: "", label: "", annualQuota: "12" });
  const { busy: savingOffice, run: runSaveOffice } = useAsyncAction();
  const { busy: savingLeave, run: runSaveLeave } = useAsyncAction();
  const { busy: locating, run: runLocate } = useAsyncAction();

  useEffect(() => subscribeOfficeLocations(setOffices), []);
  useEffect(() => subscribeLeaveTypes(setLeaveTypes), []);
  useEffect(() => subscribeUsers(setUsers), []);

  async function useMyLocation() {
    const coords = await getCurrentCoords();
    setOfficeForm((f) => ({ ...f, lat: coords.lat.toFixed(6), lng: coords.lng.toFixed(6) }));
  }

  async function saveOffice() {
    const lat = Number(officeForm.lat);
    const lng = Number(officeForm.lng);
    const radiusMeters = Number(officeForm.radiusMeters);
    if (!officeForm.name.trim()) throw new Error("Name the office.");
    if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error("Latitude/longitude must be numbers.");
    await createOfficeLocation({ name: officeForm.name, address: officeForm.address, lat, lng, radiusMeters: radiusMeters || 200 }, actor);
    setOfficeForm({ name: "", address: "", lat: "", lng: "", radiusMeters: "200" });
  }

  async function saveLeaveType() {
    if (!leaveForm.code.trim() || !leaveForm.label.trim()) throw new Error("Give the leave type a code and a label.");
    await createLeaveType({ code: leaveForm.code.trim().toUpperCase(), label: leaveForm.label.trim(), annualQuota: Number(leaveForm.annualQuota) || 0 });
    setLeaveForm({ code: "", label: "", annualQuota: "12" });
  }

  return (
    <div className="space-y-4">
      <Card title="Office locations" subtitle="Employees can only check in from within one of these — add every site your team works from.">
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder="Office name" value={officeForm.name} onChange={(e) => setOfficeForm((f) => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Address (optional)" value={officeForm.address} onChange={(e) => setOfficeForm((f) => ({ ...f, address: e.target.value }))} />
          <Input placeholder="Latitude" value={officeForm.lat} onChange={(e) => setOfficeForm((f) => ({ ...f, lat: e.target.value }))} />
          <Input placeholder="Longitude" value={officeForm.lng} onChange={(e) => setOfficeForm((f) => ({ ...f, lng: e.target.value }))} />
          <Input placeholder="Radius (m)" type="number" value={officeForm.radiusMeters} onChange={(e) => setOfficeForm((f) => ({ ...f, radiusMeters: e.target.value }))} />
        </div>
        <div className="mb-4 flex gap-2">
          <Button size="sm" loading={locating} onClick={() => void runLocate(useMyLocation)}>
            <MapPin className="h-3.5 w-3.5" /> Use my current location
          </Button>
          <Button size="sm" variant="primary" loading={savingOffice} onClick={() => void runSaveOffice(saveOffice, "Office added.")}>
            <Plus className="h-3.5 w-3.5" /> Add office
          </Button>
        </div>
        {offices.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">No offices configured — geofencing won't be enforced until you add one.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Coordinates</th>
                  <th className="th text-right">Radius</th>
                  <th className="th">Active</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {offices.map((o) => (
                  <tr key={o.id}>
                    <td className="td font-medium">{o.name}<span className="block text-xs text-ink-500">{o.address}</span></td>
                    <td className="td text-ink-600 tabular-nums">{o.lat.toFixed(5)}, {o.lng.toFixed(5)}</td>
                    <td className="td text-right tabular-nums">{o.radiusMeters}m</td>
                    <td className="td">
                      <button
                        type="button"
                        onClick={() => void updateOfficeLocation(o.id, { active: !o.active }, actor)}
                        className={o.active ? "text-emerald-700" : "text-ink-400"}
                      >
                        {o.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="td text-right">
                      <button type="button" onClick={() => void deleteOfficeLocation(o.id).then(() => push("Office removed.", "success"))} className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Leave types" subtitle="Each carries its own annual quota, deducted as requests are approved.">
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <Input placeholder="Code, e.g. CASUAL" value={leaveForm.code} onChange={(e) => setLeaveForm((f) => ({ ...f, code: e.target.value }))} />
          <Input placeholder="Label, e.g. Casual Leave" value={leaveForm.label} onChange={(e) => setLeaveForm((f) => ({ ...f, label: e.target.value }))} />
          <Input placeholder="Annual quota (days)" type="number" value={leaveForm.annualQuota} onChange={(e) => setLeaveForm((f) => ({ ...f, annualQuota: e.target.value }))} />
          <Button variant="primary" loading={savingLeave} onClick={() => void runSaveLeave(saveLeaveType, "Leave type added.")}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {leaveTypes.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">No leave types yet — Casual, Sick, Earned are common starting points.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Code</th><th className="th">Label</th><th className="th text-right">Annual quota</th><th className="th">Active</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {leaveTypes.map((t) => (
                  <tr key={t.id}>
                    <td className="td font-mono text-xs">{t.code}</td>
                    <td className="td">{t.label}</td>
                    <td className="td text-right tabular-nums">{t.annualQuota}</td>
                    <td className="td">
                      <button type="button" onClick={() => void setLeaveTypeActive(t.id, !t.active)} className={t.active ? "text-emerald-700" : "text-ink-400"}>
                        {t.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Geofence exemptions" subtitle="Admins can always check in from anywhere. Grant the same to specific people here — a field sales lead, a traveling manager.">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr><th className="th">Name</th><th className="th">Role</th><th className="th">Can check in from anywhere</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.filter((u) => u.active !== false).map((u) => {
                const admin = isAdmin(u.role);
                return (
                  <tr key={u.uid}>
                    <td className="td font-medium text-ink-900">{u.name}</td>
                    <td className="td text-ink-600">{u.role.replace(/_/g, " ")}</td>
                    <td className="td">
                      {admin ? (
                        <span className="text-xs text-ink-400">Always (admin)</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void patchUserGeofence(u.uid, !u.bypassGeofence)
                              .then(() => push(u.bypassGeofence ? "Exemption removed." : "Exemption granted.", "success"))
                              .catch((e: Error) => push(e.message, "error"))
                          }
                          className={u.bypassGeofence ? "text-emerald-700" : "text-ink-400"}
                        >
                          {u.bypassGeofence ? "Exempt" : "Not exempt"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Tab = "mine" | "team" | "approvals" | "setup";

export default function AttendancePage() {
  const viewer = useViewer();
  const manages = canManageHrms(viewer);
  const setsUp = canManageHrmsSetup(viewer);
  const [tab, setTab] = useState<Tab>("mine");

  const tabs: { key: Tab; label: string }[] = [
    { key: "mine", label: "My attendance" },
    ...(manages ? [{ key: "team" as const, label: "Team" }, { key: "approvals" as const, label: "Approvals" }] : []),
    ...(setsUp ? [{ key: "setup" as const, label: "Setup" }] : []),
  ];

  return (
    <>
      <PageHeader title="Attendance" description="Check in/out with geofencing, apply for leave, and (for managers) run the team's day." />

      <div className="mb-4 flex rounded-lg bg-ink-100 p-0.5 text-sm w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 ${tab === t.key ? "bg-white shadow-sm font-medium" : "text-ink-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mine" && <MyAttendanceTab />}
      {tab === "team" && manages && <TeamTab />}
      {tab === "approvals" && manages && <ApprovalsTab />}
      {tab === "setup" && setsUp && <SetupTab />}
    </>
  );
}
