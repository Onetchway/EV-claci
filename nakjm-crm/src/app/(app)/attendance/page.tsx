"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, LogIn, LogOut } from "lucide-react";

import { useActor, useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, PageHeader, Spinner, StatCard, useAsyncAction,
} from "@/components/ui";
import { ATTENDANCE_STATUS_COLOR, ATTENDANCE_STATUS_LABEL } from "@/lib/constants";
import { checkIn, checkOut, subscribeAttendanceRange, subscribeMyAttendanceMonth } from "@/lib/db/attendance";
import { monthRange, ymd } from "@/lib/dates";
import { subscribeActiveUsers } from "@/lib/db/users";
import { canSeeAllHrms } from "@/lib/permissions";
import type { AppUser, AttendanceRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

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

export default function AttendancePage() {
  const { profile } = useAuth();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();
  const seeAll = canSeeAllHrms(viewer);

  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [rows, setRows] = useState<AttendanceRecord[] | null>(null);
  const [teamRows, setTeamRows] = useState<AttendanceRecord[] | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);

  const { start, end } = useMemo(() => monthRange(new Date()), []);
  const today = ymd(new Date());
  const todayRecord = (rows ?? []).find((r) => r.date === today);

  useEffect(() => subscribeMyAttendanceMonth(profile!.uid, start, end, setRows), [profile, start, end]);
  useEffect(() => { if (seeAll && tab === "team") return subscribeAttendanceRange(start, end, setTeamRows); }, [seeAll, tab, start, end]);
  useEffect(() => { if (seeAll) return subscribeActiveUsers(setUsers); }, [seeAll]);

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

  const presentDays = (rows ?? []).filter((r) => r.status === "PRESENT").length;
  const absentDays = (rows ?? []).filter((r) => r.status === "ABSENT").length;
  const leaveDays = (rows ?? []).filter((r) => r.status === "ON_LEAVE").length;

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Daily check-in/check-out and a monthly record for the whole team."
        actions={
          <>
            {!todayRecord?.checkIn && <Button variant="primary" loading={busy} onClick={() => void onCheckIn()}><LogIn className="h-4 w-4" /> Check in</Button>}
            {todayRecord?.checkIn && !todayRecord?.checkOut && <Button variant="primary" loading={busy} onClick={() => void onCheckOut()}><LogOut className="h-4 w-4" /> Check out</Button>}
            {todayRecord?.checkOut && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Done for today</Badge>}
          </>
        }
      />

      {seeAll && (
        <div className="mb-4 flex gap-2">
          <Button variant={tab === "mine" ? "primary" : "secondary"} onClick={() => setTab("mine")}>My Attendance</Button>
          <Button variant={tab === "team" ? "primary" : "secondary"} onClick={() => setTab("team")}>Team</Button>
        </div>
      )}

      {tab === "mine" ? (
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
      ) : (
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
    </div>
  );
}
