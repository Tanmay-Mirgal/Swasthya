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
const db = mongoose.connection.db;

const users = await db.collection("users").find({}).project({ clerkUserId: 1, firstName: 1, imageUrl: 1, role: 1 }).toArray();
console.log("Users:", users);

const therapists = await db.collection("therapistprofiles").find({}).project({ clerkUserId: 1, professionalName: 1, avatarUrl: 1 }).toArray();
console.log("TherapistProfiles:", therapists);

await mongoose.disconnect();
