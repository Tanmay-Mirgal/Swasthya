# RehabLens — Comprehensive Architecture Audit & Migration Roadmap

**Audit Date:** October 2026  
**Repository:** `rehablens`  
**Framework & Runtime:** Next.js 16.3.5 (App Router), React 19.2.8, Tailwind CSS v4, Node.js  
**Status:** Audit Complete — Ready for Next Phases (Zero production code modified)

---

## Executive Summary

RehabLens is a physical rehabilitation platform combining client-side computer vision (MediaPipe Tasks Vision), biometric angle calculations, deterministic and LLM-assisted coaching (Groq), Clerk authentication, MongoDB persistence, and telehealth consultations (WebRTC video & real-time chat).

While the computer vision and biomechanical analysis pipeline is sophisticated and functional on the client, the application currently suffers from:
1. A **hard external dependency on a standalone Node.js Socket.IO server** (`socket-server.js` on port 3001) that prevents deployment to Vercel.
2. **Disconnected persistence loops**: completed exercise sessions are written only to browser `localStorage` and fail to sync with MongoDB, redirecting patients to a non-existent `404` route (`/exercise/[exerciseId]/summary`).
3. **Ghost mock authentication pages** (`/login`, `/signup`) that bypass Clerk and create redirect loops.
4. **Hardcoded mock patient records** (`pat_1`, `pat_2`) and seed doctors (`doc_aarti_sharma`, etc.) that coexist with real MongoDB schemas.
5. **34 React 19 / ESLint compiler errors** (specifically ref-access during render in `useExerciseEngine.ts`) that block production builds.

This document details the complete audit of the codebase and establishes a phase-by-phase roadmap to consolidate RehabLens into a **100% single Next.js application ready for native Vercel deployment**.

---

## A. Current Architecture

```
                                  ┌────────────────────────────────────────┐
                                  │           Client (Browser)             │
                                  └──────────────────┬─────────────────────┘
                                                     │
                    ┌────────────────────────────────┼────────────────────────────────┐
                    │                                │                                │
                    ▼                                ▼                                ▼
         ┌─────────────────────┐          ┌─────────────────────┐          ┌────────────────────┐
         │ MediaPipe Tasks CV  │          │    Clerk React SDK  │          │  WebRTC Peer Conn  │
         │ - WebAssembly GPU   │          │ - useAuth / useUser │          │ - Audio/Video P2P  │
         │ - 33 3D Landmarks   │          │ - JWT Bearer Token  │          │ - Direct Media     │
         │ - 60 FPS Loop       │          └──────────┬──────────┘          └─────────▲──────────┘
         └──────────┬──────────┘                     │                               │
                    │                                │ (Authorization Header)        │ (Signaling)
                    ▼                                ▼                               │
         ┌─────────────────────┐          ┌─────────────────────┐                    │
         │ Biomechanics Engine │          │ Next.js App Router  │                    │
         │ - Angle calculation │          │ (Port 3000)         │                    │
         │ - Rep state machine │          │ - Server Components │                    │
         │ - Issue detector    │          │ - API Route Handlers│                    │
         └──────────┬──────────┘          └──────────┬──────────┘                    │
                    │                                │                               │
                    ▼                                ▼                               ▼
         ┌─────────────────────┐          ┌─────────────────────┐          ┌────────────────────┐
         │  Voice & AI Cues    │          │ MongoDB (Mongoose)  │          │ Standalone Socket  │
         │ - Web Speech API    │          │ - User / Profiles   │          │ Server (Port 3001) │
         │ - Groq API proxy    │          │ - Consultations     │          │ - socket-server.js │
         └─────────────────────┘          │ - Prescriptions     │          │ - volatile memory  │
                                          └─────────────────────┘          └────────────────────┘
```

