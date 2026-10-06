# Swasthya🧘‍♂️📈

Swasthya is a comprehensive, software-based rehabilitation assistant designed to help patients recover safely and efficiently from home. Utilizing a standard smartphone or laptop camera, RehabLens provides real-time movement feedback, counts repetitions, tracks progress, and bridges the gap between patients and healthcare professionals.

## 🌟 Problem Statement & Solution

Patients recovering from injuries or physical conditions often perform rehabilitation exercises at home without professional supervision, leading to incorrect movements and slower recovery. **Swasthya** solves this by using advanced computer vision (MediaPipe) to track skeletal movements locally on the user's device. It ensures safe and meaningful movement feedback without making medical diagnoses, allows physiotherapists to monitor and review progress, and features an accessible, user-friendly interface.

---

## 👥 Core Portals & Workflows

RehabLens is divided into two primary experiences: the **Patient (User) Portal** and the **Therapist Portal**.

### 1. Patient (User) Portal

Designed for ease of use, accessibility, and clear guidance during independent exercise sessions.

- **Dashboard & Progress Tracking (`/progress`):**
  - View assigned exercise programs.
  - Track adherence, daily streaks, and completion rates.
  - Review historical sessions and form improvements (`/session`).
- **Live Exercise Tracking (`/exercise/[exerciseId]/live`):**
  - **Camera-Based Analysis:** Uses real-time Pose Detection (MediaPipe) to track body landmarks. Works across various lighting conditions and distances.
  - **Form Feedback:** Provides understandable, non-diagnostic feedback (e.g., "Straighten your back," "Raise your arm higher").
  - **Repetition Counting:** Automatically counts valid repetitions based on biomechanical angles.
  - **Audio Coaching:** Real-time audio cues using the Web Speech API so patients don't have to look at the screen constantly.
  - **Confidence Indicators:** The system alerts the user if it cannot confidently assess the movement (e.g., "Please step back into the frame").
- **Accessibility:**
  - High-contrast UI, clear typography, and auditory cues.
  - Alternatives provided for users unable to use camera-based tracking (e.g., manual logging options).

### 2. Therapist Portal

Designed for physiotherapists to manage patients, prescribe routines, and review adherence remotely.

- **Patient Management:**
  - Dashboard to view all assigned patients, their adherence rates, and recent activity flags.
- **Exercise Customization & Prescription:**
  - Create and assign custom rehabilitation routines.
  - Adjust parameters like target repetition count, expected range of motion (ROM), and hold times for individual patient needs.
- **Session Review & Telehealth (`/consultation`):**
  - Review automated session logs (reps completed, form accuracy, self-reported pain levels).
  - **Override Automated Feedback:** Therapists can manually adjust or add notes to automated assessments based on their clinical judgment.
  - **Live Video Consultations:** Integrated WebRTC video calls with camera and microphone controls for live remote sessions.
  - **Real-time Chat:** Messages are saved in MongoDB and delivered instantly over the app's WebSocket gateway, with typing indicators, read receipts and automatic resync after reconnects.

---

## 🧠 Technical Architecture

RehabLens leverages modern web technologies for a seamless, fast, and scalable experience.

### Tech Stack

