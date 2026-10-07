import "server-only";
import crypto from "node:crypto";

const API = "https://api.razorpay.com/v1";

export class PaymentConfigError extends Error {}

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new PaymentConfigError("Online payment is not set up yet. Please try again later.");
  // Test mode only for now: a live key must be opted into explicitly.
  if (!keyId.startsWith("rzp_test_") && process.env.RAZORPAY_ALLOW_LIVE !== "1") {
    throw new PaymentConfigError("Online payment is only enabled in test mode.");
  }
  return { keyId, keySecret };
}

export function razorpayKeyId(): string {
  return credentials().keyId;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const { keyId, keySecret } = credentials();
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(json.error?.description || `Razorpay request failed (${res.status})`);
  return json;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export function createOrder(params: { amountPaise: number; receipt: string; notes?: Record<string, string> }) {
  return call<RazorpayOrder>("/orders", { amount: params.amountPaise, currency: "INR", receipt: params.receipt, notes: params.notes });
}

/** Checkout returns a signature over `order_id|payment_id`, signed with the key secret. */
export function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = credentials();
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
}

/** Confirms with Razorpay that this payment belongs to the order and amount, and captures it if needed. */
export async function confirmPayment(paymentId: string, orderId: string, amountPaise: number): Promise<boolean> {
  let payment = await call<RazorpayPayment>(`/payments/${paymentId}`);
  if (payment.order_id !== orderId || payment.amount !== amountPaise) return false;
  if (payment.status === "authorized") {
    payment = await call<RazorpayPayment>(`/payments/${paymentId}/capture`, { amount: amountPaise, currency: "INR" });
  }
  return payment.status === "captured";
}

export function refundPayment(paymentId: string, amountPaise: number) {
  return call<{ id: string }>(`/payments/${paymentId}/refund`, { amount: amountPaise, notes: { reason: "Appointment not confirmed" } });
}
