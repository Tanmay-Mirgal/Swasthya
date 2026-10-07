import crypto from "node:crypto";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import DesktopAuthCode from "@/models/DesktopAuthCode";

export const dynamic = "force-dynamic";

/**
 * The desktop window (not signed in yet) trades `code` + PKCE `verifier` for the Clerk ticket.
 * A code gets exactly one attempt: it is deleted before the verifier is checked, so a stolen code
 * cannot be guessed against.
 */
export async function POST(req: Request) {
  try {
    const { code, verifier } = await req.json().catch(() => ({}));
    if (typeof code !== "string" || !/^[A-Za-z0-9_-]{20,128}$/.test(code) || typeof verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    await connectToDatabase();
    const record = await DesktopAuthCode.findOneAndDelete({ code, expiresAt: { $gt: new Date() } });
    if (!record) return NextResponse.json({ error: "This sign-in link has expired. Try again from the app." }, { status: 410 });

    const digest = crypto.createHash("sha256").update(verifier).digest("base64url");
    const a = Buffer.from(digest);
    const b = Buffer.from(record.challenge);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { ticket: record.ticket } });
  } catch (error) {
    console.error("Error redeeming desktop sign-in code:", error);
    return NextResponse.json({ error: "We couldn’t finish signing in. Please try again." }, { status: 500 });
  }
}
