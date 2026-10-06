import mongoose, { Schema, Document } from "mongoose";
import type { ReportContent, SessionFacts } from "@/lib/movement/analytics/sessionReport";

/**
 * A performance summary of one exercise-day, built from the stored session and cached so it
 * is generated once per change of data. `facts` is the exact data it was built from (kept for
 * audit); `source` says whether a language model wrote the wording or the app did.
 */
export interface ISessionReport extends Document {
  sessionId: string;
  patientId: string;
  exerciseId: string;
  source: "ai" | "deterministic";
  llmModel?: string;
  inputHash: string;
  facts: SessionFacts;
  content: ReportContent;
  generatedAt: Date;
}

const SessionReportSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    patientId: { type: String, required: true, index: true },
    exerciseId: { type: String, required: true },
    source: { type: String, enum: ["ai", "deterministic"], required: true },
    llmModel: { type: String },
    inputHash: { type: String, required: true },
    facts: { type: Schema.Types.Mixed, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const SessionReport = mongoose.models.SessionReport || mongoose.model<ISessionReport>("SessionReport", SessionReportSchema);
export default SessionReport;