### 1. Route Map (Client Pages)
| Route Path | File Location | Purpose & Status |
|---|---|---|
| `/` | `app/page.tsx` | Patient Dashboard (if authenticated) or Splash intro (if guest). Routes therapists to `/therapist`. |
| `/(auth)/sign-in` | `app/(auth)/sign-in/page.tsx` | Real Clerk `<SignIn routing="hash" />` component. |
| `/(auth)/sign-up` | `app/(auth)/sign-up/page.tsx` | Real Clerk `<SignUp routing="hash" />` component. |
| `/(auth)/login` | `app/(auth)/login/page.tsx` | **Mock form** bypassing Clerk; triggers redirect loop. |
| `/(auth)/signup` | `app/(auth)/signup/page.tsx` | **Mock form** bypassing Clerk; triggers redirect loop. |
| `/(patient)/setup` | `app/(patient)/setup/page.tsx` | Role onboarding wizard (Patient concerns or Therapist credentials). |
| `/(patient)/appointments`| `app/(patient)/appointments/page.tsx` | Patient appointments list and status tracking. |
| `/(patient)/discover` | `app/(patient)/discover/page.tsx` | Clinical matching directory to find and book therapists. |
| `/(patient)/exercise` | `app/(patient)/exercise/page.tsx` | Exercise catalogue showing prescribed & available exercises. |
| `/(patient)/exercise/[exerciseId]` | `app/(patient)/exercise/[exerciseId]/page.tsx` | Server redirect to `.../setup`. |
| `/(patient)/exercise/[exerciseId]/setup` | `.../setup/CameraSetupClient.tsx` | Webcam framing, joint visibility verification checklist. |
| `/(patient)/exercise/[exerciseId]/live` | `.../live/LiveExerciseClient.tsx` | 60 FPS Pose detection, rep counting, HUD, voice coaching. |
| `/(patient)/session` | `app/(patient)/session/page.tsx` | Workout completion summary (`SessionSummary.tsx`). |
| `/(patient)/progress` | `app/(patient)/progress/page.tsx` | Adherence calendar, streak count, historical volume graphs. |
| `/(patient)/profile` | `app/(patient)/profile/page.tsx` | Patient health profile & concern editor. |
| `/(patient)/pose-test` | `app/(patient)/pose-test/page.tsx` | Developer debugging page for MediaPipe skeletal rendering. |
| `/(therapist)/therapist` | `app/(therapist)/therapist/page.tsx` | Therapist Portal (Patients, Consultations, Requests, Profile). |
| `/(therapist)/therapist-profile/[id]` | `.../therapist-profile/[id]/page.tsx` | Public clinical profile of a therapist for booking. |
| `/(therapist)/therapist/patient/[patientId]` | `.../patient/[patientId]/page.tsx` | Clinical patient detail, concerns, and assigned routines. |
| `/(therapist)/therapist/patient/[patientId]/prescribe` | `.../prescribe/page.tsx` | Exercise prescription editor (sets, reps, targets). |
| `/consultation/[id]` | `app/consultation/[id]/page.tsx` | WebRTC Telehealth consultation room + real-time chat + Rx modal. |
| `/chat/[id]` | `app/chat/[id]/page.tsx` | Direct 1-on-1 messaging between patient and therapist. |
| `/onboarding` | `app/onboarding/page.tsx` | 3-step feature introduction carousel. |
| `/splash` | `app/splash/page.tsx` | Branded platform entry splash screen. |

