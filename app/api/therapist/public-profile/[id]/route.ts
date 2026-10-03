import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import TherapistProfile from "@/lib/models/TherapistProfile";

export function generateStaticParams() {
  return [{ id: "export" }];
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.CAPACITOR_BUILD === "true") {
    return NextResponse.json({ ok: true });
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Therapist ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const profile = await TherapistProfile.findOne({ clerkUserId: id }).lean();
    if (!profile) {
      return NextResponse.json({ error: "Therapist not found" }, { status: 404 });
    }

    // Explicitly return only public fields
    const publicProfile = {
      clerkUserId: profile.clerkUserId,
      professionalName: profile.professionalName,
      specialization: profile.specialization,
      yearsOfExperience: profile.yearsOfExperience,
      clinicName: profile.clinicName,
    };

    return NextResponse.json({
      success: true,
      data: publicProfile
    });
  } catch (error) {
    console.error("Error fetching public therapist profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
