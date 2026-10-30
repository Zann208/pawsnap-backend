// Firebase Auth subset for the PawSnap demo: accounts live in this browser only.
import { state, save, newId, fbError } from "./core.js";
import "./seed.js";

const auth = { type: "auth", currentUser: null, app: null };
const subs = new Set();

function userFor(uid) {
  const a = state.accounts[uid];
  if (!a) return null;
  return {
    uid,
    email: a.email,
    displayName: a.displayName || null,
    photoURL: a.photoURL || null,
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
    getIdToken: async () => "demo-token",
    reload: async () => {},
  };
}
function setSession(uid) {
  state.session = uid;
  save();
  auth.currentUser = uid ? userFor(uid) : null;
  for (const cb of Array.from(subs)) setTimeout(() => cb(auth.currentUser), 0);
}
auth.currentUser = state.session ? userFor(state.session) : null;

export function getAuth(app) { auth.app = app || null; return auth; }
export function onAuthStateChanged(_a, cb) {
  subs.add(cb);
  setTimeout(() => subs.has(cb) && cb(auth.currentUser), 0);
  return () => subs.delete(cb);
}
export const onIdTokenChanged = onAuthStateChanged;

const norm = (e) => String(e || "").trim().toLowerCase();
const findByEmail = (email) => Object.keys(state.accounts).find((uid) => state.accounts[uid].email === norm(email));

export async function signInWithEmailAndPassword(_a, email, password) {
  await new Promise((r) => setTimeout(r, 250));
  if (!/^\S+@\S+\.\S+$/.test(norm(email))) throw fbError("auth/invalid-email", "Firebase: Error (auth/invalid-email).");
  const uid = findByEmail(email);
  if (!uid || state.accounts[uid].password !== password) throw fbError("auth/invalid-credential", "Firebase: Error (auth/invalid-credential).");
  setSession(uid);
  return { user: auth.currentUser, providerId: null, operationType: "signIn" };
}
export async function createUserWithEmailAndPassword(_a, email, password) {
  await new Promise((r) => setTimeout(r, 250));
  if (!/^\S+@\S+\.\S+$/.test(norm(email))) throw fbError("auth/invalid-email", "Firebase: Error (auth/invalid-email).");
  if (!password || password.length < 6) throw fbError("auth/weak-password", "Firebase: Password should be at least 6 characters (auth/weak-password).");
  if (findByEmail(email)) throw fbError("auth/email-already-in-use", "Firebase: Error (auth/email-already-in-use).");
  const uid = newId(28);
  state.accounts[uid] = { email: norm(email), password, displayName: null, photoURL: null };
  setSession(uid);
  return { user: auth.currentUser, providerId: null, operationType: "signIn" };
}
export async function updateProfile(user, { displayName, photoURL } = {}) {
  const a = user && state.accounts[user.uid];
  if (!a) throw fbError("auth/user-not-found");
  if (displayName !== undefined) a.displayName = displayName;
  if (photoURL !== undefined) a.photoURL = photoURL;
  save();
  if (auth.currentUser && auth.currentUser.uid === user.uid) {
    if (displayName !== undefined) auth.currentUser.displayName = displayName;
    if (photoURL !== undefined) auth.currentUser.photoURL = photoURL;
    user.displayName = auth.currentUser.displayName;
    user.photoURL = auth.currentUser.photoURL;
  }
}
export async function signOut() { setSession(null); }
export async function setPersistence() {}
export const browserLocalPersistence = { type: "LOCAL" };
export async function sendPasswordResetEmail() {}
export class GoogleAuthProvider {}
export async function signInWithPopup() { throw fbError("auth/operation-not-supported-in-this-environment", "Google sign-in is not available in the demo build."); }
