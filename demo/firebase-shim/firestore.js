// Firestore subset used by PawSnap, implemented over an in-browser document map.
import { state, save, clone, newId, fbError, Timestamp, resetDemo } from "./core.js";
import { runTriggers } from "./functions.js";

export { Timestamp, resetDemo };

const db = { type: "firestore", app: null };
export function initializeFirestore(app) { db.app = app; return db; }
export function getFirestore(app) { if (app) db.app = app; return db; }
export function persistentLocalCache() { return {}; }
export function persistentSingleTabManager() { return {}; }
export function persistentMultipleTabManager() { return {}; }

// ---------- references ----------
function join(base, segs) {
  const parts = [];
  if (base) parts.push(base);
  for (const s of segs) for (const p of String(s).split("/")) if (p) parts.push(p);
  return parts.join("/");
}
class DocumentReference {
  constructor(path) { this.type = "document"; this.path = path; this.firestore = db; }
  get id() { return this.path.split("/").pop(); }
  get parent() { return new CollectionReference(this.path.split("/").slice(0, -1).join("/")); }
}
class CollectionReference {
  constructor(path) { this.type = "collection"; this.path = path; this.firestore = db; this._c = []; }
  get id() { return this.path.split("/").pop(); }
  get parent() { const p = this.path.split("/").slice(0, -1); return p.length ? new DocumentReference(p.join("/")) : null; }
}
class Query {
  constructor(path, constraints) { this.type = "query"; this.path = path; this._c = constraints; this.firestore = db; }
}

export function doc(parent, ...segs) {
  if (parent === db || (parent && parent.type === "firestore")) return new DocumentReference(join("", segs));
  if (parent && parent.type === "collection") {
    if (!segs.length) return new DocumentReference(join(parent.path, [newId()]));
    return new DocumentReference(join(parent.path, segs));
  }
  if (parent && parent.type === "document") return new DocumentReference(join(parent.path, segs));
  throw fbError("invalid-argument", "doc() needs a Firestore instance or reference");
}
export function collection(parent, ...segs) {
  const base = parent && parent.type === "document" ? parent.path : "";
  return new CollectionReference(join(base, segs));
}
export function query(ref, ...constraints) {
  return new Query(ref.path, [...(ref._c || []), ...constraints]);
}
export const where = (field, op, value) => ({ kind: "where", field, op, value });
export const orderBy = (field, dir = "asc") => ({ kind: "orderBy", field, dir });
export const limit = (n) => ({ kind: "limit", n });
export const documentId = () => "__name__";

// ---------- sentinels ----------
export const serverTimestamp = () => ({ __op: "ts" });
export const increment = (n) => ({ __op: "inc", n });
export const arrayUnion = (...v) => ({ __op: "union", v });
export const arrayRemove = (...v) => ({ __op: "remove", v });
export const deleteField = () => ({ __op: "del" });

