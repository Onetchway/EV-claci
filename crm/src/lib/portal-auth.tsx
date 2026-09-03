"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import {
  onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, signOut as fbSignOut,
  type ConfirmationResult, type User,
} from "firebase/auth";

import { firebaseConfigured, getFirebaseAuth } from "./firebase/client";
import { isValidPhone, toE164India } from "./utils";

interface PortalAuthState {
  loading: boolean;
  /** Only ever a phone/OTP-signed-in investor — a CRM staff session in the same browser never leaks in here. */
  user: User | null;
  /** +91XXXXXXXXXX, once signed in. */
  phoneE164: string | null;
  configured: boolean;
  /** Sends an OTP to a bare 10-digit Indian mobile number. `containerId` is an element already mounted in the DOM (the invisible reCAPTCHA anchors to it). */
  sendOtp: (phone10: string, containerId: string) => Promise<void>;
  confirmOtp: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthState | null>(null);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) { setLoading(false); return; }
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u && u.providerData.some((p) => p.providerId === "phone") ? u : null);
      setLoading(false);
    });
  }, []);

  const sendOtp = useCallback(async (phone10: string, containerId: string) => {
    if (!isValidPhone(phone10)) throw new Error("Enter a valid 10-digit mobile number.");
    const auth = getFirebaseAuth();
    verifierRef.current?.clear();
    const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    verifierRef.current = verifier;
    confirmationRef.current = await signInWithPhoneNumber(auth, toE164India(phone10), verifier);
  }, []);

  const confirmOtp = useCallback(async (code: string) => {
    if (!confirmationRef.current) throw new Error("Request an OTP first.");
    if (!/^\d{6}$/.test(code.trim())) throw new Error("Enter the 6-digit code.");
    await confirmationRef.current.confirm(code.trim());
    confirmationRef.current = null;
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth());
    setUser(null);
  }, []);

  const value = useMemo<PortalAuthState>(
    () => ({
      loading, user, phoneE164: user?.phoneNumber ?? null, configured: firebaseConfigured,
      sendOtp, confirmOtp, signOut,
    }),
    [loading, user, sendOtp, confirmOtp, signOut],
  );

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth(): PortalAuthState {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used inside <PortalAuthProvider>.");
  return ctx;
}
