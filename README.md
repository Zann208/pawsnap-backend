# PawSnap — Backend

The backend and data layer I wrote for **PawSnap**, a pet social platform
built by a team of three at Chiang Mai University in October 2025.

**Live demo:** https://zann208.github.io/pawsnap/ (runs in the browser with sample data; see [`demo/`](demo/))

This repository contains **only the files I authored.** It is an extract, not
the whole application. The complete project, including the React front end,
lives at **[MawinSkalet/Petsnaps](https://github.com/MawinSkalet/Petsnaps)**.

## The team

| | Role |
|---|---|
| [Zann208](https://github.com/Zann208) (me) | Backend: Cloud Functions, Firestore rules, Firebase integration, service layer |
| [letsliz](https://github.com/letsliz) | Backend |
| [MawinSkalet](https://github.com/MawinSkalet) | Front end, repository owner |

## What I built

**Cloud Functions** (`functions/index.js`) — seven Firestore triggers running on
Firebase Functions v2. They keep every derived count and every notification on
the server, so a client cannot forge them:

| Trigger | Does |
|---|---|
| `onFollowerAdded` / `onFollowerRemoved` | maintain `followersCount` and `followingCount`, guarded against going negative |
| `onLikeCreate` / `onLikeDelete` | maintain `likeCount` on the parent post |
| `onCommentCreate` / `onCommentDelete` | maintain `commentCount` on the parent post |
| `onMessageCreate` | fan out notifications to every chat participant except the sender |

Counters use `FieldValue.increment()` rather than read-modify-write, so
concurrent likes cannot lose updates. Notification IDs are deterministic
(`like:{postId}:{actorId}`), which makes repeated writes idempotent instead of
producing duplicate notifications.

**Firebase integration** (`src/firebase.js`, `firebase.json`) — SDK
initialisation reading config from environment variables. No credentials are
committed; see `.env.example`.

**Service layer** (`src/services/`) — the API surface the front end calls:

- `chatApi.js` — direct chats with deterministic IDs, live message streams, typing and last-seen state
- `likesApi.js` — likes as a subcollection keyed by uid, so a user cannot like twice
- `notificationsApi.js` — reads the notification feed written by the functions
- `socialApi.js` — follow and unfollow
- `postApi.js` — post creation and queries

**Auth** (`src/context/AuthContext.js`, `src/components/ProtectedRoute.jsx`,
`src/hooks/`) — auth state and route guarding.

**Firestore security rules** (`firestore.rules`) — per-collection authorisation.
Chats and messages are restricted to their participants:

```js
match /chats/{chatId} {
  allow read: if isSignedIn() && request.auth.uid in resource.data.participants;

  match /messages/{messageId} {
    allow read: if isSignedIn() &&
      request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
  }
}
```

Notifications are owner-only. Profiles and posts are world-readable by design,
since the feed is public.

## Design notes

Likes are written to `posts/{postId}/likes/{uid}` and the counter is updated by
a Cloud Function, not the client. This means the like count on a post is only
ever written by trusted server code. The same pattern applies to comments and
follower counts.

## Running it

These files are a subset of a Create React App project and will not build on
their own. To run the full application, clone the
[main repository](https://github.com/MawinSkalet/Petsnaps) and follow its README.

To deploy just the functions against your own Firebase project:

```bash
cd functions && npm install
firebase use --add          # select your project
firebase deploy --only functions
```
