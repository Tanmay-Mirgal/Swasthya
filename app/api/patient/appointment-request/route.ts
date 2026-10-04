import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import AppointmentRequest from "@/models/AppointmentRequest";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUserId = verified.sub;

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { therapistId, requestedDate, requestedTime, patientNote } = body;

    if (!therapistId) {
      return NextResponse.json({ error: "Therapist ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    // Check for existing pending request to avoid duplicates
    const existing = await AppointmentRequest.findOne({
      patientId: clerkUserId,
      therapistId,
      status: "pending"
    });

    if (existing) {
      return NextResponse.json({ error: "An appointment request is already pending for this therapist" }, { status: 400 });
    }

    const newRequest = await AppointmentRequest.create({
      patientId: clerkUserId,
      therapistId,
      status: "pending",
      requestedDate,
      requestedTime,
      patientNote,
    });

    return NextResponse.json({ success: true, data: newRequest });
  } catch (error) {
    console.error("Error creating appointment request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
