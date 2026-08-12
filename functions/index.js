const { setGlobalOptions } = require("firebase-functions/v2");
const {
  onDocumentCreated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// -------- Setup --------
setGlobalOptions({
  region: "us-central1",
  memory: "256MiB",
  concurrency: 40, // safe & snappy
});

initializeApp();
const db = getFirestore();
const ts = FieldValue.serverTimestamp;

// Helpers
const inc = (field, by = 1) => ({ [field]: FieldValue.increment(by) });

async function getUserProfile(uid) {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    return {
      name: snap.get("displayName") || "Someone",
      avatar: snap.get("photoURL") || null,
    };
  } catch {
    return { name: "Someone", avatar: null };
  }
}

async function pushToUser(uid, title, body, data = {}) {
  try {
    const user = await db.doc(`users/${uid}`).get();
    const tokens = user.get("fcmTokens") || [];
    if (!Array.isArray(tokens) || tokens.length === 0) return;

    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
  } catch {
    // ignore push errors (tokens can be stale)
  }
}

async function writeNotification(targetUid, notifId, payload) {
  // Writes under notifications/{uid}/items/{notifId}
  await db
    .collection("notifications")
    .doc(targetUid)
    .collection("items")
    .doc(notifId)
    .set(
      {
        userId: targetUid,
        isRead: false,
        createdAt: ts(),
        ...payload,
      },
      { merge: true }
    );
}

// =======================================================
// FOLLOW: create + delete follower docs
// Structure: follows/{targetUid}/followers/{meUid}
// Also mirror: follows/{meUid}/following/{targetUid} is written by client
// =======================================================

exports.onFollowerAdded = onDocumentCreated(
  "follows/{targetUid}/followers/{meUid}",
  async (event) => {
    const { targetUid, meUid } = event.params;
    if (!targetUid || !meUid || targetUid === meUid) return;

    const actor = await getUserProfile(meUid);
    const notifId = `follow:${meUid}`;

    // 1) Notification
    await writeNotification(targetUid, notifId, {
      type: "follow",
      actor: { id: meUid, name: actor.name, avatar: actor.avatar },
      entity: { type: "user", id: meUid },
      message: `${actor.name} started following you`,
      url: `/u/${meUid}`,
    });

    // 2) Counters (target: followersCount, me: followingCount)
    const batch = db.batch();
    batch.set(db.doc(`users/${targetUid}`), inc("followersCount", +1), {
      merge: true,
    });
    batch.set(db.doc(`users/${meUid}`), inc("followingCount", +1), {
      merge: true,
    });
    await batch.commit();

    // 3) Optional push
    await pushToUser(
      targetUid,
      "New follower",
      `${actor.name} started following you`,
      {
        type: "follow",
        actorId: meUid,
        url: `/u/${meUid}`,
      }
    );
  }
);

exports.onFollowerRemoved = onDocumentDeleted(
  "follows/{targetUid}/followers/{meUid}",
  async (event) => {
    const { targetUid, meUid } = event.params;
    if (!targetUid || !meUid || targetUid === meUid) return;

    // Get current counts to prevent going negative
    const targetUserSnap = await db.doc(`users/${targetUid}`).get();
    const meUserSnap = await db.doc(`users/${meUid}`).get();

    const targetFollowersCount = targetUserSnap.get("followersCount") || 0;
    const meFollowingCount = meUserSnap.get("followingCount") || 0;

    const batch = db.batch();
    // Only decrement if count is greater than 0
    if (targetFollowersCount > 0) {
      batch.set(db.doc(`users/${targetUid}`), inc("followersCount", -1), {
        merge: true,
      });
    }
    if (meFollowingCount > 0) {
      batch.set(db.doc(`users/${meUid}`), inc("followingCount", -1), {
        merge: true,
      });
    }
    await batch.commit();
  }
);

// =======================================================
// LIKE: posts/{postId}/likes/{actorId}
// Also updates posts.likeCount
// =======================================================

