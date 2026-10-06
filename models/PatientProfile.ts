import mongoose, { Schema, Document } from "mongoose";

export interface IPatientProfile extends Document {
  clerkUserId: string;
  dateOfBirth?: Date;
  concerns: string[];
  onboardingCompleted: boolean;
  /** IANA timezone; decides what "today" means for the daily plan and reminders. */
  timezone?: string;
  notifications?: { emailReminders: boolean; reminderHour: number };
  createdAt: Date;
  updatedAt: Date;
}

const PatientProfileSchema = new Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    dateOfBirth: {
      type: Date,
    },
    concerns: {
      type: [String],
      default: [],
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    timezone: { type: String, maxlength: 64 },
    notifications: {
      _id: false,
      emailReminders: { type: Boolean, default: true },
      reminderHour: { type: Number, default: 9, min: 0, max: 23 },
    },
  },
  {
    timestamps: true,
  }
);

const PatientProfile =
  mongoose.models.PatientProfile ||
  mongoose.model<IPatientProfile>("PatientProfile", PatientProfileSchema);

export default PatientProfile;