### 2. Backend API Routes
| Endpoint | Method | File Location | Purpose |
|---|---|---|---|
| `/api/webhooks/clerk` | `POST` | `app/api/webhooks/clerk/route.ts` | Svix-verified webhook for Clerk user sync. |
| `/api/onboarding/role` | `POST` | `app/api/onboarding/role/route.ts` | Sets user role (`patient` vs `therapist`). |
| `/api/onboarding/patient` | `POST` | `app/api/onboarding/patient/route.ts` | Saves patient concerns; auto-generates suggestions. |
| `/api/onboarding/therapist` | `POST` | `app/api/onboarding/therapist/route.ts` | Saves therapist qualifications, clinic, and conditions. |
| `/api/patient/dashboard` | `GET` | `app/api/patient/dashboard/route.ts` | Aggregates user plan, doctor, stats, and consultations. |
| `/api/patient/discover` | `GET` | `app/api/patient/discover/route.ts` | Returns matched therapists for patient concerns. |
| `/api/patient/recommendations` | `GET` | `app/api/patient/recommendations/route.ts` | Algorithmic exercise recommendations. |
| `/api/patient/appointment-request` | `POST, GET` | `app/api/patient/appointment-request/route.ts` | Creates and reads appointment booking requests. |
| `/api/patient/appointments` | `GET` | `app/api/patient/appointments/route.ts` | Retrieves upcoming/past patient appointments. |
| `/api/patient/session` | `GET, POST` | `app/api/patient/session/route.ts` | Fetches session history; persists new exercise logs. |
| `/api/therapist/dashboard` | `GET` | `app/api/therapist/dashboard/route.ts` | Stats, assigned patients, incoming requests. |
| `/api/therapist/profile` | `GET, PATCH` | `app/api/therapist/profile/route.ts` | Manages therapist clinical settings and fees. |
| `/api/therapist/public-profile/[id]` | `GET` | `.../public-profile/[id]/route.ts` | Public therapist profile data. |
| `/api/therapist/requests/[requestId]` | `POST` | `.../requests/[requestId]/route.ts` | Accepts/declines appointment requests. |
| `/api/therapist/patient/[patientId]` | `GET` | `.../patient/[patientId]/route.ts` | Patient clinical profile and exercise assignments. |
| `/api/therapist/patient/[patientId]/prescribe` | `POST` | `.../patient/[patientId]/prescribe/route.ts` | Creates assigned `ExerciseAssignment`. |
| `/api/chat/[doctorId]` | `GET, POST` | `app/api/chat/[doctorId]/route.ts` | Queries/saves direct messages between users. |
| `/api/consultation/start` | `POST` | `app/api/consultation/start/route.ts` | Creates/resumes active consultation session. |
| `/api/consultation/[id]` | `GET, PATCH` | `app/api/consultation/[id]/route.ts` | Fetches consultation; updates call/room status. |
| `/api/consultation/[id]/messages` | `GET, POST` | `.../messages/route.ts` | Consultation room chat history and message saving. |
| `/api/consultation/[id]/prescription` | `POST, GET` | `.../prescription/route.ts` | Issues prescription, updates plan, posts chat. |
| `/api/feedback` | `POST` | `app/api/feedback/route.ts` | Groq AI coaching cue generator with fallback. |
| `/api/test` | `POST` | `app/api/test/route.ts` | Healthcheck endpoint. |

### 3. Database Models & Schema Relationships
All user-facing entities reference Clerk User ID strings (`clerkUserId`), ensuring zero mismatch between Clerk authentication and MongoDB records:

```
                  ┌──────────────────────┐
                  │      User (Base)     │
                  │ - clerkUserId (PK)   │
                  │ - email, role        │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────┐
│    PatientProfile    │          │   TherapistProfile   │
│ - clerkUserId (FK)   │          │ - clerkUserId (FK)   │
│ - concerns: string[] │          │ - specialization     │
└──────────┬───────────┘          │ - fee, rating, clinic│
           │                      └──────────┬───────────┘
           │                                 │
           │    ┌────────────────────────────┤
           ▼    ▼                            ▼
┌────────────────────────┐      ┌────────────────────────┐
│  TherapistAssignment   │      │   AppointmentRequest   │
│ - patientId (FK)       │      │ - patientId (FK)       │
│ - therapistId (FK)     │      │ - therapistId (FK)     │
│ - status: active       │      │ - scheduledAt, status  │
└────────────────────────┘      └──────────┬─────────────┘
                                           │
           ┌───────────────────────────────┘
           ▼
┌────────────────────────┐      ┌────────────────────────┐
│      Consultation      │◄─────┤      Prescription      │
│ - patientId (FK)       │      │ - consultationId (ref) │
│ - doctorId (FK)        │      │ - patientId, doctorId  │
│ - roomStatus, callStat │      │ - medicines, exercises │
└──────────┬─────────────┘      └──────────┬─────────────┘
           │                               │
           ▼                               ▼
┌────────────────────────┐      ┌────────────────────────┐
│      ChatMessage       │      │   ExerciseAssignment   │
│ - consultationId (FK)  │      │ - patientId (FK)       │
│ - senderId, receiverId │      │ - exerciseId (slug)    │
│ - prescriptionData     │      │ - targetSets, reps     │
└────────────────────────┘      └────────────────────────┘
```

*   **`ExerciseSession`**: Standalone historical workout logs (`patientId`, `exerciseId`, `completedReps`, `rom`, `targetMet`, `date`).

