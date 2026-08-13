/**
 * Wipes every lead in the CRM and replaces them with a fresh CSV — run from
 * the backend (Firebase Admin) instead of the browser Import button, which
 * is far slower at 3,000+ rows because every write goes through a client
 * transaction one row at a time.
 *
 * Usage (Google Cloud Shell, same auth as `npm run seed`):
 *
 *   gcloud config set project YOUR-PROJECT-ID
 *   npm run reset-leads -- --csv /path/to/livantoleads_cleaned.csv --confirm WIPE-EVERYTHING
 *
 * Safety:
 *  - Without --confirm WIPE-EVERYTHING (that exact phrase) the script only
 *    prints what it *would* delete/import and makes no writes — a dry run.
 *  - The wipe is a HARD delete: leads, and their payments/documents
 *    subcollections, are gone for good. There is no Trash step and no undo.
 *    This does not touch projects, partners, users, or tasks — only the
 *    `leads` collection.
 *
 * CSV must use the same headers as the app's Leads → Import template
 * (Type, Client Name, Phone, ... Agent). Agent names are fuzzy-matched
 * against real `users` accounts exactly like the in-app importer, so
 * ownership carries over instead of collapsing to whoever runs the script.
 */

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { parseFile } from "fast-csv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- env / auth (identical pattern to scripts/seed.ts) -----------------------

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

function args(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i++; } else { out[key] = true; }
  }
  return out;
}
const ARGS = args();

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json);
    return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return { projectId, clientEmail, privateKey };
  return null;
}