const isOp = (v) => v && typeof v === "object" && !(v instanceof Timestamp) && typeof v.__op === "string";
const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Timestamp) && !isOp(v) && !(v instanceof Date);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function resolve(value, current) {
  if (isOp(value)) {
    if (value.__op === "ts") return Timestamp.now();
    if (value.__op === "inc") return (typeof current === "number" ? current : 0) + value.n;
    if (value.__op === "union") { const arr = Array.isArray(current) ? current.slice() : []; for (const x of value.v) if (!arr.some((y) => same(x, y))) arr.push(x); return arr; }
    if (value.__op === "remove") return (Array.isArray(current) ? current : []).filter((y) => !value.v.some((x) => same(x, y)));
    if (value.__op === "del") return undefined;
  }
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (isPlain(value)) {
    const out = {};
    for (const k of Object.keys(value)) { const r = resolve(value[k], current && current[k]); if (r !== undefined) out[k] = r; }
    return out;
  }
  if (Array.isArray(value)) return value.map((x) => resolve(x));
  return value;
}
function mergeInto(target, patch) {
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (isPlain(v) && isPlain(target[k])) mergeInto(target[k], v);
    else { const r = resolve(v, target[k]); if (r === undefined) delete target[k]; else target[k] = r; }
  }
  return target;
}
function setPath(obj, dotted, value) {
  const keys = dotted.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) { if (!isPlain(o[keys[i]])) o[keys[i]] = {}; o = o[keys[i]]; }
  const last = keys[keys.length - 1];
  const r = resolve(value, o[last]);
  if (r === undefined) delete o[last]; else o[last] = r;
}
export function getField(obj, dotted) {
  if (dotted === "__name__") return obj && obj.__id;
  return dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// ---------- snapshots ----------
class DocumentSnapshot {
  constructor(path) {
    this.ref = new DocumentReference(path);
    this.id = this.ref.id;
    this._d = state.docs[path] ? clone(state.docs[path]) : undefined;
    this.metadata = { hasPendingWrites: false, fromCache: false };
  }
  exists() { return this._d !== undefined; }
  data() { return this._d === undefined ? undefined : clone(this._d); }
  get(field) { return clone(getField(this._d, field)); }
}
class QuerySnapshot {
  constructor(paths, q) {
    this.docs = paths.map((p) => new DocumentSnapshot(p));
    this.size = this.docs.length;
    this.empty = this.size === 0;
    this.query = q;
    this.metadata = { hasPendingWrites: false, fromCache: false };
  }
  forEach(fn) { this.docs.forEach(fn); }
  docChanges() { return this.docs.map((d, i) => ({ type: "added", doc: d, newIndex: i, oldIndex: -1 })); }
}

function cmp(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (a instanceof Timestamp) a = a.toMillis();
  if (b instanceof Timestamp) b = b.toMillis();
  return a < b ? -1 : a > b ? 1 : 0;
}
function matches(data, w) {
  const v = getField(data, w.field);
  switch (w.op) {
    case "==": return same(v, w.value);
    case "!=": return v !== undefined && !same(v, w.value);
    case "<": return v !== undefined && cmp(v, w.value) < 0;
    case "<=": return v !== undefined && cmp(v, w.value) <= 0;
    case ">": return v !== undefined && cmp(v, w.value) > 0;
    case ">=": return v !== undefined && cmp(v, w.value) >= 0;
    case "array-contains": return Array.isArray(v) && v.some((x) => same(x, w.value));
    case "array-contains-any": return Array.isArray(v) && v.some((x) => w.value.some((y) => same(x, y)));
    case "in": return w.value.some((y) => same(v, y));
    case "not-in": return v !== undefined && !w.value.some((y) => same(v, y));
    default: return false;
  }
}
function runQuery(target) {
  const col = target.path;
  const depth = col.split("/").length + 1;
  let paths = Object.keys(state.docs).filter((p) => p.startsWith(col + "/") && p.split("/").length === depth);
  const cs = target._c || [];
  for (const w of cs.filter((c) => c.kind === "where")) {
    paths = paths.filter((p) => matches({ ...state.docs[p], __id: p.split("/").pop() }, w));
  }
  const orders = cs.filter((c) => c.kind === "orderBy");
  if (orders.length) {
    paths = paths.filter((p) => orders.every((o) => o.field === "__name__" || getField(state.docs[p], o.field) !== undefined));
    paths.sort((x, y) => {
      for (const o of orders) {
        const r = o.field === "__name__" ? cmp(x, y) : cmp(getField(state.docs[x], o.field), getField(state.docs[y], o.field));
        if (r) return o.dir === "desc" ? -r : r;
      }
      return 0;
    });
  } else {
    paths.sort();
  }
  const lim = cs.filter((c) => c.kind === "limit").pop();
  if (lim) paths = paths.slice(0, lim.n);
  return paths;
}
function snapshotOf(target) {
  return target.type === "document" ? new DocumentSnapshot(target.path) : new QuerySnapshot(runQuery(target), target);
}
function signature(target) {
  if (target.type === "document") return JSON.stringify(state.docs[target.path] ?? null);
  return JSON.stringify(runQuery(target).map((p) => [p, state.docs[p]]));
}

// ---------- reads ----------
const tick = () => new Promise((r) => setTimeout(r, 0));
export async function getDoc(ref) { await tick(); return new DocumentSnapshot(ref.path); }
export async function getDocFromServer(ref) { return getDoc(ref); }
export async function getDocs(q) { await tick(); return new QuerySnapshot(runQuery(q), q); }
export async function getDocsFromServer(q) { return getDocs(q); }
export async function getCountFromServer(q) { await tick(); const n = runQuery(q).length; return { data: () => ({ count: n }) }; }

// ---------- writes ----------
function applyOne(change, log) {
  const before = state.docs[change.path] ? clone(state.docs[change.path]) : undefined;
  if (change.kind === "delete") {
    delete state.docs[change.path];
  } else if (change.kind === "set") {
    if (change.merge && before) state.docs[change.path] = mergeInto(clone(before), change.data);
    else state.docs[change.path] = resolve(change.data, undefined);
  } else if (change.kind === "update") {
    const next = before ? clone(before) : {};
    for (const k of Object.keys(change.data)) {
      if (k.includes(".")) setPath(next, k, change.data[k]);
      else { const r = resolve(change.data[k], next[k]); if (r === undefined) delete next[k]; else next[k] = r; }
    }
    state.docs[change.path] = next;
  }
  log.push({ path: change.path, before, after: state.docs[change.path] ? clone(state.docs[change.path]) : undefined });
}
export function _commit(changes, { triggers = true } = {}) {
  const log = [];
  for (const c of changes) applyOne(c, log);
  save();
  notify();
  if (triggers) runTriggers(log);
  return log;
}

export async function setDoc(ref, data, opts = {}) { await tick(); _commit([{ kind: "set", path: ref.path, data, merge: !!(opts && (opts.merge || opts.mergeFields)) }]); }
export async function updateDoc(ref, data, ...rest) {
  await tick();
  if (typeof data === "string") { const o = {}; o[data] = rest[0]; data = o; }
  if (!state.docs[ref.path]) throw fbError("not-found", `No document to update: ${ref.path}`);
  _commit([{ kind: "update", path: ref.path, data }]);
}
export async function deleteDoc(ref) { await tick(); _commit([{ kind: "delete", path: ref.path }]); }
export async function addDoc(colRef, data) {
  await tick();
  const ref = new DocumentReference(join(colRef.path, [newId()]));
  _commit([{ kind: "set", path: ref.path, data }]);
  return ref;
}
export function writeBatch() {
  const changes = [];
  const b = {
    set(ref, data, opts) { changes.push({ kind: "set", path: ref.path, data, merge: !!(opts && opts.merge) }); return b; },
    update(ref, data) { changes.push({ kind: "update", path: ref.path, data }); return b; },
    delete(ref) { changes.push({ kind: "delete", path: ref.path }); return b; },
    async commit() { await tick(); _commit(changes); },
  };
  return b;
}
export async function runTransaction(_db, fn) {
  const changes = [];
  const tx = {
    get: async (ref) => new DocumentSnapshot(ref.path),
    set(ref, data, opts) { changes.push({ kind: "set", path: ref.path, data, merge: !!(opts && opts.merge) }); return tx; },
    update(ref, data) { changes.push({ kind: "update", path: ref.path, data }); return tx; },
    delete(ref) { changes.push({ kind: "delete", path: ref.path }); return tx; },
  };
  const result = await fn(tx);
  _commit(changes);
  return result;
}

// ---------- live listeners ----------
const listeners = new Set();
let pending = false;
function notify() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    for (const l of Array.from(listeners)) {
      if (!listeners.has(l)) continue;
      const sig = signature(l.target);
      if (sig === l.sig) continue;
      l.sig = sig;
      try { l.next(snapshotOf(l.target)); } catch (e) { console.error(e); }
    }
  }, 0);
}
export function onSnapshot(target, ...args) {
  let next = args[0];
  let error = args[1];
  if (next && typeof next === "object" && !(typeof next === "function")) {
    if (typeof next.next === "function") { error = next.error; next = next.next.bind(next); }
    else { next = args[1]; error = args[2]; }
  }
  const l = { target, next, error, sig: null };
  listeners.add(l);
  setTimeout(() => {
    if (!listeners.has(l)) return;
    l.sig = signature(target);
    try { next(snapshotOf(target)); } catch (e) { console.error(e); }
  }, 0);
  return () => listeners.delete(l);
}
export function enableNetwork() { return Promise.resolve(); }
export function disableNetwork() { return Promise.resolve(); }
