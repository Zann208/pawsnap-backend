# PawSnap live demo

**Open it:** https://zann208.github.io/pawsnap/
Sign in as `demo@pawsnap.app` / `pawsnap`, or register any email.

The original deployment needed the team's Firebase project, which is no longer
connected. This build runs the team's final front end unchanged in its features,
with Firebase swapped for an in-browser stand-in, so it works anywhere with no
accounts, keys or costs. Data stays in the visitor's browser (localStorage) and
can be reset from the demo notice.

## How it works

| Part | What it does |
|---|---|
| `firebase-shim/` | A local `firebase` package exposing the subset of `firebase/app`, `firebase/auth`, `firebase/firestore` and `firebase/storage` the app uses: documents and subcollections, `where` / `orderBy` / `limit` queries, live `onSnapshot` listeners, batches, `increment` / `arrayUnion` / `serverTimestamp`, email and password accounts, and image uploads stored as downscaled data URLs. |
| `firebase-shim/functions.js` | A direct port of [`functions/index.js`](../functions/index.js): the follower, like, comment and message triggers run after each write with the same paths, counter guards and notification IDs. Push messaging is omitted. |
| `firebase-shim/seed.js` | Five sample pets with posts, follows, likes, comments and two chats. Seeding goes through the triggers, so counters and notifications are produced the same way as live use. |
| `make_art.py` | Generates the flat SVG avatars and post illustrations used by the seed data. |
| `app.patch`, `DemoBar.js` | The only changes to the team's app: hash routing and relative paths for GitHub Pages hosting, prefilled demo credentials, chat list names instead of raw user IDs, Tailwind compiled at build time instead of the CDN script, and the demo notice. |

## Rebuild

```bash
demo/build.sh            # clones MawinSkalet/Petsnaps at a132e1d, applies the patch, builds
# output: demo/.work/app/build
```

Requires Node 18+ and Python 3 (Pillow optional, for the favicon).
