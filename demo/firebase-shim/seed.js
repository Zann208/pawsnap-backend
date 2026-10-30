// Sample data for the PawSnap demo. Written once per browser through the same
// write path and triggers as live use, so counters and notifications are real.
import { state, save, Timestamp } from "./core.js";
import { _commit } from "./firestore.js";

const H = 3600e3;
const ago = (h) => Timestamp.fromMillis(Date.now() - h * H);

export const DEMO_EMAIL = "demo@pawsnap.app";
export const DEMO_PASSWORD = "pawsnap";

const pets = [
  { uid: "demo-mochi", name: "Mochi", bio: "Shiba Inu from Chiang Mai. Professional napper, part-time sock thief.", email: DEMO_EMAIL, password: DEMO_PASSWORD },
  { uid: "demo-pepper", name: "Pepper", bio: "Tabby. Window supervisor. Judges everyone's breakfast." },
  { uid: "demo-biscuit", name: "Biscuit", bio: "Golden retriever. Will fetch anything except the thing you threw." },
  { uid: "demo-luna", name: "Luna", bio: "Night shift only. Moves when the bowl is empty." },
  { uid: "demo-nugget", name: "Nugget", bio: "Corgi. Short legs, big plans." },
];
const avatar = (uid) => `demo/avatars/${uid.replace("demo-", "")}.svg`;

const posts = [
  { id: "p-mochi-sun", uid: "demo-mochi", img: "mochi-sun", h: 30, text: "Found the sunniest spot on the balcony. Not moving until dinner." },
  { id: "p-pepper-window", uid: "demo-pepper", img: "pepper-window", h: 26, text: "Supervising the birds again. They are not following the rules." },
  { id: "p-biscuit-ball", uid: "demo-biscuit", img: "biscuit-ball", h: 20, text: "Brought the ball back. Then took it away again. Training is going well." },
  { id: "p-luna-night", uid: "demo-luna", img: "luna-night", h: 14, text: "Midnight snack review: four out of five. The bowl could be fuller." },
  { id: "p-nugget-hike", uid: "demo-nugget", img: "nugget-hike", h: 8, text: "First hike up the mountain. Legs tired, heart full." },
  { id: "p-mochi-bath", uid: "demo-mochi", img: "mochi-bath", h: 3, text: "Bath day. Under protest." },
];

const follows = [
  ["demo-mochi", "demo-pepper"], ["demo-mochi", "demo-biscuit"], ["demo-mochi", "demo-nugget"],
  ["demo-pepper", "demo-mochi"], ["demo-biscuit", "demo-mochi"], ["demo-luna", "demo-mochi"], ["demo-nugget", "demo-mochi"],
  ["demo-biscuit", "demo-nugget"], ["demo-nugget", "demo-biscuit"], ["demo-luna", "demo-pepper"], ["demo-pepper", "demo-luna"],
];
const likes = [
  ["p-mochi-sun", ["demo-pepper", "demo-biscuit", "demo-nugget"]],
  ["p-pepper-window", ["demo-mochi", "demo-luna"]],
  ["p-biscuit-ball", ["demo-mochi", "demo-nugget", "demo-pepper"]],
  ["p-luna-night", ["demo-pepper"]],
  ["p-nugget-hike", ["demo-biscuit", "demo-mochi", "demo-luna"]],
  ["p-mochi-bath", ["demo-biscuit", "demo-luna"]],
];
const comments = [
  ["p-mochi-sun", "demo-pepper", 28, "Save me a corner of that sun."],
  ["p-mochi-sun", "demo-biscuit", 27, "Dinner is in five hours. Respect."],
  ["p-biscuit-ball", "demo-nugget", 19, "Classic Biscuit."],
  ["p-nugget-hike", "demo-biscuit", 7, "Next time take me with you!"],
  ["p-mochi-bath", "demo-luna", 2, "This is why I never get caught."],
];
const chats = [
  { a: "demo-mochi", b: "demo-pepper", msgs: [["demo-pepper", 5, "Are you on the balcony again?"], ["demo-mochi", 4.9, "Obviously. Best seat in the building."], ["demo-pepper", 4.8, "Fine. I'll take the window."]] },
  { a: "demo-mochi", b: "demo-biscuit", msgs: [["demo-biscuit", 2, "Park on Saturday? I'll bring the ball."], ["demo-biscuit", 1.9, "Maybe two balls."]] },
];

function seed() {
  for (const p of pets) {
    state.accounts[p.uid] = { email: p.email || `${p.uid}@pawsnap.app`, password: p.password || null, displayName: p.name, photoURL: avatar(p.uid) };
  }
  const base = [];
  pets.forEach((p, i) => base.push({ kind: "set", path: `users/${p.uid}`, data: {
    uid: p.uid, email: state.accounts[p.uid].email, displayName: p.name, photoURL: avatar(p.uid), bio: p.bio,
    followersCount: 0, followingCount: 0, createdAt: ago(24 * (30 - i)),
  } }));
  for (const p of posts) {
    const pet = pets.find((x) => x.uid === p.uid);
    base.push({ kind: "set", path: `posts/${p.id}`, data: {
      uid: p.uid, text: p.text, images: [`demo/posts/${p.img}.svg`], likeCount: 0, commentCount: 0, createdAt: ago(p.h),
      author: { uid: p.uid, displayName: pet.name, photoURL: avatar(p.uid) },
    } });
    base.push({ kind: "set", path: `users/${p.uid}/posts/${p.id}`, data: { ref: `posts/${p.id}`, createdAt: ago(p.h) } });
  }
  for (const c of chats) {
    const id = [c.a, c.b].sort().join("_");
    const last = c.msgs[c.msgs.length - 1];
    base.push({ kind: "set", path: `chats/${id}`, data: {
      participants: [c.a, c.b], createdAt: ago(48), lastMessageText: last[2], lastMessageAt: ago(last[1]), typing: {}, lastSeen: {}, type: "direct",
    } });
  }
  _commit(base, { triggers: false });

  // Social activity goes through the triggers, like real client writes.
  const social = [];
  const pet = (uid) => pets.find((x) => x.uid === uid);
  for (const [me, target] of follows) {
    social.push({ kind: "set", path: `follows/${target}/followers/${me}`, data: { uid: me, displayName: pet(me).name, photoURL: avatar(me), createdAt: ago(100) } });
    social.push({ kind: "set", path: `follows/${me}/following/${target}`, data: { uid: target, displayName: pet(target).name, photoURL: avatar(target), createdAt: ago(100) } });
  }
  for (const [postId, uids] of likes) for (const u of uids) social.push({ kind: "set", path: `posts/${postId}/likes/${u}`, data: { uid: u, createdAt: ago(1) } });
  comments.forEach(([postId, uid, h, text], i) => social.push({ kind: "set", path: `posts/${postId}/comments/c${i + 1}`, data: {
    text, createdAt: ago(h), author: { uid, displayName: pet(uid).name, photoURL: avatar(uid) },
  } }));
  for (const c of chats) {
    const id = [c.a, c.b].sort().join("_");
    c.msgs.forEach(([sender, h, text], i) => social.push({ kind: "set", path: `chats/${id}/messages/m${i + 1}`, data: { senderId: sender, text, imageUrl: null, createdAt: ago(h) } }));
  }
  _commit(social);
  state.seeded = true;
  save();
}

if (!state.seeded) seed();
