import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import DesktopAuthCode from "@/models/DesktopAuthCode";
import { getIdentityFromRequest } from "@/lib/realtime/auth/verifier";

export const dynamic = "force-dynamic";

const CODE_TTL_SECONDS = 120;
const MAX_ACTIVE_PER_USER = 5;

/** Signed-in browser asks for a one-time code to give to the desktop app (which holds the PKCE verifier). */
export async function POST(req: Request) {
  try {
    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { challenge } = await req.json().catch(() => ({}));
    // A SHA-256 digest, base64url encoded, is exactly 43 characters.
    if (typeof challenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    await connectToDatabase();
    if ((await DesktopAuthCode.countDocuments({ userId: me.userId })) >= MAX_ACTIVE_PER_USER) {
      return NextResponse.json({ error: "Too many sign-in attempts. Wait a minute and try again." }, { status: 429 });
    }

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const signInToken = await clerk.signInTokens.createSignInToken({ userId: me.userId, expiresInSeconds: CODE_TTL_SECONDS });

    const code = crypto.randomBytes(32).toString("base64url");
    await DesktopAuthCode.create({
      code,
      challenge,
      ticket: signInToken.token,
      userId: me.userId,
      expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
    });

    return NextResponse.json({ success: true, data: { code } });
  } catch (error) {
    console.error("Error creating desktop sign-in code:", error);
    return NextResponse.json({ error: "We couldn’t start desktop sign-in. Please try again." }, { status: 500 });
  }
}
