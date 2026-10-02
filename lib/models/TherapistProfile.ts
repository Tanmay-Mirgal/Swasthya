import mongoose, { Schema, Document } from "mongoose";

export interface ITherapistProfile extends Document {
  clerkUserId: string;
  professionalName?: string;
  specialization?: string;
  yearsOfExperience?: string;
  clinicName?: string;
  verificationStatus: "pending" | "verified" | "rejected";
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TherapistProfileSchema = new Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    professionalName: {
      type: String,
    },
    specialization: {
      type: String,
    },
    yearsOfExperience: {
      type: String,
    },
    clinicName: {
      type: String,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
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

const TherapistProfile =
  mongoose.models.TherapistProfile ||
  mongoose.model<ITherapistProfile>("TherapistProfile", TherapistProfileSchema);

export default TherapistProfile;