function projectId(): string | undefined {
  return (
    (ARGS.project as string | undefined) ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function init() {
  if (getApps().length) return;
  const sa = serviceAccount();
  if (sa) {
    initializeApp({ credential: cert(sa), projectId: sa.projectId });
    console.log(`Authenticated with a service-account key (project ${sa.projectId}).`);
    return;
  }
  const project = projectId();
  if (!project) {
    console.error(
      "\nCould not work out which Firebase project to use.\n\n" +
        "In Google Cloud Shell, run this first:\n" +
        "    gcloud config set project YOUR-PROJECT-ID\n\n" +
        "Or pass it directly:\n" +
        '    npm run reset-leads -- --project YOUR-PROJECT-ID --csv leads.csv --confirm WIPE-EVERYTHING\n',
    );
    process.exit(1);
  }
  try {
    initializeApp({ credential: applicationDefault(), projectId: project });
    console.log(`Authenticated as the signed-in Google account (project ${project}).`);
  } catch (err) {
    console.error(
      "\nNo Google credentials found. In Cloud Shell run:\n" +
        "    gcloud auth application-default login\n",
    );
    console.error(err);
    process.exit(1);
  }
}
init();
const db = getFirestore();

// --- constants (mirrors src/lib/constants.ts + src/lib/db/leads.ts) ---------

const LEAD_TYPE_CODE: Record<string, string> = {
  FRANCHISE: "FR", SITE: "ST", RWA: "RW", EPC: "EP", CHARGER_SALE: "CS",
  CORPORATE: "CO", GOVERNMENT: "GV", SOFTWARE: "SW", OTHERS: "OT",
};
const LEAD_TYPES = Object.keys(LEAD_TYPE_CODE);
const SOURCES = [
  "LINKEDIN", "INSTAGRAM", "META_ADS", "NEWSPAPER", "DIRECT_CALL", "REFERRAL",
  "CHANNEL_PARTNER", "WEBSITE", "WALK_IN", "EXHIBITION", "WHATSAPP", "OTHER",
];
const FUNDING_MODES = ["SELF", "BANK_LOAN", "PARTIAL_LOAN"];

const DEFAULT_FINANCING = {
  mode: "SELF", stage: "NOT_APPLICABLE", bank: "", requestedAmount: null,
  sanctionedAmount: null, disbursedAmount: null, interestRate: null,
  tenureYears: null, emi: null, applicationNo: "", note: "",
  cibilScore: null, cibilCheckedAt: null,
};

const EMPTY_QUOTE = {
  subtotal: 0, discount: 0, gst: 0, grandTotal: 0, totalKw: 0, unitCount: 0, effectiveGstPct: 0,
};

function tokens(...parts: (string | undefined | null)[]): string[] {
  const out = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const clean = String(part).toLowerCase().trim();
    if (!clean) continue;
    out.add(clean);
    for (const w of clean.split(/[\s,./-]+/)) {
      if (w.length < 2) continue;
      out.add(w);
      for (let i = 2; i <= Math.min(w.length, 12); i++) out.add(w.slice(0, i));
    }
  }
  return [...out].slice(0, 250);
}

function normalisePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(-10);
  return digits.slice(-10) || digits;
}
function isValidPhone(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalisePhone(raw));
}
function isValidEmail(raw: string): boolean {
  return !raw || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
function matchAgent(value: string, agents: { uid: string; name: string }[]) {
  const v = nameKey(value);
  if (!v) return null;
  return (
    agents.find((a) => nameKey(a.name) === v) ??
    agents.find((a) => nameKey(a.name).startsWith(v) || v.startsWith(nameKey(a.name))) ??
    agents.find((a) => nameKey(a.name).includes(v) || v.includes(nameKey(a.name))) ??
    null
  );
}

function parseSheetDate(raw: string): Date | null {
  const v = (raw || "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// --- CSV row -> Firestore lead payload ---------------------------------------

interface Row { [key: string]: string }

function buildPayload(
  row: Row,
  agents: { uid: string; name: string }[],
  fallbackOwner: { uid: string; name: string },
  code: string,
): { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string } {
  const get = (col: string) => (row[col] ?? "").toString().trim();

  const name = get("Client Name");
  if (!name) return { ok: false, reason: "missing client name" };

  const phone = normalisePhone(get("Phone"));
  if (!phone || !isValidPhone(phone)) return { ok: false, reason: `bad phone "${get("Phone")}"` };

  const city = get("City");
  if (!city) return { ok: false, reason: "missing city" };

  const email = get("Email");
  if (email && !isValidEmail(email)) return { ok: false, reason: `bad email "${email}"` };

  const typeRaw = get("Type").toUpperCase().replace(/[^A-Z]/g, "");
  const type = LEAD_TYPES.includes(typeRaw) ? typeRaw : "FRANCHISE";

  const sourceRaw = get("Source").toUpperCase().replace(/[^A-Z_]/g, "");
  const source = SOURCES.includes(sourceRaw) ? sourceRaw : "OTHER";

  const fundingRaw = get("Funding Mode").toUpperCase().replace(/[^A-Z_]/g, "");
  const fundingMode = FUNDING_MODES.includes(fundingRaw) ? fundingRaw : "SELF";

  const matched = matchAgent(get("Agent"), agents);
  const ownerId = matched?.uid ?? fallbackOwner.uid;
  const ownerName = matched?.name ?? fallbackOwner.name;

  const client = {
    name, phone,
    altPhone: get("Alternate Phone") ? normalisePhone(get("Alternate Phone")) : "",
    email, company: get("Company"), city, state: get("State"), address: get("Address"),
    pan: get("PAN").toUpperCase(), gstin: get("GSTIN").toUpperCase(),
  };
  const site = {
    locationName: get("Location Name"), mapsLink: get("Google Maps Link"),
    lat: null, lng: null, locationTypes: [], landType: null, ownerType: null,
    ownership: null, commercialModelInterested: false, powerLoad: null,
    sanctionedLoadKva: null, spaceAvailableSqft: null, remarks: get("Remarks"),
  };
  const nextFollowUpAt = parseSheetDate(get("Next Follow-up"));
  const expectedCloseAt = parseSheetDate(get("Expected Close"));

  const payload = {
    code, type, stage: "NEW", status: "ACTIVE", client, source,
    sourceDetail: get("Source Detail"), config: [], extras: [], discount: 0,
    oem: null, commercialModel: null, quote: EMPTY_QUOTE, value: 0,
    financing: { ...DEFAULT_FINANCING, mode: fundingMode, bank: get("Bank") },
    eoi: null, linkedLeads: [], partnerId: null, partnerName: null, site,
    ownerId, ownerName, tags: matched ? ["imported"] : ["imported", "unassigned-in-sheet"],
    nextFollowUpAt: nextFollowUpAt ? Timestamp.fromDate(nextFollowUpAt) : null,
    expectedCloseAt: expectedCloseAt ? Timestamp.fromDate(expectedCloseAt) : null,
    rejection: null, paidAmount: 0, dueAmount: 0, docCount: 0,
    createdAt: Timestamp.now(), createdBy: { uid: "backend-import", name: "Backend import" },
    updatedAt: Timestamp.now(), updatedBy: { uid: "backend-import", name: "Backend import" },
    lastActivityAt: Timestamp.now(), lastActivityBy: "Backend import",
    search: tokens(client.name, client.phone, client.altPhone, client.email, client.company, client.gstin, client.city, code, site.locationName, ownerName),
  };
  return { ok: true, payload };
}

// --- subcollection-aware hard delete of every lead ---------------------------

async function deleteAllLeads(): Promise<number> {
  const leadsRef = db.collection("leads");
  let total = 0;
  for (;;) {
    const snap = await leadsRef.limit(300).get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      for (const sub of ["payments", "documents"]) {
        const subSnap = await doc.ref.collection(sub).get();
        if (!subSnap.empty) {
          const batch = db.batch();
          subSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    }
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    process.stdout.write(`\r  deleted ${total} leads…`);
  }
  console.log();
  return total;
}

// --- main ---------------------------------------------------------------------

async function main() {
  const csvPath = ARGS.csv as string | undefined;
  if (!csvPath) {
    console.error('Usage: npm run reset-leads -- --csv /path/to/file.csv --confirm WIPE-EVERYTHING');
    process.exit(1);
  }
  const confirmed = ARGS.confirm === "WIPE-EVERYTHING";

  console.log(`\nReading ${csvPath} …`);
  const rows: Row[] = await new Promise((resolvePromise, reject) => {
    const acc: Row[] = [];
    parseFile(resolve(csvPath), { headers: true, trim: true })
      .on("error", reject)
      .on("data", (r: Row) => acc.push(r))
      .on("end", () => resolvePromise(acc));
  });
  console.log(`  ${rows.length} rows in the CSV.`);

  const usersSnap = await db.collection("users").where("active", "==", true).get();
  const agents = usersSnap.docs.map((d) => ({ uid: d.id, name: (d.data().name as string) ?? "" }));
  console.log(`  ${agents.length} active users to match agent names against.`);

  const fallbackEmail = (ARGS.owner as string) || "";
  const fallbackDoc = fallbackEmail
    ? usersSnap.docs.find((d) => (d.data().email as string)?.toLowerCase() === fallbackEmail.toLowerCase())
    : usersSnap.docs.find((d) => (d.data().role as string) === "SUPER_ADMIN");
  const fallbackOwner = fallbackDoc
    ? { uid: fallbackDoc.id, name: (fallbackDoc.data().name as string) ?? "Unassigned" }
    : { uid: "backend-import", name: "Unassigned" };
  console.log(`  Rows with no agent match fall back to: ${fallbackOwner.name}.`);

  const existingSnap = await db.collection("leads").select().get();
  console.log(`\nCurrently in the CRM: ${existingSnap.size} leads.`);

  if (!confirmed) {
    console.log(
      "\nDRY RUN — pass --confirm WIPE-EVERYTHING to actually delete the " +
        `${existingSnap.size} existing leads and import ${rows.length} fresh ones.\n` +
        "Nothing has been written.\n",
    );
  } else {
    console.log(`\nDeleting all ${existingSnap.size} existing leads (hard delete, no Trash, no undo)…`);
    await deleteAllLeads();
    console.log("Resetting lead-code counters…");
    await db.collection("counters").doc("leads").set({}, { merge: false });
  }

  // Assign codes in-memory (single-threaded script, no contention).
  const seq: Record<string, number> = {};
  let batch = db.batch();
  let inBatch = 0;
  let created = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const typeRaw = (row["Type"] ?? "FRANCHISE").toUpperCase().replace(/[^A-Z]/g, "");
    const type = LEAD_TYPES.includes(typeRaw) ? typeRaw : "FRANCHISE";
    const field = type.toLowerCase();
    seq[field] = (seq[field] ?? 0) + 1;
    const code = `LG-${LEAD_TYPE_CODE[type]}-${String(seq[field]).padStart(6, "0")}`;

    const result = buildPayload(row, agents, fallbackOwner, code);
    if (!result.ok) {
      skipped.push({ row: i + 2, reason: result.reason }); // +2: header row + 1-index
      seq[field]! -= 1; // don't burn a code on a skipped row
      continue;
    }

    if (confirmed) {
      const ref = db.collection("leads").doc();
      batch.set(ref, result.payload);
      inBatch++;
      if (inBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    created++;
    if (created % 200 === 0) process.stdout.write(`\r  prepared ${created} leads…`);
  }
  if (confirmed && inBatch > 0) await batch.commit();
  console.log();

  if (confirmed) {
    await db.collection("counters").doc("leads").set(seq, { merge: true });
    console.log(`\nDone. Imported ${created} leads. Skipped ${skipped.length}.`);
  } else {
    console.log(`\nWould import ${created} leads. Would skip ${skipped.length}.`);
  }
  if (skipped.length) {
    console.log("\nSkipped rows (CSV row number, reason):");
    for (const s of skipped.slice(0, 50)) console.log(`  row ${s.row}: ${s.reason}`);
    if (skipped.length > 50) console.log(`  … and ${skipped.length - 50} more.`);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
