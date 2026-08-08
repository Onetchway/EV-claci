"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import {
  markAllNotificationsRead, markNotificationRead, subscribeMyNotifications,
} from "@/lib/db/notifications";
import type { AppNotification } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

export function NotificationBell({ uid }: { uid: string }) {
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeMyNotifications(uid, setRows), [uid]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = rows.filter((r) => !r.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => void markAllNotificationsRead(rows)}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto scroll-thin">
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-500">You&apos;re all caught up.</p>
            ) : (
              rows.map((n) => {
                const content = (
                  <div className={`px-3 py-2.5 hover:bg-ink-50 ${!n.read ? "bg-brand-50/60" : ""}`}>
                    <p className="text-sm font-medium text-ink-900">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-600">{n.body}</p>
                    <p className="mt-1 text-[11px] text-ink-400">{formatRelative(n.createdAt)}</p>
                  </div>
                );
                return n.leadId ? (
                  <Link
                    key={n.id}
                    href={`/leads/${n.leadId}`}
                    onClick={() => { if (!n.read) void markNotificationRead(n.id); setOpen(false); }}
                    className="block border-b border-ink-50 last:border-0"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.read) void markNotificationRead(n.id); }}
                    className="block w-full border-b border-ink-50 text-left last:border-0"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
