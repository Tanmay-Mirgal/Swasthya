import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import TherapistProfile from "@/models/TherapistProfile";
import User from "@/models/User";
import { ensureSeedDoctors } from "@/services/doctors/doctorService";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Therapist ID is required" }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSeedDoctors();

    interface TherapistProfileData {
      clerkUserId: string;
      professionalName?: string;
      title?: string;
      qualification?: string;
      specialization?: string;
      supportedConditions?: string[];
      yearsOfExperience?: string;
      clinicName?: string;
      consultationFee?: number;
      rating?: number;
      reviewCount?: number;
      languages?: string[];
      availability?: string;
      avatarUrl?: string | null;
      bio?: string;
      isOnline?: boolean;
    }

    const profile = await TherapistProfile.findOne({ clerkUserId: id }).lean() as TherapistProfileData | null;
    if (!profile) {
      return NextResponse.json({ error: "Therapist not found" }, { status: 404 });
    }

    // Try finding Clerk avatar from DB or Clerk client
    let avatarUrl = profile.avatarUrl || null;
    const dbUser = await User.findOne({ clerkUserId: id }).lean();
    if (dbUser?.imageUrl) {
      avatarUrl = dbUser.imageUrl;
    } else {
      try {
        const { createClerkClient } = await import("@clerk/backend");
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const clerkUser = await clerk.users.getUser(id);
        if (clerkUser?.imageUrl) {
          avatarUrl = clerkUser.imageUrl;
        }
      } catch {
        // Fallback gracefully
      }
    }

    const publicProfile = {
      clerkUserId: profile.clerkUserId,
      professionalName: profile.professionalName || "Physiotherapy Specialist",
      title: profile.title || "Doctor / Physiotherapist",
      qualification: profile.qualification || "MPT, BPT Certified",
      specialization: profile.specialization || "Orthopedic Physical Therapy",
      supportedConditions: profile.supportedConditions || [],
      yearsOfExperience: profile.yearsOfExperience || "8+ years",
      clinicName: profile.clinicName || "Swasthya Rehabilitation Network",
      consultationFee: profile.consultationFee || 499,
      rating: profile.rating || 4.9,
      reviewCount: profile.reviewCount || 60,
      languages: profile.languages || ["English", "Hindi"],
      availability: profile.availability || "Available Today",
      avatarUrl,
      bio: profile.bio || "Dedicated orthopedic physiotherapist specializing in personalized functional recovery.",
      isOnline: profile.isOnline ?? true,
    };

    return NextResponse.json({
      success: true,
      data: publicProfile,
    });
  } catch (error) {
    console.error("Error fetching public therapist profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
