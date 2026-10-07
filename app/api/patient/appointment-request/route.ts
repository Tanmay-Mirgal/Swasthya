import { NextResponse } from "next/server";

export function parseScheduledAt(
  requestedDate?: string | Date,
  requestedTime?: string
): Date {
  let base: Date;
  if (requestedDate instanceof Date) {
    base = new Date(requestedDate);
  } else if (typeof requestedDate === "string" && requestedDate.includes("-")) {
    const parts = requestedDate.split("-").map(Number);
    base = new Date(parts[0], parts[1] - 1, parts[2] || 1);
  } else if (requestedDate) {
    base = new Date(requestedDate);
  } else {
    base = new Date();
  }

  let hours = 10;
  let minutes = 0;

  if (requestedTime) {
    const timeMatch = requestedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const meridian = timeMatch[3]?.toUpperCase();
      if (meridian === "PM" && hours < 12) hours += 12;
      if (meridian === "AM" && hours === 12) hours = 0;
    }
  }

  base.setHours(hours, minutes, 0, 0);
  return base;
}

/** Appointments are booked through /api/payments/razorpay/{order,verify}; this unpaid path is closed. */
export async function POST() {
  return NextResponse.json({ error: "Appointments must be paid for when booking." }, { status: 410 });
}
