import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ChatMessage from "@/models/ChatMessage";
import Consultation from "@/models/Consultation";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Consultation ID required" }, { status: 400 });
    }

    await connectToDatabase();

    let consultation = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      consultation = await Consultation.findById(id).lean();
    }
    if (!consultation) {
      consultation = await Consultation.findOne({ appointmentId: id }).lean();
    }

    const consultationIdStr = consultation ? consultation._id.toString() : id;

    const messages = await ChatMessage.find({
      $or: [{ consultationId: id }, { consultationId: consultationIdStr }],
    })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { senderId, senderRole = "patient", content, type = "text", prescriptionData } = body;

    if (!senderId || (!content && !prescriptionData)) {
      return NextResponse.json(
        { error: "senderId and content/prescriptionData required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    let consultation = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      consultation = await Consultation.findById(id).lean();
    }
    if (!consultation) {
      consultation = await Consultation.findOne({ appointmentId: id }).lean();
    }

    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    const receiverId =
      senderRole === "patient" ? consultation.doctorId : consultation.patientId;

    const message = await ChatMessage.create({
      consultationId: consultation._id.toString(),
      senderId,
      senderRole,
      receiverId,
      content,
      type,
      prescriptionData,
      read: false,
    });

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Error creating chat message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
