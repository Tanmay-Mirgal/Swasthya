import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import AppointmentRequest from "@/models/AppointmentRequest";

export function parseScheduledAt(
  requestedDate?: string | Date,
  requestedTime?: string
): Date {
  let base: Date;
  if (requestedDate instanceof Date) {
    base = new Date(requestedDate);
  } else if (typeof requestedDate === "string" && requestedDate.includes("-")) {
    const parts = requestedDate.split("-").map(Number);
    base = new Date(parts[0], parts[1] - 1, parts[2] || 1);
  } else if (requestedDate) {
    base = new Date(requestedDate);
  } else {
    base = new Date();
  }

  let hours = 10;
  let minutes = 0;

  if (requestedTime) {
    const timeMatch = requestedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const meridian = timeMatch[3]?.toUpperCase();
      if (meridian === "PM" && hours < 12) hours += 12;
      if (meridian === "AM" && hours === 12) hours = 0;
    }
  }

  base.setHours(hours, minutes, 0, 0);
  return base;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUserId = verified?.sub;

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { therapistId, requestedDate, requestedTime, patientNote, scheduledAt: clientScheduledAt } = body;

    if (!therapistId) {
      return NextResponse.json({ error: "Therapist ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    // Check for existing pending request with this therapist
    const existing = await AppointmentRequest.findOne({
      patientId: clerkUserId,
      therapistId,
      status: "pending",
    });

    if (existing) {
      return NextResponse.json(
        { error: "An appointment request is already pending review with this therapist." },
        { status: 400 }
      );
    }

    const scheduledAt = clientScheduledAt
      ? new Date(clientScheduledAt)
      : parseScheduledAt(requestedDate, requestedTime);

    const newRequest = await AppointmentRequest.create({
      patientId: clerkUserId,
      therapistId,
      status: "pending",
      requestedDate: requestedDate ? new Date(requestedDate) : new Date(),
      requestedTime: requestedTime || "10:00 AM",
      scheduledAt,
      duration: 30,
      patientNote: patientNote?.trim() || "",
    });

    return NextResponse.json({ success: true, data: newRequest });
  } catch (error) {
    console.error("Error creating appointment request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
