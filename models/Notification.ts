import mongoose, { Schema, Document } from "mongoose";

/**
 * A durable record of every reminder or notice sent to a user. `dedupeKey` is unique
 * per user, so a cron retry or a double click can never send the same notice twice
 * (for example `daily:<prescriptionId>:2026-10-06`).
 */

export type NotificationType =
  | "daily_reminder"
  | "prescription_assigned"
  | "prescription_updated"
  | "weekly_review_due"
  | "weekly_review_ready"
  | "therapist_feedback";

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  dedupeKey: string;
  title: string;
  body: string;
  /** In-app deep link. */
  href?: string;
  channels: { email: "sent" | "skipped" | "failed" | "pending" };
  emailError?: string;
  readAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "daily_reminder",
        "prescription_assigned",
        "prescription_updated",
        "weekly_review_due",
        "weekly_review_ready",
        "therapist_feedback",
      ],
    },
    dedupeKey: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    href: { type: String },
    channels: {
      _id: false,
      email: { type: String, enum: ["sent", "skipped", "failed", "pending"], default: "pending" },
    },
    emailError: { type: String },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

const Notification =
  (mongoose.models.Notification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
