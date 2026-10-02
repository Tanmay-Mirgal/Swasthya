import mongoose, { Schema, Document } from "mongoose";

export interface IPatientProfile extends Document {
  clerkUserId: string;
  dateOfBirth?: Date;
  concerns: string[];
  onboardingCompleted: boolean;
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
  },
  {
    timestamps: true,
  }
);

const PatientProfile =
  mongoose.models.PatientProfile ||
  mongoose.model<IPatientProfile>("PatientProfile", PatientProfileSchema);

export default PatientProfile;
