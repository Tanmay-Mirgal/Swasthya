import mongoose from "mongoose";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
let uri = "";
for (const line of env.split("\n")) {
  if (line.startsWith("MONGODB_URI=")) {
    uri = line.split("=")[1].trim().replace(/['"]/g, "");
    break;
  }
}

await mongoose.connect(uri);
const res = await mongoose.connection.db.collection("therapistprofiles").updateOne(
  { clerkUserId: "dummy_therapist_1790954711531" },
  {
    $set: {
      avatarUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
      title: "Senior Spine & Orthopedic Physiotherapist",
      qualification: "MPT Orthopedics, Certified Spine Specialist",
      yearsOfExperience: "9+ years",
      clinicName: "SpineCare & Ortho Institute",
      consultationFee: 499,
      rating: 4.94,
      reviewCount: 92,
      languages: ["English", "Hindi"],
      availability: "Available Today • Instant Video & Chat",
      supportedConditions: ["Neck Pain", "Back Pain", "Posture Problems", "Rehabilitation", "Neck", "Back"],
      bio: "Specialist in non-surgical cervical spine rehabilitation, neck stiffness relief, and ergonomic posture correction.",
      isOnline: true,
      verificationStatus: "verified",
    },
  }
);
console.log("Updated dummy therapist:", res.modifiedCount);
await mongoose.disconnect();
