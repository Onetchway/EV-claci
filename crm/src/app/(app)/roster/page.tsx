"use client";

import { useEffect, useMemo, useState } from "react";

import { useActor, useAuth, useViewer } from "@/components/auth-provider";
import { Badge, Button, Card, PageHeader, Spinner, useAsyncAction } from "@/components/ui";
import { WEEK_DAYS } from "@/lib/constants";
import { WEEK_DAY_LABEL, addDays, mondayOf, parseYmd, weekDates } from "@/lib/dates";
import {
  blankRosterWeek, saveRosterWeek, subscribeMyRosterWeek, subscribeRosterForWeek,
} from "@/lib/db/roster";
import { subscribeUsers } from "@/lib/db/users";
import { canManageHrms, canSeeAllHrms } from "@/lib/permissions";
import type { AppUser, RosterWeek } from "@/lib/types";
import { downloadCsv, formatDate } from "@/lib/utils";

function WeekNav({ weekStart, onChange }: { weekStart: string; onChange: (next: string) => void }) {
  const dates = weekDates(weekStart);
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => onChange(mondayOf(addDays(parseYmd(weekStart), -7)))}>Prev</Button>
      <span className="text-sm font-medium text-ink-800">
        {formatDate(dates.MON)} – {formatDate(dates.SUN)}
      </span>
      <Button size="sm" onClick={() => onChange(mondayOf(addDays(parseYmd(weekStart), 7)))}>Next</Button>
      <Button size="sm" onClick={() => onChange(mondayOf(new Date()))}>This week</Button>
    </div>
  );
}

function MyRosterView({ weekStart }: { weekStart: string }) {
  const { profile } = useAuth();
  const [row, setRow] = useState<RosterWeek | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    return subscribeMyRosterWeek(profile.uid, weekStart, (r) => { setRow(r); setLoading(false); }, () => setLoading(false));
  }, [profile, weekStart]);

  const dates = weekDates(weekStart);

  return (
    <Card title="Your week">
      {loading ? (
        <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
      ) : !row ? (
        <p className="py-4 text-center text-sm text-ink-500">No roster has been set for this week yet.</p>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {WEEK_DAYS.map((wd) => (
            <div key={wd} className="rounded-lg border border-ink-200 p-2 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{WEEK_DAY_LABEL[wd]}</p>
              <p className="text-xs text-ink-400">{formatDate(dates[wd])}</p>
              <Badge className={row.days[wd] === "WORKING" ? "mt-1 bg-emerald-100 text-emerald-800 ring-emerald-200" : "mt-1 bg-ink-100 text-ink-600 ring-ink-200"}>
                {row.days[wd] === "WORKING" ? "Working" : "Week off"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TeamRosterView({ weekStart }: { weekStart: string }) {
  const actor = useActor();
  const viewer = useViewer();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [rosters, setRosters] = useState<RosterWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeUsers(setUsers), []);
  useEffect(() => {
    setLoading(true);
    return subscribeRosterForWeek(weekStart, (r) => { setRosters(r); setLoading(false); }, () => setLoading(false));
  }, [weekStart]);

  const byUid = useMemo(() => new Map(rosters.map((r) => [r.uid, r])), [rosters]);
  const activeUsers = useMemo(() => {
    const active = users.filter((u) => u.active !== false);
    return canSeeAllHrms(viewer) ? active : active.filter((u) => u.managerId === viewer.uid);
  }, [users, viewer]);
  const dates = weekDates(weekStart);

  const [draft, setDraft] = useState<Map<string, RosterWeek>>(new Map());

  function rowFor(u: AppUser): RosterWeek {
    return draft.get(u.uid) ?? byUid.get(u.uid) ?? blankRosterWeek(u.uid, u.name, weekStart);
  }

  function toggleDay(u: AppUser, wd: (typeof WEEK_DAYS)[number]) {
    const current = rowFor(u);
    const next: RosterWeek = { ...current, days: { ...current.days, [wd]: current.days[wd] === "WORKING" ? "WEEK_OFF" : "WORKING" } };
    setDraft((d) => new Map(d).set(u.uid, next));
  }

  async function saveAll() {
    const targets = [...draft.values()];
    for (const r of targets) await saveRosterWeek(r.uid, r.userName, weekStart, r.days, actor);
    setDraft(new Map());
  }

  function downloadWeekly() {
    const header = ["Employee", ...WEEK_DAYS.map((wd) => `${WEEK_DAY_LABEL[wd]} ${formatDate(dates[wd])}`)];
    const csvRows = [header, ...activeUsers.map((u) => {
      const r = rowFor(u);
      return [u.name, ...WEEK_DAYS.map((wd) => (r.days[wd] === "WORKING" ? "Working" : "Week off"))];
    })];
    downloadCsv(`livanto-roster-${weekStart}.csv`, csvRows);
  }

  return (
    <Card
      title="Team roster"
      subtitle="Click a day to toggle Working / Week-off, then save."
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={downloadWeekly}>Download CSV</Button>
          {draft.size > 0 && (
            <Button size="sm" variant="primary" loading={busy} onClick={() => void run(saveAll, "Roster saved.")}>
              Save {draft.size} change{draft.size === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Employee</th>
                {WEEK_DAYS.map((wd) => <th key={wd} className="th text-center">{WEEK_DAY_LABEL[wd]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {activeUsers.map((u) => {
                const r = rowFor(u);
                return (
                  <tr key={u.uid}>
                    <td className="td font-medium text-ink-900">{u.name}</td>
                    {WEEK_DAYS.map((wd) => (
                      <td key={wd} className="td text-center">
                        <button
                          type="button"
                          onClick={() => toggleDay(u, wd)}
                          className={`rounded px-2 py-1 text-[11px] font-medium ${r.days[wd] === "WORKING" ? "bg-emerald-100 text-emerald-800" : "bg-ink-100 text-ink-500"}`}
                        >
                          {r.days[wd] === "WORKING" ? "Work" : "Off"}
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function RosterPage() {
  const viewer = useViewer();
  const manages = canManageHrms(viewer);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  return (
    <>
      <PageHeader
        title="Roster"
        description={manages ? "Build the week's working/week-off pattern for the whole team." : "Your working days for the selected week."}
        actions={<WeekNav weekStart={weekStart} onChange={setWeekStart} />}
      />

      {manages ? <TeamRosterView weekStart={weekStart} /> : <MyRosterView weekStart={weekStart} />}
    </>
  );
}
