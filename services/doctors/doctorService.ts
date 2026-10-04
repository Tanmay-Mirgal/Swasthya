import connectToDatabase from "@/lib/mongodb";
import TherapistProfile, { ITherapistProfile } from "@/models/TherapistProfile";

export interface MatchedDoctor {
  clerkUserId: string;
  professionalName: string;
  title: string;
  qualification: string;
  specialization: string;
  supportedConditions: string[];
  yearsOfExperience: string;
  clinicName: string;
  consultationFee: number;
  rating: number;
  reviewCount: number;
  languages: string[];
  availability: string;
  avatarUrl: string;
  bio: string;
  isOnline: boolean;
  isRecommended: boolean;
  matchScore: number;
  recommendationReason: string;
  matchedConditions: string[];
}

export const VERIFIED_SEED_DOCTORS = [
  {
    clerkUserId: "doc_aarti_sharma",
    professionalName: "Dr. Aarti Sharma",
    title: "Senior Orthopedic Physiotherapist",
    qualification: "MPT Orthopedics, Certified Knee & Sports Specialist (AIIMS)",
    specialization: "Knee Rehabilitation & Orthopedic Physiotherapy",
    supportedConditions: [
      "Knee Pain",
      "Knee Rehabilitation",
      "Sports Injury",
      "Lower-limb rehabilitation",
      "Mobility Issues",
      "Rehabilitation",
      "Knee",
    ],
    yearsOfExperience: "12+ years",
    clinicName: "Apex Ortho & Joint Rehabilitation Center",
    consultationFee: 499,
    rating: 4.96,
    reviewCount: 184,
    languages: ["English", "Hindi"],
    availability: "Available Now • Instant Video & Chat",
    avatarUrl: "https://images.unsplash.com/photo-1594824813589-f54460f997cb?auto=format&fit=crop&q=80&w=400",
    bio: "Chief of Orthopedic Rehabilitation specializing in patellofemoral disorders, ACL biomechanics, and targeted knee strengthening programs. Formulated over 3,000 successful recovery plans.",
    isOnline: true,
    verificationStatus: "verified" as const,
    onboardingCompleted: true,
  },
  {
    clerkUserId: "doc_rajesh_verma",
    professionalName: "Dr. Rajesh Verma",
    title: "Consultant Spine & Posture Specialist",
    qualification: "MPT Musculoskeletal & Spine Mechanics, BPT",
    specialization: "Spine, Neck & Posture Rehabilitation",
    supportedConditions: [
      "Back Pain",
      "Neck Pain",
      "Posture Problems",
      "Mobility Issues",
      "Neck",
      "Back",
      "Rehabilitation",
    ],
    yearsOfExperience: "15+ years",
    clinicName: "SpineCare & Ergonomic Mobility Institute",
    consultationFee: 599,
    rating: 4.92,
    reviewCount: 215,
    languages: ["English", "Hindi"],
    availability: "Available Today • Instant Video & Chat",
    avatarUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
    bio: "Pioneer in non-invasive cervical and lumbar spine decompression, postural ergonomic rehabilitation, and degenerative spine disease recovery.",
    isOnline: true,
    verificationStatus: "verified" as const,
    onboardingCompleted: true,
  },
  {
    clerkUserId: "doc_priya_nair",
    professionalName: "Dr. Priya Nair",
    title: "Lead Sports Physical Therapist",
    qualification: "MS Sports Physiotherapy, CSCS Certified",
    specialization: "Sports Injury & High-Performance Rehabilitation",
    supportedConditions: [
      "Sports Injury",
      "Knee Pain",
      "Shoulder Pain",
      "Mobility Issues",
      "Arm / Elbow",
      "Rehabilitation",
      "General Physiotherapy",
    ],
    yearsOfExperience: "9+ years",
    clinicName: "Kinetic Sports Rehab & Recovery Lab",
    consultationFee: 449,
    rating: 4.89,
    reviewCount: 96,
    languages: ["English", "Hindi", "Malayalam"],
    availability: "Available Today • Next slot in 15 mins",
    avatarUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
    bio: "Former team physiotherapist for athletic federations. Expert in return-to-sport testing, biomechanical video analysis, and active kinetic loading protocols.",
    isOnline: true,
    verificationStatus: "verified" as const,
    onboardingCompleted: true,
  },
  {
    clerkUserId: "doc_vikram_mehra",
    professionalName: "Dr. Vikram Mehra",
    title: "Upper Extremity & Shoulder Specialist",
    qualification: "MPT Upper Extremity & Joint Arthroplasty, CMPT",
    specialization: "Shoulder, Arm & General Physiotherapy",
    supportedConditions: [
      "Shoulder Pain",
      "Arm / Elbow",
      "Posture Problems",
      "General Physiotherapy",
      "Shoulder",
      "Neck",
    ],
    yearsOfExperience: "11+ years",
    clinicName: "Metro Joint & Orthopedic Polyclinic",
    consultationFee: 499,
    rating: 4.88,
    reviewCount: 110,
    languages: ["English", "Hindi", "Punjabi"],
    availability: "Available Today • Instant Video & Chat",
    avatarUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
    bio: "Specializing in rotator cuff rehabilitation, frozen shoulder hydrodilatation therapy, and functional shoulder stability restoration.",
    isOnline: true,
    verificationStatus: "verified" as const,
    onboardingCompleted: true,
  },
];

