// Shared in-browser state for the PawSnap demo build.
// Everything lives in this tab's memory and is mirrored to localStorage, so the
// demo needs no Firebase project and never sends data anywhere.

const KEY = "pawsnap-demo:v1";

export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() { return Timestamp.fromMillis(Date.now()); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
  isEqual(o) { return o instanceof Timestamp && o.toMillis() === this.toMillis(); }
  valueOf() { return String(this.toMillis()).padStart(15, "0"); }
  toJSON() { return { __ts: this.toMillis() }; }
}

export const state = { docs: {}, accounts: {}, files: {}, session: null, seeded: false };

function revive(_k, v) {
  if (v && typeof v === "object" && typeof v.__ts === "number" && Object.keys(v).length === 1) {
    return Timestamp.fromMillis(v.__ts);
  }
  return v;
}

export function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) Object.assign(state, JSON.parse(raw, revive));
  } catch (_) { /* storage unavailable: run in memory */ }
}

let saveTimer = null;
let warned = false;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!warned) { warned = true; console.warn("PawSnap demo: browser storage is full or blocked; changes stay for this tab only."); }
    }
  }, 120);
}

export function resetDemo() {
  try { window.localStorage.removeItem(KEY); } catch (_) {}
  window.location.reload();
}

export function clone(v) {
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds);
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) o[k] = clone(v[k]);
    return o;
  }
  return v;
}

export function newId(len = 20) {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  const r = (window.crypto && window.crypto.getRandomValues) ? window.crypto.getRandomValues(new Uint8Array(len)) : null;
  for (let i = 0; i < len; i++) s += a[(r ? r[i] : Math.floor(Math.random() * 256)) % a.length];
  return s;
}

export function fbError(code, message) {
  const e = new Error(message || `Firebase: Error (${code}).`);
  e.code = code;
  e.name = "FirebaseError";
  return e;
}

load();
