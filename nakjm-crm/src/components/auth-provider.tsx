"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut,
  updatePassword, type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { firebaseConfigured, getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { ensureProfile, touchLastLogin, USERS } from "@/lib/db/users";
import type { Viewer } from "@/lib/permissions";
import type { Actor, AppUser } from "@/lib/types";
import type { Role } from "@/lib/constants";

interface AuthState {
  loading: boolean;
  user: User | null;
  profile: AppUser | null;
  role: Role | null;
  roles: Role[];
  viewer: Viewer | null;
  actor: Actor | null;
  configured: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (next: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Sign-in is restricted to NAKJM's own Workspace domain. The `hd` hint below
 * only steers Google's account chooser — the real boundary is the post-sign-in
 * domain check here, which signs a mismatched account straight back out.
 */
const WORKSPACE_DOMAIN = process.env.NEXT_PUBLIC_WORKSPACE_DOMAIN || "nakjminfra.com";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      throw new Error(`Only ${WORKSPACE_DOMAIN} accounts can sign in. Signed in as ${email || "unknown"}.`);
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

  const value = useMemo<AuthState>(() => {
    const actor: Actor | null =
      profile && profile.active ? { uid: profile.uid, name: profile.name, role: profile.role } : null;
    const roles: Role[] = profile ? (profile.roles?.length ? profile.roles : [profile.role]) : [];

    return {
      loading,
      user,
      profile,
      role: profile?.role ?? null,
      roles,
      viewer: profile ? { uid: profile.uid, role: profile.role, roles } : null,
      actor,
      configured: firebaseConfigured,
      error,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      changePassword,
    };
  }, [loading, user, profile, error, signIn, signInWithGoogle, signOut, resetPassword, changePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

export function useViewer(): Viewer {
  const { viewer } = useAuth();
  return viewer ?? { uid: "", role: "VIEWER", roles: ["VIEWER"] };
}

export function useActor(): Actor {
  const { actor } = useAuth();
  if (!actor) throw new Error("No active actor — this component must render inside the app shell.");
  return actor;
}
