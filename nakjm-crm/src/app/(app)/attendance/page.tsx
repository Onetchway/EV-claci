"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, LogIn, LogOut } from "lucide-react";

import { useActor, useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  ATTENDANCE_STATUS_COLOR, ATTENDANCE_STATUS_LABEL, LEAVE_REQUEST_STATUS_META, LEAVE_TYPES, LEAVE_TYPE_LABEL,
  type LeaveType,
} from "@/lib/constants";
import { checkIn, checkOut, subscribeAttendanceRange, subscribeMyAttendanceMonth } from "@/lib/db/attendance";
import { cancelLeaveRequest, createLeaveRequest, decideLeaveRequest, subscribeAllLeaveRequests, subscribeMyLeaveRequests } from "@/lib/db/leave";
import { monthRange, ymd } from "@/lib/dates";
import { subscribeActiveUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { canSeeAllHrms } from "@/lib/permissions";
import type { AppUser, AttendanceRecord, LeaveRequest } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

/** Best-effort — email notifications never block or fail the leave-request action itself. */
async function notifyLeaveRequest(requestId: string, type: "submitted" | "decided") {
  try {
    const current = getFirebaseAuth().currentUser;
    if (!current) return;
    const token = await current.getIdToken();
    await fetch("/api/notify/leave-request", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ requestId, type }),
    });
  } catch {
    // Notification email is a nice-to-have; the leave request itself already succeeded.
  }
}

function getCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 4000 },
    );
  });
}

const BLANK_LEAVE_FORM = { leaveType: "CASUAL" as LeaveType, startDate: "", endDate: "", reason: "" };

