import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export function listenNotifications(uid, cb) {
  const q = query(
    collection(db, "notifications", uid, "items"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    // ensure stable shape
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(items);
  });
}

export async function markNotifRead(uid, id) {
  await updateDoc(doc(db, "notifications", uid, "items", id), { isRead: true });
}

export async function markAllRead(uid, items) {
  const updates = items
    .filter(n => !n.isRead)
    .map(n => updateDoc(doc(db, "notifications", uid, "items", n.id), { isRead: true }));
  await Promise.allSettled(updates);
}