### 4. Exercise Analysis & Biomechanics Pipeline
```
Webcam MediaStream
       │
       ▼
PoseDetector (HTMLVideoElement, 60 FPS requestAnimationFrame)
       │
       ▼
@mediapipe/tasks-vision (PoseLandmarker running on GPU / WebAssembly)
       │
       ├──> NormalizedLandmark[33]
       │
       ▼
smoothLandmarks (Exponential Moving Average smoothing across frames)
       │
       ├──> checkPoseConfidence (Validates joint visibility & user framing)
       │
       ├──> calculateAngle (3-point joint trigonometric dot product / vectors)
       │       - Neck: Nose & Shoulder lateral offset
       │       - Upper: Shoulder ── Elbow ── Wrist
       │       - Lower: Hip ── Knee ── Ankle
       │
       ├──> updateROM (Tracks minAngle, maxAngle, peak Range of Motion)
       │
       ├──> processRepFrame (Debounced biomechanical state machine)
       │       READY ──> EXTENDING ──> EXTENDED (Peak) ──> RETURNING ──> READY (+1 Rep)
       │
       ├──> Issue Detection & Form Feedback
       │       ├── Deterministic: FeedbackEngine (Instant visual hints)
       │       ├── Biomechanical: IssueDetector (Threshold violations)
       │       └── AI LLM: GroqFeedbackService (Contextual spoken cues via /api/feedback)
       │
       └──> VoiceService (Web Speech API speechSynthesis audio cues)
```

---

## B. Working Features

These features are functionally complete, verified in code, and must be preserved:
1. **Client-side Computer Vision**: MediaPipe PoseLandmarker initializes smoothly using local model asset `/models/pose_landmarker.task`.
2. **Camera Setup Calibration**: Joint visibility verification checklist (`CameraSetupClient.tsx`) confirms presence of Hip, Knee, Ankle, or Shoulder/Elbow before exercise begins.
3. **Biomechanical Angle & ROM Calculations**: Accurate vector calculations for joint angles in `lib/biomechanics/angle.ts` and Range-of-Motion tracking in `lib/biomechanics/rom.ts`.
4. **State-Machine Repetition Counter**: Debounced repetition counting with tempo detection (`repCounter.ts`) for Seated Knee Extension, Seated Bicep Curl, and Neck Rotation.
5. **Real-time Voice Coaching**: Audio cues uttered through the browser's native `SpeechSynthesisUtterance` via `VoiceService.ts` with priority interruption.
6. **AI Contextual Form Feedback**: Fallback-resilient Groq feedback pipeline (`/api/feedback` & `groqFeedback.ts`) that persists cues and protects against frame jitter.
7. **Clerk Authentication Backend**: Secure JWT verification via `@clerk/backend`'s `verifyToken` on protected API endpoints.
8. **Clinical Recommendation Engine**: Sophisticated matching algorithm (`recommendationEngine.ts`) mapping patient musculoskeletal concerns to exercise regimens.
9. **Doctor-Patient Assignment & Request Management**: Therapist dashboard creates assignments, accepts appointment requests, and provisions consultations in MongoDB.
10. **Consultation Prescription Generation**: Rich clinical prescriptions with medicines, healthy tips, and exercise assignments that synchronize directly with `ExerciseAssignment` in MongoDB.

---

## C. Partially Working Features

1. **Exercise Session Persistence**:
   *   *What works*: `POST /api/patient/session` properly writes sessions to MongoDB.
   *   *What is incomplete*: `LiveExerciseClient.tsx` saves sessions **only** to `localStorage` and never triggers `syncSessionToDatabase()`. The patient's server-side session history remains empty.
2. **Patient History Review by Therapist**:
   *   *What works*: The therapist can view assigned patient cards and routines.
   *   *What is incomplete*: In `app/(therapist)/therapist/patient/[patientId]/page.tsx`, `const [sessions] = useState<PatientSession[]>([])` is hardcoded as empty. The API route `/api/therapist/patient/[patientId]` does not query `ExerciseSession`.
3. **WebRTC Telehealth Consultation**:
   *   *What works*: WebRTC peer connection configuration, media track attachments, local/remote video switching, mute/disable controls, and canvas stream fallback.
   *   *What is incomplete*: Signaling is hard-coupled to `http://localhost:3001` via `socket-server.js`. If the standalone socket server is not running, signaling fails completely.
4. **Direct & Consultation Chat**:
   *   *What works*: Messages are saved to MongoDB via `/api/chat/[doctorId]` and `/api/consultation/[id]/messages`.
   *   *What is incomplete*: Real-time message reception relies entirely on Socket.IO room events (`send_message`, `new_message`). Without the standalone socket server, incoming messages do not appear without a full page reload.

