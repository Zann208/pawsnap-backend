import {
  doc, setDoc, getDoc, serverTimestamp, addDoc,
  collection, query, where, onSnapshot, orderBy, limit, updateDoc
} from "firebase/firestore";
import { db } from "../firebase";

export function directChatId(a, b) {
  return [a, b].sort().join("_");
}

export async function ensureDirectChat(meUid, otherUid) {
  const id = directChatId(meUid, otherUid);
  const ref = doc(db, "chats", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [meUid, otherUid],
      createdAt: serverTimestamp(),
      lastMessageText: "",
      lastMessageAt: serverTimestamp(),
      typing: {},                // map of uid -> boolean
      lastSeen: {},              // map of uid -> Timestamp
      type: "direct",
    }, { merge: true });
  }
  return { id, ref };
}

/** Send a text message and update chat preview */
export async function sendMessage(chatId, { senderId, text }) {
  const msgRef = await addDoc(collection(db, "chats", chatId, "messages"), {
    senderId,
    text: text || "",
    imageUrl: null,
    createdAt: serverTimestamp(),
    // no per-message seen list needed when we track chat.lastSeen
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMessageText: text ? String(text).slice(0, 90) : "New message",
    lastMessageAt: serverTimestamp(),
  });
  return msgRef.id;
}

/** Send an image message (url already uploaded) */
export async function sendImageMessage(chatId, { senderId, imageUrl }) {
  const msgRef = await addDoc(collection(db, "chats", chatId, "messages"), {
    senderId,
    text: "",
    imageUrl,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMessageText: "📷 Photo",
    lastMessageAt: serverTimestamp(),
  });
  return msgRef.id;
}

/** Live stream of messages in a chat (ascending) */
export function listenMessages(chatId, cb, pageSize = 50) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

/** My chats list (ordered by lastMessageAt desc) */
export function listenMyChats(meUid, cb) {
  if (!meUid) return () => {};
  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", meUid),
    orderBy("lastMessageAt", "desc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

/** Mark me as typing / not typing */
export async function setTyping(chatId, meUid, isTyping) {
  await updateDoc(doc(db, "chats", chatId), { [`typing.${meUid}`]: !!isTyping });
}

/** Update my lastSeen timestamp for this chat */
export async function setLastSeen(chatId, meUid) {
  await updateDoc(doc(db, "chats", chatId), { [`lastSeen.${meUid}`]: serverTimestamp() });
}
