/**
 * One-time bootstrap.
 *
 *   npm run seed
 *
 * Creates the super-admin account (so somebody can sign in at all), the lead
 * code counter, and — when SEED_DEMO_DATA=1 — a few representative leads
 * including the site enquiry the CRM was specced against.
 *
 * Safe to re-run: every write is keyed and idempotent.
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildQuote, type ConfigItem } from "../src/lib/pricing";
import type { Role } from "../src/lib/constants";

// --- env ---------------------------------------------------------------------

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!m) continue;
        const [, key, rawValue] = m;
        if (process.env[key!] !== undefined) continue;
        process.env[key!] = rawValue!.trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      /* file is optional */
    }
  }
}

loadEnv();

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json);
    return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "\nMissing Firebase Admin credentials.\n" +
        "Set FIREBASE_SERVICE_ACCOUNT_KEY (JSON or base64) in crm/.env.local,\n" +
        "or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.\n",
    );
    process.exit(1);
  }
  return { projectId, clientEmail, privateKey };
}

if (!getApps().length) initializeApp({ credential: cert(credentials()) });
const auth = getAuth();
const db = getFirestore();

// --- helpers -----------------------------------------------------------------

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function upsertUser(params: {
  email: string;
  name: string;
  role: Role;
  phone?: string;
  password?: string;
}): Promise<{ uid: string; password?: string }> {
  const existing = await auth.getUserByEmail(params.email).catch(() => null);
  const password = params.password || randomPassword();

  const uid = existing
    ? existing.uid
    : (await auth.createUser({
        email: params.email,
        password,
        displayName: params.name,
      })).uid;

  await auth.setCustomUserClaims(uid, { role: params.role });

  await db.collection("users").doc(uid).set(
    {
      uid,
      email: params.email,
      name: params.name,
      phone: params.phone ?? "",
      role: params.role,
      managerId: null,
      region: null,
      active: true,
      photoURL: null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: null,
    },
    { merge: true },
  );

  return { uid, password: existing ? undefined : password };
}

async function nextCode(kind: "franchise" | "site"): Promise<string> {
  const ref = db.collection("counters").doc("leads");
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? (snap.data()?.[kind] as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { [kind]: next }, { merge: true });
    return next;
  });
  return `LG-${kind === "site" ? "ST" : "FR"}-${String(seq).padStart(6, "0")}`;
}

function tokens(...parts: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    const clean = p.toLowerCase().trim();
    out.add(clean);
    for (const w of clean.split(/[\s,./-]+/)) {
      if (w.length < 2) continue;
      for (let i = 2; i <= Math.min(w.length, 12); i++) out.add(w.slice(0, i));
    }
  }
  return [...out].slice(0, 250);
}

interface DemoLead {
  type: "FRANCHISE" | "SITE";
  stage: string;
  status: string;
  client: Record<string, string>;
  source: string;
  config: ConfigItem[];
  site?: Record<string, unknown>;
  daysAgo: number;
}

const DEMO: DemoLead[] = [
  {
    // The reference enquiry this CRM was designed around.
    type: "SITE",
    stage: "CONTACTED",
    status: "ACTIVE",
    source: "DIRECT_CALL",
    client: {
      name: "Shoyeb Khan",
      phone: "7028297300",
      email: "",
      city: "Vayusena Nagar",
      state: "Maharashtra",
    },
    config: [{ sku: "DC-90", qty: 1 }],
    site: {
      locationName: "Kkal Layadi",
      mapsLink: "https://maps.app.goo.gl/5KaVs33msPiafpTQ8?g_st=ac",
      lat: null,
      lng: null,
      locationTypes: ["HIGHWAY", "RING_ROAD"],
      ownership: "OWNED",
      commercialModelInterested: true,
      powerLoad: "THREE_PHASE",
      sanctionedLoadKva: null,
      spaceAvailableSqft: null,
      nearbyLandmark: "",
      remarks:
        "Customer wants to install an EV charger outside his hotel; interested in a 90 kW unit.",
    },
    daysAgo: 2,
  },
  {
    type: "FRANCHISE",
    stage: "EOI",
    status: "ACTIVE",
    source: "LINKEDIN",
    client: { name: "Ritu Deshmukh", phone: "9822014477", email: "ritu.d@example.com", city: "Nagpur", state: "Maharashtra" },
    config: [{ sku: "DC-60", qty: 2 }, { sku: "DC-120", qty: 2 }],
    daysAgo: 21,
  },
  {
    type: "FRANCHISE",
    stage: "AGREEMENT",
    status: "ACTIVE",
    source: "CHANNEL_PARTNER",
    client: { name: "Harpreet Singh Bedi", phone: "9878012345", email: "hs.bedi@example.com", city: "Ludhiana", state: "Punjab" },
    config: [{ sku: "DC-180", qty: 1 }],
    daysAgo: 45,
  },
  {
    type: "FRANCHISE",
    stage: "HANDOVER",
    status: "WON",
    source: "REFERRAL",
    client: { name: "Meenakshi Iyer", phone: "9840055221", email: "m.iyer@example.com", city: "Coimbatore", state: "Tamil Nadu" },
    config: [{ sku: "DC-120", qty: 1 }],
    daysAgo: 120,
  },
  {
    type: "FRANCHISE",
    stage: "INTRODUCTION",
    status: "REJECTED",
    source: "META_ADS",
    client: { name: "Arvind Rathore", phone: "9829001122", email: "", city: "Jaipur", state: "Rajasthan" },
    config: [{ sku: "DC-360", qty: 1 }],
    daysAgo: 60,
  },
];

