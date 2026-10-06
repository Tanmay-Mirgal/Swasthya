import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Consultation from "@/models/Consultation";
import AppointmentRequest from "@/models/AppointmentRequest";
import TherapistProfile, { ITherapistProfile } from "@/models/TherapistProfile";
import PatientProfile from "@/models/PatientProfile";
import Prescription from "@/models/Prescription";
import ChatMessage from "@/models/ChatMessage";
import User, { IUser } from "@/models/User";
import { publish } from "@/lib/realtime/server/bus";
import { RealtimeEvent } from "@/lib/realtime/protocol/events";
import { Rooms } from "@/lib/realtime/protocol/rooms";
import { canJoinConsultation, getAppointmentTimeStatus } from "@/types/appointment";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Consultation ID is required" }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Sign in required" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const callerClerkUserId = verified?.sub;

    if (!callerClerkUserId) {
      return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
    }

    await connectToDatabase();

    // Look up Consultation by ID or by linked appointmentId
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

    // STRICT AUTHORIZATION CHECK (Rule 4 & Part 16)
    const isPatient = callerClerkUserId === consultation.patientId;
    const isDoctor = callerClerkUserId === consultation.doctorId;

    if (!isPatient && !isDoctor) {
      return NextResponse.json(
        { error: "Forbidden: You are not an authorized participant in this consultation." },
        { status: 403 }
      );
    }

    const currentUserRole: "patient" | "doctor" = isDoctor ? "doctor" : "patient";

    // Lookup linked appointment if exists
    let appointment = null;
    if (consultation.appointmentId) {
      appointment = await AppointmentRequest.findById(consultation.appointmentId).lean();
    }

    // Check cancellation state
    if (consultation.status === "CANCELLED" || appointment?.status === "cancelled") {
      return NextResponse.json(
        {
          error: "APPOINTMENT_CANCELLED",
          message: "This consultation appointment was cancelled.",
          status: "CANCELLED",
        },
        { status: 403 }
      );
    }

    // Fetch related records
    const [doctorProfile, doctorUser, patientProfile, patientUser, prescription, messages] =
      await Promise.all([
        TherapistProfile.findOne({ clerkUserId: consultation.doctorId }).lean<ITherapistProfile>(),
        User.findOne({ clerkUserId: consultation.doctorId }).lean<IUser>(),
        PatientProfile.findOne({ clerkUserId: consultation.patientId }).lean(),
        User.findOne({ clerkUserId: consultation.patientId }).lean<IUser>(),
        consultation.prescriptionId
          ? Prescription.findById(consultation.prescriptionId).lean()
          : Prescription.findOne({ consultationId: consultation._id }).lean(),
        ChatMessage.find({ consultationId: consultation._id.toString() }).sort({ createdAt: 1 }).lean(),
      ]);

    const resolvedDoctor = {
      clerkUserId: consultation.doctorId,
      professionalName:
        doctorProfile?.professionalName ||
        (doctorUser?.firstName ? `Dr. ${doctorUser.firstName} ${doctorUser.lastName || ""}`.trim() : "Dr. Physiotherapist"),
      title: doctorProfile?.title || "Doctor / Physiotherapist",
      specialization: doctorProfile?.specialization || "Orthopedic Physical Therapy",
      qualification: doctorProfile?.qualification || "MPT, Certified Specialist",
      clinicName: doctorProfile?.clinicName || "Swasthya Partner Center",
      avatarUrl:
        doctorProfile?.avatarUrl ||
        doctorUser?.imageUrl ||
        "",
      rating: doctorProfile?.rating || 4.9,
    };

    const resolvedPatient = {
      patientId: consultation.patientId,
      name:
        (patientUser?.firstName ? `${patientUser.firstName} ${patientUser.lastName || ""}`.trim() : "Patient"),
      imageUrl: patientUser?.imageUrl || null,
      concerns: patientProfile?.concerns || [consultation.issue || "Orthopedic Recovery"],
    };

    // Evaluate time window
    const now = new Date();
    const scheduledAt = consultation.scheduledAt || appointment?.scheduledAt || consultation.createdAt;
    const duration = consultation.duration || appointment?.duration || 30;
    const timeStatus = getAppointmentTimeStatus(consultation.status, scheduledAt, duration, now);
    const canJoinCall = canJoinConsultation(consultation.status, scheduledAt, duration, now);

    // If window expired and not completed yet, update to COMPLETED
    if (timeStatus === "ENDED" && consultation.status === "ACTIVE") {
      await Consultation.findByIdAndUpdate(consultation._id, {
        status: "COMPLETED",
        roomStatus: "EXPIRED",
        endedAt: consultation.endedAt || now,
      });
      consultation.status = "COMPLETED";
      consultation.roomStatus = "EXPIRED";
    }

    return NextResponse.json({
      success: true,
      data: {
        consultation,
        doctor: resolvedDoctor,
        patient: resolvedPatient,
        prescription,
        messages,
        currentUserRole,
        timeStatus,
        canJoinCall,
        isCompleted: consultation.status === "COMPLETED",
        scheduledAt,
      },
    });
  } catch (error) {
    console.error("Error fetching consultation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Consultation ID required" }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const callerClerkUserId = verified?.sub;

    if (!callerClerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    let consultation = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      consultation = await Consultation.findById(id);
    }
    if (!consultation) {
      consultation = await Consultation.findOne({ appointmentId: id });
    }
    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    // STRICT AUTHORIZATION CHECK
    const isPatient = callerClerkUserId === consultation.patientId;
    const isDoctor = callerClerkUserId === consultation.doctorId;

    if (!isPatient && !isDoctor) {
      return NextResponse.json({ error: "Forbidden: Not an authorized participant" }, { status: 403 });
    }

    const body = await req.json();
    const updateFields: Record<string, unknown> = {};

    // callStatus is owned by the realtime call state machine (lib/realtime/server/callService.ts)
    // and can no longer be set by clients.
    if (body.duration !== undefined && Number.isFinite(Number(body.duration))) updateFields.duration = Number(body.duration);
    if (body.patientNote) updateFields.patientNote = body.patientNote;
    if (body.doctorNotes && isDoctor) updateFields.doctorNotes = body.doctorNotes;

    // Doctor ends consultation -> Appointment becomes COMPLETED (Rule 14)
    if (body.status === "COMPLETED") {
      if (!isDoctor) {
        return NextResponse.json(
          { error: "Forbidden: Only the consulting doctor can end and complete a consultation." },
          { status: 403 }
        );
      }
      updateFields.status = "COMPLETED";
      updateFields.roomStatus = "COMPLETED";
      updateFields.endedAt = new Date();

      // Update linked appointment if present
      if (consultation.appointmentId) {
        await AppointmentRequest.findByIdAndUpdate(consultation.appointmentId, {
          status: "completed",
        });
      }
    }

    const updated = await Consultation.findByIdAndUpdate(
      consultation._id,
      { $set: updateFields },
      { returnDocument: "after" }
    );

    // Tell everyone in the room (e.g. the patient) that the consultation was concluded.
    if (body.status === "COMPLETED") {
      const cid = consultation._id.toString();
      await publish({
        roomId: Rooms.consultation(cid),
        event: RealtimeEvent.CALL_END,
        payload: { consultationId: cid, reason: "hangup", consultationCompleted: true },
        from: { userId: callerClerkUserId, role: "doctor" },
        excludeUserId: callerClerkUserId,
      });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating consultation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
