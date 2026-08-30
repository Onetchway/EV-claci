import "server-only";

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ROLE_RANK, type Role } from "@/lib/constants";
import { adminAuth, adminConfigured, adminDb } from "@/lib/firebase/admin";

export interface Caller {
  uid: string;
  email: string;
  role: Role;
  roles: Role[];
  name: string;
}

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
 * Verifies the caller's Firebase ID token and reads their role from
 * Firestore rather than trusting the token's claims alone — a role change
 * must take effect immediately, not when the client's token happens to
 * refresh.
 */
export async function requireCaller(req: Request, minRole: Role = "ADMIN"): Promise<Caller> {
  if (!adminConfigured()) {
    throw new ApiError(
      "This server has no Firebase Admin credentials, so it cannot create or modify user accounts. " +
        "In production on App Hosting these are provided automatically. Running locally, either run " +
        "`gcloud auth application-default login`, or add FIREBASE_SERVICE_ACCOUNT_KEY to nakjm-crm/.env.local " +
        "and restart the dev server.",
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

  const data = snap.data() as { role?: Role; roles?: Role[]; active?: boolean; name?: string };
  if (data.active === false) throw new ApiError("This account is deactivated.", 403);

  const roles = (data.roles?.length ? data.roles : [data.role ?? "VIEWER"]) as Role[];
  const role = highestRole(roles);
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new ApiError("You do not have permission to perform this action.", 403);
  }

  return { uid: decoded.uid, email: decoded.email ?? "", role, roles, name: data.name ?? decoded.email ?? "User" };
}

export function highestRole(roles: Role[]): Role {
  return [...roles].sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0))[0] ?? "VIEWER";
}

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
