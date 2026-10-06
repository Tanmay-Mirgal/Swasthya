import { NextResponse } from "next/server";
import { getIdentityFromRequest, resolveConsultation } from "@/lib/realtime/auth/verifier";
import { ChatServiceError, listMessages, sendConsultationMessage } from "@/lib/realtime/server/chatService";

export const dynamic = "force-dynamic";

async function authorize(req: Request, id: string) {
  const me = await getIdentityFromRequest(req);
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const consultation = await resolveConsultation(id);
  if (!consultation) return { error: NextResponse.json({ error: "Consultation not found" }, { status: 404 }) } as const;
  if (consultation.patientId !== me.userId && consultation.doctorId !== me.userId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { me, consultation } as const;
}

/** GET /api/consultation/:id/messages[?since=ISO] — history, or only newer messages for reconnect resync. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorize(req, id);
    if ("error" in auth) return auth.error;

    const since = new URL(req.url).searchParams.get("since");
    const messages = await listMessages({ consultationId: auth.consultation._id.toString() }, since);
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/consultation/:id/messages { content, clientId } — the single write path for consultation chat. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorize(req, id);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const message = await sendConsultationMessage(auth.me, auth.consultation, body?.content, body?.clientId);
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    if (error instanceof ChatServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating chat message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
