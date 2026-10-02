import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/lib/models/PatientProfile";
import TherapistProfile from "@/lib/models/TherapistProfile";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

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

    const profile = await PatientProfile.findOne({ clerkUserId }).lean();
    if (!profile) {
      return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });
    }

    // Find all therapists (optionally filtering by verification status)
    // For a real app, we'd do text indexing or category matching between profile.concerns and therapist.specialization
    let therapists = await TherapistProfile.find({}).lean();
    
    // Sort therapists: those whose specialization matches concerns come first
    const concernsLower = (profile.concerns || []).map(c => c.toLowerCase());
    
    therapists = therapists.sort((a, b) => {
      const aSpec = (a.specialization || "").toLowerCase();
      const bSpec = (b.specialization || "").toLowerCase();
      
      const aMatches = concernsLower.some(c => aSpec.includes(c));
      const bMatches = concernsLower.some(c => bSpec.includes(c));
      
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        concerns: profile.concerns || [],
        therapists,
      }
    });
  } catch (error) {
    console.error("Error fetching discover therapists:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
