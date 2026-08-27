"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider, getIdTokenResult, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut,
  updatePassword, type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { expandRole, ROLE_ENFORCEMENT, type Role } from "@/lib/constants";
import { firebaseConfigured, getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { ensureProfile, touchLastLogin, USERS } from "@/lib/db/users";
import type { Viewer } from "@/lib/permissions";
import type { Actor, AppUser } from "@/lib/types";

interface AuthState {
  loading: boolean;
  user: User | null;
  profile: AppUser | null;
  /** Primary (highest-ranked) role. */
  role: Role | null;
  /** Every role held — capabilities are the union across them. */
  roles: Role[];
  /** Ready-made subject for permission checks. */
  viewer: Viewer | null;
  actor: Actor | null;
  configured: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (next: string) => Promise<void>;
  /**
   * True when this session's ID token custom claim (`role`) doesn't match
   * the Firestore profile's role — happens for an account whose claim was
   * never set (the first-run bootstrap super admin doesn't get one, since
   * that path runs client-side and only the Admin SDK can set claims) or
   * whose role changed a long time ago. Firestore *security rules* read the
   * claim, not the Firestore doc, so a stale claim silently blocks any
   * direct client write gated by role (office locations, departments,
   * holidays, the RBAC matrix) even though the UI shows the right role.
   */
  claimsStale: boolean;
  /** Re-issues this account's custom claims from its current Firestore role, then signs out so the next sign-in picks up a fresh token. */
  fixPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Sign-in is restricted to Livanto Green's own Google Workspace. The `hd`
 * hint below only steers Google's account chooser — it is not enforcement,
 * since a user can still pick a different account in the picker. The real
 * boundary is the post-sign-in domain check here (which signs a mismatched
 * account straight back out before it can touch anything) and the matching
 * Firestore rule on the user-profile bootstrap write.
 */
const WORKSPACE_DOMAIN = "livantogreen.com";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimsStale, setClaimsStale] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

  // Profile is watched live so a role change or deactivation takes effect
  // without the user having to sign out and back in.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const unsub = onSnapshot(
      doc(getDb(), USERS, user.uid),
      async (snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setProfile({ id: snap.id, ...(snap.data() as Omit<AppUser, "id">) });
          setError(null);
        } else {
          try {
            const created = await ensureProfile({
              uid: user.uid,
              email: user.email ?? "",
              name: user.displayName ?? user.email?.split("@")[0] ?? "User",
              photoURL: user.photoURL,
            });
            if (!cancelled) setProfile(created);
          } catch (e) {
            if (!cancelled) setError((e as Error).message);
          }
        }
        setLoading(false);
      },
      (e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      },
    );

    void touchLastLogin(user.uid);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  // Compare the ID token's `role` custom claim (what Firestore security
  // rules actually see) against the Firestore profile's role (what the app
  // shows). A mismatch means direct client writes gated by role — office
  // locations, departments, holidays, the RBAC matrix — will 403 even
  // though the account looks correctly privileged everywhere else.
  useEffect(() => {
    if (!user || !profile) {
      setClaimsStale(false);
      return;
    }
    let cancelled = false;
    void getIdTokenResult(user).then((token) => {
      if (cancelled) return;
      const expected = ROLE_ENFORCEMENT[profile.role] ?? profile.role;
      setClaimsStale(token.claims.role !== expected);
    }).catch(() => {
      if (!cancelled) setClaimsStale(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: WORKSPACE_DOMAIN, prompt: "select_account" });
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    const email = (result.user.email ?? "").toLowerCase();
    if (!email.endsWith(`@${WORKSPACE_DOMAIN}`)) {
      await fbSignOut(getFirebaseAuth());
      throw new Error(`Only ${WORKSPACE_DOMAIN} Google Workspace accounts can sign in. Signed in as ${email || "unknown"}.`);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth());
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const changePassword = useCallback(async (next: string) => {
    const current = getFirebaseAuth().currentUser;
    if (!current) throw new Error("Not signed in.");
    await updatePassword(current, next);
  }, []);

  const fixPermissions = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current || !profile) throw new Error("Not signed in.");
    const token = await current.getIdToken();
    const roles = profile.roles?.length ? profile.roles : [profile.role];
    // requireCaller reads the *Firestore* role, not the (possibly stale)
    // token claim being fixed here, so this self-call succeeds regardless.
    const res = await fetch(`/api/users/${current.uid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ roles }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Could not refresh permissions.");
    }
    await signOut();
  }, [profile, signOut]);

  const value = useMemo<AuthState>(() => {
    const actor: Actor | null =
      profile && profile.active
        ? { uid: profile.uid, name: profile.name, role: profile.role }
        : null;
    const roles: Role[] = profile
      ? (profile.roles?.length ? profile.roles : [profile.role]).flatMap(expandRole)
      : [];

    return {
      loading,
      user,
      profile,
      role: profile?.role ?? null,
      roles,
      viewer: profile ? { uid: profile.uid, role: profile.role, roles, hrmsAdmin: profile.hrmsAdmin } : null,
      actor,
      configured: firebaseConfigured,
      error,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      changePassword,
      claimsStale,
      fixPermissions,
    };
  }, [
    loading, user, profile, error, signIn, signInWithGoogle, signOut, resetPassword, changePassword,
    claimsStale, fixPermissions,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

/** Permission subject for the signed-in user. Safe before the profile loads. */
export function useViewer(): Viewer {
  const { viewer } = useAuth();
  return viewer ?? { uid: "", role: "VIEWER", roles: ["VIEWER"] };
}

/** Convenience for pages that are already behind the authenticated shell. */
export function useActor(): Actor {
  const { actor } = useAuth();
  if (!actor) throw new Error("No active actor — this component must render inside the app shell.");
  return actor;
}