exports.onLikeCreate = onDocumentCreated(
  "posts/{postId}/likes/{actorId}",
  async (event) => {
    const { postId, actorId } = event.params;

    const postSnap = await db.doc(`posts/${postId}`).get();
    if (!postSnap.exists) return;

    const ownerId = postSnap.get("author.uid") || postSnap.get("uid");
    if (!ownerId || ownerId === actorId) return;

    // Notification
    const actor = await getUserProfile(actorId);
    const notifId = `like:${postId}:${actorId}`;

    await writeNotification(ownerId, notifId, {
      type: "like",
      actor: { id: actorId, name: actor.name, avatar: actor.avatar },
      entity: { type: "post", id: postId },
      message: `${actor.name} liked your post`,
      url: `/post/${postId}`,
    });

    // likeCount++
    await db.doc(`posts/${postId}`).set(inc("likeCount", +1), { merge: true });

    // Optional push
    await pushToUser(ownerId, "New like", `${actor.name} liked your post`, {
      type: "like",
      postId,
      actorId,
    });
  }
);

exports.onLikeDelete = onDocumentDeleted(
  "posts/{postId}/likes/{actorId}",
  async (event) => {
    const { postId } = event.params;
    await db.doc(`posts/${postId}`).set(inc("likeCount", -1), { merge: true });
  }
);

// =======================================================
// COMMENT: posts/{postId}/comments/{commentId}
// Also updates posts.commentCount
// =======================================================

exports.onCommentCreate = onDocumentCreated(
  "posts/{postId}/comments/{commentId}",
  async (event) => {
    const { postId, commentId } = event.params;
    const c = event.data?.data() || {};
    const actorId = c.actorId || c.userId || c.author?.uid;
    if (!actorId) return;

    const postSnap = await db.doc(`posts/${postId}`).get();
    if (!postSnap.exists) return;

    const ownerId = postSnap.get("author.uid") || postSnap.get("uid");
    if (!ownerId || ownerId === actorId) return;

    const actor = await getUserProfile(actorId);
    const notifId = `comment:${postId}:${commentId}`;

    await writeNotification(ownerId, notifId, {
      type: "comment",
      actor: { id: actorId, name: actor.name, avatar: actor.avatar },
      entity: { type: "post", id: postId },
      message: `${actor.name} commented on your post`,
      url: `/post/${postId}#comment-${commentId}`,
      preview: c.text ? String(c.text).slice(0, 140) : "",
    });

    await db
      .doc(`posts/${postId}`)
      .set(inc("commentCount", +1), { merge: true });

    await pushToUser(
      ownerId,
      "New comment",
      `${actor.name} commented on your post`,
      {
        type: "comment",
        postId,
        actorId,
        commentId,
      }
    );
  }
);

exports.onCommentDelete = onDocumentDeleted(
  "posts/{postId}/comments/{commentId}",
  async (event) => {
    const { postId } = event.params;
    await db
      .doc(`posts/${postId}`)
      .set(inc("commentCount", -1), { merge: true });
  }
);

// =======================================================
// MESSAGES: chats/{chatId}/messages/{messageId}
// Notifies all participants except sender; optional push
// Expect chat doc: chats/{chatId} with { participants: [uid1, uid2, ...] }
// Message doc: { senderId, text, createdAt, ... }
// =======================================================

exports.onMessageCreate = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const { chatId, messageId } = event.params;
    const m = event.data?.data() || {};
    const senderId = m.senderId || m.userId;
    if (!senderId) return;

    const chat = await db.doc(`chats/${chatId}`).get();
    if (!chat.exists) return;

    const participants = chat.get("participants") || [];
    if (!Array.isArray(participants) || participants.length === 0) return;

    const sender = await getUserProfile(senderId);
    const preview = m.text ? String(m.text).slice(0, 90) : "New message";

    // fan-out notifications to all recipients except sender
    const writes = [];
    for (const uid of participants) {
      if (uid === senderId) continue;
      const notifId = `message:${chatId}:${messageId}`;

      writes.push(
        writeNotification(uid, notifId, {
          type: "message",
          actor: { id: senderId, name: sender.name, avatar: sender.avatar },
          entity: { type: "chat", id: chatId },
          message: `${sender.name}: ${preview}`,
          url: `/chat/${chatId}`,
        })
      );

      // optional push
      writes.push(
        pushToUser(uid, `Message from ${sender.name}`, preview, {
          type: "message",
          chatId,
          senderId,
          messageId,
        })
      );
    }

    await Promise.allSettled(writes);
  }
);
