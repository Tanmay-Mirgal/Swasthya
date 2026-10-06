/**
 * Email templates. Each returns { subject, html, text } and only states stored facts:
 * no medical conclusions, no invented figures.
 */
import { PATIENT_FOOTNOTE, THERAPIST_FOOTNOTE, appUrl, renderEmail } from "./layout";

export interface Email {
  subject: string;
  html: string;
  text: string;
}

const first = (name?: string) => (name || "").trim().split(/\s+/)[0] || "there";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function dailyReminderEmail(p: { patientName?: string; remainingExercises: number; totalExercises: number; remainingSets: number; dayNumber: number; totalDays: number }): Email {
  const subject =
    p.remainingExercises === p.totalExercises
      ? `Your rehabilitation plan for today is ready`
      : `${plural(p.remainingExercises, "exercise")} left on today's plan`;
  const body = renderEmail({
    preheader: `${plural(p.remainingExercises, "exercise")} remaining today.`,
    heading: "Your rehabilitation plan for today is ready",
    paragraphs: [
      `Hello ${first(p.patientName)},`,
      `You have ${plural(p.remainingExercises, "exercise")} remaining today. Open your plan to see the sets and reps your therapist prescribed.`,
    ],
    facts: [
      { label: "Exercises today", value: String(p.totalExercises) },
      { label: "Exercises remaining", value: String(p.remainingExercises) },
      { label: "Sets remaining", value: String(p.remainingSets) },
      { label: "Plan day", value: `${p.dayNumber} of ${p.totalDays}` },
    ],
    cta: { label: "Open today's plan", href: appUrl("/") },
    footnote: PATIENT_FOOTNOTE,
  });
  return { subject, ...body };
}

export function prescriptionEmail(p: {
  patientName?: string;
  therapistName?: string;
  revision: boolean;
  exerciseNames: string[];
  startDate: string;
  endDate: string;
  note?: string;
}): Email {
  const who = p.therapistName || "Your therapist";
  const subject = p.revision ? `${who} updated your rehabilitation plan` : `${who} prescribed your rehabilitation plan`;
  const body = renderEmail({
    preheader: p.revision ? "Your plan has changed." : "Your plan is ready.",
    heading: p.revision ? "Your plan was updated" : "Your plan is ready",
    paragraphs: [
      `Hello ${first(p.patientName)},`,
      p.revision
        ? `${who} changed your rehabilitation plan. The new version replaces the old one from the start date below.`
        : `${who} created your rehabilitation plan. You will find today's exercises in the app.`,
      ...(p.note ? [`Note from your therapist: ${p.note}`] : []),
    ],
    facts: [
      { label: "Exercises", value: p.exerciseNames.join(", ") },
      { label: "Starts", value: p.startDate },
      { label: "Ends", value: p.endDate },
    ],
    cta: { label: "View your plan", href: appUrl("/") },
    footnote: PATIENT_FOOTNOTE,
  });
  return { subject, ...body };
}

export function weeklyReviewDueEmail(p: { patientName?: string; week: number; recordingRequired: boolean; exerciseName?: string }): Email {
  const body = renderEmail({
    preheader: `Week ${p.week} review day.`,
    heading: `Week ${p.week} review day`,
    paragraphs: [
      `Hello ${first(p.patientName)},`,
      p.recordingRequired
        ? `Today is your weekly review. Your therapist asked for a short recording of ${p.exerciseName || "one exercise"} so they can check your movement. Nothing is recorded unless you start it.`
        : `Today is your weekly review. Do today's exercises as usual; your therapist will see your week's progress.`,
    ],
    cta: { label: "Open today's plan", href: appUrl("/") },
    footnote: PATIENT_FOOTNOTE,
  });
  return { subject: `Week ${p.week} review day`, ...body };
}

export function weeklyReviewReadyEmail(p: { therapistName?: string; patientName: string; week: number; adherencePercent: number | null; recordingAttached: boolean; reviewHref: string }): Email {
  const body = renderEmail({
    preheader: `${p.patientName}'s week ${p.week} report is ready.`,
    heading: `${p.patientName}: week ${p.week} report is ready`,
    paragraphs: [`Hello ${first(p.therapistName)},`, `The week ${p.week} report for ${p.patientName} is ready for your review.`],
    facts: [
      { label: "Adherence", value: p.adherencePercent === null ? "No sets due" : `${p.adherencePercent}%` },
      { label: "Recording", value: p.recordingAttached ? "Attached" : "Not attached" },
    ],
    cta: { label: "Review the week", href: appUrl(p.reviewHref) },
    footnote: THERAPIST_FOOTNOTE,
  });
  return { subject: `${p.patientName}: week ${p.week} report ready`, ...body };
}

export function therapistFeedbackEmail(p: { patientName?: string; therapistName?: string; exerciseName: string; note?: string }): Email {
  const who = p.therapistName || "Your therapist";
  const body = renderEmail({
    preheader: `${who} reviewed your ${p.exerciseName} session.`,
    heading: `${who} reviewed your ${p.exerciseName}`,
    paragraphs: [`Hello ${first(p.patientName)},`, p.note ? `Their note: ${p.note}` : `They have reviewed your session. Open the app to read it.`],
    cta: { label: "See the feedback", href: appUrl("/progress") },
    footnote: PATIENT_FOOTNOTE,
  });
  return { subject: `${who} reviewed your ${p.exerciseName}`, ...body };
}
