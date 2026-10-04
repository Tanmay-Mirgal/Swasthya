import mongoose, { Schema, Document } from "mongoose";

export interface ITherapistProfile extends Document {
  clerkUserId: string;
  professionalName?: string;
  title?: string;
  qualification?: string;
  specialization?: string;
  supportedConditions?: string[];
  yearsOfExperience?: string;
  clinicName?: string;
  consultationFee?: number;
  rating?: number;
  reviewCount?: number;
  languages?: string[];
  availability?: string;
  avatarUrl?: string;
  bio?: string;
  isOnline?: boolean;
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
    title: {
      type: String,
      default: "Doctor / Physiotherapist",
    },
    qualification: {
      type: String,
    },
    specialization: {
      type: String,
    },
    supportedConditions: {
      type: [String],
      default: [],
    },
    yearsOfExperience: {
      type: String,
    },
    clinicName: {
      type: String,
    },
    consultationFee: {
      type: Number,
      default: 499,
    },
    rating: {
      type: Number,
      default: 4.9,
    },
    reviewCount: {
      type: Number,
      default: 84,
    },
    languages: {
      type: [String],
      default: ["English", "Hindi"],
    },
    availability: {
      type: String,
      default: "Available Today • Instant Consultation",
    },
    avatarUrl: {
      type: String,
    },
    bio: {
      type: String,
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "verified",
    },
    onboardingCompleted: {
      type: Boolean,
      default: true,
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
