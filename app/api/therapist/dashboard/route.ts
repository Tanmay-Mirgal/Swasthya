import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/models/PatientProfile";
import TherapistAssignment from "@/models/TherapistAssignment";
import ExerciseAssignment from "@/models/ExerciseAssignment";
import User from "@/models/User";

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
    const clerkUserId = verified.sub;

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Verify role (either role is therapist or TherapistProfile exists)
    const user = await User.findOne({ clerkUserId });
    const TherapistProfile = (await import("@/models/TherapistProfile")).default;
    const therapistProfile = await TherapistProfile.findOne({ clerkUserId }).lean();

    if ((!user || user.role !== "therapist") && !therapistProfile) {
      return NextResponse.json({ error: "Forbidden: Not a therapist" }, { status: 403 });
    }

    // Get patients assigned to this therapist
    const assignments = await TherapistAssignment.find({ therapistId: clerkUserId, status: "active" }).lean();
    
    const patients = [];
    for (const assignment of assignments) {
      const patientUser = await User.findOne({ clerkUserId: assignment.patientId }).lean();
      const patientProfile = await PatientProfile.findOne({ clerkUserId: assignment.patientId }).lean();
      const exerciseAssignments = await ExerciseAssignment.find({ patientId: assignment.patientId }).lean();
      
      if (patientUser) {
        patients.push({
          assignment,
          user: {
             clerkUserId: assignment.patientId,
             firstName: patientUser.firstName,
             lastName: patientUser.lastName,
             fullName: patientUser.fullName || `${patientUser.firstName || "Patient"} ${patientUser.lastName || ""}`.trim(),
             email: patientUser.email,
             imageUrl: patientUser.imageUrl,
          },
          profile: patientProfile,
          exerciseAssignments
        });
      }
    }

    const AppointmentRequest = (await import("@/models/AppointmentRequest")).default;
    const requestRecords = await AppointmentRequest.find({ therapistId: clerkUserId, status: "pending" }).lean();
    
    const pendingRequests = [];
    for (const req of requestRecords) {
      const patientUser = await User.findOne({ clerkUserId: req.patientId }).lean();
      const patientProfile = await PatientProfile.findOne({ clerkUserId: req.patientId }).lean();
      
      if (patientUser) {
        pendingRequests.push({
          request: req,
          user: {
             clerkUserId: req.patientId,
             firstName: patientUser.firstName,
             lastName: patientUser.lastName,
             fullName: patientUser.fullName || `${patientUser.firstName || "Patient"} ${patientUser.lastName || ""}`.trim(),
             imageUrl: patientUser.imageUrl,
          },
          profile: patientProfile,
        });
      }
    }

    const Consultation = (await import("@/models/Consultation")).default;
    const rawConsultations = await Consultation.find({ doctorId: clerkUserId }).sort({ updatedAt: -1 }).lean();
    
    const { canJoinConsultation, getAppointmentTimeStatus } = await import("@/types/appointment");
    const now = new Date();

    // Enrich consultations with patient details and lifecycle status
    interface RawConsultationDoc {
      _id: { toString(): string } | string;
      patientId: string;
      doctorId: string;
      issue?: string;
      status: string;
      roomStatus?: string;
      scheduledAt?: Date | string;
      createdAt: Date | string;
      duration?: number;
    }

    const typedRawConsultations = rawConsultations as unknown as RawConsultationDoc[];

    const consultations = await Promise.all(
      typedRawConsultations.map(async (c) => {
        const patientUser = await User.findOne({ clerkUserId: c.patientId }).lean();
        const patientProf = await PatientProfile.findOne({ clerkUserId: c.patientId }).lean();
        const sched = c.scheduledAt || c.createdAt;
        const duration = c.duration || 30;
        const canJoin = canJoinConsultation(c.status, sched, duration, now);
        const timeStatus = getAppointmentTimeStatus(c.status, sched, duration, now);

        return {
          ...c,
          _id: c._id.toString(),
          patientName: patientUser?.fullName || `${patientUser?.firstName || "Patient"} ${patientUser?.lastName || ""}`.trim(),
          patientImage: patientUser?.imageUrl || null,
          patientConcerns: patientProf?.concerns || [c.issue || "Orthopedic Recovery"],
          scheduledAt: sched,
          duration,
          canJoin,
          timeStatus,
        };
      })
    );

    interface PatientEntry {
      assignment?: { patientId: string; status?: string };
      user?: {
        clerkUserId: string;
        firstName?: string;
        lastName?: string;
        fullName?: string;
        email?: string;
        imageUrl?: string;
      };
      profile?: { concerns?: string[] } | null;
      exerciseAssignments?: unknown[];
      consultation?: RawConsultationDoc;
    }

    const typedPatients = patients as PatientEntry[];

    // Also include any patient from active consultations
    for (const c of typedRawConsultations) {
      const alreadyIncluded = typedPatients.some((p) => p.assignment?.patientId === c.patientId || p.user?.clerkUserId === c.patientId);
      if (!alreadyIncluded) {
        const patientUser = await User.findOne({ clerkUserId: c.patientId }).lean();
        const patientProfile = await PatientProfile.findOne({ clerkUserId: c.patientId }).lean();
        const exerciseAssignments = await ExerciseAssignment.find({ patientId: c.patientId }).lean();

        typedPatients.push({
          assignment: { patientId: c.patientId, status: c.status },
          consultation: c,
          user: {
            clerkUserId: c.patientId,
            firstName: patientUser?.firstName || "Patient",
            lastName: patientUser?.lastName || "",
            fullName: patientUser?.fullName || `${patientUser?.firstName || "Patient"} ${patientUser?.lastName || ""}`.trim(),
            email: patientUser?.email || "",
            imageUrl: patientUser?.imageUrl || "",
          },
          profile: patientProfile || { concerns: [c.issue || "Orthopedic Recovery"] },
          exerciseAssignments,
        });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAppointments = consultations.filter((c) => new Date(c.scheduledAt || c.createdAt) >= today);
    const completedConsultations = consultations.filter((c) => c.status === "COMPLETED");

    return NextResponse.json({
      success: true,
      data: {
        patients,
        consultations,
        pendingRequests,
        profile: therapistProfile,
        stats: {
          totalPatients: patients.length,
          todayAppointments: todayAppointments.length,
          completedSessions: completedConsultations.length,
          consultationFee: therapistProfile?.consultationFee || 499,
          totalRevenue: completedConsultations.length * (therapistProfile?.consultationFee || 499),
        },
      }
    });
  } catch (error) {
    console.error("Error fetching therapist dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
