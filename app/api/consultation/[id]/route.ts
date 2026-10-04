import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Consultation from "@/models/Consultation";
import TherapistProfile from "@/models/TherapistProfile";
import PatientProfile from "@/models/PatientProfile";
import Prescription from "@/models/Prescription";
import ChatMessage from "@/models/ChatMessage";
import { ensureSeedDoctors } from "@/services/doctors/doctorService";

import User from "@/models/User";

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
    let callerClerkUserId: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const { verifyToken } = await import("@clerk/backend");
        const verified = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        callerClerkUserId = verified?.sub || null;
      } catch (err) {
        console.warn("Token verification note:", err);
      }
    }

    await connectToDatabase();
    await ensureSeedDoctors();

    const consultation = await Consultation.findById(id).lean();
    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    const [doctorProfile, doctorUser, patientProfile, patientUser, prescription, messages] =
      await Promise.all([
        TherapistProfile.findOne({ clerkUserId: consultation.doctorId }).lean(),
        User.findOne({ clerkUserId: consultation.doctorId }).lean(),
        PatientProfile.findOne({ clerkUserId: consultation.patientId }).lean(),
        User.findOne({ clerkUserId: consultation.patientId }).lean(),
        consultation.prescriptionId
          ? Prescription.findById(consultation.prescriptionId).lean()
          : Prescription.findOne({ consultationId: consultation._id }).lean(),
        ChatMessage.find({ consultationId: id }).sort({ createdAt: 1 }).lean(),
      ]);

    // Resolve Clerk / live image for Doctor
    const doctorAvatar =
      doctorProfile?.avatarUrl ||
      doctorUser?.imageUrl ||
      "https://images.unsplash.com/photo-1594824813589-f54460f997cb?auto=format&fit=crop&q=80&w=400";

    const resolvedDoctor = {
      clerkUserId: consultation.doctorId,
      professionalName: doctorProfile?.professionalName || doctorUser?.fullName || "Dr. Physiotherapist",
      title: doctorProfile?.title || "Doctor / Physiotherapist",
      specialization: doctorProfile?.specialization || "Orthopedic Physical Therapy",
      avatarUrl: doctorAvatar,
    };

    // Resolve patient details
    const resolvedPatient = {
      patientId: consultation.patientId,
      name: patientUser?.fullName || patientUser?.name || "Patient",
      imageUrl: patientUser?.imageUrl || null,
      concerns: patientProfile?.concerns || [consultation.issue || "Orthopedic Recovery"],
    };

    // Automatically determine role
    let currentUserRole: "patient" | "doctor" = "patient";
    if (callerClerkUserId) {
      if (callerClerkUserId === consultation.doctorId) {
        currentUserRole = "doctor";
      } else {
        const callerUser = await User.findOne({ clerkUserId: callerClerkUserId }).lean();
        const callerTherapist = await TherapistProfile.findOne({ clerkUserId: callerClerkUserId }).lean();
        if (callerUser?.role === "therapist" || callerTherapist) {
          currentUserRole = "doctor";
        }
      }
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
    const body = await req.json();

    await connectToDatabase();

    const updateFields: any = {};
    if (body.status) updateFields.status = body.status;
    if (body.callStatus) updateFields.callStatus = body.callStatus;
    if (body.duration !== undefined) updateFields.duration = body.duration;
    if (body.doctorNotes) updateFields.doctorNotes = body.doctorNotes;
    if (body.patientNote) updateFields.patientNote = body.patientNote;
    if (body.status === "COMPLETED") {
      updateFields.endedAt = new Date();
    }

    const updated = await Consultation.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating consultation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
