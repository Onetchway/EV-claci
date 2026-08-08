import "server-only";

import { NextResponse } from "next/server";

import { ROLE_RANK, type Role } from "@/lib/constants";
import { adminAuth, adminConfigured, adminDb } from "@/lib/firebase/admin";

export interface Caller {
  uid: string;
  email: string;
  role: Role;
  name: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Verifies the caller's Firebase ID token and reads their role from Firestore
 * rather than trusting the token's claims alone — a role change must take
 * effect immediately, not when the client's token happens to refresh.
 */
export async function requireCaller(req: Request, minRole: Role = "ADMIN"): Promise<Caller> {
  if (!adminConfigured()) {
    throw new ApiError("Server is missing Firebase Admin credentials.", 500);
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

  const data = snap.data() as { role?: Role; active?: boolean; name?: string };
  if (data.active === false) throw new ApiError("This account is deactivated.", 403);

  const role = (data.role ?? "AGENT") as Role;
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new ApiError("You do not have permission to perform this action.", 403);
  }

  return { uid: decoded.uid, email: decoded.email ?? "", role, name: data.name ?? decoded.email ?? "User" };
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: (err as Error)?.message ?? "Unexpected error." }, { status: 500 });
}