---

## D. Broken Features

1. **Exercise Finish Redirection (404 Error)**:
   *   *Issue*: Upon completing target reps, `LiveExerciseClient.tsx` (line 91) executes:
       ```ts
       router.push(`/exercise/${exercise.id}/summary`);
       ```
   *   *Cause*: The route `/exercise/[exerciseId]/summary` **does not exist** in the repository. The actual summary page is `/session`. Patients hit a 404 page immediately after finishing a workout.
2. **Mock Login/Signup Forms vs Clerk Auth**:
   *   *Issue*: `/login` and `/signup` are dummy HTML forms that simulate authentication with `router.push("/")` without invoking Clerk.
   *   *Cause*: When submitted, `AuthGuard` detects the user is unauthenticated and bounces them to `/sign-in`. Furthermore, `/onboarding` links directly to `/signup` rather than Clerk's `/sign-up`.
3. **Incomplete Exercise Registry Entries**:
   *   *Issue* (resolved): `straight-leg-raise` and `quad-stretch` were registered in `lib/exercises/registry.ts` without a movement template. Exercises with no template are no longer registered at all.
   *   *Cause*: If a patient opens either exercise, `templateRef.current` evaluates to `null` and the live tracking engine freezes.
4. **React 19 Ref Access During Render (ESLint Failure)**:
   *   *Issue*: 34 ESLint errors fail `npm run lint`.
   *   *Cause*: In `hooks/useExerciseEngine.ts`, lines 172–177 access `engineStateRef.current` and `templateRef.current` directly in the hook return statement during render, violating React 19's compiler constraints (`react-hooks/refs`).

---

## E. Dummy & Mock Features

1. **Hardcoded Seed Doctors**:
   *   `services/doctors/doctorService.ts` contains `VERIFIED_SEED_DOCTORS` (`doc_aarti_sharma`, `doc_rajesh_verma`, `doc_priya_nair`, `doc_vikram_mehra`).
   *   `ensureSeedDoctors()` automatically seeds these profiles into MongoDB. Because these are synthetic Clerk IDs, no actual user can log in as these doctors.
2. **Dead Mock Store (`lib/therapist/therapistStore.ts`)**:
   *   Contains `INITIAL_MOCK_PATIENTS` ("John Doe", "Jane Smith") and `getPatients()`.
   *   This file is **completely unreferenced** anywhere in the active codebase (leftover prototype code).
3. **Hardcoded `generateStaticParams` in Layouts**:
   *   `app/(therapist)/therapist/patient/[patientId]/layout.tsx` hardcodes `pat_1` and `pat_2`.
   *   `app/chat/[id]/layout.tsx` and `app/(therapist)/therapist-profile/[id]/layout.tsx` hardcode `id: "default"`.
   *   These are relics of an earlier static export attempt and conflict with dynamic database-driven IDs.

---

## F. Realtime Dependencies & `socket-server.js` Audit

### `socket-server.js` Deep Inspection
`socket-server.js` is a 274-line standalone Node.js server using `http.createServer` and `socket.io` on port 3001.

#### Event Catalog:
| Event Name | Direction | Payload | Functionality |
|---|---|---|---|
| `join_user` | Client → Server | `{ userId }` | Joins room `user:${userId}` for personal alerts. |
| `join_chat` | Client → Server | `{ userId, targetUserId, conversationId }` | Joins direct chat channel. |
| `join_consultation` | Client → Server | `{ consultationId, userId, role }` | Joins room and updates in-memory `roomUsers` Map. |
| `presence_update` | Server → Client | `{ activeUserCount, online, ... }` | Broadcasts active participant count. |
| `send_message` | Client → Server | `{ consultationId, conversationId, targetUserId, ... }` | Relays chat message to room and recipient. |
| `new_message` | Server → Client | Chat message object | Delivers message to peer's UI. |
| `typing` | Client → Server | `{ isTyping, role, userId }` | Broadcasts typing status. |
| `typing_update` | Server → Client | `{ isTyping, role, userId }` | Displays "Doctor is typing..." in UI. |
| `call_user` / `peer_offer` | Client → Server | `{ consultationId, offer, callerName, targetUserId }` | WebRTC SDP offer signaling to peer. |
| `incoming_call` | Server → Client | `{ consultationId, offer, callerName }` | Triggers "Incoming Call" modal. |
| `call_accepted` / `peer_answer` | Client → Server | `{ consultationId, answer, targetUserId }` | WebRTC SDP answer signaling to caller. |
| `ice_candidate` | Both | `{ consultationId, candidate, targetUserId }` | WebRTC ICE candidate exchange. |
| `call_rejected` | Both | `{ consultationId, reason }` | Dismisses incoming call modal. |
| `end_call` / `call_ended` | Both | `{ consultationId, duration }` | Terminates call and updates status. |
| `prescription_published` | Client → Server | `{ consultationId, prescription, message }` | Therapist sends completed prescription. |
| `prescription_received` | Server → Client | `{ prescription, message }` | Patient's modal updates with new Rx. |

