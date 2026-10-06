import { NextResponse } from "next/server";
import { getIdentityFromRequest, resolveConsultation } from "@/lib/realtime/auth/verifier";
import { markScopeRead } from "@/lib/realtime/server/chatService";
import { Rooms } from "@/lib/realtime/protocol/rooms";

export const dynamic = "force-dynamic";

/** POST /api/consultation/:id/messages/read — mark the caller's unread consultation messages as read. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const consultation = await resolveConsultation(id);
    if (!consultation || (consultation.patientId !== me.userId && consultation.doctorId !== me.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const cid = consultation._id.toString();
    const ids = await markScopeRead(me, { consultationId: cid }, Rooms.consultation(cid));
    return NextResponse.json({ success: true, data: { messageIds: ids } });
  } catch (error) {
    console.error("Error marking messages read:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
