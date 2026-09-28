# CONNECT

A campus academic discussion platform: students and mentors post doubts, answer
each other, discuss in subject channels, message one to one, and moderators keep
the commons clean — backed entirely by Firebase (Auth, Firestore, Storage,
Hosting).

> **CONNECT** is the product name. Always use `CONNECT` in copy, docs and UI.

---

## Features

| Area | What works |
| --- | --- |
| Auth | Email/password sign-up, sign-in, sign-out, protected routes, role-aware redirects (`student`, `mentor`, `moderator`, `admin`), domain-gated sign-up |
| Doubts | Post with title/body/category/tags/code, draft autosave, approve/edit/delete, upvote/downvote, accept answers, comments, view counts |
| Answers & discussions | Answers with code snippets, threaded comments, mentions (`@handle`), notifications, real-time-ish refresh |
| Channels | Subject-channel browsing, channel detail, pinned content, catalog search, question counts |
| Profiles | Public profiles, reputation, badges, activity stats, follow/unfollow |
| Messaging | One-to-one threads, deterministic conversation ids, per-member read cursors, unread badges, code snippets in messages |
| Moderation | Report content, moderator queue, dismiss/resolve/delete-content, academic warnings |
| Admin | Announcements, audit trail, policy settings (approval required, spam auto-flag, allowed domain, min reputation), analytics |
| Search | Doubts / answers / users / channels with tabbed results |

Admin analytics and dashboards derive every figure from live store data — there
is no hard-coded metric.

---

## Architecture

```
UI (pages, components)
  └─ context / hooks          AppContext, useAdmin, useMessages, useAuth
       └─ services            messageService, reportService, adminService,
                              doubtService, answerService, userService, ...
            └─ adapters       *Adapter interfaces (one per domain)
                 └─ Firebase SDK  (firebaseXAdapter)  ─ or ─
                                  fakeXAdapter (tests)
```

* **Adapters are injectable.** Every service gets its adapter through
  `getXAdapter()`, and tests call `setXAdapter(fake)` then
  `setXAdapter(null)` to restore Firebase. This is how all service tests run
  hermetically — no network, no emulator.
* **Store helper:** `src/lib/store.ts` exposes `createStore` / `useStore` with a
  `LoadStatus` of `'loading' | 'ready' | 'error'`.
* **Security lives in `firestore.rules`.** Client code never decides
  permissions; it only writes shapes the rules accept.

---

## Prerequisites

* **Node.js** 20+ and npm
* **Firebase CLI** — `npm i -g firebase-tools` (auth once with `firebase login`)
* **JDK 21+** only if you run the Firestore emulator (see [Emulators](#emulators))

---

## Run locally

```bash
npm install
cp .env.example .env      # then fill in your Firebase web config
npm run dev               # http://localhost:3000
```

### Environment

`.env.example` documents every variable. The `VITE_FIREBASE_*` values
**identify** your Firebase app — they are not secrets. Security is enforced by
Firebase Auth, Firestore Security Rules and App Check, never by hiding config.

Never commit `.env`, service-account JSON or private keys (both are
git-ignored).

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Type-check-free production build into `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | `tsc --noEmit` — type-check only |
| `npm run test` | Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run admin:create` | Create/promote an admin account (Admin SDK) |
| `npm run admin:cleanup-mock` | Remove seeded/mock user documents |
| `npm run catalog:seed` | Seed the subject catalog |

---

## Firebase

Configured project: **`connect-yb`** (see `.firebaserc`).

| File | Purpose |
| --- | --- |
| `firebase.json` | Firestore rules/indexes, SPA hosting rewrites, emulator ports |
| `firestore.rules` | **All** read/write authorization |
| `firestore.indexes.json` | Composite indexes |

### Deploy

```bash
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

Hosting is also deployed by CI (`.github/workflows/firebase-hosting-merge.yml`)
on pushes to `main`, and preview-deployed for pull requests
(`firebase-hosting-pull-request.yml`). Both install with `npm ci`, write the
public Firebase web config out of `.env.example`, run `npm run lint` and
`npm run test`, then build — so a red type-check or test run blocks the deploy.

> **One repository secret is required for CI:** `FIREBASE_SERVICE_ACCOUNT_CONNECT_YB`
> (a service-account JSON key with Firebase Hosting admin). Until it exists,
> push deploys from CI will fail and `firebase deploy` from a machine that is
> already logged in remains the working path.

Live site: `https://connect-yb.web.app`

### Emulators

```bash
firebase emulators:exec --only firestore --project connect-yb "npm run test"
```

On Windows the Firebase CLI refuses to start the emulator on an old JRE. Point
it at a modern JDK first:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.2'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
firebase emulators:exec --only firestore --project connect-yb "echo RULES_OK"
```

Rules are verified against the emulator with `@firebase/rules-unit-testing`
(see `firestore.rules` for the invariants each block enforces).

---

## Testing

* **Unit/service tests** (`src/services/*.test.ts`) run against fake adapters —
  fast, offline, deterministic. They cover validation, error mapping, unread
  derivation, duplicate reports, audit writes and denied-permission copy.
* **Pure-logic tests** cover mention parsing, route access, privacy queries and
  error translation.
* **Rules tests** run against the Firestore emulator and are the source of
  truth for what a non-admin member can and cannot do.

Run everything:

```bash
npm run lint && npm run test && npm run build
```

---

## Project layout

```
src/
  adapters/         (see services/*Adapter.ts)
  components/       cards, layout, ui
  context/          AppContext, auth session
  hooks/            useAuth, useAdmin, useMessages, ...
  lib/              firebase, store, route access, errors
  pages/            route-level screens (admin, messages, doubts, ...)
  services/         domain services + Firebase adapters + fakes
  types/            shared domain types
scripts/            Admin SDK maintenance scripts
```