#### Why `socket-server.js` Cannot Be Deployed to Vercel:
1. **Stateless Functions vs Persistent Connections**: Vercel executes code in serverless functions (ephemeral container instances) that terminate after responding. They cannot host persistent, long-running WebSocket or Socket.IO listeners.
2. **Volatile Memory State**: `roomUsers = new Map()` in `socket-server.js` stores active user connections in the Node process's local RAM. In serverless functions, state is not shared across function invocations or separate instances.
3. **Separate Port Binding**: `socket-server.js` listens on port 3001. Vercel routes all incoming traffic through standard HTTP/HTTPS ports (80/443) to Next.js routes.

---

## G. Vercel Deployment Blockers

| Blocker # | Issue Description | Root Cause | Impact on Vercel |
|---|---|---|---|
| **1** | **Standalone Socket Server** | `socket-server.js` requires a long-running Node process (`concurrently "next dev" "node socket-server.js"`). | Vercel cannot start daemon processes; real-time features fail. |
| **2** | **Hardcoded `localhost:3001` Socket Client** | `lib/socket/client.ts` falls back to `window.location.hostname:3001`. | In production, clients attempt to connect to port 3001 on the user's browser, throwing connection refused errors. |
| **3** | **Top-Level Throw in `lib/mongodb.ts`** | `if (!MONGODB_URI) throw new Error(...)` is executed at module evaluation time. | During `next build`, page compilation evaluates imported modules. Missing URI during build crashes the pipeline. |
| **4** | **34 ESLint Errors During Build** | `react-hooks/refs` errors in `useExerciseEngine.ts` and `prefer-const` in `recommendationEngine.ts`. | `next build` runs ESLint by default. The build exits with error code 1. |
| **5** | **Exercise Completion 404** | `LiveExerciseClient.tsx` routes to non-existent `/exercise/[exerciseId]/summary`. | Users encounter a broken 404 screen upon workout completion. |
| **6** | **Hardcoded `generateStaticParams`** | Static parameters for `pat_1`, `pat_2`, and `default` in layout files. | Statically generates routes for mock IDs; dynamic MongoDB IDs can cause unexpected routing behavior. |
| **7** | **Static Export Config Confusion** | `next.config.ts` has `images: { unoptimized: true }` and `trailingSlash: true` with static export comments. | Trailing slashes can cause API routing and webhook redirect anomalies. |

---

## H. Proposed Final Architecture

### Evaluation of Realtime Solutions for a Single Next.js Vercel App

We evaluated three potential architectural approaches to eliminate the standalone socket server while keeping RehabLens as a **single Next.js application deployed to Vercel**:

| Architecture Option | How It Works | Pros | Cons / Constraints | Recommendation |
|---|---|---|---|---|
| **Option 1: Vercel Native WebSockets (`@vercel/functions.experimental_upgradeWebSocket`)** | Route Handler (`app/api/ws/route.ts`) upgrades HTTP to WS. Requires Upstash Redis to bridge instances. | Native to Vercel platform; bidirectional. | In experimental beta; requires `vercel dev` CLI instead of `next dev`; connections pinned to lambda instances; requires third-party Redis broker. | Not recommended for stability. |
| **Option 2: Serverless Managed Realtime (Pusher Channels)** | Next.js API route triggers events (`pusher.trigger()`); client connects to Pusher WSS. | 100% serverless; zero backend infrastructure; built-in presence channels; rock-solid WebRTC signaling; zero server maintenance. | Requires external Pusher API keys (free tier supports 200k msg/day). | Viable, but introduces external SaaS dependency. |
| **Option 3: Database-Backed Signaling + SSE / Polling + WebRTC DataChannels (Recommended)** | WebRTC signaling (Offer, Answer, ICE) is persisted in MongoDB `SignalingSession` (TTL index) and consumed via lightweight polling or Server-Sent Events (SSE). Chat is persisted directly in MongoDB (`ChatMessage`). Once WebRTC connects, **P2P WebRTC DataChannels** handle zero-latency direct chat & typing! | **Zero external dependencies.** 100% Next.js + MongoDB. Vercel-native. Video & Audio stream directly P2P via WebRTC anyway. Zero ongoing cost. Works seamlessly locally with `next dev` and on Vercel. | Signaling has ~500ms latency during the initial 5-second call setup handshake (negligible for video calls). | **Recommended (Cleanest & Most Robust)** |

