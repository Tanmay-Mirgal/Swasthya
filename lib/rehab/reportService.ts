import "server-only";
/**
 * lib/rehab/reportService.ts
 *
 * Creates and serves the performance summary of one exercise-day. The report is built from
 * the stored session ONLY (the client names a session id and nothing else), cached by a hash
 * of the data it was built from, and always exists: if the language model is unavailable the
 * deterministic wording is stored instead.
 */
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import ExerciseSession, { type IExerciseSession } from "@/models/ExerciseSession";
import SessionReport, { type ISessionReport } from "@/models/SessionReport";
import { buildSessionFacts, deterministicReport, type ReportContent } from "@/lib/movement/analytics/sessionReport";
import { generateModelReport } from "@/lib/movement/analytics/serverReport";
import type { ChatFetcher } from "@/lib/movement/coach/serverCue";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import { assertTherapistOfPatient, HttpError } from "./auth";
import { consume } from "./rateLimit";
import type { VerifiedIdentity } from "@/lib/realtime/auth/verifier";

export interface SessionReportView {
  sessionId: string;
  source: "ai" | "deterministic";
  generatedAt: string;
  content: ReportContent;
  /** Plain label the UI must show next to the report. */
  disclosure: string;
}

const DISCLOSURE: Record<"ai" | "deterministic", string> = {
  ai: "AI-generated performance summary from your recorded session data. It is not a medical diagnosis.",
  deterministic: "Automatic summary from your recorded session data. It is not a medical diagnosis.",
};

export const hashFacts = (facts: unknown) => createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 32);

/** Loads a session and checks the caller may see it: the patient who owns it, or their assigned therapist. */
export async function loadSessionFor(me: VerifiedIdentity, sessionId: string): Promise<IExerciseSession> {
  if (!mongoose.isValidObjectId(sessionId)) throw new HttpError(400, "That session id is not valid.");
  const session = await ExerciseSession.findById(sessionId).lean<IExerciseSession | null>();
  if (!session) throw new HttpError(404, "Session not found.");
  if (me.role === "patient") {
    if (session.patientId !== me.userId) throw new HttpError(404, "Session not found.");
  } else if (me.role === "doctor") {
    await assertTherapistOfPatient(me.userId, session.patientId);
  } else throw new HttpError(403, "Not allowed.");
  return session;
}

export function toView(r: Pick<ISessionReport, "sessionId" | "source" | "generatedAt" | "content">, role: "patient" | "doctor"): SessionReportView {
  const content = role === "patient" ? { ...r.content, therapistSummary: "" } : r.content;
  return { sessionId: r.sessionId, source: r.source, generatedAt: new Date(r.generatedAt).toISOString(), content, disclosure: DISCLOSURE[r.source] };
}

export async function getExistingReport(sessionId: string) {
  return SessionReport.findOne({ sessionId }).lean<ISessionReport | null>();
}

/**
 * Makes sure a current report exists for the session. `allowModel` lets the language model
 * write the wording; the deterministic version is always the fallback and is stored first.
 */
export async function ensureSessionReport(session: IExerciseSession, opts: { allowModel?: boolean; fetcher?: ChatFetcher; env?: NodeJS.ProcessEnv; userIdForLimit?: string } = {}): Promise<ISessionReport> {
  const sessionId = session._id.toString();
  const template = getMovementTemplate(session.exerciseId);
  const facts = buildSessionFacts(session, { romUnit: template?.rep.unit });
  const inputHash = hashFacts(facts);
  const existing = await getExistingReport(sessionId);
  if (existing && existing.inputHash === inputHash && (existing.source === "ai" || !opts.allowModel)) return existing;

  let content = deterministicReport(facts);
  let source: "ai" | "deterministic" = "deterministic";
  let model: string | undefined;

  if (opts.allowModel && facts.judged) {
    const limited = opts.userIdForLimit ? !(await consume(opts.userIdForLimit, "report", [{ name: "hour", seconds: 3600, max: 30 }])) : false;
    if (!limited) {
      const m = await generateModelReport(facts, content, { fetcher: opts.fetcher, env: opts.env });
      if (m) {
        content = m.content;
        source = "ai";
        model = m.model;
      }
    }
  }

  const doc = await SessionReport.findOneAndUpdate(
    { sessionId },
    { $set: { sessionId, patientId: session.patientId, exerciseId: session.exerciseId, source, llmModel: model, inputHash, facts, content, generatedAt: new Date() } },
    { upsert: true, returnDocument: "after" }
  ).lean<ISessionReport>();
  return doc as ISessionReport;
}
