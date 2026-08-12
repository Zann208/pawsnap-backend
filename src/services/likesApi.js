// src/services/likesApi.js
import { db } from "../firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

export function listenLikes(postId, myUid, cb) {
  const likesCol = collection(db, "posts", postId, "likes");
  const unsub = onSnapshot(likesCol, (snap) => {
    const count = snap.size;
    const liked = !!snap.docs.find(d => d.id === myUid);
    cb({ count, liked });
  });
  return unsub;
}

export async function toggleLike(postId, myUid, liked) {
  const likeRef = doc(db, "posts", postId, "likes", myUid);
  if (liked) {
    await deleteDoc(likeRef);
  } else {
    await setDoc(likeRef, { uid: myUid, createdAt: new Date() });
  }
}
