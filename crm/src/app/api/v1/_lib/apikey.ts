import "server-only";

import { createHash } from "node:crypto";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError } from "../../_lib/guard";

/** Verifies a `Bearer lg_...` key against apiKeys' stored hash — never the raw key. */
export async function requireApiKey(req: Request): Promise<void> {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) throw new ApiError("Missing Authorization: Bearer <api key> header.", 401);

  const keyHash = createHash("sha256").update(raw).digest("hex");
  const db = adminDb();
  const snap = await db.collection("apiKeys").where("keyHash", "==", keyHash).limit(1).get();
  if (snap.empty) throw new ApiError("Invalid API key.", 401);

  const doc = snap.docs[0]!;
  if (doc.data().active !== true) throw new ApiError("This API key has been revoked.", 401);

  await doc.ref.update({ lastUsedAt: new Date() });
}
