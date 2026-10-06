import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ChatMessage from "@/models/ChatMessage";
import TherapistAssignment from "@/models/TherapistAssignment";
import AppointmentRequest from "@/models/AppointmentRequest";
import WeeklyReview from "@/models/WeeklyReview";
import { getIdentityFromRequest } from "@/lib/realtime/auth/verifier";
import { canJoinConsultation } from "@/types/appointment";

export const dynamic = "force-dynamic";

/** Counts shown in navigation: unread messages and the pending action for the caller's role. */
export async function GET(req: Request) {
  try {
    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectToDatabase();

    const unreadMessages = await ChatMessage.countDocuments({ receiverId: me.userId, read: false });

    if (me.role === "doctor") {
      const pendingRequests = await AppointmentRequest.countDocuments({ therapistId: me.userId, status: "pending" });
      const reviewsReady = await WeeklyReview.countDocuments({ doctorId: me.userId, status: "report_ready" });
      return NextResponse.json({ success: true, data: { role: "doctor", unreadMessages, pendingRequests, reviewsReady, messagesHref: null, liveConsultationId: null } });
    }

    const assignment = await TherapistAssignment.findOne({ patientId: me.userId, status: "active" }).lean<{ therapistId: string }>();
    const accepted = await AppointmentRequest.find({ patientId: me.userId, status: "accepted" }).lean<
      { scheduledAt?: Date; requestedDate?: Date; createdAt: Date; duration?: number; consultationId?: string; status: string }[]
    >();
    const now = new Date();
    const live = accepted.find((a) =>
      canJoinConsultation(a.status, a.scheduledAt || a.requestedDate || a.createdAt, a.duration || 30, now)
    );

    return NextResponse.json({
      success: true,
      data: {
        role: "patient",
        unreadMessages,
        pendingRequests: 0,
        reviewsReady: 0,
        messagesHref: assignment?.therapistId ? `/chat/${assignment.therapistId}` : null,
        liveConsultationId: live?.consultationId || null,
      },
    });
  } catch (error) {
    console.error("Error loading nav badges:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
