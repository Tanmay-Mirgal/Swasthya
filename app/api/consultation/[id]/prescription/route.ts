import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Consultation from "@/lib/models/Consultation";
import Prescription from "@/lib/models/Prescription";
import ExerciseAssignment from "@/lib/models/ExerciseAssignment";
import ChatMessage from "@/lib/models/ChatMessage";
import TherapistProfile from "@/lib/models/TherapistProfile";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Consultation ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const { medicines = [], healthyTips = [], exercises = [], doctorNotes = "" } = body;

    await connectToDatabase();

    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    const doctorProfile: any = await TherapistProfile.findOne({
      clerkUserId: consultation.doctorId,
    }).lean();

    const doctorName = doctorProfile?.professionalName || "Dr. Aarti Sharma";
    const doctorSpecialization = doctorProfile?.specialization || "Knee Rehabilitation";

    // 1. Create or replace Prescription
    const prescription = await Prescription.create({
      consultationId: consultation._id,
      patientId: consultation.patientId,
      doctorId: consultation.doctorId,
      doctorName,
      doctorSpecialization,
      medicines,
      healthyTips,
      exercises,
      doctorNotes,
    });

    // 2. Link prescription to consultation and mark status completed
    consultation.prescriptionId = prescription._id;
    consultation.status = "COMPLETED";
    consultation.endedAt = new Date();
    await consultation.save();

    // 3. SYNCHRONIZE WITH USER'S RECOVERY PLAN:
    // Create/update active ExerciseAssignment for each prescribed exercise
    const assignmentPromises = exercises.map(async (ex: any) => {
      return ExerciseAssignment.findOneAndUpdate(
        {
          patientId: consultation.patientId,
          exerciseId: ex.exerciseId,
        },
        {
          $set: {
            patientId: consultation.patientId,
            therapistId: consultation.doctorId,
            consultationId: consultation._id.toString(),
            prescriptionId: prescription._id.toString(),
            exerciseId: ex.exerciseId,
            exerciseName: ex.name,
            status: "active",
            type: "assigned",
            targetSets: Number(ex.sets) || 3,
            targetReps: Number(ex.reps) || 10,
            frequency: ex.frequency || "Daily",
            instructions: ex.instructions || `Assigned by ${doctorName}`,
            assignedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    });

    await Promise.all(assignmentPromises);

    // 4. Send structured Prescription message to Doctor Chat
    const chatMsg = await ChatMessage.create({
      consultationId: consultation._id.toString(),
      senderId: consultation.doctorId,
      senderRole: "doctor",
      receiverId: consultation.patientId,
      content: `${doctorName} has shared your post-consultation recovery plan & prescription.`,
      type: "prescription",
      prescriptionData: {
        id: prescription._id.toString(),
        doctorName,
        doctorSpecialization,
        medicines,
        healthyTips,
        exercises,
        doctorNotes,
        createdAt: prescription.createdAt,
      },
      read: false,
    });

    return NextResponse.json({
      success: true,
      data: {
        prescription,
        message: chatMsg,
        assignedExercisesCount: exercises.length,
      },
    });
  } catch (error) {
    console.error("Error creating prescription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const prescription = await Prescription.findOne({ consultationId: id }).lean();
    if (!prescription) {
      return NextResponse.json({ error: "No prescription found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    console.error("Error fetching prescription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
