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

    const body = await req.json();
    const {
      professionalName,
      specialization,
      specializations = [],
      supportedConditions = [],
      clinicName = "Swasthya Rehabilitation Network",
      yearsOfExperience = "8+ years",
      qualification = "MPT, BPT Certified",
    } = body;

    // Combine conditions from both specializations and supportedConditions
    const combinedConditions = Array.from(
      new Set([
        ...supportedConditions,
        ...specializations,
        ...(specialization ? specialization.split(",").map((s: string) => s.trim()) : []),
      ])
    ).filter(Boolean);

    const primarySpecialization =
      specialization ||
      (specializations.length > 0 ? specializations.slice(0, 3).join(", ") : "Orthopedic Physical Therapy");

    await connectToDatabase();

    const user = await User.findOne({ clerkUserId });
    
    if (!user || user.role !== "therapist") {
      return NextResponse.json({ error: "Forbidden: Not a therapist" }, { status: 403 });
    }

    // Upsert Therapist Profile with rich clinical data
    await TherapistProfile.findOneAndUpdate(
      { clerkUserId },
      {
        professionalName: professionalName || user.fullName || user.name || "Doctor",
        specialization: primarySpecialization,
        supportedConditions: combinedConditions,
        qualification,
        clinicName,
        yearsOfExperience,
        avatarUrl: user.imageUrl || null,
        onboardingCompleted: true,
        verificationStatus: "verified",
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
