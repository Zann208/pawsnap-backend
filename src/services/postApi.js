import { db, storage } from "../firebase";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";

/**
 * Create a post with up to 10 images.
 * Saves into:
 *   - /posts (global feed)
 *   - /users/{uid}/posts/{postId} (owner index)
 */
export async function createPost({ uid, author, text, files }) {
  if (!uid) throw new Error("No uid supplied to createPost");
  const images = Array.from(files || []).slice(0, 10);

  // 1) Upload to Storage: posts/{uid}/{timestamp}_{name}
  const urls = [];
  for (const file of images) {
    const path = `posts/${uid}/${Date.now()}_${file.name}`;
    const r = sref(storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    urls.push(url);
  }

  // 2) Create Firestore post
  const post = {
    uid,
    text: text || "",
    images: urls,                 // []
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(), // IMPORTANT for ordering
    author: {
      uid,
      displayName: author?.displayName || "",
      photoURL: author?.photoURL || "",
    },
  };

  // /posts
  const ref = await addDoc(collection(db, "posts"), post);

  // /users/{uid}/posts/{postId} (index)
  await setDoc(doc(db, "users", uid, "posts", ref.id), {
    ref: ref.path,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}
