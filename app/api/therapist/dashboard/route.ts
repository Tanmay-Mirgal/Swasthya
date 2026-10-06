import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/models/PatientProfile";
import TherapistAssignment from "@/models/TherapistAssignment";
import Prescription from "@/models/Prescription";
import { adherenceForPlans } from "@/lib/rehab/adherence";
import AppointmentRequest from "@/models/AppointmentRequest";
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
      appointmentId?: string;
      patientId: string;
      doctorId: string;
      issue?: string;
      status: string;
      roomStatus?: string;
      scheduledAt?: Date | string;
      requestedTime?: string;
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

        let requestedTime = c.requestedTime;
        if (!requestedTime && c.appointmentId) {
          const appReq = await AppointmentRequest.findById(c.appointmentId).lean();
          if (appReq?.requestedTime) {
            requestedTime = appReq.requestedTime;
          }
        }

        return {
          ...c,
          _id: c._id.toString(),
          patientName: patientUser?.fullName || `${patientUser?.firstName || "Patient"} ${patientUser?.lastName || ""}`.trim(),
          patientImage: patientUser?.imageUrl || null,
          patientConcerns: patientProf?.concerns || [c.issue || "Orthopedic Recovery"],
          scheduledAt: sched,
          requestedTime,
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
        });
      }
    }

    // The live plan per patient (one query), with adherence derived from stored sets.
    {
      const ids = (patients as unknown as PatientEntry[])
        .map((p) => p.assignment?.patientId || p.user?.clerkUserId)
        .filter((id): id is string => Boolean(id));
      const plans = await Prescription.find({ patientId: { $in: ids }, doctorId: clerkUserId, status: { $in: ["active", "paused"] } });
      const adherence = await adherenceForPlans(plans);
      const planOf = new Map(plans.map((pl) => [pl.patientId, pl]));
      for (const p of patients as unknown as (PatientEntry & { plan?: unknown; exerciseAssignments?: unknown[] })[]) {
        const id = p.assignment?.patientId || p.user?.clerkUserId || "";
        const pl = planOf.get(id);
        const a = pl ? adherence.get(pl._id.toString()) : undefined;
        p.exerciseAssignments = pl ? pl.exercises.map((e) => ({ exerciseId: e.exerciseId, targetSets: e.sets, targetReps: e.reps })) : [];
        p.plan = pl
          ? {
              id: pl._id.toString(),
              status: pl.status,
              version: pl.version,
              startDate: pl.startDate,
              endDate: pl.endDate,
              exerciseCount: pl.exercises.length,
              dayNumber: a?.dayNumber ?? null,
              totalDays: a?.totalDays ?? null,
              adherence7d: a?.adherence7d ?? null,
              missedDays7d: a?.missedDays7d ?? 0,
              completedToday: a?.completedToday ?? false,
              lastActiveDay: a?.lastActiveDay ?? null,
            }
          : null;
      }
    }

    // Real activity per patient: last session, sessions in the last 7 days, unread messages from them.
    {
      const ExerciseSession = (await import("@/models/ExerciseSession")).default;
      const ChatMessage = (await import("@/models/ChatMessage")).default;
      const ids = (patients as unknown as PatientEntry[])
        .map((p) => p.assignment?.patientId || p.user?.clerkUserId)
        .filter((id): id is string => Boolean(id));
      const weekAgo = new Date(Date.now() - 7 * 86_400_000);
      const [sessionAgg, unreadAgg] = await Promise.all([
        ExerciseSession.aggregate([
          { $match: { patientId: { $in: ids } } },
          {
            $group: {
              _id: "$patientId",
              lastSessionAt: { $max: "$date" },
              totalSessions: { $sum: 1 },
              sessionsLast7Days: { $sum: { $cond: [{ $gte: ["$date", weekAgo] }, 1, 0] } },
              daysLast7: { $addToSet: { $cond: [{ $gte: ["$date", weekAgo] }, { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, null] } },
            },
          },
        ]),
        ChatMessage.aggregate([
          { $match: { receiverId: clerkUserId, read: false, senderId: { $in: ids } } },
          { $group: { _id: "$senderId", unread: { $sum: 1 } } },
        ]),
      ]);
      const sessionMap = new Map<string, { lastSessionAt?: Date; totalSessions: number; sessionsLast7Days: number; daysLast7: (string | null)[] }>(sessionAgg.map((a: { _id: string }) => [a._id, a as never]));
      const unreadMap = new Map<string, number>(unreadAgg.map((a: { _id: string; unread: number }) => [a._id, a.unread]));
      for (const p of patients as unknown as (PatientEntry & { activity?: unknown })[]) {
        const id = p.assignment?.patientId || p.user?.clerkUserId || "";
        const s = sessionMap.get(id);
        p.activity = {
          lastSessionAt: s?.lastSessionAt || null,
          totalSessions: s?.totalSessions || 0,
          sessionsLast7Days: s?.sessionsLast7Days || 0,
          activeDaysLast7: s ? s.daysLast7.filter(Boolean).length : 0,
          unreadMessages: unreadMap.get(id) || 0,
        };
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
        },
      }
    });
  } catch (error) {
    console.error("Error fetching therapist dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
