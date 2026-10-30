// Port of the PawSnap Cloud Functions (functions/index.js in Zann208/pawsnap-backend).
// In production these ran on Firebase Functions v2 as Firestore triggers; in the demo
// they run in the browser after each commit, with the same paths, counters,
// notification IDs and guards. Push messaging (FCM) is omitted.
import { state, clone } from "./core.js";
import { _commit, serverTimestamp, increment } from "./firestore.js";

const LATENCY_MS = 150; // triggers run after the client write, as on the server

function profile(uid) {
  const d = state.docs[`users/${uid}`] || {};
  return { name: d.displayName || "Someone", avatar: d.photoURL || null };
}
function notification(targetUid, notifId, payload) {
  return {
    kind: "set",
    path: `notifications/${targetUid}/items/${notifId}`,
    merge: true,
    data: { userId: targetUid, isRead: false, createdAt: serverTimestamp(), ...payload },
  };
}
const inc = (path, field, by) => ({ kind: "set", path, merge: true, data: { [field]: increment(by) } });
const get = (path) => (state.docs[path] ? clone(state.docs[path]) : undefined);
const owner = (post) => (post && ((post.author && post.author.uid) || post.uid)) || null;

const handlers = [
  // follows/{targetUid}/followers/{meUid}
  {
    re: /^follows\/([^/]+)\/followers\/([^/]+)$/,
    created([targetUid, meUid]) {
      if (!targetUid || !meUid || targetUid === meUid) return [];
      const actor = profile(meUid);
      return [
        notification(targetUid, `follow:${meUid}`, {
          type: "follow",
          actor: { id: meUid, name: actor.name, avatar: actor.avatar },
          entity: { type: "user", id: meUid },
          message: `${actor.name} started following you`,
          url: `/u/${meUid}`,
        }),
        inc(`users/${targetUid}`, "followersCount", +1),
        inc(`users/${meUid}`, "followingCount", +1),
      ];
    },
    deleted([targetUid, meUid]) {
      if (!targetUid || !meUid || targetUid === meUid) return [];
      const out = [];
      if (((get(`users/${targetUid}`) || {}).followersCount || 0) > 0) out.push(inc(`users/${targetUid}`, "followersCount", -1));
      if (((get(`users/${meUid}`) || {}).followingCount || 0) > 0) out.push(inc(`users/${meUid}`, "followingCount", -1));
      return out;
    },
  },
  // posts/{postId}/likes/{actorId}
  {
    re: /^posts\/([^/]+)\/likes\/([^/]+)$/,
    created([postId, actorId]) {
      const post = get(`posts/${postId}`);
      if (!post) return [];
      const ownerId = owner(post);
      if (!ownerId || ownerId === actorId) return [];
      const actor = profile(actorId);
      return [
        notification(ownerId, `like:${postId}:${actorId}`, {
          type: "like",
          actor: { id: actorId, name: actor.name, avatar: actor.avatar },
          entity: { type: "post", id: postId },
          message: `${actor.name} liked your post`,
          url: `/post/${postId}`,
        }),
        inc(`posts/${postId}`, "likeCount", +1),
      ];
    },
    deleted([postId]) {
      return get(`posts/${postId}`) ? [inc(`posts/${postId}`, "likeCount", -1)] : [];
    },
  },
  // posts/{postId}/comments/{commentId}
  {
    re: /^posts\/([^/]+)\/comments\/([^/]+)$/,
    created([postId, commentId], c) {
      const actorId = c.actorId || c.userId || (c.author && c.author.uid);
      if (!actorId) return [];
      const post = get(`posts/${postId}`);
      if (!post) return [];
      const ownerId = owner(post);
      if (!ownerId || ownerId === actorId) return [];
      const actor = profile(actorId);
      return [
        notification(ownerId, `comment:${postId}:${commentId}`, {
          type: "comment",
          actor: { id: actorId, name: actor.name, avatar: actor.avatar },
          entity: { type: "post", id: postId },
          message: `${actor.name} commented on your post`,
          url: `/post/${postId}#comment-${commentId}`,
          preview: c.text ? String(c.text).slice(0, 140) : "",
        }),
        inc(`posts/${postId}`, "commentCount", +1),
      ];
    },
    deleted([postId]) {
      return get(`posts/${postId}`) ? [inc(`posts/${postId}`, "commentCount", -1)] : [];
    },
  },
  // chats/{chatId}/messages/{messageId}
  {
    re: /^chats\/([^/]+)\/messages\/([^/]+)$/,
    created([chatId, messageId], m) {
      const senderId = m.senderId || m.userId;
      if (!senderId) return [];
      const chat = get(`chats/${chatId}`);
      if (!chat) return [];
      const participants = Array.isArray(chat.participants) ? chat.participants : [];
      const sender = profile(senderId);
      const preview = m.text ? String(m.text).slice(0, 90) : "New message";
      return participants
        .filter((uid) => uid !== senderId)
        .map((uid) =>
          notification(uid, `message:${chatId}:${messageId}`, {
            type: "message",
            actor: { id: senderId, name: sender.name, avatar: sender.avatar },
            entity: { type: "chat", id: chatId },
            message: `${sender.name}: ${preview}`,
            url: `/chat/${chatId}`,
          })
        );
    },
  },
];

export function runTriggers(log) {
  const jobs = [];
  for (const entry of log) {
    for (const h of handlers) {
      const m = entry.path.match(h.re);
      if (!m) continue;
      const params = m.slice(1);
      if (!entry.before && entry.after && h.created) jobs.push(() => h.created(params, entry.after));
      if (entry.before && !entry.after && h.deleted) jobs.push(() => h.deleted(params, entry.before));
    }
  }
  if (!jobs.length) return;
  setTimeout(() => {
    for (const job of jobs) {
      const writes = job();
      if (writes && writes.length) _commit(writes, { triggers: false });
    }
  }, LATENCY_MS);
}
