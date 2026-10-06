import mongoose, { Schema, Document } from "mongoose";

export interface IChatMessage extends Document {
  consultationId?: string;
  conversationId?: string;
  senderId: string;
  senderRole: "patient" | "doctor" | "system";
  receiverId?: string;
  content: string;
  type: "text" | "prescription" | "call_summary" | "exercise_card" | "system";
  prescriptionData?: Record<string, unknown>;
  read: boolean;
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema(
  {
    consultationId: {
      type: String,
      index: true,
    },
    conversationId: {
      type: String,
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
    // Client-generated idempotency key so retries never create duplicate messages
    clientId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying direct conversation messages between 2 users
ChatMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });
ChatMessageSchema.index({ consultationId: 1, createdAt: 1 });
ChatMessageSchema.index(
  { senderId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
);

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