export default function AttendancePage() {
  const { profile } = useAuth();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();
  const seeAll = canSeeAllHrms(viewer);

  const [tab, setTab] = useState<"mine" | "team" | "leave">("mine");
  const [rows, setRows] = useState<AttendanceRecord[] | null>(null);
  const [teamRows, setTeamRows] = useState<AttendanceRecord[] | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [myLeave, setMyLeave] = useState<LeaveRequest[]>([]);
  const [allLeave, setAllLeave] = useState<LeaveRequest[]>([]);
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState(BLANK_LEAVE_FORM);

  const { start, end } = useMemo(() => monthRange(new Date()), []);
  const today = ymd(new Date());
  const todayRecord = (rows ?? []).find((r) => r.date === today);

  useEffect(() => subscribeMyAttendanceMonth(profile!.uid, start, end, setRows), [profile, start, end]);
  useEffect(() => { if (seeAll && tab === "team") return subscribeAttendanceRange(start, end, setTeamRows); }, [seeAll, tab, start, end]);
  useEffect(() => { if (seeAll) return subscribeActiveUsers(setUsers); }, [seeAll]);
  useEffect(() => subscribeMyLeaveRequests(actor.uid, setMyLeave), [actor.uid]);
  useEffect(() => { if (seeAll) return subscribeAllLeaveRequests(setAllLeave); }, [seeAll]);

  async function onCheckIn() {
    await run(async () => {
      const coords = await getCoords();
      await checkIn(actor.uid, actor.name, coords, actor);
    }, "Checked in.");
  }

  async function onCheckOut() {
    await run(async () => {
      const coords = await getCoords();
      await checkOut(actor.uid, coords, actor);
    }, "Checked out.");
  }

  async function onRequestLeave() {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) return;
    await run(async () => {
      const requestId = await createLeaveRequest(leaveForm, actor);
      setLeaveFormOpen(false);
      setLeaveForm(BLANK_LEAVE_FORM);
      void notifyLeaveRequest(requestId, "submitted");
    }, "Leave requested.");
  }

  async function onDecide(request: LeaveRequest, approve: boolean) {
    await run(async () => {
      await decideLeaveRequest(request, approve, actor);
      void notifyLeaveRequest(request.id, "decided");
    }, approve ? "Leave approved." : "Leave rejected.");
  }

  async function onCancel(request: LeaveRequest) {
    await run(() => cancelLeaveRequest(request, actor), "Leave request cancelled.");
  }

  const presentDays = (rows ?? []).filter((r) => r.status === "PRESENT").length;
  const absentDays = (rows ?? []).filter((r) => r.status === "ABSENT").length;
  const leaveDays = (rows ?? []).filter((r) => r.status === "ON_LEAVE").length;
  const pendingLeave = allLeave.filter((r) => r.status === "PENDING");

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Daily check-in/check-out, a monthly record, and leave requests for the whole team."
        actions={
          <>
            <Button variant="secondary" onClick={() => setLeaveFormOpen(true)}><CalendarPlus className="h-4 w-4" /> Request Leave</Button>
            {!todayRecord?.checkIn && <Button variant="primary" loading={busy} onClick={() => void onCheckIn()}><LogIn className="h-4 w-4" /> Check in</Button>}
            {todayRecord?.checkIn && !todayRecord?.checkOut && <Button variant="primary" loading={busy} onClick={() => void onCheckOut()}><LogOut className="h-4 w-4" /> Check out</Button>}
            {todayRecord?.checkOut && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Done for today</Badge>}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={tab === "mine" ? "primary" : "secondary"} onClick={() => setTab("mine")}>My Attendance</Button>
        {seeAll && <Button variant={tab === "team" ? "primary" : "secondary"} onClick={() => setTab("team")}>Team</Button>}
        <Button variant={tab === "leave" ? "primary" : "secondary"} onClick={() => setTab("leave")}>
          Leave{seeAll && pendingLeave.length > 0 ? ` (${pendingLeave.length} pending)` : ""}
        </Button>
      </div>

      {tab === "mine" && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="Present days" value={presentDays} tone="positive" />
            <StatCard label="Absent days" value={absentDays} tone="negative" />
            <StatCard label="Leave days" value={leaveDays} />
          </div>

          {!rows ? (
            <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="h-8 w-8" />} title="No attendance recorded this month yet" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
              <table className="w-full">
                <thead><tr><th className="th">Date</th><th className="th">Status</th><th className="th">Check in</th><th className="th">Check out</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-ink-100">
                      <td className="td">{r.date}</td>
                      <td className="td"><Badge className={ATTENDANCE_STATUS_COLOR[r.status]}>{ATTENDANCE_STATUS_LABEL[r.status]}</Badge></td>
                      <td className="td">{r.checkIn?.at ? formatDateTime(r.checkIn.at) : "—"}</td>
                      <td className="td">{r.checkOut?.at ? formatDateTime(r.checkOut.at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "team" && (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Employee</th><th className="th">Status</th><th className="th">Check in</th><th className="th">Check out</th></tr></thead>
            <tbody>
              {!teamRows || teamRows.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-ink-400">No records this month.</td></tr>
              ) : teamRows.map((r) => (
                <tr key={r.id} className="border-t border-ink-100">
                  <td className="td">{r.date}</td>
                  <td className="td">{users.find((u) => u.uid === r.uid)?.name ?? r.userName}</td>
                  <td className="td"><Badge className={ATTENDANCE_STATUS_COLOR[r.status]}>{ATTENDANCE_STATUS_LABEL[r.status]}</Badge></td>
                  <td className="td">{r.checkIn?.at ? formatDateTime(r.checkIn.at) : "—"}</td>
                  <td className="td">{r.checkOut?.at ? formatDateTime(r.checkOut.at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "leave" && (
        <div className="space-y-6">
          {seeAll && pendingLeave.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink-900">Pending approvals</h2>
              <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
                <table className="w-full">
                  <thead><tr><th className="th">Employee</th><th className="th">Type</th><th className="th">Dates</th><th className="th">Reason</th><th className="th"></th></tr></thead>
                  <tbody>
                    {pendingLeave.map((r) => (
                      <tr key={r.id} className="border-t border-ink-100">
                        <td className="td font-medium">{r.userName}</td>
                        <td className="td">{LEAVE_TYPE_LABEL[r.leaveType]}</td>
                        <td className="td">{formatDate(r.startDate)} – {formatDate(r.endDate)}</td>
                        <td className="td text-ink-600">{r.reason}</td>
                        <td className="td text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" loading={busy} onClick={() => void onDecide(r, false)}>Reject</Button>
                            <Button size="sm" variant="primary" loading={busy} onClick={() => void onDecide(r, true)}>Approve</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink-900">My leave requests</h2>
            {myLeave.length === 0 ? (
              <EmptyState icon={<CalendarPlus className="h-8 w-8" />} title="No leave requests yet" description="Use Request Leave above to ask for time off." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
                <table className="w-full">
                  <thead><tr><th className="th">Type</th><th className="th">Dates</th><th className="th">Reason</th><th className="th">Status</th><th className="th"></th></tr></thead>
                  <tbody>
                    {myLeave.map((r) => (
                      <tr key={r.id} className="border-t border-ink-100">
                        <td className="td">{LEAVE_TYPE_LABEL[r.leaveType]}</td>
                        <td className="td">{formatDate(r.startDate)} – {formatDate(r.endDate)}</td>
                        <td className="td text-ink-600">{r.reason}</td>
                        <td className="td"><Badge className={LEAVE_REQUEST_STATUS_META[r.status].className}>{LEAVE_REQUEST_STATUS_META[r.status].label}</Badge></td>
                        <td className="td text-right">
                          {r.status === "PENDING" && (
                            <button className="text-xs font-medium text-rose-600 hover:underline" onClick={() => void onCancel(r)} disabled={busy}>Cancel</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={leaveFormOpen}
        onClose={() => setLeaveFormOpen(false)}
        title="Request Leave"
        footer={<><Button variant="secondary" onClick={() => setLeaveFormOpen(false)}>Cancel</Button><Button onClick={() => void onRequestLeave()} loading={busy}>Submit</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Leave type" required className="col-span-2">
            <Select value={leaveForm.leaveType} options={LEAVE_TYPES.map((t) => ({ value: t, label: LEAVE_TYPE_LABEL[t] }))} onChange={(e) => setLeaveForm((f) => ({ ...f, leaveType: e.target.value as LeaveType }))} />
          </Field>
          <Field label="Start date" required><Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
          <Field label="End date" required><Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} /></Field>
          <Field label="Reason" required className="col-span-2"><Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
