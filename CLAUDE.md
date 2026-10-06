# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev     # tsx watch server.ts — custom unified server (Next.js + WebSocket) on :3000
npm run build   # next build
npm start       # NODE_ENV=production tsx server.ts (same unified server)
npm run lint    # eslint
npm run test:realtime   # realtime e2e (needs local mongod)
npm run test:rehab      # schedule + rep-chunking unit tests (node:test via tsx, no database)
npm run test:rehab:e2e  # rehab workflow e2e: real route handlers, throw-away mongod, local SMTP sink
npm run migrate:plans   # legacy ExerciseAssignment -> Prescription (dry run; add --apply to write)
```

- `npm run dev` must go through `server.ts`, not `next dev`, or `/api/ws` won't upgrade locally. The old `socket-server.js` / Socket.IO server is gone.
- Env vars (see `.env.example`): Clerk keys + `CLERK_WEBHOOK_SECRET`, `MONGODB_URI`, optional `NEXT_PUBLIC_WS_URL`, Gmail app credentials for email. `.env.local` is loaded by `server.ts` via dotenv. Groq is used for LLM feedback.
- Path alias: `@/*` → repo root. Next.js 16 / React 19 / Tailwind v4 — check `node_modules/next/dist/docs/` before using Next APIs (see AGENTS.md).
- `NEXT_DIST_DIR=.next-verify npx next build` builds without touching a running dev server's `.next`.
- `ARCHITECTURE_AUDIT.md` documents known issues (React 19 ref-in-render lint errors in `hooks/useExerciseEngine.ts`, sessions stored only in `localStorage`, mock patient/doctor seed data under `services/doctors`, etc.) and the migration roadmap. `README.md` describes the product. `PROJECT_RULES.md` / `GSD-STYLE.md` are generic GSD-methodology docs, not repo-specific code rules.

## Architecture

RehabLens is a telehealth + camera-based rehab app with two roles: **patient** and **therapist** (Clerk-authenticated; role set during `/onboarding` via `app/api/onboarding/*` and synced by `app/api/webhooks/clerk`).

**Routing:** App Router with route groups `app/(patient)`, `app/(therapist)`, `app/(auth)`, plus top-level `chat/[id]` and `consultation/[id]` (shared by both roles). Server logic lives in `app/api/**` route handlers that talk to MongoDB through Mongoose models in `models/` using the cached connection in `lib/mongodb.ts`.

**Exercise pipeline (all client-side, no video leaves the browser):** MediaPipe pose landmarks (`lib/pose`) → joint angles / ROM / tempo (`lib/biomechanics`) → exercise engine and rep state machine (`lib/engine`, `lib/exercises`) → feedback (`lib/feedback`, `lib/engine/groqFeedback.ts`, deterministic rules plus Groq LLM via `app/api/feedback`). `hooks/useExerciseEngine.ts` wires it into React. New exercises are a config file in `lib/exercises/` registered in `lib/exercises/registry.ts` (with a template in `lib/engine/templates`). `lib/recommendations` and `lib/session/sessionStore.ts` handle recommendations and session persistence.

**Realtime (single Next.js app, no separate socket server):** one WebSocket endpoint, `/api/ws/` (trailing slash — `trailingSlash:true` would 308 the bare path and WebSockets can't follow redirects).
- Local dev: `server.ts` creates the HTTP server, hands requests to Next and upgrades `/api/ws` itself with `ws`. `npm start` also runs `server.ts` (production mode). Vercel: `app/api/ws/route.ts` upgrades with `@vercel/functions` `experimental_upgradeWebSocket`. Both call `RealtimeServer.getInstance().registerClient`.
- **Never rely on process memory across requests.** Patient and therapist sockets land on different instances on Vercel, so every fan-out goes through `lib/realtime/server/bus.ts`: documents in the TTL'd `RealtimeSignal` collection, tailed by each instance via a change stream (polling fallback on standalone mongod). Presence is in `RealtimePresence`; call state lives on `Consultation` (`callStatus`, `callInitiatorId`, `callUpdatedAt`) and is driven by `server/callService.ts`.
- `lib/realtime/protocol`: typed event dictionary (`RealtimeEvent`), payloads, `Rooms` ids, runtime packet validation. Clients may only send `CLIENT_TO_SERVER_EVENTS`; anything else is rejected. `CHAT_MESSAGE`, `MESSAGE_READ`, `PRESCRIPTION_RECEIVED` are server-published only.
- Auth: `lib/realtime/auth/verifier.ts` verifies the Clerk JWT (`?token=`) and resolves role from Mongo; `getIdentityFromRequest` does the same for REST. Rooms are authorized on join and each packet must target a joined room. `REALTIME_DEV_AUTH=1` (non-production only) enables `dev_test_<id>:<role>:<name>` tokens for tests.
- Chat has ONE write path: authenticated REST POST (`/api/chat/[id]`, `/api/consultation/[id]/messages`, idempotent via `clientId`) → `server/chatService.ts` persists then publishes. History/resync (`?since=`) comes from REST after every reconnect.
- Client: `lib/realtime/client` (`RealtimeClient`, `useRealtime`, `useChat`, `useConsultation`) and `lib/webrtc` (`callMachine`, `PeerSession`, `useWebRTC`). Components must use the hooks, not raw sockets/RTCPeerConnection. Media is peer-to-peer; the server only relays signaling.
- Tests: `npm run test:realtime` (add `-- --standalone` for the polling bus) spawns a throw-away local mongod plus two realtime server processes (`scripts/realtime-test-server.ts`); needs `mongod` on PATH and never touches `.env.local`'s database.

**Rehabilitation workflow (plan → today → sets → reports):** the product loop is therapist plan → patient sets → weekly review.
- `models/Prescription.ts` is the ONE source of truth for what a patient must do (lifecycle draft/active/paused/completed/cancelled, immutable versions via `supersedesId`, dates as `YYYY-MM-DD` strings in the patient's timezone, optional `weeklyReview`, medication *record*). `ExerciseAssignment` is legacy: nothing writes "assigned" rows and nothing reads them (migrate with `npm run migrate:plans`).
- `lib/rehab/` — `dates` + `schedule` (pure: due exercises, set progress, adherence, review days; "today" is never stored, it is derived from the plan plus `ExerciseSession` logs), `chunking` (rep chunking rules), `prescriptionService`, `sessionService` (`getPlanSnapshot`, `recordChunk`: one `ExerciseSession` per prescribed exercise per day, optimistic concurrency, idempotent by `chunkId`), `weeklyReport` (stored data only, no conclusions), `reminders` (the daily job), `notifier` (unique `dedupeKey` per user so nothing is sent twice), `auth` (server-side authorization helpers), `chunkOutbox` + `useReviewRecording` (client).
- Routes: `/api/prescriptions[/id]`, `/api/patient/plan` (+ `/sets`, `/discomfort`), `/api/patient/{medications,notifications,weekly-reviews}`, `/api/therapist/weekly-reviews`, `/api/weekly-reviews/[id]`, `/api/recordings` (+ `/upload`, `/[id]`), `/api/cron/daily` (Bearer `CRON_SECRET`; refuses when the secret is unset). Authorization is server-side from the Clerk identity only; patients reach only their own data, therapists only patients with an active `TherapistAssignment`.
- Email is Nodemailer in `lib/email` (server-only; `SMTP_*`, `EMAIL_FROM`, falls back to `GOOGLE_APP_*`). Recordings are PRIVATE Vercel Blob objects behind `lib/storage/recordingStorage.ts`; the browser uploads with a scoped token and playback streams through an authorised route. Never expose a storage URL. Only exercises with an engine template are prescribable (`lib/rehab/exerciseCatalog.ts`).
- UI: `components/prescription` (builder), `components/review` (reports, reviews list, recording player), `components/exercise/PrescribedSession` (set-by-set live flow), `components/patient/PatientHome`, `components/landing`. The `/ui-preview` route is development-only fixtures for design review.

**Other:** `electron/` is a separate desktop wrapper with its own `package.json`. `services/` holds doctor/voice helpers. UI primitives are Shadcn-style in `components/ui`.
