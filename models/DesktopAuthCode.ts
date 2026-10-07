import mongoose, { Schema, Document } from "mongoose";

/**
 * One-time hand-off for signing the desktop app in through the system browser. The browser (already
 * signed in) stores a Clerk sign-in ticket here under a random `code`; the desktop app can only
 * redeem it by proving it knows the PKCE verifier whose hash is `challenge`. Single use, short-lived.
 */
export interface IDesktopAuthCode extends Document {
  code: string;
  challenge: string;
  ticket: string;
  userId: string;
  expiresAt: Date;
}

const DesktopAuthCodeSchema = new Schema({
  code: { type: String, required: true, unique: true },
  challenge: { type: String, required: true },
  ticket: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  // Mongo removes the document once this time passes.
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

const DesktopAuthCode = mongoose.models.DesktopAuthCode || mongoose.model<IDesktopAuthCode>("DesktopAuthCode", DesktopAuthCodeSchema);
export default DesktopAuthCode;
