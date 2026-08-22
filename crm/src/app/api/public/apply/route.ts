import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { LEAD_TYPE_CODE, LEAD_TYPE_LABEL, type LeadType } from "@/lib/constants";
import { adminDb } from "@/lib/firebase/admin";
import { buildSearchTokens, isValidEmail, isValidPhone, normalisePhone } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated intake for the livantogreen.com marketing site's
 * "Apply now" form — a different origin from the CRM itself, so this needs
 * its own CORS handling (unlike the CRM's other /api/public routes, which
 * are only ever called same-origin from a page the CRM itself serves).
 *
 * Writes straight to Firestore via the Admin SDK, the same way the OCPP
 * server and the other public routes bypass security rules — there is no
 * signed-in user here to satisfy `leads/{id}`'s create rule.
 */

const ALLOWED_ORIGINS = (
  process.env.PUBLIC_WEBSITE_ORIGINS
    ?? "https://livantogreen.com,https://www.livantogreen.com,http://localhost:8080,http://localhost:3000"
).split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Every option the public form's "I'm interested in" select can send. */
const INTEREST_TO_LEAD_TYPE: Record<string, LeadType> = {
  FRANCHISE: "FRANCHISE",
  SITE: "SITE",
  CHARGER_SALE: "CHARGER_SALE",
  CORPORATE: "CORPORATE",
  RWA: "RWA",
  GOVERNMENT: "GOVERNMENT",
};

const Body = z.object({
  interest: z.enum(["FRANCHISE", "SITE", "CHARGER_SALE", "CORPORATE", "RWA", "GOVERNMENT"]),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(15),
  email: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).optional(),
  message: z.string().trim().max(2000).optional(),
  entityType: z.enum(["INDIVIDUAL", "FIRM"]).default("INDIVIDUAL"),
  company: z.string().trim().max(160).optional(),
  gstin: z.string().trim().max(20).optional(),
  /** Client's Date.now() at page load, used only for a soft bot-timing check. */
  loadedAtMs: z.number().optional(),
});

async function nextLeadCode(type: LeadType): Promise<string> {
  const db = adminDb();
  const ref = db.collection("counters").doc("leads");
  const field = type.toLowerCase();
  const prefix = LEAD_TYPE_CODE[type];

  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? (snap.data()?.[field] as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { [field]: next }, { merge: true });
    return next;
  });

  return `LG-${prefix}-${String(seq).padStart(6, "0")}`;
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Please fill in the form correctly and try again." }, { status: 400, headers });
  }

  if (!isValidPhone(body.phone)) {
    return NextResponse.json({ error: "Please enter a valid 10-digit Indian mobile number." }, { status: 400, headers });
  }
  if (body.email && !isValidEmail(body.email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400, headers });
  }

  const type = INTEREST_TO_LEAD_TYPE[body.interest];
  const phone = normalisePhone(body.phone);
  // A submission completed within ~1.2s of the page loading is almost
  // certainly a bot — too fast for a human to have read and filled the
  // form. Flag rather than reject, so a genuinely fast human (autofill)
  // isn't silently dropped; a Sales Manager can still see and dismiss it.
  const suspiciouslyFast = typeof body.loadedAtMs === "number" && Date.now() - body.loadedAtMs < 1200;

  const db = adminDb();
  const code = await nextLeadCode(type);
  const ref = db.collection("leads").doc();
  const now = FieldValue.serverTimestamp();

  const client = {
    name: body.name,
    phone,
    email: body.email || "",
    city: body.city,
    state: body.state || "",
    entityType: body.entityType,
    ...(body.entityType === "FIRM" ? { company: body.company || "", gstin: body.gstin || "" } : {}),
  };

  const remarksParts = [
    `Submitted via livantogreen.com — "${LEAD_TYPE_LABEL[type]}" enquiry.`,
    body.message ? `Message: ${body.message}` : null,
  ].filter(Boolean);

  await ref.set({
    code,
    type,
    stage: "NEW",
    status: "ACTIVE",
    client,
    source: "WEBSITE",
    sourceDetail: "livantogreen.com — Apply now form",
    config: [],
    extras: [],
    discount: 0,
    oem: null,
    commercialModel: null,
    quote: { subtotal: 0, discount: 0, gst: 0, grandTotal: 0, totalKw: 0, unitCount: 0, effectiveGstPct: 0 },
    value: 0,
    financing: {
      mode: "SELF", stage: "NOT_APPLICABLE", bank: "", requestedAmount: null, sanctionedAmount: null,
      disbursedAmount: null, interestRate: null, tenureYears: null, emi: null, applicationNo: "", note: "",
      cibilScore: null, cibilCheckedAt: null,
    },
    eoi: null,
    linkedLeads: [],
    partnerId: null,
    partnerName: null,
    site: { remarks: remarksParts.join(" ") },
    ownerId: "",
    ownerName: "Unassigned (website)",
    tags: ["website-inquiry", ...(suspiciouslyFast ? ["flag:fast-submit"] : [])],
    paidAmount: 0,
    dueAmount: 0,
    docCount: 0,
    lastActivityAt: now,
    createdAt: now,
    createdBy: { uid: "website", name: "livantogreen.com", role: "AGENT" },
    updatedAt: now,
    search: buildSearchTokens(body.name, phone, body.email, body.company, body.city, code),
  });

  await db.collection("activities").add({
    leadId: ref.id,
    ownerId: "",
    leadCode: code,
    leadName: body.name,
    type: "CREATED",
    message: `New enquiry submitted via livantogreen.com (${LEAD_TYPE_LABEL[type]}).`,
    changes: [],
    actor: { uid: "website", name: "livantogreen.com", role: "AGENT" },
    at: now,
    followUpAt: null,
    mentions: [],
  });

  return NextResponse.json({ ok: true, code }, { status: 201, headers });
}
