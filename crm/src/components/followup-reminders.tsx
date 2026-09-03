"use client";

import { useEffect, useRef } from "react";

import { useAuth } from "@/components/auth-provider";
import { subscribeLeads } from "@/lib/db/leads";
import { notifyFollowUpDueSafe } from "@/lib/db/notifications";
import type { Lead } from "@/lib/types";
import { toDate } from "@/lib/utils";

const RECHECK_MS = 30 * 60 * 1000;

/**
 * Headless — mounted once in the app shell. A lead's follow-up date arriving
 * used to only show up as a dashboard count; this puts a standing reminder
 * in the owner's own notification bell instead, re-appearing each day it
 * stays overdue (see notifyFollowUpDueSafe's doc comment for exactly how
 * "until they work on it" is enforced) — for their own active leads only.
 *
 * One live subscription for the session; a timer just re-evaluates the
 * already-cached rows against the current time (no extra Firestore reads)
 * so a follow-up that becomes due while the tab is left open — including
 * across a midnight rollover — still gets caught, not just ones due at
 * the moment the page loaded.
 */
export function FollowUpReminders() {
  const { profile } = useAuth();
  const rowsRef = useRef<Lead[]>([]);

  useEffect(() => {
    if (!profile) return;

    function checkDue() {
      const now = Date.now();
      for (const lead of rowsRef.current) {
        const due = toDate(lead.nextFollowUpAt)?.getTime();
        if (due && due <= now) {
          notifyFollowUpDueSafe({ id: lead.id, code: lead.code, clientName: lead.client?.name, ownerId: lead.ownerId });
        }
      }
    }

    const unsub = subscribeLeads(
      { ownerId: profile.uid, status: "ACTIVE", max: 3000 },
      (rows) => {
        rowsRef.current = rows;
        checkDue();
      },
    );
    const interval = setInterval(checkDue, RECHECK_MS);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [profile]);

  return null;
}
