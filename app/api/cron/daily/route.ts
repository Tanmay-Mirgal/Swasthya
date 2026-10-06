import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import connectToDatabase from "@/lib/mongodb";
import { runDailyJob } from "@/lib/rehab/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run open if the secret is not configured
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily reminder + weekly review job. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET`. Safe to run more than once: notices are de-duplicated.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectToDatabase();
    const summary = await runDailyJob();
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error("[cron/daily] failed:", error);
    return NextResponse.json({ error: "The daily job failed." }, { status: 500 });
  }
}