export async function ensureSeedDoctors(): Promise<void> {
  await connectToDatabase();
  for (const doc of VERIFIED_SEED_DOCTORS) {
    await TherapistProfile.findOneAndUpdate(
      { clerkUserId: doc.clerkUserId },
      { $set: doc },
      { upsert: true, new: true }
    );
  }
}

/**
 * Robust matching engine between User Onboarding Issues and Doctor Specialties
 */
export function matchDoctorsForPatient(
  concerns: string[],
  doctors: Partial<ITherapistProfile>[]
): MatchedDoctor[] {
  const normalizedConcerns = concerns.map((c) => c.toLowerCase().trim());

  const scoredDoctors: MatchedDoctor[] = doctors.map((doc) => {
    const supported = (doc.supportedConditions || []).map((sc: string) =>
      sc.toLowerCase().trim()
    );
    const spec = (doc.specialization || "").toLowerCase();
    const bio = (doc.bio || "").toLowerCase();

    const matchedConditions: string[] = [];

    for (const concern of normalizedConcerns) {
      const isDirectMatch = supported.some(
        (sc: string) => sc.includes(concern) || concern.includes(sc)
      );
      const isSpecMatch = spec.includes(concern) || concern.split(" ").some((w: string) => w.length > 3 && spec.includes(w));
      const isBioMatch = bio.includes(concern);

      if (isDirectMatch || isSpecMatch || isBioMatch) {
        matchedConditions.push(concern);
      }
    }

    const uniqueMatched = Array.from(new Set(matchedConditions));
    const isRecommended = uniqueMatched.length > 0;
    
    // Calculate match score (base 75% + up to 24% boost)
    const matchScore = isRecommended
      ? Math.min(99, 85 + uniqueMatched.length * 7)
      : Math.floor(70 + Math.random() * 8);

    let recommendationReason = "";
    if (uniqueMatched.length > 0) {
      recommendationReason = `Specializes in ${doc.specialization || uniqueMatched[0]}`;
    } else {
      recommendationReason = `Specializes in ${doc.specialization || "Orthopedic Physical Therapy"}`;
    }

    return {
      clerkUserId: doc.clerkUserId || "",
      professionalName: doc.professionalName || "Physiotherapy Specialist",
      title: doc.title || "Doctor / Physiotherapist",
      qualification: doc.qualification || "MPT, BPT Certified",
      specialization: doc.specialization || "Orthopedic Rehabilitation",
      supportedConditions: doc.supportedConditions || [],
      yearsOfExperience: doc.yearsOfExperience || "8+ years",
      clinicName: doc.clinicName || "Swasthya Partner Clinic",
      consultationFee: doc.consultationFee || 499,
      rating: doc.rating || 4.9,
      reviewCount: doc.reviewCount || 50,
      languages: doc.languages || ["English", "Hindi"],
      availability: doc.availability || "Available Today",
      avatarUrl:
        doc.avatarUrl ||
        "https://images.unsplash.com/photo-1594824813589-f54460f997cb?auto=format&fit=crop&q=80&w=400",
      bio: doc.bio || "",
      isOnline: doc.isOnline ?? true,
      isRecommended,
      matchScore,
      recommendationReason,
      matchedConditions: uniqueMatched,
    };
  });

  // Sort: recommended first, then highest matchScore, then rating
  return scoredDoctors.sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return b.rating - a.rating;
  });
}
