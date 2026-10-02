import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import User from "@/lib/models/User";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    
    // In a real app we'd verify the token with clerkClient.verifyToken, but for simplicity
    // in this Next.js API route we can decode it if we have the secret, 
    // or we can use the clerkClient to fetch the user if they passed their ID.
    // For proper security, we need to verify the JWT.
    
    // Verify JWT
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUserId = verified.sub;

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role } = await req.json();

    if (role !== "patient" && role !== "therapist") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    await connectToDatabase();

    let user = await User.findOne({ clerkUserId });
    
    // Fallback: If webhook was missed or user signed up before webhooks were configured
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      
      user = await User.create({
        clerkUserId: clerkUserId,
        email: email || "",
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        role: null,
        onboardingCompleted: false,
      });
    }

    if (user.role && user.role !== null) {
      return NextResponse.json({ error: "Role already assigned" }, { status: 403 });
    }

    user.role = role;
    await user.save();

    // Update Clerk Metadata
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        role,
        onboardingCompleted: false
      }
    });

    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error("Error setting role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
