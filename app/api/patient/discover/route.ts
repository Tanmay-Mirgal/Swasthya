import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/lib/models/PatientProfile";
import TherapistProfile from "@/lib/models/TherapistProfile";
import User from "@/lib/models/User";
import { ensureSeedDoctors, matchDoctorsForPatient } from "@/lib/doctors/doctorService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    let clerkUserId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const { verifyToken } = await import("@clerk/backend");
        const verified = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        clerkUserId = verified?.sub || null;
      } catch (err) {
        console.warn("Token verification failed, proceeding gracefully:", err);
      }
    }

    await connectToDatabase();
    await ensureSeedDoctors();

    let concerns: string[] = ["Knee Pain"];
    if (clerkUserId) {
      const profile = await PatientProfile.findOne({ clerkUserId }).lean();
      if (profile && Array.isArray(profile.concerns) && profile.concerns.length > 0) {
        concerns = profile.concerns;
      }
    }

    // Fetch all verified doctors from DB
    const allDoctors = await TherapistProfile.find({
      verificationStatus: { $ne: "rejected" },
    }).lean();

    // Map existing User collection to get Clerk images stored locally
    const dbUsers = await User.find({}).lean();
    const dbUserMap = new Map(dbUsers.map((u: any) => [u.clerkUserId, u]));

    // Query Clerk API to get live avatar URLs
    const clerkUserMap = new Map<string, string>();
    try {
      const { createClerkClient } = await import("@clerk/backend");
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const clerkList = await clerk.users.getUserList({ limit: 100 });
      clerkList.data.forEach((u: any) => {
        if (u.imageUrl) {
          clerkUserMap.set(u.id, u.imageUrl);
        }
      });
    } catch (e) {
      console.warn("Clerk getUserList non-blocking error:", e);
    }

    // Enrich each doctor with their live Clerk profile photo
    const enrichedDoctors = allDoctors.map((doc: any) => {
      const clerkAvatar =
        clerkUserMap.get(doc.clerkUserId) ||
        dbUserMap.get(doc.clerkUserId)?.imageUrl ||
        doc.avatarUrl ||
        null;

      return {
        ...doc,
        avatarUrl: clerkAvatar,
      };
    });

    // Run the clinical matching algorithm
    const matchedDoctors = matchDoctorsForPatient(concerns, enrichedDoctors);

    return NextResponse.json({
      success: true,
      data: {
        concerns,
        therapists: matchedDoctors,
      },
    });
  } catch (error) {
    console.error("Error fetching discover therapists:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
