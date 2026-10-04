import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import TherapistProfile from "@/models/TherapistProfile";

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

    const [user, profile] = await Promise.all([
      User.findOne({ clerkUserId }).lean(),
      TherapistProfile.findOne({ clerkUserId }).lean(),
    ]);

    if (!profile && user?.role !== "therapist") {
      return NextResponse.json({ error: "Therapist profile not found" }, { status: 404 });
    }

    // Resolve avatar
    const avatarUrl =
      profile?.avatarUrl ||
      user?.imageUrl ||
      null;

    const data = {
      clerkUserId,
      professionalName: profile?.professionalName || user?.fullName || "Dr. Physiotherapist",
      title: profile?.title || "Doctor / Physiotherapist",
      qualification: profile?.qualification || "MPT, BPT Certified",
      specialization: profile?.specialization || "Orthopedic Physical Therapy",
      supportedConditions: profile?.supportedConditions || ["Neck Pain", "Back Pain"],
      yearsOfExperience: profile?.yearsOfExperience || "8+ years",
      clinicName: profile?.clinicName || "Swasthya Partner Center",
      consultationFee: profile?.consultationFee || 499,
      rating: profile?.rating || 4.95,
      reviewCount: profile?.reviewCount || 120,
      languages: profile?.languages || ["English", "Hindi"],
      availability: profile?.availability || "Available Today • Instant Video & Chat",
      avatarUrl,
      bio: profile?.bio || "Experienced orthopedic physical therapist dedicated to evidence-based musculoskeletal recovery.",
      isOnline: profile?.isOnline ?? true,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching therapist profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
      title,
      qualification,
      specialization,
      supportedConditions = [],
      yearsOfExperience,
      clinicName,
      consultationFee,
      languages,
      availability,
      bio,
      isOnline,
    } = body;

interface TherapistUpdateFields {
  updatedAt: Date;
  professionalName?: string;
  title?: string;
  qualification?: string;
  specialization?: string;
  supportedConditions?: string[];
  yearsOfExperience?: string;
  clinicName?: string;
  consultationFee?: number;
  languages?: string[];
  availability?: string;
  bio?: string;
  isOnline?: boolean;
}

    const updateFields: TherapistUpdateFields = {
      updatedAt: new Date(),
    };

    if (professionalName !== undefined) updateFields.professionalName = professionalName;
    if (title !== undefined) updateFields.title = title;
    if (qualification !== undefined) updateFields.qualification = qualification;
    if (specialization !== undefined) updateFields.specialization = specialization;
    if (Array.isArray(supportedConditions)) updateFields.supportedConditions = supportedConditions;
    if (yearsOfExperience !== undefined) updateFields.yearsOfExperience = yearsOfExperience;
    if (clinicName !== undefined) updateFields.clinicName = clinicName;
    if (consultationFee !== undefined) updateFields.consultationFee = Number(consultationFee) || 499;
    if (Array.isArray(languages)) updateFields.languages = languages;
    if (availability !== undefined) updateFields.availability = availability;
    if (bio !== undefined) updateFields.bio = bio;
    if (isOnline !== undefined) updateFields.isOnline = isOnline;

    const updatedProfile = await TherapistProfile.findOneAndUpdate(
      { clerkUserId },
      { $set: updateFields },
      { upsert: true, new: true }
    );

    // Update User record if professionalName changed
    if (professionalName) {
      await User.findOneAndUpdate(
        { clerkUserId },
        { $set: { fullName: professionalName, role: "therapist" } }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Therapist profile updated successfully",
      data: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating therapist profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
