import mongoose, { Schema, Document } from "mongoose";

export interface ITherapistAssignment extends Document {
  patientId: string; // clerkUserId
  therapistId: string; // clerkUserId
  status: "pending" | "active" | "completed";
  assignedAt: Date;
}

const TherapistAssignmentSchema = new Schema(
  {
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    therapistId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed"],
      default: "pending",
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const TherapistAssignment =
  mongoose.models.TherapistAssignment ||
  mongoose.model<ITherapistAssignment>("TherapistAssignment", TherapistAssignmentSchema);

export default TherapistAssignment;