### Recommended Solution Details: Self-Contained Serverless Realtime

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Vercel Serverless Next.js                       │
│                                                                        │
│   ┌───────────────────────────┐      ┌──────────────────────────────┐  │
│   │   Signaling Route Handler │      │      Chat Route Handler      │  │
│   │   /api/consultation/[id]/ │      │   /api/chat/[id]/route.ts    │  │
│   │   signal/route.ts         │      │   /api/consultation/[id]/    │  │
│   │   (POST offer/answer/ICE) │      │   messages/route.ts          │  │
│   └─────────────┬─────────────┘      └──────────────┬───────────────┘  │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │                                   │
                  ▼                                   ▼
        ┌───────────────────┐               ┌───────────────────┐
        │  MongoDB Atlas    │               │  MongoDB Atlas    │
        │  Consultation     │               │  ChatMessage      │
        │  (signaling data, │               │  (persisted chat  │
        │   callStatus)     │               │   history)        │
        └─────────┬─────────┘               └─────────┬─────────┘
                  │                                   │
                  │ (Initial Handshake ~3-5s)         │
                  ▼                                   ▼
        ┌───────────────────────────────────────────────────────┐
        │                 WebRTC Peer Connection                │
        │                                                       │
        │  1. Video Stream: Camera A ◄────────────► Camera B    │
        │  2. Audio Stream: Mic A    ◄────────────► Mic B       │
        │  3. DataChannel:  RTCDataChannel (0ms P2P Chat,       │
        │                   typing indicator, prescriptions)    │
        └───────────────────────────────────────────────────────┘
```

1. **WebRTC Signaling via Next.js Route Handlers**:
   *   During call setup, the caller sends the SDP Offer via `POST /api/consultation/[id]/signal`.
   *   The callee receives the offer via `GET /api/consultation/[id]/signal` (short-polling at 800ms intervals only while call status is `calling` or `connecting`).
   *   The callee posts the SDP Answer and ICE candidates back to the same endpoint.
   *   Once `RTCPeerConnection` transitions to `connected`, **signaling polling stops completely**.
2. **Direct Media & DataChannel**:
   *   WebRTC video and audio streams flow **directly peer-to-peer** between the two browsers via STUN (Google free STUN servers). No video bandwidth touches Vercel or any server.
   *   An `RTCDataChannel` ("chat") is opened over the established peer connection for instant, zero-latency messages, typing indicators, and prescription receipts while in the call.
3. **Direct Chat (Outside of Video Calls)**:
   *   Messages are posted to `/api/chat/[doctorId]` (saved to MongoDB) and fetched with smart SWR / optimistic updates.

---

## I. Phase-by-Phase Implementation Plan

```
Phase 1: Build & Quality Hygiene
├── Fix React 19 ref-access ESLint errors in useExerciseEngine.ts
├── Fix unused variables & prefer-const lint errors
├── Clean next.config.ts (remove export remnants & fix trailingSlash)
└── Verify zero-error local production build (next build)

Phase 2: Authentication & Routing Consolidation
├── Remove mock forms (/login, /signup); redirect to Clerk (/sign-in, /sign-up)
├── Update /onboarding CTA to point to Clerk /sign-up
├── Fix exercise finish redirect: route to /session instead of missing /summary
└── Clean hardcoded generateStaticParams from layout files

Phase 3: Exercise Persistence & Therapist Review Loop
├── Connect LiveExerciseClient.tsx to syncSessionToDatabase()
├── Update /api/therapist/patient/[patientId] to query ExerciseSession
├── Enable session history rendering in Therapist Patient Detail page
└── Register missing exercise templates or disable unconfigured exercises

