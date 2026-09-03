/**
 * Monthly minimum-guarantee top-up for a site host's revenue share — the
 * "hybrid" model: the host gets whichever is higher, their %/flat share
 * or a guaranteed monthly minimum. Runs periodically (see index.ts); for
 * each zone with revenueShareMinGuaranteeInr set, once the calendar month
 * has actually turned over (checked against revenueShareGuaranteeMonth, so
 * a zone is only ever topped up once per month), sums the *previous*
 * month's "Site host" SESSION accruals and writes one GUARANTEE_TOPUP
 * entry for the shortfall, if any.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { db } from "./firebase.js";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthRange(now: Date): { start: Date; end: Date; key: string } {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end, key: monthKey(start) };
}

export async function sweepRevenueGuarantees(): Promise<void> {
  const now = new Date();
  const currentMonth = monthKey(now);

  const zonesSnap = await db()
    .collection("zones")
    .where("revenueShareMinGuaranteeInr", ">", 0)
    .get();

  for (const zoneDoc of zonesSnap.docs) {
    const zone = zoneDoc.data();
    const lastMonth = zone.revenueShareGuaranteeMonth as string | undefined;
    if (lastMonth === currentMonth) continue; // already processed this calendar month

    const { start, end, key } = previousMonthRange(now);
    if (lastMonth === key) continue; // previous month already topped up (re-run safety)

    const guarantee = zone.revenueShareMinGuaranteeInr as number;
    const accruedSnap = await db()
      .collection("siteRevenueShares")
      .where("zoneId", "==", zoneDoc.id)
      .where("recipientName", "==", "Site host")
      .where("kind", "==", "SESSION")
      .where("createdAt", ">=", Timestamp.fromDate(start))
      .where("createdAt", "<", Timestamp.fromDate(end))
      .get();
    const accrued = accruedSnap.docs.reduce((a, d) => a + ((d.data().shareAmountInr as number | undefined) ?? 0), 0);

    const shortfall = Math.round((guarantee - accrued) * 100) / 100;
    if (shortfall > 0) {
      await db().collection("siteRevenueShares").add({
        zoneId: zoneDoc.id,
        zoneName: (zone.name as string | undefined) ?? "Unknown site",
        recipientName: "Site host",
        kind: "GUARANTEE_TOPUP",
        grossAmountInr: accrued,
        shareType: "FIXED",
        shareRate: guarantee,
        shareAmountInr: shortfall,
        status: "PENDING",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await zoneDoc.ref.set({ revenueShareGuaranteeMonth: currentMonth }, { merge: true });
  }
}
