"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider, githubProvider } from "@/lib/firebase";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isDev?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signInDev: (uid?: string, email?: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithGithub: async () => {},
  signInDev: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check local storage for persisted Dev Mode sign-in
    const savedDevUser = localStorage.getItem("pulse_dev_user");
    if (savedDevUser) {
      try {
        const parsed = JSON.parse(savedDevUser);
        setUser(parsed);
        setToken(`dev:${parsed.uid}:${parsed.email || "dev@pulse.dev"}`);
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem("pulse_dev_user");
      }
    }

    // 2. Listen to Firebase auth state
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "Developer",
          photoURL: fbUser.photoURL,
          isDev: false,
        });
        setToken(idToken);
      } else if (!localStorage.getItem("pulse_dev_user")) {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) return;
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const idToken = await res.user.getIdToken();
      setUser({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        photoURL: res.user.photoURL,
        isDev: false,
      });
      setToken(idToken);
      localStorage.removeItem("pulse_dev_user");
    } catch (err) {
      console.error("Google sign in failed:", err);
      throw err;
    }
  };

  const signInWithGithub = async () => {
    if (!auth) return;
    try {
      const res = await signInWithPopup(auth, githubProvider);
      const idToken = await res.user.getIdToken();
      setUser({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        photoURL: res.user.photoURL,
        isDev: false,
      });
      setToken(idToken);
      localStorage.removeItem("pulse_dev_user");
    } catch (err) {
      console.error("GitHub sign in failed:", err);
      throw err;
    }
  };

  const signInDev = (uid = "dev_user_1", email = "developer@pulse.dev") => {
    const devUser: AuthUser = {
      uid,
      email,
      displayName: "Dev Account",
      isDev: true,
    };
    setUser(devUser);
    const devToken = `dev:${uid}:${email}`;
    setToken(devToken);
    localStorage.setItem("pulse_dev_user", JSON.stringify(devUser));
  };

  const signOut = async () => {
    if (user?.isDev) {
      localStorage.removeItem("pulse_dev_user");
      setUser(null);
      setToken(null);
      return;
    }
    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signInWithGoogle,
        signInWithGithub,
        signInDev,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
