import mongoose, { Schema, Document } from "mongoose";

export interface IChatMessage extends Document {
  consultationId: string;
  senderId: string;
  senderRole: "patient" | "doctor" | "system";
  receiverId?: string;
  content: string;
  type: "text" | "prescription" | "call_summary" | "exercise_card" | "system";
  prescriptionData?: any;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema(
  {
    consultationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["patient", "doctor", "system"],
      default: "patient",
    },
    receiverId: {
      type: String,
      index: true,
    },
    content: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["text", "prescription", "call_summary", "exercise_card", "system"],
      default: "text",
    },
    prescriptionData: {
      type: Schema.Types.Mixed,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
