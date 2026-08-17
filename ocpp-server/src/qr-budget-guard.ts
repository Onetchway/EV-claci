/**
 * App-less QR charging is prepaid — a walk-up user with no account pays a
 * fixed amount via Razorpay before the session starts (see the CRM's
 * api/public/qr-charge/* routes), and there's no wallet to keep debiting
 * and no invoice to bill an overage to afterward. Without a stop-at-budget
 * guard, a session could keep drawing energy past what was actually paid
 * for — this sweep estimates the live cost of every active QR session
 * against the tariff and sends RequestStopTransaction once it reaches the
 * prepaid amount.
 *
 * Deliberately an estimate, not exact: it reads the same energyDeliveredWh
 * MeterValues already keep current, run through the same resolveTariff/
 * computeCost billSession() uses at the real, final billing moment — this
 * sweep only ever stops early, never bills, so an estimate that runs a
 * little conservative just means stopping a little before the exact
 * budget, not an incorrect final charge.
 */

import { db } from "./firebase.js";
import { sendCommand } from "./ocpp/commands.js";
import { connections } from "./registry.js";
import { computeCost, resolveTariff } from "./tariff.js";

export async function sweepQrBudgets(): Promise<void> {
  const activeQr = await db().collection("qrChargeSessions").where("status", "==", "ACTIVE").get();
  if (activeQr.empty) return;

  for (const qrDoc of activeQr.docs) {
    const { chargerId, amountInr } = qrDoc.data() as { chargerId: string; amountInr: number };
    const idToken = qrDoc.id;
    if (!connections.has(chargerId)) continue; // not held by this instance — same limitation as every other remote command

    try {
      const sessSnap = await db()
        .collection("chargeSessions")
        .where("chargePointId", "==", chargerId)
        .where("idToken", "==", idToken)
        .where("status", "==", "ACTIVE")
        .limit(1)
        .get();
      if (sessSnap.empty) continue;
      const session = sessSnap.docs[0]!.data();
      const energyDeliveredWh = (session.energyDeliveredWh as number | undefined) ?? 0;
      if (energyDeliveredWh <= 0) continue;

      const startedAt = (session.startedAt as { toDate?: () => Date } | undefined)?.toDate?.();
      const durationMinutes = startedAt ? Math.max(0, (Date.now() - startedAt.getTime()) / 60000) : 0;
      const tariff = await resolveTariff(chargerId, new Date(), session.connectorId as number | undefined, idToken);
      if (!tariff) continue;

      const estimate = computeCost(tariff, energyDeliveredWh, durationMinutes, (session.idleMinutes as number | undefined) ?? 0);
      if (estimate.totalCostInr >= amountInr) {
        await sendCommand(chargerId, "RequestStopTransaction", { transactionId: session.transactionId });
        console.log(`[qr-budget] stopped ${chargerId}/${idToken} — estimated ₹${estimate.totalCostInr} reached the ₹${amountInr} prepaid amount`);
      }
    } catch (err) {
      console.error(`[qr-budget] sweep failed for ${chargerId}/${idToken}:`, (err as Error).message);
    }
  }
}
