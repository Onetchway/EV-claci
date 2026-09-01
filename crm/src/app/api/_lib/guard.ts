import "server-only";

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ROLE_RANK, type Role } from "@/lib/constants";
import { adminAuth, adminConfigured, adminDb } from "@/lib/firebase/admin";

export interface Caller {
  uid: string;
  email: string;
  /** Primary (highest-ranked) role. */
  role: Role;
  /** Every role held. */
  roles: Role[];
  name: string;
  /** Which white-label org (see lib/db/organizations.ts) this caller belongs to — null for the default (Livanto's own) org. */
  orgId: string | null;
}

/**
 * `code` is a stable, machine-readable slug (e.g. "RATE_LIMITED",
 * "KEY_EXPIRED") an integration can branch on without string-matching
 * `message`, which is free to change. Optional so existing call sites
 * (just a message + status) keep working unchanged — errorResponse below
 * falls back to a generic code derived from the HTTP status when omitted.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

const STATUS_FALLBACK_CODE: Record<number, string> = {
  400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND",
  429: "RATE_LIMITED", 500: "INTERNAL_ERROR", 502: "UPSTREAM_ERROR", 503: "UNAVAILABLE",
};

/**
 * Verifies the caller's Firebase ID token and reads their role from Firestore
 * rather than trusting the token's claims alone — a role change must take
 * effect immediately, not when the client's token happens to refresh.
 */
export async function requireCaller(req: Request, minRole: Role = "ADMIN"): Promise<Caller> {
  if (!adminConfigured()) {
    // This is the single most common local-setup failure, so say exactly what
    // to do rather than just naming the missing thing.
    throw new ApiError(
      "This server has no Firebase Admin credentials, so it cannot create or modify user accounts. " +
        "In production on App Hosting these are provided automatically. Running locally, either run " +
        "`gcloud auth application-default login`, or add FIREBASE_SERVICE_ACCOUNT_KEY to crm/.env.local " +
        "and restart the dev server. You can also manage users from the deployed site instead.",
      503,
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError("Missing bearer token.", 401);

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch {
    throw new ApiError("Invalid or expired session. Sign in again.", 401);
  }

  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  if (!snap.exists) throw new ApiError("No CRM profile exists for this account.", 403);

  const data = snap.data() as { role?: Role; roles?: Role[]; active?: boolean; name?: string; orgId?: string | null };
  if (data.active === false) throw new ApiError("This account is deactivated.", 403);

  const roles = (data.roles?.length ? data.roles : [data.role ?? "AGENT"]) as Role[];
  const role = highestRole(roles);
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new ApiError("You do not have permission to perform this action.", 403);
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? "",
    role,
    roles,
    name: data.name ?? decoded.email ?? "User",
    orgId: data.orgId ?? null,
  };
}

/** The primary role is the highest-ranked one a user holds. */
export function highestRole(roles: Role[]): Role {
  return [...roles].sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0))[0] ?? "AGENT";
}

/**
 * Every failure response gets a requestId — cheap to generate, and the one
 * thing that lets us find "the request that failed for you at 3:14pm" in
 * logs/apiRequestLogs without the caller needing to have captured anything
 * else. Not returned on success (the 2xx body is whatever the route
 * defines) — this is specifically for the "something broke, now what"
 * support path.
 */
export function errorResponse(err: unknown) {
  const requestId = randomUUID();
  if (err instanceof ApiError) {
    const code = err.code ?? STATUS_FALLBACK_CODE[err.status] ?? "ERROR";
    return NextResponse.json({ error: err.message, code, requestId }, { status: err.status });
  }
  console.error(`[api] unexpected error (requestId ${requestId})`, err);
  return NextResponse.json(
    { error: (err as Error)?.message ?? "Unexpected error.", code: "INTERNAL_ERROR", requestId },
    { status: 500 },
  );
}
