"use client";

import { useEffect, useMemo, useState } from "react";
import { KanbanSquare } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Badge, Button, EmptyState, PageHeader, useAsyncAction } from "@/components/ui";
import { WEEK_DAY_LABEL, WEEK_DAYS, type WeekDay } from "@/lib/constants";
import { addDaysYmd, mondayOf } from "@/lib/dates";
import { blankRosterWeek, saveRosterWeek, subscribeMyRosterWeek, subscribeRosterForWeek } from "@/lib/db/roster";
import { subscribeActiveUsers } from "@/lib/db/users";
import { canSeeAllHrms } from "@/lib/permissions";
import type { AppUser, RosterWeek } from "@/lib/types";

export default function RosterPage() {
  const actor = useActor();
  const viewer = useViewer();
  const seeAll = canSeeAllHrms(viewer);
  const { busy, run } = useAsyncAction();

  const weekStart = useMemo(() => mondayOf(new Date()), []);
  const weekLabel = `${weekStart} — ${addDaysYmd(weekStart, 6)}`;

  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [mine, setMine] = useState<RosterWeek | null>(null);
  const [teamWeek, setTeamWeek] = useState<RosterWeek[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => subscribeMyRosterWeek(actor.uid, weekStart, setMine), [actor.uid, weekStart]);
  useEffect(() => { if (seeAll && tab === "team") return subscribeRosterForWeek(weekStart, setTeamWeek); }, [seeAll, tab, weekStart]);
  useEffect(() => { if (seeAll) return subscribeActiveUsers(setUsers); }, [seeAll]);

  const days = mine?.days ?? blankRosterWeek(actor.uid, actor.name, weekStart).days;

  async function toggleDay(day: WeekDay) {
    const next = { ...days, [day]: days[day] === "WORKING" ? "WEEK_OFF" : "WORKING" } as Record<WeekDay, "WORKING" | "WEEK_OFF">;
    await run(() => saveRosterWeek(actor.uid, actor.name, weekStart, next, actor), "Roster saved.");
  }

  return (
    <div>
      <PageHeader title="Roster" description={`Working days vs. week-off for the current week (${weekLabel}).`} />

      {seeAll && (
        <div className="mb-4 flex gap-2">
          <Button variant={tab === "mine" ? "primary" : "secondary"} onClick={() => setTab("mine")}>My Roster</Button>
          <Button variant={tab === "team" ? "primary" : "secondary"} onClick={() => setTab("team")}>Team</Button>
        </div>
      )}

      {tab === "team" && users.length === 0 ? (
        <EmptyState icon={<KanbanSquare className="h-8 w-8" />} title="No employees yet" />
      ) : tab === "mine" ? (
        <div className="card card-pad">
          <div className="grid grid-cols-7 gap-2">
            {WEEK_DAYS.map((d) => (
              <button
                key={d}
                disabled={busy}
                onClick={() => void toggleDay(d)}
                className={`rounded-xl border px-3 py-4 text-center text-sm font-medium transition ${
                  days[d] === "WORKING"
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-ink-200 bg-ink-50 text-ink-500"
                }`}
              >
                <p className="text-xs uppercase tracking-wide">{WEEK_DAY_LABEL[d]}</p>
                <p className="mt-1 text-[11px]">{days[d] === "WORKING" ? "Working" : "Week off"}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Employee</th>
                {WEEK_DAYS.map((d) => <th key={d} className="th text-center">{WEEK_DAY_LABEL[d]}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={8} className="td text-center text-ink-400">No employees to show.</td></tr>
              ) : users.map((u) => {
                const week = teamWeek.find((w) => w.uid === u.uid);
                const rowDays = week?.days ?? blankRosterWeek(u.uid, u.name, weekStart).days;
                return (
                  <tr key={u.uid} className="border-t border-ink-100">
                    <td className="td font-medium">{u.name}</td>
                    {WEEK_DAYS.map((d) => (
                      <td key={d} className="td text-center">
                        <Badge className={rowDays[d] === "WORKING" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                          {rowDays[d] === "WORKING" ? "W" : "Off"}
                        </Badge>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
