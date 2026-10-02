import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import User from "@/lib/models/User";
import TherapistProfile from "@/lib/models/TherapistProfile";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function POST(req: Request) {
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

    const { professionalName, specialization, clinicName, yearsOfExperience } = await req.json();

    await connectToDatabase();

    const user = await User.findOne({ clerkUserId });
    
    if (!user || user.role !== "therapist") {
      return NextResponse.json({ error: "Forbidden: Not a therapist" }, { status: 403 });
    }

    // Upsert Therapist Profile
    await TherapistProfile.findOneAndUpdate(
      { clerkUserId },
      {
        professionalName,
        specialization,
        clinicName,
        yearsOfExperience,
        onboardingCompleted: true
      },
      { upsert: true, new: true }
    );

    user.onboardingCompleted = true;
    await user.save();

    // Update Clerk Metadata
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        role: "therapist",
        onboardingCompleted: true
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving therapist profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
