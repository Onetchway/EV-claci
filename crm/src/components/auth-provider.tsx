"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword,
  signOut as fbSignOut, updatePassword, type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import type { Role } from "@/lib/constants";
import { firebaseConfigured, getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { ensureProfile, touchLastLogin, USERS } from "@/lib/db/users";
import type { Actor, AppUser } from "@/lib/types";

interface AuthState {
  loading: boolean;
  user: User | null;
  profile: AppUser | null;
  role: Role | null;
  actor: Actor | null;
  configured: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (next: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

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

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
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
      profile && profile.active
        ? { uid: profile.uid, name: profile.name, role: profile.role }
        : null;
    return {
      loading,
      user,
      profile,
      role: profile?.role ?? null,
      actor,
      configured: firebaseConfigured,
      error,
      signIn,
      signOut,
      resetPassword,
      changePassword,
    };
  }, [loading, user, profile, error, signIn, signOut, resetPassword, changePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

/** Convenience for pages that are already behind the authenticated shell. */
export function useActor(): Actor {
  const { actor } = useAuth();
  if (!actor) throw new Error("No active actor — this component must render inside the app shell.");
  return actor;
}
