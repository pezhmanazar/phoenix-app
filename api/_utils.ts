// /api/_utils.ts
import type { VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";

/* ---------- CORS ---------- */
export function setCORS(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/* ---------- helpers ---------- */
export function normalizePhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.startsWith("989") && digits.length === 12) return "0" + digits.slice(2);
  if (digits.startsWith("09") && digits.length === 11) return digits;
  if (digits.startsWith("9") && digits.length === 10) return "0" + digits;
  return null;
}
export const now = () => Date.now();

/* ---------- in-memory store (per instance) ---------- */
type ActiveOTP = { token: string; code: string; expiresAt: number; sentAt: number };
type OTPStore = { active: Map<string, ActiveOTP>; requests: Map<string, number[]> };
const g = globalThis as any;
if (!g.__otpStore) g.__otpStore = { active: new Map(), requests: new Map() } as OTPStore;
export const store: OTPStore = g.__otpStore;

/* ---------- rate limits ---------- */
export const COOLDOWN_MS = 30_000;
export const OTP_TTL_MS  = 120_000;
export const MAX_10MIN   = 5;
export const WINDOW_10MIN = 10 * 60_000;

export function pruneAndCount(phone: string, t: number) {
  const arr = store.requests.get(phone) || [];
  const fresh = arr.filter((x) => t - x <= WINDOW_10MIN);
  store.requests.set(phone, fresh);
  return fresh.length;
}
export function recordRequest(phone: string, t: number) {
  const arr = store.requests.get(phone) || [];
  arr.push(t);
  store.requests.set(phone, arr);
}
export function hasCooldown(phone: string, t: number) {
  const active = store.active.get(phone);
  return !!active && t - active.sentAt < COOLDOWN_MS;
}

/* ---------- JWT helpers ---------- */
export function signJwt(payload: any, secret: string, expiresInSec: number) {
  return jwt.sign(payload, secret, { expiresIn: expiresInSec });
}
export function verifyJwt(token: string, secret: string) {
  return jwt.verify(token, secret);
}