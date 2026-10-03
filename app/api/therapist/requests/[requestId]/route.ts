import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import AppointmentRequest from "@/lib/models/AppointmentRequest";
import TherapistAssignment from "@/lib/models/TherapistAssignment";
import User from "@/lib/models/User";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export function generateStaticParams() {
  return [{ requestId: "export" }];
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    
    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

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

    await connectToDatabase();

    // Verify role
    const user = await User.findOne({ clerkUserId }).lean();
    if (!user || user.role !== "therapist") {
      return NextResponse.json({ error: "Forbidden: Not a therapist" }, { status: 403 });
    }

    const { action } = await req.json(); // "accept" or "decline"
    
    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const appointmentRequest = await AppointmentRequest.findById(requestId);
    
    if (!appointmentRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    
    if (appointmentRequest.therapistId !== clerkUserId) {
      return NextResponse.json({ error: "Forbidden: Request does not belong to you" }, { status: 403 });
    }
    
    if (appointmentRequest.status !== "pending") {
      return NextResponse.json({ error: `Request is already ${appointmentRequest.status}` }, { status: 400 });
    }

    if (action === "accept") {
      appointmentRequest.status = "accepted";
      await appointmentRequest.save();

      // Create or update TherapistAssignment to active
      await TherapistAssignment.findOneAndUpdate(
        { patientId: appointmentRequest.patientId, therapistId: clerkUserId },
        { status: "active", assignedAt: new Date() },
        { upsert: true, new: true }
      );
    } else if (action === "decline") {
      appointmentRequest.status = "declined";
      await appointmentRequest.save();
    }

    return NextResponse.json({ success: true, status: appointmentRequest.status });
  } catch (error) {
    console.error("Error processing appointment request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