Phase 4: Realtime Migration to Serverless (Decommission socket-server.js)
├── Implement /api/consultation/[id]/signal route handler in Next.js
├── Refactor app/consultation/[id]/page.tsx to use serverless signaling
├── Establish WebRTC RTCDataChannel for in-call P2P messaging & typing
├── Replace socket imports with serverless client helper
├── Remove socket-server.js and concurrently script from package.json
└── Verify full video call, chat, and prescription flow without socket server

Phase 5: Vercel Deployment Verification
├── Ensure MONGODB_URI lazy connection handling in lib/mongodb.ts
├── Document required Vercel environment variables
└── Execute dry-run build and verify all routes
```

---

## J. Files Modified in Each Phase

### Phase 1: Build & Quality Hygiene
*   `hooks/useExerciseEngine.ts` — Refactor state returns to derive from React state rather than accessing `engineStateRef.current` during render.
*   `lib/recommendations/recommendationEngine.ts` — Fix `prefer-const` and unused imports.
*   `lib/utils.ts` — Remove unused React import.
*   `next.config.ts` — Remove static export comments, remove `trailingSlash: true`, configure build rules.

### Phase 2: Authentication & Routing Consolidation
*   `app/(auth)/login/page.tsx` — Replace mock form with redirect or Clerk `<SignIn />`.
*   `app/(auth)/signup/page.tsx` — Replace mock form with redirect or Clerk `<SignUp />`.
*   `app/onboarding/page.tsx` — Update CTA button to route to `/sign-up`.
*   `app/(patient)/exercise/[exerciseId]/live/LiveExerciseClient.tsx` — Fix summary route redirection to `/session`.
*   `app/chat/[id]/layout.tsx` — Remove hardcoded `generateStaticParams`.
*   `app/(therapist)/therapist-profile/[id]/layout.tsx` — Remove hardcoded `generateStaticParams`.
*   `app/(therapist)/therapist/patient/[patientId]/layout.tsx` — Remove hardcoded `generateStaticParams`.

### Phase 3: Exercise Persistence & Therapist Review Loop
*   `app/(patient)/exercise/[exerciseId]/live/LiveExerciseClient.tsx` — Invoke `syncSessionToDatabase` with Clerk bearer token upon exercise finish.
*   `app/api/therapist/patient/[patientId]/route.ts` — Query `ExerciseSession` collection for the requested patient and return in response payload.
*   `app/(therapist)/therapist/patient/[patientId]/page.tsx` — Bind `sessions` state to API response data to render historical workout cards.
*   `lib/exercises/registry.ts` — (done) only exercises with a movement template are registered.

### Phase 4: Realtime Migration to Serverless
*   `app/api/consultation/[id]/signal/route.ts` — **New Route**: Handles SDP Offer, Answer, and ICE candidate exchanges with short TTL.
*   `models/Consultation.ts` — Add subdocument fields for active signaling payloads (`offer`, `answer`, `iceCandidates`, `callerName`).
*   `app/consultation/[id]/page.tsx` — Replace `socket.emit` / `socket.on` with serverless signaling polling during connection phase; attach `RTCDataChannel` for in-call P2P chat, typing, and prescriptions.
*   `app/chat/[id]/page.tsx` — Migrate direct messaging to serverless polling / optimistic SWR updates.
*   `lib/socket/client.ts` & `lib/socket/events.ts` — Deprecate / remove standalone socket client logic.
*   `package.json` — Remove `concurrently`, remove `socket` script, update `dev` to `next dev`.
*   `socket-server.js` — Decommissioned and archived.

### Phase 5: Vercel Deployment Verification
*   `lib/mongodb.ts` — Safeguard `MONGODB_URI` check so it throws inside `connectToDatabase()` instead of at module load time.
*   `README.md` — Update setup instructions to reflect single `npm run dev` and single-click Vercel deployment.

---

## Conclusion & Readiness

The RehabLens codebase possesses a well-structured foundation. The computer vision, angle math, rep counting, and clinical logic are solid and require no rewriting. 

Following this audit, execution of Phases 1 through 5 will cleanly resolve all build blockers, unify authentication, bridge the persistence gaps, and eliminate the standalone socket server—enabling seamless, zero-friction deployment to Vercel as a single Next.js application.
