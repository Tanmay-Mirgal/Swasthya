import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import TherapistProfile, { ITherapistProfile } from "@/models/TherapistProfile";
import AppointmentRequest, { IAppointmentRequest } from "@/models/AppointmentRequest";
import User, { IUser } from "@/models/User";
import { getIdentityFromRequest, usersHaveRelationship } from "@/lib/realtime/auth/verifier";
import {
  ChatServiceError,
  listMessages,
  markScopeRead,
  sendConversationMessage,
} from "@/lib/realtime/server/chatService";
import { Rooms } from "@/lib/realtime/protocol/rooms";

export const dynamic = "force-dynamic";

/** GET /api/chat/:otherUserId[?since=ISO] — history (or only newer messages for reconnect resync). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  try {
    const { doctorId } = await params;
    if (!doctorId) {
      return NextResponse.json({ error: "Doctor/User ID required" }, { status: 400 });
    }

    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await usersHaveRelationship(me.userId, doctorId))) {
      return NextResponse.json({ error: "You can message a physiotherapist after you have requested an appointment with them." }, { status: 403 });
    }

    await connectToDatabase();
    const conversationId = Rooms.conversationId(me.userId, doctorId);
    const since = new URL(req.url).searchParams.get("since");
    const messages = await listMessages({ conversationId }, since);

    // Opening the conversation marks incoming messages as read (and tells the sender in realtime).
    if (!since) {
      void markScopeRead(me, { conversationId }, Rooms.conversation(me.userId, doctorId)).catch(() => undefined);
    }

    const [targetDoctorProfile, targetUser, upcomingApp] = await Promise.all([
      TherapistProfile.findOne({ clerkUserId: doctorId }).lean<ITherapistProfile>(),
      User.findOne({ clerkUserId: doctorId }).lean<IUser>(),
      AppointmentRequest.findOne({
        $or: [
          { patientId: me.userId, therapistId: doctorId, status: "accepted" },
          { patientId: doctorId, therapistId: me.userId, status: "accepted" },
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
      availabilityNotice: "Replies during clinical hours (9:00 AM – 6:00 PM)",
    };

    return NextResponse.json({
      success: true,
      data: {
        participant,
        messages,
        conversationId,
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

/** POST /api/chat/:otherUserId  { content, clientId } — the single write path for direct chat. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  try {
    const { doctorId } = await params;
    if (!doctorId) {
      return NextResponse.json({ error: "Doctor/User ID required" }, { status: 400 });
    }
    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const message = await sendConversationMessage(me, doctorId, body?.content, body?.clientId);
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    if (error instanceof ChatServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