- **Frontend & Framework:** [Next.js](https://nextjs.org/) (App Router), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Computer Vision:** [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker) (Client-side, privacy-preserving pose detection)
- **Authentication:** [Clerk](https://clerk.com/) for secure user and therapist logins
- **Database:** [MongoDB with Mongoose](https://mongoosejs.com/)
- **Real-Time Communication:** Native WebSockets inside the Next.js app (chat + WebRTC signaling, MongoDB-backed bus) and peer-to-peer WebRTC (video calls)
- **Icons & UI:** [Lucide React](https://lucide.dev/), Shadcn UI components

### How the Exercise Engine Works

1. **Video Feed:** Captured via the browser's native MediaDevices API.
2. **Pose Estimation:** Frames are processed locally in the browser via MediaPipe's WebAssembly models to generate 33 3D skeletal landmarks. (No video data is sent to the server).
3. **Biomechanics Engine (in `/lib` & `/hooks`):** Calculates angles between joints (e.g., shoulder, elbow, wrist for a bicep curl).
4. **State Machine:** Determines the phase of the exercise (e.g., concentric vs. eccentric phase) and counts a valid repetition only when specific biomechanical angle thresholds are met.
5. **Feedback Loop:** Generates on-screen visual cues, color-coded skeletons, and text-to-speech audio based on real-time form calculations.

---

## 🛠️ Development & Local Setup

### Prerequisites

- Node.js (v18+)
- npm or yarn
- MongoDB URI and Clerk API Keys (Must be set in a `.env.local` file)

### Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run the unified Next.js + Realtime application (one command)
npm run dev
```

The application and realtime gateway are served together at `http://localhost:3000` by a single process (`server.ts`). There is no separate socket server and no second command to run.

For local realtime testing you can enable test identities (never honoured in production) with `REALTIME_DEV_AUTH=1`; see `scripts/test_realtime_e2e.ts` (`npm run test:realtime`).

### Building for Production

```bash
npm run build
npm run start   # unified server, production mode
```

### Deploying to Vercel

Deploy the repository as one Next.js project (no servers of your own). Set `MONGODB_URI`, the Clerk keys and `CLERK_WEBHOOK_SECRET`. For the rehabilitation workflow also set the SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`), `APP_URL`, `CRON_SECRET` (Vercel Cron reads `vercel.json` and calls `/api/cron/daily` with it) and, for weekly-review recordings, create a **private** Vercel Blob store (it sets `BLOB_READ_WRITE_TOKEN`). See `.env.example`. Realtime uses `app/api/ws/route.ts` (`experimental_upgradeWebSocket`), so WebSocket Functions must be enabled for your Vercel project. MongoDB must be a replica set (Atlas) so change streams work; a standalone `mongod` falls back to polling.

### Realtime architecture

```
Browser ──WebSocket──▶ /api/ws (Next.js) ──▶ MongoDB (RealtimeSignal bus, presence, consultations, messages)
   ▲                                              │
   └── peer-to-peer WebRTC media (never via the server) ◀──┘
```

- Identity comes only from a verified Clerk JWT; rooms (`user:`, `conversation:`, `consultation:`) are authorized server-side on join and every later packet must target a joined room.
- Chat: `POST` (authenticated, authorized, idempotent) → saved in MongoDB → published → delivered over WebSocket. History and missed messages are re-fetched from MongoDB after any reconnect.
- Calls: `CALL_CREATE → CALL_ACCEPT → WEBRTC_OFFER → WEBRTC_ANSWER → ICE`, with the call state kept on the `Consultation` document. The server only relays signaling.
- Instances never rely on process memory: every fan-out goes through the `RealtimeSignal` collection (change stream, polling fallback) so a patient and therapist on different serverless instances still hear each other.

### Rehabilitation workflow

```
Consultation ends ─▶ therapist writes a plan ─▶ Prescription (MongoDB, versioned)
                                                        │
        patient "Today" = schedule maths + stored sets ◀┘      (nothing duplicated)
                │
   set → chunks (8 + rest + 7 = 15) ─▶ ExerciseSession (one per exercise per day)
                │
   daily cron ─▶ reminder emails · review-day notice · weekly report ─▶ therapist review
```

- **Plan:** `models/Prescription.ts` is the single source of truth: lifecycle `draft → active → paused → completed | cancelled`, immutable versions (a change creates version N+1 and closes N), optional weekly review and a medication *record* (never generated by the app).
- **Today is derived, not stored:** `lib/rehab/schedule.ts` turns the plan and the stored set logs into today's exercises, set progress, missed days and review days. Dates are calendar days in the patient's timezone.
- **Rep chunking:** the prescription fixes reps per set; the patient only splits a set into chunks. `lib/rehab/chunking.ts` enforces order, caps at the prescribed reps and ignores a chunk id it has already counted, so retries and double submits never double count. Chunks are saved as each one ends (with a browser outbox for dropped connections).
- **Reminders and reports:** `vercel.json` runs `/api/cron/daily` (secret-protected, idempotent via unique notification keys). It sends reminders, tells patients about review day and builds weekly reports from stored data only.
- **Email:** `lib/email` (Nodemailer, server-only) with HTML and plain-text templates.
- **Recordings:** only when a plan asks for one and the patient agrees. The browser uploads straight to a private Vercel Blob store with a short-lived, scoped token; playback streams through `/api/recordings/[id]`, which checks patient or therapist. There are no public URLs.
- **Authorization:** identity from the Clerk token only. Patients reach their own plan, sets, reports, recordings and medication; therapists reach patients with an active `TherapistAssignment`. Ids from the browser are never trusted.
- **Tests:** `npm run test:rehab` (schedule and chunking maths) and `npm run test:rehab:e2e` (the real route handlers against a throw-away MongoDB with a local SMTP sink). Existing assignments are moved to plans with `npm run migrate:plans` (dry run by default).

---

## 📁 In-Depth Technical Architecture & File Structure

Here is a comprehensive breakdown of the project files, why they exist, what they do, and the core libraries used.

### 1. `/app` (Next.js App Router)

This directory handles all the routing and server-side/client-side page rendering.

- **`/(auth)`**: Contains the Clerk authentication routes (Sign In, Sign Up).
- **`/(patient)`**: The core patient experience routes, including the user dashboard, exercise list, and progress tracking pages.
- **`/(therapist)`**: The professional portal routes where therapists can view their assigned patients and prescribe routines.
- **`/api`**: Backend API routes. Handles database interactions (MongoDB via Mongoose) and Clerk webhooks (using `svix` to verify events like `user.created`).
- **`/api/ws`**: Vercel WebSocket Function Route Handler utilizing `@vercel/functions.experimental_upgradeWebSocket` for real-time gateway hosting directly on Vercel without third-party socket servers.
- **`/consultation`**: The live telehealth route. This page mounts the WebRTC video interface and Realtime connection for live doctor-patient calls.
- **`/chat`**: Real-time text messaging interface powered by durable MongoDB chat persistence and realtime WebSockets.
- **`/onboarding` & `/splash`**: Initial welcome screens and user setup workflows.

### 2. `/components` (Modular UI)

Reusable React components organized by domain. Built with **Tailwind CSS**, **Lucide-React** (icons), and **Radix UI** primitives (`clsx`, `tailwind-merge`).

- **`auth/` & `brand/`**: Reusable branding and login components.
- **`consultation/`**: Video player components, mute/unmute buttons, and WebRTC stream wrappers.
- **`dashboard/`**: Graphs and metric cards for both Patient and Therapist views.
- **`exercise/` & `movement/`**: the live panel and the camera stage (`<video>` plus the skeleton `<canvas>` drawn outside React).
- **`session/`**: UI for displaying post-workout summaries.
- **`ui/`**: Base UI elements (Buttons, Inputs, Dialogs) typically styled via Shadcn.

### 3. `/hooks` (Business Logic)
- **`useExerciseEngine.ts`**: The core state machine. It takes the live camera feed, pipes it into the MediaPipe pose landmarker, extracts the 33 3D coordinates, passes them to the biomechanics engine to calculate angles, and counts repetitions dynamically in real-time.

### 4. `/lib` (Core Engines & Utilities)

The brain of the application.

- **`/biomechanics` & `/engine`**: Contains the mathematical formulas (trigonometry) to calculate angles between joints (e.g., shoulder, elbow, wrist).
- **`lib/movement`**: the movement-intelligence engine: templates, signal processing, rules, coaching, reports. Pure TypeScript with its own tests (`npm run test:movement`).
- **`/realtime`**: Unified Next.js realtime engine:
  - `protocol/`: Typed event dictionary, payload types, room ids and runtime packet validation.
  - `auth/`: Server-side Clerk JWT token verification and MongoDB room authorization.
  - `server/`: Realtime engine, MongoDB-backed cross-instance bus, presence, call state machine and chat service.
  - `client/`: Native browser WebSocket client (auto-reconnect, heartbeat) and the `useRealtime`, `useChat` and `useConsultation` hooks.
- **`/webrtc`**: Peer-to-peer WebRTC: call state machine, `PeerSession` (offer/answer/ICE) and the `useWebRTC` media hook.
- **`mongodb.ts`**: The database connection string and Mongoose connection caching logic.

### 5. `/models` (Database)

- Contains **Mongoose schemas** for Users (Patients/Therapists), Exercises, Prescriptions, Consultations, ChatMessages, and Session Logs.

### 6. `/electron`

- Contains wrappers (`offline.html`, etc.) for potentially packaging the web application into a desktop app using Electron.js.

### 7. `server.ts` (Unified Local Dev Server)

- Single unified development server hosting both the Next.js App Router and the WebSocket gateway on port 3000 in a single process (`npm run dev`).

---

## 📦 Core Libraries & Dependencies

- **Framework:** `next` (v16 App Router) & `react` (v19)
- **Authentication:** `@clerk/nextjs`, `@clerk/backend`, `svix` (for webhook security).
- **Computer Vision:** `@mediapipe/tasks-vision` (Google's optimized ML models running via WebAssembly in the browser).
- **Database:** `mongoose` for connecting to MongoDB.
- **Real-Time:** Unified WebSockets (`ws`, `@vercel/functions`) for WebRTC signaling and real-time messaging.
- **Styling:** `@tailwindcss/postcss`, `clsx`, `tailwind-merge`.
- **UI Icons:** `lucide-react`.

---

## 🔄 Dynamic vs Dummy Data

- **Dynamic Data (Live):**
  - **Pose Tracking & Rep Counting:** driven by the user's live camera feed, on the device.
  - **The patient's plan, today's exercises, set progress, progress and reports:** from MongoDB (the active prescription plus the stored sets). Nothing on the patient or therapist screens is hard-coded.
  - **Authentication, Consultation & Chat:** Clerk, WebRTC and the realtime WebSocket gateway.
- **Empty states, not placeholders:** a new account with no plan, no sessions or no reviews sees an explanation of what will appear and how to get it. The `/ui-preview` route (development only, 404 in production) renders the UI with made-up fixtures for design review and is never reachable in production.


## Movement intelligence

Each exercise is a **template** (`lib/movement/template/templates`): which joints must be seen, how a repetition is shaped, the form rules with their tolerances, and the wording of every correction. MediaPipe sees, the template defines what correct means, and a deterministic engine judges. The skeleton shows the verdict (green = fine, red = check this, yellow = not seen clearly enough to judge) and the coach says one specific thing at a time (what, where, how), escalating if it persists and acknowledging when it is fixed. If the camera cannot see a joint clearly, nothing is judged and the person is told how to reposition.

A language model (Groq) is optional and only rewords confirmed facts or rewrites a session summary; it never judges, and the app works identically without it. Session summaries are built from stored data only and are always labelled as automatic/AI summaries, not diagnoses. The therapist remains the authority: nothing here changes a prescription.

Seven exercises are tracked today: seated knee extension, seated bicep curl, neck rotation, sit to stand, shoulder abduction, heel raise, and mini squat. Thresholds are defaults, tuned on synthetic geometry; they need on-camera tuning and a physiotherapist's review.
