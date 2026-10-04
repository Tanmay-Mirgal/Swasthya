import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ChatMessage, { IChatMessage } from "@/models/ChatMessage";
import TherapistProfile, { ITherapistProfile } from "@/models/TherapistProfile";
import AppointmentRequest, { IAppointmentRequest } from "@/models/AppointmentRequest";
import User, { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  try {
    const { doctorId } = await params;
    if (!doctorId) {
      return NextResponse.json({ error: "Doctor/User ID required" }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const callerId = verified?.sub;

    if (!callerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Fetch conversation messages
    const conversationId = [callerId, doctorId].sort().join("_");
    const messages = await ChatMessage.find({
      $or: [
        { conversationId },
        { senderId: callerId, receiverId: doctorId },
        { senderId: doctorId, receiverId: callerId },
      ],
    })
      .sort({ createdAt: 1 })
      .lean<IChatMessage[]>();

    // Fetch target user profile (doctor or patient)
    const [targetDoctorProfile, targetUser, upcomingApp] = await Promise.all([
      TherapistProfile.findOne({ clerkUserId: doctorId }).lean<ITherapistProfile>(),
      User.findOne({ clerkUserId: doctorId }).lean<IUser>(),
      AppointmentRequest.findOne({
        $or: [
          { patientId: callerId, therapistId: doctorId, status: "accepted" },
          { patientId: doctorId, therapistId: callerId, status: "accepted" },
        ],
      })
        .sort({ scheduledAt: 1 })
        .lean<IAppointmentRequest>(),
    ]);

    const participant = {
      clerkUserId: doctorId,
      name:
        targetDoctorProfile?.professionalName ||
        (targetUser?.firstName ? `${targetUser.firstName} ${targetUser.lastName || ""}`.trim() : "Healthcare Specialist"),
      title: targetDoctorProfile?.title || "Doctor / Physiotherapist",
      specialization: targetDoctorProfile?.specialization || "Orthopedic Physical Therapy",
      clinicName: targetDoctorProfile?.clinicName || "Swasthya Partner Center",
      avatarUrl: targetDoctorProfile?.avatarUrl || targetUser?.imageUrl || "",
      // Real availability policy:
      availabilityNotice: "Replies during clinical hours (9:00 AM – 6:00 PM)",
    };

    return NextResponse.json({
      success: true,
      data: {
        participant,
        messages,
        upcomingAppointment: upcomingApp
          ? {
              _id: upcomingApp._id.toString(),
              scheduledAt: upcomingApp.scheduledAt || upcomingApp.requestedDate,
              requestedTime: upcomingApp.requestedTime,
              status: upcomingApp.status,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  try {
    const { doctorId } = await params;
    if (!doctorId) {
      return NextResponse.json({ error: "Doctor/User ID required" }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const senderId = verified?.sub;

    if (!senderId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Message content required" }, { status: 400 });
    }

    await connectToDatabase();

    // Determine sender role
    const callerUser = await User.findOne({ clerkUserId: senderId }).lean();
    const senderRole: "patient" | "doctor" = callerUser?.role === "therapist" ? "doctor" : "patient";

    const conversationId = [senderId, doctorId].sort().join("_");

    const message = await ChatMessage.create({
      conversationId,
      senderId,
      senderRole,
      receiverId: doctorId,
      content: content.trim(),
      type: "text",
      read: false,
    });

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
