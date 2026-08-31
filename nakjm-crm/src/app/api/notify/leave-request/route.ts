import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { emailConfigured, sendEmail } from "@/lib/email";
import { ApiError, errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  requestId: z.string().min(1),
  type: z.enum(["submitted", "decided"]),
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.nakjminfra.com";

/**
 * Best-effort email notification for the leave-request workflow. Never
 * blocks the caller's own action on this succeeding -- the Firestore write
 * (create/decide) already happened before this is called; if SMTP isn't
 * configured, sendEmail just logs and returns, so this route always answers
 * 200 either way.
 */
export async function POST(req: Request) {
  try {
    await requireCaller(req, "VIEWER");
    const { requestId, type } = Body.parse(await req.json());

    const db = adminDb();
    const reqSnap = await db.collection("leaveRequests").doc(requestId).get();
    if (!reqSnap.exists) throw new ApiError("Leave request not found.", 404);
    const leave = reqSnap.data() as {
      uid: string; userName: string; leaveType: string; startDate: string; endDate: string;
      reason: string; status: string;
    };

    if (!emailConfigured()) return NextResponse.json({ ok: true, sent: false });

    if (type === "submitted") {
      const admins = await db.collection("users").where("role", "in", ["ADMIN", "SUPER_ADMIN"]).where("active", "==", true).get();
      const emails = admins.docs.map((d) => (d.data() as { email?: string }).email).filter((e): e is string => !!e);
      if (emails.length > 0) {
        await sendEmail({
          to: emails,
          subject: `Leave request from ${leave.userName}`,
          html: `<p><strong>${leave.userName}</strong> requested ${leave.leaveType.toLowerCase()} leave from ${leave.startDate} to ${leave.endDate}.</p><p>${leave.reason}</p><p><a href="${APP_URL}/attendance">Review in NAKJM CRM</a></p>`,
        });
      }
    } else {
      const userSnap = await db.collection("users").doc(leave.uid).get();
      const email = (userSnap.data() as { email?: string } | undefined)?.email;
      if (email) {
        await sendEmail({
          to: email,
          subject: `Your leave request was ${leave.status.toLowerCase()}`,
          html: `<p>Your ${leave.leaveType.toLowerCase()} leave request (${leave.startDate} to ${leave.endDate}) was <strong>${leave.status.toLowerCase()}</strong>.</p><p><a href="${APP_URL}/attendance">View in NAKJM CRM</a></p>`,
        });
      }
    }

    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    return errorResponse(err);
  }
}
