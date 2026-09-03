/**
 * Depot/fleet scheduled charging — sweeps chargingSchedules for rows whose
 * scheduledStartAt has arrived and fires the RequestStartTransaction the
 * CRM only ever queued. Runs on the same cadence family as the other
 * sweeps in tickets.ts/load-balancer.ts.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { db } from "./firebase.js";
import { sendCommand } from "./ocpp/commands.js";

const CHARGING_SCHEDULES = "chargingSchedules";

export async function sweepScheduledCharging(): Promise<void> {
  const now = Timestamp.now();
  const due = await db()
    .collection(CHARGING_SCHEDULES)
    .where("status", "==", "SCHEDULED")
    .where("scheduledStartAt", "<=", now)
    .get();

  for (const docSnap of due.docs) {
    const schedule = docSnap.data();
    const chargerId = schedule.chargerId as string;
    const idToken = schedule.idToken as string;
    const evseId = (schedule.evseId as number | undefined) ?? 1;

    try {
      await sendCommand(chargerId, "RequestStartTransaction", {
        remoteStartId: Date.now(),
        idToken: { idToken, type: "Central" },
        evseId,
      }, 15_000);
      await docSnap.ref.update({ status: "TRIGGERED", triggeredAt: FieldValue.serverTimestamp() });
    } catch (err) {
      await docSnap.ref.update({
        status: "FAILED",
        failReason: (err as Error).message || "Remote start failed.",
      });
      console.error(`[depot-scheduling] failed to start ${chargerId} for schedule ${docSnap.id}:`, err);
    }
  }
}
