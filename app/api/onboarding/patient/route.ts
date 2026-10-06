import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import PatientProfile from "@/models/PatientProfile";

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

    const { concerns } = await req.json();

    await connectToDatabase();

    const user = await User.findOne({ clerkUserId });
    
    if (!user || user.role !== "patient") {
      return NextResponse.json({ error: "Forbidden: Not a patient" }, { status: 403 });
    }

    // Upsert Patient Profile
    await PatientProfile.findOneAndUpdate(
      { clerkUserId },
      {
        concerns: concerns || [],
        onboardingCompleted: true
      },
      { upsert: true, returnDocument: "after" }
    );

    // No exercises are assigned here. A plan comes only from the patient's therapist;
    // practice suggestions are computed on read from the concerns saved above.

    user.onboardingCompleted = true;
    await user.save();

    // Update Clerk Metadata
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        role: "patient",
        onboardingCompleted: true
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving patient profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
