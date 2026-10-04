import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/models/PatientProfile";
import TherapistAssignment from "@/models/TherapistAssignment";
import TherapistProfile, { ITherapistProfile } from "@/models/TherapistProfile";
import Consultation, { IConsultation } from "@/models/Consultation";
import Prescription from "@/models/Prescription";
import AppointmentRequest, { IAppointmentRequest } from "@/models/AppointmentRequest";
import User, { IUser } from "@/models/User";
import { canJoinConsultation, getAppointmentTimeStatus } from "@/types/appointment";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUserId = verified?.sub;

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // 1. Patient Profile
    const profile = await PatientProfile.findOne({ clerkUserId }).lean();

    // 2. Active Therapist Assignment (Connected Doctor)
    const assignment = await TherapistAssignment.findOne({
      patientId: clerkUserId,
      status: "active",
    }).lean();

    // 3. All Appointment Requests for this patient
    const appointmentRequests = await AppointmentRequest.find({
      patientId: clerkUserId,
    })
      .sort({ scheduledAt: 1, createdAt: -1 })
      .lean<IAppointmentRequest[]>();

    // 4. All Consultations for this patient
    const rawConsultations = await Consultation.find({
      patientId: clerkUserId,
    })
      .sort({ scheduledAt: 1, createdAt: -1 })
      .lean<IConsultation[]>();

    // Collect all doctor clerkUserIds across assignment, requests, and consultations
    const doctorIds = Array.from(
      new Set(
        [
          assignment?.therapistId,
          ...appointmentRequests.map((r) => r.therapistId),
          ...rawConsultations.map((c) => c.doctorId),
        ].filter(Boolean)
      )
    );

    const [doctorProfiles, doctorUsers] = await Promise.all([
      TherapistProfile.find({ clerkUserId: { $in: doctorIds } }).lean<ITherapistProfile[]>(),
      User.find({ clerkUserId: { $in: doctorIds } }).lean<IUser[]>(),
    ]);

    const doctorProfileMap = new Map<string, ITherapistProfile>();
    doctorProfiles.forEach((d) => doctorProfileMap.set(d.clerkUserId, d));

    const doctorUserMap = new Map<string, IUser>();
    doctorUsers.forEach((u) => doctorUserMap.set(u.clerkUserId, u));

    const enrichDoctor = (doctorId: string) => {
      const prof = doctorProfileMap.get(doctorId);
      const user = doctorUserMap.get(doctorId);
      return {
        clerkUserId: doctorId,
        professionalName:
          prof?.professionalName ||
          (user?.firstName ? `Dr. ${user.firstName} ${user.lastName || ""}`.trim() : "Dr. Physiotherapist"),
        title: prof?.title || "Licensed Physiotherapist",
        specialization: prof?.specialization || "Orthopedic Physical Therapy",
        qualification: prof?.qualification || "MPT, Certified Specialist",
        clinicName: prof?.clinicName || "Swasthya Partner Center",
        avatarUrl: prof?.avatarUrl || user?.imageUrl || "",
        rating: prof?.rating || 4.9,
        yearsOfExperience: prof?.yearsOfExperience || "8+ years",
        consultationFee: prof?.consultationFee || 499,
      };
    };

    // Care team doctor
    let careTeamDoctor = null;
    if (assignment?.therapistId) {
      careTeamDoctor = enrichDoctor(assignment.therapistId);
    } else if (appointmentRequests.length > 0) {
      careTeamDoctor = enrichDoctor(appointmentRequests[0].therapistId);
    } else if (rawConsultations.length > 0) {
      careTeamDoctor = enrichDoctor(rawConsultations[0].doctorId);
    }

    const now = new Date();

    // Upcoming accepted appointments
    const acceptedRequests = appointmentRequests.filter(
      (r) => r.status === "accepted"
    );

    const upcomingAppointments = acceptedRequests
      .map((r) => {
        const doc = enrichDoctor(r.therapistId);
        const sched = r.scheduledAt || r.requestedDate || r.createdAt;
        const duration = r.duration || 30;
        const timeStatus = getAppointmentTimeStatus(r.status, sched, duration, now);
        const canJoin = canJoinConsultation(r.status, sched, duration, now);

        return {
          _id: r._id.toString(),
          appointmentId: r._id.toString(),
          consultationId: r.consultationId,
          patientId: r.patientId,
          therapistId: r.therapistId,
          status: r.status,
          scheduledAt: sched,
          requestedTime: r.requestedTime,
          duration,
          patientNote: r.patientNote,
          doctor: doc,
          timeStatus,
          canJoin,
          createdAt: r.createdAt,
        };
      })
      .filter((app) => app.timeStatus !== "ENDED");

    // Pending requests awaiting doctor review
    const pendingRequests = appointmentRequests
      .filter((r) => r.status === "pending")
      .map((r) => ({
        _id: r._id.toString(),
        patientId: r.patientId,
        therapistId: r.therapistId,
        status: r.status,
        requestedDate: r.requestedDate,
        requestedTime: r.requestedTime,
        scheduledAt: r.scheduledAt,
        patientNote: r.patientNote,
        doctor: enrichDoctor(r.therapistId),
        createdAt: r.createdAt,
      }));

    // Past / Completed Consultations
    const pastConsultations = rawConsultations
      .filter((c) => c.status === "COMPLETED")
      .map((c) => ({
        _id: c._id.toString(),
        appointmentId: c.appointmentId,
        patientId: c.patientId,
        doctorId: c.doctorId,
        issue: c.issue,
        status: c.status,
        scheduledAt: c.scheduledAt,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        duration: c.duration,
        doctorNotes: c.doctorNotes,
        doctor: enrichDoctor(c.doctorId),
        createdAt: c.createdAt,
      }));

    // ACTIVE CONSULTATION: Strict evaluation
    // RULE 4: ONLY if status is ACCEPTED/ACTIVE, and CURRENT TIME IS INSIDE THE WINDOW!
    // No room is active outside the consultation window.
    const activeAppointment = upcomingAppointments.find((a) => a.canJoin && a.consultationId);
    let activeConsultation = null;

    if (activeAppointment) {
      const activeConsDoc = rawConsultations.find(
        (c) => c._id.toString() === activeAppointment.consultationId
      );
      activeConsultation = {
        _id: activeAppointment.consultationId,
        appointmentId: activeAppointment.appointmentId,
        issue: activeConsDoc?.issue || activeAppointment.patientNote || "Rehabilitation Consultation",
        status: "ACTIVE",
        scheduledAt: activeAppointment.scheduledAt,
        doctor: activeAppointment.doctor,
      };
    }

    // Latest prescription
    const latestPrescription = await Prescription.findOne({
      patientId: clerkUserId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        profile,
        careTeam: careTeamDoctor,
        upcomingAppointments,
        pendingRequests,
        pastConsultations,
        activeConsultation, // strictly null unless inside valid window!
        latestPrescription,
      },
    });
  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
