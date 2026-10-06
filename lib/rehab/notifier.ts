/**
 * lib/rehab/notifier.ts
 *
 * One place that records and delivers notifications. Every notice is first written to
 * the Notification collection under a unique `dedupeKey`; only the request that wins
 * that insert sends the email. A cron retry, a double click or two instances racing
 * therefore cannot send the same reminder twice.
 *
 * Reminder-type notices (daily reminder, weekly review due) honour the patient's
 * email preference. Transactional notices (a new or changed plan, therapist
 * feedback) are always delivered because the patient needs to know the plan changed.
 */
import "server-only";
import User from "@/models/User";
import PatientProfile from "@/models/PatientProfile";
import Notification, { type NotificationType } from "@/models/Notification";
import { sendMail } from "@/lib/email/transporter";
import { prescriptionEmail, therapistFeedbackEmail, type Email } from "@/lib/email/templates";
import type { IPrescription } from "@/models/Prescription";
import { formatDateKey } from "./dates";

export interface DeliverInput {
  userId: string;
  type: NotificationType;
  dedupeKey: string;
  title: string;
  body: string;
  href?: string;
  email?: Email;
  /** Skip the email (but keep the in-app record) when the user opted out of reminders. */
  respectsReminderPreference?: boolean;
}

export type DeliverResult = { status: "sent" | "skipped" | "failed" | "duplicate"; notificationId?: string };

const REMINDER_TYPES: NotificationType[] = ["daily_reminder", "weekly_review_due"];

export async function deliver(input: DeliverInput): Promise<DeliverResult> {
  let notification;
  try {
    notification = await Notification.create({
      userId: input.userId,
      type: input.type,
      dedupeKey: input.dedupeKey,
      title: input.title,
      body: input.body,
      href: input.href,
      channels: { email: "pending" },
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { status: "duplicate" };
    throw err;
  }

  if (!input.email) {
    await Notification.updateOne({ _id: notification._id }, { $set: { "channels.email": "skipped" } });
    return { status: "skipped", notificationId: notification._id.toString() };
  }

  const [user, profile] = await Promise.all([
    User.findOne({ clerkUserId: input.userId }, { email: 1 }).lean<{ email?: string }>(),
    PatientProfile.findOne({ clerkUserId: input.userId }, { notifications: 1 }).lean<{ notifications?: { emailReminders?: boolean } }>(),
  ]);

  const optedOut =
    (input.respectsReminderPreference ?? REMINDER_TYPES.includes(input.type)) && profile?.notifications?.emailReminders === false;
  if (!user?.email || optedOut) {
    await Notification.updateOne({ _id: notification._id }, { $set: { "channels.email": "skipped" } });
    return { status: "skipped", notificationId: notification._id.toString() };
  }

  const result = await sendMail({ to: user.email, ...input.email });
  await Notification.updateOne(
    { _id: notification._id },
    result.ok
      ? { $set: { "channels.email": "sent" } }
      : { $set: { "channels.email": result.skipped ? "skipped" : "failed", emailError: result.error } }
  );
  return { status: result.ok ? "sent" : result.skipped ? "skipped" : "failed", notificationId: notification._id.toString() };
}

async function displayName(userId: string): Promise<string | undefined> {
  const u = await User.findOne({ clerkUserId: userId }, { firstName: 1, lastName: 1 }).lean<{ firstName?: string; lastName?: string }>();
  return u?.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : undefined;
}

/** Tells the patient their plan was created or replaced. */
export async function notifyPrescriptionChange(doc: IPrescription, revision: boolean): Promise<DeliverResult> {
  const patientName = await displayName(doc.patientId);
  const email = prescriptionEmail({
    patientName,
    therapistName: doc.doctorName,
    revision,
    exerciseNames: doc.exercises.map((e) => e.name),
    startDate: formatDateKey(doc.startDate, { day: "numeric", month: "short", year: "numeric" }),
    endDate: formatDateKey(doc.endDate, { day: "numeric", month: "short", year: "numeric" }),
    note: doc.doctorNotes,
  });
  return deliver({
    userId: doc.patientId,
    type: revision ? "prescription_updated" : "prescription_assigned",
    dedupeKey: `${revision ? "prescription_updated" : "prescription_assigned"}:${doc._id.toString()}`,
    title: email.subject,
    body: `${doc.exercises.length} ${doc.exercises.length === 1 ? "exercise" : "exercises"}, ${formatDateKey(doc.startDate)} to ${formatDateKey(doc.endDate)}.`,
    href: "/",
    email,
  });
}

/** Tells the patient their therapist reviewed a session. */
export async function notifyTherapistFeedback(p: {
  patientId: string;
  therapistName?: string;
  sessionId: string;
  exerciseName: string;
  note?: string;
}): Promise<DeliverResult> {
  const patientName = await displayName(p.patientId);
  const email = therapistFeedbackEmail({ patientName, therapistName: p.therapistName, exerciseName: p.exerciseName, note: p.note });
  return deliver({
    userId: p.patientId,
    type: "therapist_feedback",
    dedupeKey: `therapist_feedback:${p.sessionId}`,
    title: email.subject,
    body: p.note ? p.note.slice(0, 200) : "Your therapist reviewed this session.",
    href: "/progress",
    email,
  });
}
