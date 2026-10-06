import { NextResponse } from "next/server";
import { getIdentityFromRequest, usersHaveRelationship } from "@/lib/realtime/auth/verifier";
import { markScopeRead } from "@/lib/realtime/server/chatService";
import { Rooms } from "@/lib/realtime/protocol/rooms";

export const dynamic = "force-dynamic";

/** POST /api/chat/:otherUserId/read — mark the caller's unread messages as read. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  try {
    const { doctorId } = await params;
    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!doctorId || !(await usersHaveRelationship(me.userId, doctorId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const ids = await markScopeRead(me, { conversationId: Rooms.conversationId(me.userId, doctorId) }, Rooms.conversation(me.userId, doctorId));
    return NextResponse.json({ success: true, data: { messageIds: ids } });
  } catch (error) {
    console.error("Error marking messages read:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