async function seedDemo(ownerUid: string, ownerName: string) {
  for (const d of DEMO) {
    const existing = await db
      .collection("leads")
      .where("client.phone", "==", d.client.phone)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.log(`  · ${d.client.name} already exists, skipping`);
      continue;
    }

    const code = await nextCode(d.type === "SITE" ? "site" : "franchise");
    const quote = buildQuote(d.config);
    const created = Timestamp.fromDate(new Date(Date.now() - d.daysAgo * 86_400_000));
    const actor = { uid: ownerUid, name: ownerName, role: "SUPER_ADMIN" as Role };

    const ref = db.collection("leads").doc();
    await ref.set({
      code,
      type: d.type,
      stage: d.stage,
      status: d.status,
      client: { altPhone: "", company: "", address: "", pan: "", gstin: "", ...d.client },
      source: d.source,
      sourceDetail: "",
      config: d.config,
      discount: 0,
      quote: {
        subtotal: quote.subtotal,
        discount: 0,
        gst: quote.gst,
        grandTotal: quote.grandTotal,
        totalKw: quote.totalKw,
        unitCount: quote.unitCount,
      },
      value: quote.grandTotal,
      site: d.site ?? {},
      ownerId: ownerUid,
      ownerName,
      tags: [],
      nextFollowUpAt: d.status === "ACTIVE" ? Timestamp.fromDate(new Date(Date.now() + 3 * 86_400_000)) : null,
      expectedCloseAt: null,
      rejection:
        d.status === "REJECTED"
          ? { reason: "BUDGET_CONSTRAINT", note: "Wanted 360 kW but could not arrange funding.", at: created, by: actor }
          : null,
      paidAmount: d.status === "WON" ? quote.grandTotal : 0,
      dueAmount: d.status === "WON" ? 0 : quote.grandTotal,
      docCount: 0,
      createdAt: created,
      createdBy: actor,
      updatedAt: created,
      updatedBy: actor,
      lastActivityAt: created,
      lastActivityBy: ownerName,
      search: tokens(d.client.name, d.client.phone, d.client.city, code, String(d.site?.locationName ?? "")),
    });

    await db.collection("activities").add({
      leadId: ref.id,
      ownerId: ownerUid,
      leadCode: code,
      leadName: d.client.name,
      type: "CREATED",
      message: `Lead created from ${d.source.replace(/_/g, " ").toLowerCase()} (seed data)`,
      changes: [],
      actor,
      at: created,
      followUpAt: null,
    });

    console.log(`  · ${code} — ${d.client.name} (${quote.grandTotal.toLocaleString("en-IN")})`);
  }
}

// --- main --------------------------------------------------------------------

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  if (!email) {
    console.error("Set SEED_SUPER_ADMIN_EMAIL in crm/.env.local first.");
    process.exit(1);
  }

  console.log("\nSeeding Livanto Green CRM\n");

  const { uid, password } = await upsertUser({
    email,
    name: process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin",
    role: "SUPER_ADMIN",
    password: process.env.SEED_SUPER_ADMIN_PASSWORD,
  });

  console.log(`✓ Super admin ready: ${email}`);
  if (password) {
    console.log(`  Temporary password: ${password}`);
    console.log("  Change it after your first sign-in.");
  } else {
    console.log("  (account already existed — password unchanged, role re-applied)");
  }

  await db.collection("counters").doc("leads").set({ franchise: 0, site: 0 }, { merge: true });
  console.log("✓ Lead code counter ready");

  if (process.env.SEED_DEMO_DATA === "1") {
    console.log("\nInserting demo leads:");
    await seedDemo(uid, process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin");
  }

  console.log("\nDone. Start the app with `npm run dev` and sign in.\n");
}

main().catch((err) => {
  console.error("\nSeeding failed:", err);
  process.exit(1);
});
