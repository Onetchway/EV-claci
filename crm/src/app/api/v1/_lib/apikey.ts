import "server-only";

import { createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError } from "../../_lib/guard";

const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
/**
 * Best-effort, in-memory, per-instance rate limiting — not a distributed
 * limiter (that would need Redis, out of scope for this deployment). Under
 * App Hosting's typical low instance count this still meaningfully caps a
 * runaway integration; it just doesn't guarantee a hard global ceiling.
 */
const requestLog = new Map<string, number[]>();

function checkRateLimit(keyHash: string, limitPerMinute: number): void {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (requestLog.get(keyHash) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= limitPerMinute) {
    throw new ApiError(`Rate limit exceeded — max ${limitPerMinute} requests/minute for this API key.`, 429, "RATE_LIMITED");
  }
  timestamps.push(now);
  requestLog.set(keyHash, timestamps);
}

export const API_REQUEST_LOGS = "apiRequestLogs";
/** Capped, best-effort structured log of every /api/v1 call — support/debugging trail, not a source of truth for anything billed or metered. */
async function logRequest(keyId: string, req: Request, status: number, latencyMs: number): Promise<void> {
  await adminDb().collection(API_REQUEST_LOGS).add({
    keyId,
    method: req.method,
    path: new URL(req.url).pathname,
    status,
    latencyMs,
    createdAt: FieldValue.serverTimestamp(),
  }).catch((err) => console.error("[api/v1] failed to log request", err));
}

export interface ApiKeyContext {
  keyId: string;
}

/** Verifies a `Bearer lg_...` key against apiKeys' stored hash — never the raw key. Call the returned `finish(status)` from a `finally` block so every call (success or failure) gets logged with its real outcome and latency. */
export async function requireApiKey(req: Request): Promise<{ finish: (status: number) => void }> {
  const startedAt = Date.now();
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) throw new ApiError("Missing Authorization: Bearer <api key> header.", 401, "MISSING_API_KEY");

  const keyHash = createHash("sha256").update(raw).digest("hex");

  const db = adminDb();
  const snap = await db.collection("apiKeys").where("keyHash", "==", keyHash).limit(1).get();
  if (snap.empty) throw new ApiError("Invalid API key.", 401, "INVALID_API_KEY");

  const doc = snap.docs[0]!;
  const data = doc.data();
  if (data.active !== true) throw new ApiError("This API key has been revoked.", 401, "KEY_REVOKED");

  const expiresAt = data.expiresAt as { toMillis?: () => number } | undefined;
  if (expiresAt?.toMillis && expiresAt.toMillis() < Date.now()) {
    throw new ApiError("This API key has expired — generate a new one from Developer settings.", 401, "KEY_EXPIRED");
  }

  checkRateLimit(keyHash, (data.rateLimitPerMinute as number | undefined) || DEFAULT_RATE_LIMIT_PER_MINUTE);

  await doc.ref.update({ lastUsedAt: new Date(), requestCount: FieldValue.increment(1) });

  return {
    finish: (status: number) => {
      void logRequest(doc.id, req, status, Date.now() - startedAt);
    },
  };
}
