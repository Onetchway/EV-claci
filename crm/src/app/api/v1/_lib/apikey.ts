import "server-only";

import { createHash } from "node:crypto";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError } from "../../_lib/guard";

const RATE_LIMIT_PER_MINUTE = 60;
/**
 * Best-effort, in-memory, per-instance rate limiting — not a distributed
 * limiter (that would need Redis, out of scope for this deployment). Under
 * App Hosting's typical low instance count this still meaningfully caps a
 * runaway integration; it just doesn't guarantee a hard global ceiling.
 */
const requestLog = new Map<string, number[]>();

function checkRateLimit(keyHash: string): void {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (requestLog.get(keyHash) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_PER_MINUTE) {
    throw new ApiError(`Rate limit exceeded — max ${RATE_LIMIT_PER_MINUTE} requests/minute per API key.`, 429);
  }
  timestamps.push(now);
  requestLog.set(keyHash, timestamps);
}

/** Verifies a `Bearer lg_...` key against apiKeys' stored hash — never the raw key. */
export async function requireApiKey(req: Request): Promise<void> {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) throw new ApiError("Missing Authorization: Bearer <api key> header.", 401);

  const keyHash = createHash("sha256").update(raw).digest("hex");
  checkRateLimit(keyHash);

  const db = adminDb();
  const snap = await db.collection("apiKeys").where("keyHash", "==", keyHash).limit(1).get();
  if (snap.empty) throw new ApiError("Invalid API key.", 401);

  const doc = snap.docs[0]!;
  if (doc.data().active !== true) throw new ApiError("This API key has been revoked.", 401);

  await doc.ref.update({ lastUsedAt: new Date() });
}
