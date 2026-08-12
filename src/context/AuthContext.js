import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signIn({ email, password }) {
    const { user: u } = await signInWithEmailAndPassword(auth, email, password);
    return u;
  }

  async function signUp({ email, password, displayName }) {
    const { user: u } = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(u, { displayName });
    }
    return u;
  }

  async function logout() {
    await signOut(auth);
  }

  const value = { user, loading, signIn, signUp, logout };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}